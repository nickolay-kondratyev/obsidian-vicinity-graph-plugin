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

## ROUND 2 (fresh instance, commit `9dee711`) — CONVERGED

Findings file: `IMPLEMENTATION_REVIEW_ROUND2__PUBLIC.md`. 0 BLOCKING, 1 SHOULD-FIX (get the
owner's yes on widening "SMALL" → all 21, on the TICKET not just in `.ai_out/`), 2 NITs
(the 4-vs-7 geometry-observability prose is now duplicated 3×; one `it` covers 21 behaviors).

What I ran (all reverted; `git status` clean):
1. `npm run check` exit 0 (`.tmp/r2-check.log`); `npm test` exit 0, **91 files / 1160 tests**
   (`.tmp/r2-test.log`). Claim confirmed.
2. `it(`-count audit: productDefaults 8→3, forceLayout 4→5, specBounds 10→9, parity 5→6 =
   net −4. 1164−4=1160. Accounting honest, no behavior lost (the derived "own-file-size only"
   assertion is now stronger — every metric's `enabled` is in the table).
3. Q1 file-count experiment (`.tmp/r2_default_mut.py`, `.tmp/r2_mut2.py`): nodeCap 100→250,
   centerPullStrength 0.05→0.15, linkStrengthFactor.max 4→8 each fail **exactly one file, one
   test** (`settingsProductDefaults.test.ts`). minPx 40→30 fails 2 (the extra is the
   pre-existing `persistedShapes.test.ts` fixture-must-differ guard, not a value mirror).
   Grep confirms NO other default/range literal survives in any `src/**/*.test.ts*`.
   => VERDICT: all-21 table is ACCEPTABLE, not a staleness regression. Extra properties a
   small set cannot have: added/removed-leaf detection; no per-field judgement to re-measure.
   Caveat is purely the CLAUDE.md "deviation needs human yes" rule.
4. Q2 parity teeth (`.tmp/r2_parity_mut.py`), 3 mutations, all REDDEN by name:
   panel `if (row.label === "Node cap") return <></>` → label-scan test; same skip in the tab →
   label-scan test; `case "node-cap":` commented out in the panel → kind-`case` test.
   Mutation 1 is the exact one that passed in their first cut — module-keying fix is real.
5. Vacuity sweep of the new scan code: `new Set(Object.values(...))` kills the collision class;
   `source()` only removes text so false FAILURES only (safe direction); `readFileSync` throws
   on rename; label-scan zero-length is guarded by the `EVERY_SETTINGS_ROW.length >
   SETTINGS_SECTIONS.length` check; defaults `toEqual` is non-vacuous by construction.
6. e2e untouched, `package.json` untouched (no harness), no production source changed.
7. NIT 5 rejection judged reasonable (repo-wide convention call, owner's).

## Housekeeping

- `.ai_out/.../TOP_LEVEL_AGENT.md` showed as modified in `git status` throughout my session; I
  never touched it (another agent did). No source file left dirty by me — verified with
  `git status --short` after each revert.
