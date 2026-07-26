# IMPLEMENTATION_REVIEWER__PUBLIC — e2e-slider-obsidian-113-verify

Reviewed: commit `8d8fe32` ("test(e2e): make slider value-readout failure self-diagnosing")
against its parent `bcc28b5`. Source files touched: `e2e/settingsUxVisual.e2e.ts`,
`scripts/setup-obsidian-bin.sh`.

# VERDICT: READY — 0 BLOCKING findings.

Scope note (accepted, not a fault): the ticket's acceptance criterion — green on a real
Obsidian >= 1.13 — is BLOCKED on an external dependency per `TOP_LEVEL_AGENT.md`. The
delivered scope is deliberately narrower. Neither rejected approach (asar-swap, synthesised
1.13 DOM) appears anywhere in the diff. Confirmed by reading the commit in full.

## Summary

The union assertion `expect(valueReadout.first()).toBeVisible()` is wrapped in a `try/catch`
that captures the row's DOM and re-throws an enriched `Error`. A WHY block is extended with
the "inline arm is unverified" truth-up, and `scripts/setup-obsidian-bin.sh` gains a 4-line
warning for a future `OBSIDIAN_VERSION` bumper. No production code touched.

## 1. Assertion NOT weakened — verified mechanically

I extracted the whole test body from both revisions and diffed them after substituting only
the `try { … } catch { … }` scaffolding. Result: **byte-identical**.

```
assertion-context identical after removing only the try/catch wrapper: True
test() count parent=[16] current=[16]
```

Specifically unchanged: the `.tooltip` + `hasText: exactly` arm, the regex-escaped `^…$`
exact match, the `.or(...)` inline arm scoped to `.setting-item-control` with
`getByText(value, { exact: true })`, `.first()`, the `page.mouse.move(0, 0)` reset **before**
`slider.hover()`, and the 15 000 ms `expect` timeout (config-level, untouched). Nothing was
broadened; the set of DOM states that go red is identical.

No test was removed (16 → 16) and no `ap_XXX_E` anchor is touched.

## 2. Failure NOT swallowed — verified by independent perturbation

I re-ran the perturbation myself (`const value = "999999"`, then `git checkout --` to
restore; working tree confirmed clean afterwards). Observed:

```
✘  14 … WHEN a slider is hovered THEN its current value is readable (15.1s)
1 failed
perturbed e2e exit=[1]
```

Every path through the new code still fails:

- The `catch` block's only statement is `throw`. There is no branch that returns normally,
  no `.catch(() => …)`, no conditional re-throw.
- The diagnostic cannot mask the original: each field goes through `capture()`, which
  wraps `await read()` in its own try/catch and degrades to `UNREADABLE: …`. The only code
  outside a `capture()` is `row.locator(…)` (synchronous, non-throwing), a string
  interpolation and `Array.join` — none can throw.
- The original Playwright error is preserved verbatim, including locator and call log, via
  `cause=[${String(error)}]`. The string form (rather than `new Error(msg, { cause })`) is
  correct here: `tsconfig` targets ES2021 where `ErrorOptions` is not in lib, and
  `e2e/obsidianHarness.ts:667` already establishes this exact pattern. Consistent.

Observed enriched message reproduces the IMPLEMENTATION report exactly, including the
discriminating field `body .tooltip texts=[["2"]]` — i.e. "value is rendered, our expectation
was wrong", which is precisely the 1.13 case this change exists for.

## 3. Timeout budget — no stacking

- Happy path: zero added cost (catch never runs). My clean run: `16 passed (3.4s)`.
- Failure path: the failing test took **15.1 s** against a 15 000 ms `expect` timeout —
  i.e. the diagnostic added ~0.1 s, not seconds. The three DOM reads are individually capped
  at `READOUT_DIAGNOSTIC_TIMEOUT_MS = 1_000`; the `.tooltip` read uses `allTextContents()`,
  which does not wait at all.
- Worst case ≈ 15 s + 3 s against a 120 000 ms `timeout` in `e2e/playwright.config.ts`, so
  the test-level timeout can never fire mid-diagnostic and discard the enriched message.

## 4. Honesty of the claims — all reproduce

| Claim | My re-run | Result |
|---|---|---|
| `npm run check` PASS | `.tmp/rev-check.log` | `check exit=[0]` |
| `npm test` 74 files / 990 tests | `.tmp/rev-test.log` | `74 passed (74)` / `990 passed (990)`, exit 0 |
| `npm run test:e2e -- settingsUxVisual.e2e.ts` 16 passed | `.tmp/rev-e2e.log` | `e2e exit=[0]`, `16 passed (3.4s)` |
| Enriched failure OBSERVED | `.tmp/rev-e2e-perturbed.log` | reproduced verbatim |

No `sanity_check.sh` exists in this repo.

Perturbation **is** reverted in the commit: `grep -n "TEMP-PERTURBATION\|999999"` on
`e2e/settingsUxVisual.e2e.ts` returns nothing, and no debug scaffolding (`console.log`,
`test.only`, `.skip`) was added by the diff.

`OBSIDIAN_VERSION="1.12.7"` (`scripts/setup-obsidian-bin.sh:31`) and
`manifest.json` `minAppVersion: "1.12.4"` are both untouched — `git diff main -- manifest.json`
is empty.

## 5. Quality

- **SRP**: `sliderReadoutDiagnostic` does one thing (capture the DOM for one failure), and
  the inner `capture` isolates "best-effort read" as its own concern. Good separation.
- **Placement/DRY**: module-scope helper declared immediately above its test — this is the
  file's established convention (`toolbar`, `disclosure`, `setOpen`,
  `topLevelPanelSummaries`, `seedPreviewPreference` all do the same). Not extracting to
  `e2e/` shared code is right at one call site; a generic "explain this union" utility would
  be speculative generality.
- **No magic numbers**: `READOUT_DIAGNOSTIC_TIMEOUT_MS` is named and justified.
- **WHY block truth-up**: six added lines, each carrying non-obvious information (1.13 not
  GA, the single `obsidian.d.ts` line that is the arm's entire basis, and that it names no
  selector/ancestry/formatting). Accurate against `EXPLORATION_PUBLIC.md`. Not bloat.
- **`setup-obsidian-bin.sh` note**: earns its space. It sits exactly where a bumper looks
  (immediately under "Bump OBSIDIAN_VERSION deliberately") and answers the one question that
  red will raise. Four lines.

## 🚨 CRITICAL / BLOCKING

None.

## ⚠️ SHOULD-FIX

None.

## 💡 NICE-TO-HAVE (do not block the merge)

1. `row .setting-item-control html` is strictly a substring of `row html` — two of the four
   captured fields overlap, as the observed output shows. Dropping the control-scoped **html**
   field (keeping the control-scoped **innerText**, which is genuinely different information)
   would shorten the dump with no loss. Marginal.
2. The docblock on `READOUT_DIAGNOSTIC_TIMEOUT_MS` is three lines for a 1 s constant. Fine as
   WHY content; only mentioned because it is the one place the comment-to-code ratio is high.

## Documentation Updates Needed

None from this commit. The ticket `nid_zylnmqz76ftecuqpavnnu1byt_e` must stay OPEN with the
blocking-feasibility evidence and a re-check trigger (TOP_LEVEL_AGENT already owns this per
its flow log) — closing it would misrepresent an unmet acceptance criterion.
