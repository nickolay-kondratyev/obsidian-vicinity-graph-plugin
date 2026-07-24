# IMPLEMENTATION (self-plan) — PRIVATE state

## Goal
Centralize settings defaults + limits into ONE nested `SETTINGS_SPEC` mirroring
`PluginData` shape. Pure refactor, ZERO value changes.

## Design chosen
- NEW `src/engine/SettingsSpec.ts`: `SETTINGS_SPEC` (nested) + leaf types
  (`BoundedNumberSpec {default,min,max,step}`, `MinBoundedNumberSpec {default,min}`,
  `DefaultSpec<T> {default}`). Shape: `globalDepths / globalView(→sizing.metrics,
  forceLayout) / nodeExclusion`. All JSDoc WHY rationales moved here.
  - Shared `DEPTH_STEPPER_BOUNDS = {min:0,max:5,step:1}` spread into both depth fields (DRY).
  - Metric leaf = `DefaultSpec<SizingMetricSetting>` (`{default:{enabled,weight}}`); local `DEFAULT_METRIC_WEIGHT=1`.
- NEW `src/engine/SettingsDefaults.ts`: discoverability shim, re-exports SETTINGS_SPEC + dummy class.
- `src/engine/constants.ts`: EngineDefaults factories + DEFAULT_* + MIN_NODE_CAP +
  MIN/MAX_STEPPER_DEPTH + FORCE_LAYOUT_RANGES all DERIVE from SETTINGS_SPEC (read .default / .min/.max/.step).
  NEUTRAL_NORMALIZED_VALUE + CENTRAL_SIZE_SCORE stay (not settings defaults).
- `src/engine/index.ts`: export SETTINGS_SPEC, SettingsDefaults, MIN_NODE_CAP, MIN/MAX_STEPPER_DEPTH, spec types.
- `src/view/constants.ts`: MIN/MAX_STEPPER_DEPTH now imported from ../engine + re-exported (DepthStepper imports from ./constants unchanged).
- `src/view/VicinityGraphSettingTab.ts`: drop local MIN_NODE_CAP const, import from ../engine.

## Files touched
- CREATE src/engine/SettingsSpec.ts, src/engine/SettingsDefaults.ts, src/engine/SettingsSpec.test.ts
- EDIT src/engine/constants.ts, src/engine/index.ts, src/view/constants.ts, src/view/VicinityGraphSettingTab.ts

## Gotchas
- importGuard: new engine files import only ./types.
- forceLayoutSettings.test.ts asserts exact baseline — must stay green untouched.
- DEFAULT_* still imported by tests (EdgeVisibility.test, DocDataMutations.test) — keep exporting.
- strict TS noUncheckedIndexedAccess.

## Status: DONE
- `npm run check` EXIT=0; `npm test` EXIT=0 → 62 files / 739 tests passed.
- No stale refs to removed force `DEFAULT_*` scalars or `DEFAULT_METRIC_WEIGHT` (now local to SettingsSpec.ts).
- Remaining risk: none known. E2E (npm run test:e2e) not run (release gate, out of scope).
