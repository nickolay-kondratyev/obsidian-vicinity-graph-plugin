# IMPLEMENTATION_REVIEW__PUBLIC — e2e slider value readout

Ticket `nid_14phm98g7w64oparxz5wvfqwh_e`. Branch `e2e-slider-value-readout`. Reviewer: IMPLEMENTATION_REVIEWER (read-only; no files under `e2e/` or `src/` were modified).

## Verdict

**READY** — merge after the two SHOULD-FIX items are applied or explicitly waived. No BLOCKING findings.

| Severity | Count |
|---|---|
| BLOCKING | 0 |
| SHOULD-FIX | 2 |
| NIT | 4 |

## Summary

One test added to `e2e/settingsUxVisual.e2e.ts` (lines 380-420: a 21-line WHY block plus the test at 401-420). It opens the plugin settings tab via the existing in-file `openSettingsTab()`, locates the "Outline depth" row, reads the slider's current value with `inputValue()`, hovers the slider, and asserts that value is visible as **rendered text** in either a body-level `.tooltip` (the ≤1.12.x mechanism) or inside the row's `.setting-item-control` (the ≥1.13 inline mechanism).

Diff is `e2e/` + `.ai_out/` docs only. `git diff main...HEAD -- src/` is **empty** — the temporary 3b probe was fully reverted, confirmed directly.

## 1. Does the test have teeth? — YES

I walked each escape hatch named in the brief:

- **`<input value=…>` attribute** — cannot satisfy it. Both arms match rendered text (`filter({hasText})` / `getByText`); an `<input>` has no text content. `inputValue()` is used only to *learn* the expected string, which is the right way round: it makes the assertion value-*tied*, so a readout showing a stale or wrong number also fails.
- **`aria-label` / `title`** — not matched by either arm.
- **Digit in the row name/description** — the inline arm is scoped to `.setting-item-control`; name and desc live in the sibling `.setting-item-info`. `getByText(value, {exact: true})` is exact, not substring. Cannot be satisfied.
- **Digit in the row name via the `.tooltip` arm** — the `.tooltip` arm uses an anchored regex `/^2$/`, so a longer tooltip string cannot match.
- **Empirically proven**: log `.tmp/3b.log` shows the union locator finding **neither** arm with `.setDynamicTooltip()` removed (`element(s) not found`, 15s timeout, EXIT=1). That is the real proof and it is genuine — I read the log file on disk, and the failure line/locator string exactly match the committed source.

The one residual hole is stale-`.tooltip` contamination — see SHOULD-FIX #1.

## 2. Flakiness — low, one cheap hardening missing

- Web-first assertion (`await expect(...).toBeVisible()`, 15s expect timeout). No sleeps. Correct.
- Locators are lazy, built before the hover and resolved at assertion time — correct ordering.
- `.first()` on the union avoids strict-mode ambiguity.
- Serial placement is right: it sits after the pill test and before the two controls-panel tests, which begin by closing the settings modal themselves — so this test leaving the modal open matches the file's existing contract.
- **Independently verified**: I ran `npm run test:e2e -- settingsUxVisual.e2e.ts` myself (`.tmp/rev-3c.log`) → **15 passed, EXIT=0**, new test at `:401`, and the following two tests (`:422`, `:438`) still green. So no observed leak either direction.

## 3. Future-proofing honesty — honest

The union is not a fig leaf. False-green risk on ≥1.13 is negligible: `.setting-item-control` for a slider row contains essentially only the `<input type=range>`, so there is no incidental text that could equal the value exactly. If 1.13 renders the readout outside `.setting-item-control`, the test goes **red**, which is a correct "a human must look" signal, not a silent pass. The PUBLIC doc says so plainly rather than claiming the untested arm is proven — that is the right kind of transparency.

The in-test WHY comment is genuinely good and names the exact regression, the `@deprecated` trap, and the reason for each shape choice. See SHOULD-FIX #2 for the one missing half of the loop.

## 🚨 CRITICAL / BLOCKING

None.

## ⚠️ SHOULD-FIX

### SF-1 — Reset the mouse before the hover (stale-tooltip + no-op-hover hardening)

`e2e/settingsUxVisual.e2e.ts:415` hovers without first clearing pointer state. Two consequences:

1. The `.tooltip` arm is **document-wide** and asserted only *after* the hover, so nothing establishes that the tooltip was produced *by this hover*. In this `mode: "serial"` file the mouse is left wherever test 12 put it. A tooltip left over from an earlier element whose text happens to be exactly the outline-depth value would false-green. Probability is low today (the value is `2`), but it is real and it degrades silently as tests are added above.
2. If the mouse already sits at the slider's centre, Chromium may not re-dispatch `mouseover`, so `hover()` becomes a no-op — a latent flake source as neighbouring tests change.

