# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory

Ticket: `nid_ek3wrqoh1rsftk6ulg836mghf_e` — e2e: no spec types into a settings-tab text/number input.
Branch: `nid_ek3wrqoh1rsftk6ulg836mghf_e_2026-07-29T23-30-55PDT`.

## Verified facts (re-checked, not just trusted from EXPLORATION_PUBLIC.md)

- `SETTINGS_WRITE_DEBOUNCE_MS = 400` in `src/view/constants.ts:29`. That module has NO imports
  (pure) ⇒ safe to import from the e2e node process.
- `src/view/settingsRows.ts` is pure data; exports `settingsRowsFor(kind)`, `SettingsRowNames.sole(row)`,
  `SETTINGS_GROUPS`. `e2e/settingsBaseline.ts` already imports it ⇒ precedent for pulling labels from
  the declared model.
- `src/view/settingsValidation.ts` exports `describeInvalidExclusionPatterns(raw)` and
  `describeSizingRejection(sizing)` — PURE (imports `PathExclusionMatcher` from the pure engine) ⇒
  the spec can COMPUTE the expected message instead of hand-typing it. This is the key to
  "never hand-type copy".
- `src/view/sizingRowWrite.ts`: `judge()` is cross-field only for `minPx`/`maxPx`; a rejected value
  ⇒ `debounced.drop(name)` ⇒ NOTHING is ever scheduled for that field.
- `clampSizingNumber` clamps into range only — NO step rounding. So an in-range typed number is
  stored verbatim (maxPx range `{min:1,max:400,step:4}`, default 160; minPx default 40;
  depthDecayK `{default:1,min:0,max:10,step:0.5}`).
- Feedback slot: `setting.descEl.createDiv({ cls: "vicinity-graph-settings-error", attr: { role } })`
  ⇒ it lives INSIDE Obsidian's `.setting-item-description`, inside `.setting-item`. `role="alert"`
  for sizing numbers, `role="status"` for exclusion patterns. `aria-invalid` goes on the INPUT.
- CSS `src/view/settings-tab.css`: `color: var(--text-error)`, `white-space: pre-line`,
  `:empty { display: none }`.
- `selectorGuard.test.ts`: `.vicinity-graph-settings-error` IS rendered in
  `VicinityGraphSettingTab.ts` ⇒ dotted selector allowed.
- `harness.saveGlobalView` writes through the LIVE `pluginDataStore`, so the tab's
  `store.globalView()` sees a seeded value immediately (only the rendered rows need `redisplay()`).
- playwright config: `testMatch **/*.e2e.ts`, `expect.timeout: 15_000`, workers 1, serial.

## The debounce-window pattern (the design decision that mattered)

Two different needs, and only one of them can be a plain poll:

1. "the typed edit DID persist" → `expect.poll(() => harness.readGlobalView()...)`. Web-first,
   no sleep. Trivial.
2. "the REJECTED edit did NOT persist" → an absence claim. Polling cannot prove absence, and a
   `waitForTimeout(400+margin)` is the hack the ticket forbids.

Chosen solution: a **sentinel edit barrier**, `SettingsWriteWindow.drain()`.
`DebouncedSettingsWrites` keeps ONE shared settle window for all fields and drains ALL pending
thunks together. So: after the rejected keystroke, type a valid value into a DIFFERENT debounced
row (`Depth decay k` — a sizing-number with no cross-field rule) and poll until THAT value is in
`data.json`. Observing the sentinel persisted proves the shared window opened and drained AFTER the
rejected keystroke ⇒ had the rejected value been scheduled, it would have landed too. A genuine
happens-after ordering, zero wall-clock dependence, and it doubles as a positive control that
`.fill()` really drives the pipeline.

`SETTINGS_WRITE_DEBOUNCE_MS` is still imported and used — as the documented *reason* the barrier
exists and as the `expect.poll` interval/timeout budget derived from it (`intervals`, `timeout`),
never as a `sleep`.

Sentinel value alternates between two in-bounds values derived from the accessor bounds
(`bounds.min` and `bounds.min + bounds.step` = 0 and 0.5) so repeated `drain()` calls always
CHANGE the stored number (a no-op write would be an invisible barrier).

### Rejected alternatives
- `page.waitForTimeout(SETTINGS_WRITE_DEBOUNCE_MS + margin)` — a sleep, forbidden, and masks races.
- calling the tab's private `settlePendingWrites()` via `page.evaluate` — deterministic, but it
  tests the barrier we install rather than the window the user experiences, and it bypasses the
  very debounce the ticket wants covered. Kept as a NOTE, not used.
- timing assertion for the `hide()` flush (`persisted within < 400ms of the keystroke`) —
  REJECTED: the margin is 400ms on a container that also runs Electron; a flaky release gate is
  worse than an honest weaker claim. See the WHY-NOT in the spec.

## Plan / progress

1. [x] Extend `e2e/settingsTabPage.ts`: `root()`, `control(name)`, `rowHolding(name)`,
       `feedbackUnder(name)` (scoped through `.setting-item-description` so "under the row" is
       part of the assertion), `typeInto(name, text)`.
2. [x] DRY: `e2e/settingsDependentRows.e2e.ts` had module-local `settingsRoot/control/rowHolding`
       copies — delegate them to the page object (identical selectors, no behavior change).
