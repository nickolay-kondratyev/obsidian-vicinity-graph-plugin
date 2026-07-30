# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration)

Round 1 complete. Verdict NOT READY: 1 BLOCKING, 3 SHOULD-FIX, 6 NICE-TO-HAVE.
Findings written to `IMPLEMENTATION_REVIEW__PUBLIC.md` in this workdir.

## Verified myself (do not re-run unless code changed)
- `npm test` → 87 files / 1137 tests pass, exit 0 (`.tmp/rev_test.log`).
- `npm run check` → exit 0 (`.tmp/rev_check.log`).
- Anchors `ap_XXX_E`: 1 at 72abfc5, 1 at HEAD.

## The blocking finding and how I proved it
`VicinityGraphSettingTab.addRow(): void` switches on `row.control.kind` with no
`default` → a NEW union arm is NOT a compile error (void return defeats
`noImplicitReturns`). Probe: `.tmp/probe/p.ts` (3-arm union, 2 cases, class method
returning void) compiled with `--strict --noImplicitReturns
--noUncheckedIndexedAccess` → exit 0. Panel side (`SettingsRowView`) returns
`ReactElement`, so it IS forced. Five docs claim BOTH: CLAUDE.md:42,
settingsRows.ts:19-22, VicinityGraphSettingTab.ts:250-252, SettingsRowView.tsx:36-39,
architecture-map, notes/settings.md, settingsRowParity.test.ts:16-18.
Requested fix: `default: { const unhandled: never = row.control; throw … }` (+ tighten
the parity scan to `case "${kind}":`).

## Round-2 checklist (if the implementer replies)
1. Did `addRow` gain a `never` default (or a non-void return)? Re-run `npm run check`.
2. S1: did `SliderRow`/`NumberRow` start honouring `isSettingsRowDisabled`, or was the
   docblock narrowed + a "patterns row is the only disabledWhen user" test added?
   Either is acceptable; a docblock still claiming a general facility is not.
3. S2: is there a `decide` ticket covering (a) exclusion 2nd→5th, (b) panel Performance
   /node-cap row, (c) lengthened panel labels? I endorsed keeping all three.
4. S3: `nid_uer0a6uxv9ff3sxo9a4je40gp_e` closed (the CSS it describes is already gone);
   tickets naming SizingSection/ForceLayoutSection/GlobalDepthControls re-pointed.

## Conclusions I already settled — do not relitigate
- Removed `settingsSectionFields.test.ts` assertion was a TRUE tautology (alias of the
  same tuple); property survives in `settingsResetPlan.test.ts:263`. No coverage lost.
- Five deleted panel components: diffed line by line against SettingsRowView +
  GraphToolbar. Nothing lost (classes, nowheel, count badge, useId radio grouping,
  optimistic hooks/clamps, nested Advanced disclosure); a11y improved.
- Write path, layering/importGuard, subsumed-ticket completeness: all fine.
- e2e: the 4 updated specs are self-consistent; the 4 UNtouched panel specs
  (controlsRestart, pinnedCentralScenario, settingsUxVisual scoped locators,
  settingsBaseline.test) still hold — substring `hasText`, unchanged stepper
  aria-labels, `.vicinity-graph-settings`-scoped `Node cap`/`Outline depth`,
  MIN_NAMED_CONTROLS=26 recount verified (10 sliders + 9 numbers + 1 textarea + 6
  toggles).