**Fix** (one line, no downside, does *not* reintroduce the 1.13 pre-hover-assertion problem, because it is an action, not an assertion):

```ts
// Clear pointer state first: `.tooltip` is body-level and this file is serial,
// so a tooltip left by an earlier test must not be able to satisfy the assertion.
await page.mouse.move(0, 0);
await slider.hover();
```

### SF-2 — Point the production WHY doc at the guarding test

`src/view/VicinityGraphSettingTab.ts:462-467` carries an excellent WHY for keeping `setDynamicTooltip()`, but does **not** name the test that now guards it. The next maintainer tempted by the `@deprecated` tag reads the *source*, not the e2e file. Close the loop:

```
 * @see e2e/settingsUxVisual.e2e.ts — "WHEN a slider is hovered THEN its current
 *      value is readable" is the test that catches this removal.
```

Comment-only change to a production file; it does not alter behaviour, so it does not violate the "no production change" scope in any meaningful way. If the workflow forbids touching `src/` at this stage, file it as a follow-up ticket rather than dropping it.

## 💡 NITs

- **N-1 — unescaped interpolation into a regex.** `new RegExp(`^${value}$`)` (line 410). Safe for the integer Outline depth value, but if this test is ever repointed at a decimal-step force-layout slider, `^0.5$` would also match `015`. Escape the value, or drop the regex in favour of asserting `toHaveText(value)` on the tooltip.
- **N-2 — hover state leaks out.** The test ends with the mouse on the slider and the settings modal open. Benign today (observed green twice, and the following tests close the modal by design), but a trailing `await page.mouse.move(0, 0)` would make it self-contained. Optional — SF-1's leading reset is the higher-value half.
- **N-3 — on ≥1.13 the test name becomes partly nominal**: the inline readout is present before any hover, so "WHEN a slider is hovered" would pass even if hover did nothing. This is an accepted consequence of mechanism-agnosticism and is already documented in the WHY block. Acceptable.
- **N-4 — doc drift.** `IMPLEMENTATION_WITH_SELF_PLAN__PRIVATE.md:36` says the test is at `380-404`; it is at `401-420` (`380-420` including the comment, as the PUBLIC doc correctly states). Cosmetic.

## 4. Conventions — compliant

- BDD `WHEN … THEN …` naming, matching the newest test in the file (line 198). One behaviour, one assertion.
- Reuses the in-file `openSettingsTab()`; no helper extracted (correct per the per-file duplication convention).
- Comments are WHY / WHY-NOT, not WHAT — including an explicit WHY-NOT for the omitted pre-hover precondition and a WHY for choosing the non-advanced "Outline depth" slider. This is exactly the CLAUDE.md documentation standard.
- No magic values: the expected string is derived from the live control, not hardcoded.

## 5. Scope & regression safety — clean

- No production behaviour changed (`git diff main...HEAD -- src/` empty).
- No existing test removed, weakened, or renamed; no `ap_XXX_E` anchor touched.
- `.tmp/3b.log`'s probe was reverted; `setDynamicTooltip()` is present at `src/view/VicinityGraphSettingTab.ts:484` with its WHY doc at 456-468 intact.

## 6. Verification claims — plausible and independently confirmed

| Claim | Status |
|---|---|
| 3a new test alone PASS | Taken on trust (`.tmp/3a.log` present and consistent) |
| 3b RED without `setDynamicTooltip()` | Taken on trust — but `.tmp/3b.log` is on disk with a locator string that byte-matches the committed source, so it is credible, not fabricated |
| 3c whole file 15/15 | **Re-run by me**: `npm run test:e2e -- settingsUxVisual.e2e.ts` → 15 passed, EXIT=0 (`.tmp/rev-3c.log`) |
| 3d `npm run check` / `npm test` 966 tests | Taken on trust (`.tmp/3d-*.log` present); the e2e run I did includes `tsc -p e2e/tsconfig.json` as a gate, which passed |

The suspiciously short wall-clock totals ("15 passed (3.3s)") reproduced **identically** in my own run, so they are a property of how this harness reports (Obsidian boot happens in `beforeAll` outside the reported total), not a sign of a faked log. I flagged and cleared this.

## Documentation Updates Needed

- Ticket `nid_14phm98g7w64oparxz5wvfqwh_e` is still **open** — close it on merge.
- No `change_log` entry is present in the diff; recent branch history (e.g. `2631465`) establishes that as the convention for a merged unit of work.
- No `CLAUDE.md` change needed.