3. [x] New `e2e/settingsWriteWindow.ts` — `SettingsWriteWindow` (the reusable named pattern).
4. [x] New `e2e/settingsTypedInput.e2e.ts` — the spec.
5. [x] `npm run check` → `.tmp/check.log` — EXIT 0
6. [x] `npm test` → `.tmp/test.log` — EXIT 0, 94 files / 1245 tests passed
7. [x] `npm run test:e2e -- settingsTypedInput.e2e.ts` → `.tmp/e2e.log` — **11 passed (4.4s)**,
       real Obsidian, ran fine in this container (the pinned binary was already resolvable)
8. [x] `npm run test:e2e` (FULL suite, because step 2 touched an existing spec) → `.tmp/e2e-full.log`
       — **106 passed (59.2s)**
9. [x] committed `7170c24`

## Test list in the spec

1. valid max typed → persists once the window drains (positive control + pattern demo)
2. inverted max typed → the rejection is VISIBLE under the row, with the message
   `describeSizingRejection` computes
3. inverted max typed → the input is marked `aria-invalid`
4. inverted max typed → the value is NOT persisted (uses `drain()`)
5. invalid regex line typed → the feedback NAMES the line (message from
   `describeInvalidExclusionPatterns`)
6. invalid regex line typed → the line is still persisted verbatim (documented policy)
7. `.vicinity-graph-settings-error` styling: `white-space: pre-line` + `color` resolves to
   `var(--text-error)` (probe element resolves the theme var) + an empty slot is `display:none`
8. settings window closed right after a typed edit → the edit is not lost

## Gotchas hit
- `noUncheckedIndexedAccess`: `settingsRowsFor(...)` returns a readonly array; every `[0]`/`find`
  must be unwrapped with an explicit throw (the repo's own idiom — see `METRIC_UNDER_TEST` in
  `settingsDependentRows.e2e.ts`).
- The exclusion textarea is DISABLED unless the exclusion toggle is on ⇒ seed
  `saveNodeExclusion({enabled:true, ...})` + `redisplay()` in the GIVEN.
- Obsidian's settings window is itself a `.modal-container`.
- `card("Node sizing")` uses `hasText` (substring) — the minPx/maxPx/depthDecayK rows are all in
  it, so row scoping MUST go through `rowHolding(accessibleName)`, not the card.

## Observation worth keeping (from the real run)

Test 11 ("closed right after a typed edit") settled in **46ms**, while the two tests that wait out
the real window settle in ~900ms. That is empirical evidence `hide()`'s flush is genuinely doing
the work (the 400ms timer would have shown as ~400ms+). It is deliberately NOT asserted — see the
WHY-NOT in the spec — but it is why I am comfortable the test is not vacuous in practice.

## Iteration 1 (review response) — what changed and what I MEASURED

The MAJOR was right: the close test could not fail. I did NOT take the "reword and file a
follow-up" route — I made both flush claims falsifiable and then PROVED it by mutation.

`SettingsWriteWindow.expectFlushedAheadOfWindow(editAndLeave, read, expected, message)`:
- takes the ACTION, not a start time, so "clock starts before the keystroke" is structural.
- SOUNDNESS does not depend on the margin: the fallback is `setTimeout(…, 400)` armed at the
  keystroke, and `setTimeout` may fire late, never early ⇒ anything under one whole window
  cannot be the timer, at any load. Budget = 0.75 × window = 300ms is pure anti-flake headroom.
- polls at 10ms (default first interval is 100ms = a third of the budget spent on detection).

MEASURED, real Obsidian in this container:
- `--repeat-each=5` → **75/75 passed (1.5m)**, flush latency **12,13,13,14,14,14,14,15,16,16 ms**
  (both flush tests, 5 repeats each). ~20x margin. Not flaky.
- MUTATION 1 (blur flush removed): blur test **FAILS at 415ms**. ✔ falsifiable.
- MUTATION 2 (only `hide()` flush removed): close test still **passes at 16ms** — closing the
  window BLURS the focused field first, so `flushOnBlur` gets there. Worth knowing.
- MUTATION 3 (BOTH removed): close test **FAILS at 414ms**. ✔ falsifiable, at the outcome level.
- `git checkout src/view/VicinityGraphSettingTab.ts` after each; tree verified clean.

So the close test's honest claim is "leaving the window does not cost the keystroke", which is
the product's promise; it deliberately does NOT isolate `hide()` from `flushOnBlur` (that would
be testing the implementation, and the second belt is a feature). Said so in the test comment.

Other findings: #2 reworded `data.json` → "settings store" + added ONE `reloadPlugin()` round
trip (last test, since it replaces the plugin instance). #3 three contract bullets on `drain()`.
#4 `givenNoWriteStillPending()` at the top of both GIVENs. #5 white-space moved to the exclusion
slot with a genuinely 2-line message + `toContainText("\n")`. #6 two role tests. Nothing rejected.

## Commands
```bash
mkdir -p .tmp
npm run check > .tmp/check.log 2>&1
npm test > .tmp/test.log 2>&1
npm run test:e2e -- settingsTypedInput.e2e.ts > .tmp/e2e.log 2>&1
```
