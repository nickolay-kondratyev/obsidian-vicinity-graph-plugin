# IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC — e2e-slider-obsidian-113-verify

Scope executed: the three items handed to me. The 1.13 build verification itself was
**not attempted** — it is BLOCKED per TOP_LEVEL_AGENT.md and explicitly out of scope.
`OBSIDIAN_VERSION` is untouched.

## Plan (as executed)

**Goal**: a future 1.13 red on the slider value-readout test must self-diagnose as
"our locator missed" vs "the product regressed", without softening the assertion.

1. Add a best-effort DOM-capture helper local to the spec.
2. Wrap the union assertion in try/catch → enrich → re-throw (never swallow).
3. Truth-up the WHY block (inline arm unverified, exact evidentiary basis).
4. Add a 1.13-bump warning to `setup-obsidian-bin.sh`.
5. Verify: `check`, `test`, real e2e; plus a perturbation run to prove the diagnostic fires.

## Changes

### 1. `e2e/settingsUxVisual.e2e.ts` — self-diagnosing failure (PRIMARY)

- New `READOUT_DIAGNOSTIC_TIMEOUT_MS = 1_000` and `sliderReadoutDiagnostic(row, expectedValue)`.
  Captures, each independently best-effort (a read that throws degrades to
  `UNREADABLE: …`, never masking the real failure):
  - `expected value` — the string both arms were built from;
  - `body .tooltip texts` (via `allTextContents()`, no waiting) — empty list ⇒ the 1.12
    tooltip arm had nothing at all to match;
  - row `.setting-item-control` **innerText** and **innerHTML** — the inline arm's scope;
  - the **whole row html** — because "rendered, but OUTSIDE `.setting-item-control`" is a
    scoping bug in the inline arm and is invisible in the two captures above.
- The assertion is now wrapped in `try/catch`; the catch throws a new `Error` whose message
  states the two mechanisms, tells the reader that a value visible in the dump means a
  test-locator problem, appends the diagnostic, and appends `cause=[…]` with the original
  Playwright error (verbatim locator + call log).

**Assertion semantics unchanged**: the locator union, the exact-match regex, `.first()`, the
`hover()` and the `mouse.move(0,0)` reset are all byte-identical. Nothing was broadened. The
test goes red in exactly the cases it went red before — only the message is richer.

**Why `cause=[…]` in the message and not `new Error(msg, { cause })`**: `tsconfig` targets
ES2021, where `ErrorOptions` is not in lib; and `e2e/obsidianHarness.ts:663-668` already
establishes the `cause=[${String(error)}]` pattern in this suite. Consistency + compiles.

**Timeout budget**: unchanged on the happy path (zero cost — the catch never runs). On the
failing path the single 15s expect timeout is followed by at most ~3s of capped 1s reads.
No stacked long timeouts.

### 2. `e2e/settingsUxVisual.e2e.ts:399-419` WHY block — truth-up

Appended six lines recording that as of **2026-07-26** only the `.tooltip` arm is verified;
1.13 is not GA (newest public release 1.12.7, 1.13.x Catalyst-gated); and that the inline
arm's entire basis is one line of `obsidian.d.ts`:

> `@deprecated The value is now always shown inline next to the slider.`

explicitly noting it names **no selector, no ancestry and no number formatting** — "it is a
reasoned guess" — and pointing at the new catch. Existing prose was left intact; it was
already tight and non-redundant with the addition, so there was nothing to cut without
losing content.

### 3. `src/view/VicinityGraphSettingTab.ts:456-471` — **NO CHANGE** (reported, as instructed)

The existing WHY doc already says exactly the right thing and does **not** suggest removal is
imminent or safe: *"Our floor is `minAppVersion` 1.12.4 (e2e pins 1.12.7) … Removing it
silently blanks the value on every supported build below 1.13. Drop it only when
`minAppVersion` reaches 1.13.0."* It states a gating condition, not a plan. Touching it
would have been churn. `setDynamicTooltip()` STAYS.

### 4. `scripts/setup-obsidian-bin.sh` — 4-line note under the existing "Bump deliberately"

Warns a future bumper that 1.13+ switches the slider readout e2e to a second, never-verified
matching arm, and that a red there is likelier a locator miss than a regression. `OBSIDIAN_VERSION`
itself unchanged (`1.12.7`).

## Verification

Verbatim result lines:

```
check exit=[0]
 Test Files  74 passed (74)
      Tests  990 passed (990)
test exit=[0]
```

Real e2e against the cached 1.12.7 binary, `npm run test:e2e -- settingsUxVisual.e2e.ts`:

```
e2e exit=[0]
  16 passed (3.5s)
```

### Perturbation check — the diagnostic was OBSERVED firing

Temporarily replaced `const value = await slider.inputValue();` with `const value = "999999";`
(impossible value ⇒ both arms miss), ran the real e2e, then reverted. `git diff --stat` after
revert confirms only the two intended files changed.

Captured message, **verbatim** from `.tmp/e2e-perturbed.log`:

```
    Error: Slider value is not readable by EITHER mechanism (body .tooltip, or inline text in the row's .setting-item-control). If the value IS present below but we did not match it, this is a test-locator problem — most likely the 1.13 inline readout differing in placement or number formatting from what the union guesses. See the WHY block above this test.
      expected value=[999999]
      body .tooltip texts=[["2"]]
      row .setting-item-control text=[]
      row .setting-item-control html=[<input class="slider" type="range" data-ignore-swipe="true" min="1" max="6" step="1" aria-label="Outline depth">]
      row html=[<div class="setting-item-info"><div class="setting-item-name">Outline depth</div><div class="setting-item-description">How many heading levels a note's outline shows inside its node.</div></div><div class="setting-item-control"><input class="slider" type="range" data-ignore-swipe="true" min="1" max="6" step="1" aria-label="Outline depth"></div>]
      cause=[Error: expect(locator).toBeVisible() failed

    Locator: locator('.tooltip').filter({ hasText: /^999999$/ }).or(locator('.vicinity-graph-settings .setting-item').filter({ has: locator('input[aria-label="Outline depth"]') }).locator('.setting-item-control').getByText('999999', { exact: true })).first()
    Expected: visible
    Timeout: 15000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 15000ms
      - waiting for locator('.tooltip').filter({ hasText: /^999999$/ }).or(locator('.vicinity-graph-settings .setting-item').filter({ has: locator('input[aria-label="Outline depth"]') }).locator('.setting-item-control').getByText('999999', { exact: true })).first()
    ]
```

This is precisely the intended discrimination: `body .tooltip texts=[["2"]]` shows at a glance
that the value **is** rendered and only our expectation was wrong — the "locator problem, not a
regression" verdict is readable without opening a debugger. Had the value genuinely been
unrendered, that field would read `[]` and the row html would show no digit anywhere.

## Deliberately NOT done

- **No 1.13 download / asar patching / synthesised DOM.** Both rejected approaches in
  TOP_LEVEL_AGENT.md and EXPLORATION_PUBLIC.md were left alone.
- **No `OBSIDIAN_VERSION` bump** and no `minAppVersion` change.
- **No shared e2e helper / diagnostic framework.** One test has this problem; a page-object or
  generic "explain this union" utility would be speculative generality (80/20). Local helper.
- **No new unit test for the diagnostic.** It is a failure-path formatter in an e2e spec whose
  only real substrate is a live Obsidian DOM; the perturbation run above is the honest
  verification and a mocked one would assert against my own guess.
- **No edit to `VicinityGraphSettingTab.ts`** — see item 3.
