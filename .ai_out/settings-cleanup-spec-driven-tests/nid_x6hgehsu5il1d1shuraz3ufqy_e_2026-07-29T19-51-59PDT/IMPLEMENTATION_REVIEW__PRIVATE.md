# IMPLEMENTATION_REVIEW — PRIVATE (rehydration notes)

Role: IMPLEMENTATION_REVIEWER, read-only on source. Reviewed commit `3468387` on branch
`nid_x6hgehsu5il1d1shuraz3ufqy_e_2026-07-29T19-51-59PDT`. Verdict READY, 0 BLOCKING.

## What I actually ran (all reverted afterwards)

1. `npm run check` + `npm test` → exit 0 / exit 0, `Test Files 91 passed (91)`,
   `Tests 1164 passed (1164)`. Logs: `.tmp/review-check.log`, `.tmp/review-test.log`.
2. TEETH: python-patched `src/engine/SettingsSpec.ts` adding
   `phantomKnob: { default: 3, min: 1, max: 9, step: 1 }` right after
   `nodeCap: { default: 100, min: 1 },`. `npx vitest run` → `4 failed | 87 passed`, 9 failing
   tests, messages containing `phantomKnob: expected=[3] got=[undefined]`,
   `phantomKnob: still [undefined]`, `phantomKnob: owned by []`. Log `.tmp/teeth-test.log`.
   Reverted via `git checkout src/engine/SettingsSpec.ts`. (vitest does not typecheck, so no
   need to touch the `ViewSpec` interface.)
3. DEFAULT-DRIFT experiment #1: repelStrength 300→60, collidePaddingPx 50→0,
   elkNodeSpacingPx 20→115, linkGapPx 40→240 → `3 failed | 88 passed`, 5 failures in
   `src/view/D3ForceLayout.test.ts`, `src/view/d3ForceStranding.test.ts` (3),
   `src/view/groupPacking.test.ts`. Log `.tmp/teeth-defaults.log`.
4. DEFAULT-DRIFT #2: centerPullStrength 0.05→0.15, linkStrengthFactor 1→4 → 91/1164 GREEN.
   Log `.tmp/teeth-defaults2.log`.
5. DEFAULT-DRIFT #3: edgeRoutingClearancePx 11→14 → 91/1164 GREEN. Log `.tmp/teeth-defaults3.log`.

=> the "layout-quality suites are the tripwire" claim is true for 4 of 7 force-layout fields,
false for centerPullStrength / linkStrengthFactor / edgeRoutingClearancePx. That is finding 1
and the only substantive coverage loss.

## Things I checked and cleared (do not re-litigate)

- `metricWeight` bounds-only exception: honest — `clampSizingSettings`
  (`src/engine/constants.ts:217-221`) clamps every metric weight via
  `clampSizingNumber("metricWeight", …)`. Two guards keep the exception list from rotting
  (`SettingsSpec.test.ts:81-94`).
- `SETTINGS_FIELD_LEAVES` is the only shrinking filter; guarded.
- `alternateSettingsRoot()` throws (loud) for unmodelled leaf types — no silent skip.
- `FAR_OUTSIDE_ANY_RANGE = 1e6` fails loudly if a future max exceeds it.
- `clampOutlineMaxDepth` NaN change: finite behavior identical; callers = `persistedShapes.ts:147`
  (pre-filtered by `numberOrUndefined`), `VicinityGraphSettingTab.ts:729` (slider),
  `SettingsRowView.tsx:334` (`settlesAt`, where NaN is plausible → mild live improvement).
  Regression-covered by `settingsSpecBounds.test.ts:143`.
- e2e untouched; `git show 3468387 --stat -- e2e/` empty.
- Follow-up ticket `nid_5meu9s38sbrv1703na77of4m7_e` is well-formed (`decide` tag, both
  options, names the behavior-capturing test that blocks the silent change). Right call.

## Parity (Goal 2) analysis, exact

`src/view/settingsRowParity.test.ts` asserts: (a) each `SETTINGS_ROW_CONTROL_KINDS` entry has a
`case "<kind>":` substring in `VicinityGraphSettingTab.ts` and `SettingsRowView.tsx`;
(b) both contain `return unhandledRowControl(row.control)`; (c) `GraphToolbar.tsx` and the tab
mention `SETTINGS_GROUPS` and `SETTINGS_SECTIONS`; (d) vacuity length check using
`EVERY_SETTINGS_ROW`. It does NOT assert per-ROW rendering; a per-row `if`/`.filter` skip, or a
`case` label in dead code, passes. Documented partially in the file header; recommended it be
recorded on `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` instead. Not blocking — a render harness is the
only real fix and it is an explicitly out-of-scope ticket.

## Housekeeping

- `.ai_out/.../TOP_LEVEL_AGENT.md` showed as modified in `git status` throughout my session; I
  never touched it (another agent did). No source file left dirty by me — verified with
  `git status --short` after each revert.
