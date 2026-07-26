# IMPLEMENTATION_PUBLIC — e2e: assert settings-tab sliders show their value

Ticket `nid_14phm98g7w64oparxz5wvfqwh_e`. Branch `e2e-slider-value-readout`.

## Plan (as executed)

**Goal**: one e2e test that goes RED on the pinned 1.12.7 runtime if `setDynamicTooltip()` is
dropped from `addLabeledSlider`, and that neither false-greens nor false-reds after a
`minAppVersion` bump to >= 1.13.0.

**Steps**: (1) insert the test into `e2e/settingsUxVisual.e2e.ts` after the preview-pill test and
before the two controls-panel tests (serial mode). (2) run it. (3) delete `setDynamicTooltip()`,
prove RED, restore. (4) whole-file run. (5) `npm run check` + `npm test`. (6) commit.

## Strategy chosen: (a) mechanism-agnostic, TEXT-only, asserted AFTER hover

The test hovers the "Outline depth" slider (non-advanced — the advanced force-layout sliders are
inside a collapsed `<details>` and cannot be hovered) and asserts that the slider's *current*
value, read at runtime via `inputValue()`, is **visible as rendered text** in either

- a body-level `.tooltip` whose text matches `/^<value>$/` (the 1.12.x mechanism), **or**
- the row's own `.setting-item-control`, exact text match (the >= 1.13 inline mechanism).

**Why (a) and not the explicit version gate**: exploration §5 established that no verified way to
read the running Obsidian version exists in this repo — both candidate expressions
(`require("obsidian").apiVersion`, `app.appVersion`) are unverified, and an unverified gate is
exactly the false-green the ticket is about. A gate would also need a second branch asserting a
1.13 behaviour nobody here can execute. The union locator needs no version knowledge: on any
supported build, at least one of the two readouts is present, and on a build with neither, the
value is genuinely unreadable — which is the regression.

**Why it cannot be satisfied by the traps**:
- the `<input value=…>` attribute — the assertion matches *rendered text*; `getByText` /
  `hasText` never see an input's value. (`inputValue()` is used only to learn what to look for.)
- a digit in the row's name/desc — the inline arm is scoped to `.setting-item-control`, while the
  name and description live in the sibling `.setting-item-info`; and the match is exact/anchored,
  not substring.
- proven empirically by step 3b below: with `setDynamicTooltip()` gone the locator finds nothing.

**Why NO "hidden before hover" precondition** (deliberate omission, documented in the test's WHY
comment): from 1.13 the inline readout is rendered before any hover, so such a precondition would
fail after a `minAppVersion` bump for a reason that is not a regression. It is not needed for
teeth. `.first()` is used for the same reason: a 1.13 build may render both readouts.

The test also carries the WHY comment a future maintainer needs: this is the exact spot that a
reader of the 1.13 `@deprecated` tag will be tempted to "clean up" again.

## What changed

- `e2e/settingsUxVisual.e2e.ts:380-420` — new block: a 21-line WHY comment (380-399) plus the test
  `settings tab: WHEN a slider is hovered THEN its current value is readable` (401-420), inserted
  between the preview-pill colour test and the first controls-panel test, per exploration §1.
- Reuses the in-file `openSettingsTab()` (no shared helper extracted, per exploration §3).
- **No production change.** `src/view/VicinityGraphSettingTab.ts` was touched only by the temporary
  probe in 3b and restored with `git checkout` (verified: `setDynamicTooltip()` present at line 484,
  its WHY doc at 456-468 intact).

## Verification (verbatim)

### 3a — new test alone, `setDynamicTooltip()` PRESENT → PASS
```
Running 1 test using 1 worker
  ✓  1 e2e/settingsUxVisual.e2e.ts:401:1 › settings tab: WHEN a slider is hovered THEN its current value is readable (95ms)
  1 passed (1.3s)
```
(`npm run test:e2e -- settingsUxVisual.e2e.ts -g "WHEN a slider is hovered"`, EXIT=0)

### 3b — `.setDynamicTooltip()` line REMOVED → FAIL (this is the proof of teeth)
```
  ✘  1 e2e/settingsUxVisual.e2e.ts:401:1 › settings tab: WHEN a slider is hovered THEN its current value is readable (15.1s)

  1) e2e/settingsUxVisual.e2e.ts:401:1 › settings tab: WHEN a slider is hovered THEN its current value is readable

    Error: expect(locator).toBeVisible() failed

    Locator: locator('.tooltip').filter({ hasText: /^2$/ }).or(locator('.vicinity-graph-settings .setting-item').filter({ has: locator('input[aria-label="Outline depth"]') }).locator('.setting-item-control').getByText('2', { exact: true })).first()
    Expected: visible
    Timeout: 15000ms
    Error: element(s) not found
  1 failed
```
(EXIT=1. Note the union locator found NEITHER arm — confirming the inline/attribute/row-text paths
cannot rescue it on 1.12.7.) The line was restored immediately (`git checkout` on the file) and the
green re-confirmed by 3c below.

### 3c — whole file, line restored → 15/15 PASS (14 pre-existing + the new one)
```
  ✓   1 … panel defaults: every section is a disclosure, only Depth starts open (138ms)
  ✓   2 … exclusion toggle switches on, shows patterns state, and persists (288ms)
  ✓   3 … force layout: 7 sliders, live write, restore defaults (227ms)
  ✓   4 … settings tab renders six framed section cards with plugin CSS applied (279ms)
  ✓   5 … settings tab: every section card ends with its own scoped restore row (111ms)
  ✓   6 … WHEN the tab renders THEN every input carries its row name as accessible name (39ms)
  ✓   7 … settings tab: a section restore resets ONLY that section (60ms)
  ✓   8 … settings tab: restore-all asks first, then resets every section (292ms)
  ✓   9 … the Preview pill shows one segment per option and checks the stored one (52ms)
  ✓  10 … clicking a Preview segment persists the new preference (55ms)
  ✓  11 … the segmented-control stylesheet reaches the settings modal DOM (25ms)
  ✓  12 … the selected Preview segment is filled distinctly from the trough (321ms)
  ✓  13 e2e/settingsUxVisual.e2e.ts:401:1 › settings tab: WHEN a slider is hovered THEN its current value is readable (71ms)
  ✓  14 … controls panel: clicking its Preview segment writes the SAME global the tab writes (62ms)
  ✓  15 … controls panel: the pill re-checks itself from the rebuilt snapshot (10ms)
  15 passed (3.3s)
```
(EXIT=0 — the new test does not perturb the serial ordering.)

### 3d — static checks + unit suite
```
CHECK_EXIT=0      (npm run check → tsc -noEmit)
E2E_TSC_EXIT=0    (npx tsc -p e2e/tsconfig.json)
TEST_EXIT=0       (npm test)
 Test Files  72 passed (72)
      Tests  966 passed (966)
```

## Risks / open questions

- The `.tooltip` arm is asserted only against the pinned 1.12.7 binary; the inline arm is written
  from the 1.13 typings' `@deprecated` note and has **never been executed**. If 1.13 renders the
  value outside `.setting-item-control`, the test goes red on the bump — a *correct* red in the
  sense that a human must then look, but it is an untested branch. Documented in the WHY comment
  ("a future minAppVersion bump needs no edit here" is the intent, not a proof).
- The test asserts one slider ("Outline depth"). All 10 sliders go through the single
  `addLabeledSlider` builder, so one is representative; a slider added outside that builder would
  not be covered. That is the same coverage shape as the existing accessible-name test.
- No new e2e helper was introduced; if a third spec ever needs the readout locator, the per-file
  duplication convention (exploration §3) should be revisited deliberately.
