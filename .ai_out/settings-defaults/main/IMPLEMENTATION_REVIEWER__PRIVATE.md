# IMPLEMENTATION_REVIEWER — rehydration notes

## Task
Review the settings-defaults centralization refactor (latest commit `07c4db7`).
Read-only on code. Verify zero value drift, requirements met, engine purity,
type safety, test adequacy, simplicity. Write PUBLIC review + this private file.

## What the refactor did
- NEW `src/engine/SettingsSpec.ts`: `SETTINGS_SPEC` nested const mirroring
  `PluginData` shape; leaf types `BoundedNumberSpec{default,min,max,step}`,
  `MinBoundedNumberSpec{default,min}`, `DefaultSpec<T>{default}`. Shared
  `DEPTH_STEPPER_BOUNDS{0,5,1}` + local `DEFAULT_METRIC_WEIGHT=1`. Imports only
  `./types` (pure).
- NEW `src/engine/SettingsDefaults.ts`: discoverability shim (re-export +
  non-instantiable class `SettingsDefaults.SPEC = SETTINGS_SPEC`).
- NEW `src/engine/SettingsSpec.test.ts`: pins defaults + limits to literals,
  proves adapters are projections.
- EDIT `src/engine/constants.ts`: `EngineDefaults`, `DEFAULT_*`, `MIN_NODE_CAP`,
  `MIN/MAX_STEPPER_DEPTH`, `FORCE_LAYOUT_RANGES` now derive from spec. Removed 6
  force `DEFAULT_*` scalars + private `DEFAULT_METRIC_WEIGHT` (no consumers).
  `NEUTRAL_NORMALIZED_VALUE`/`CENTRAL_SIZE_SCORE` kept (non-settings tuning).
- EDIT `src/engine/index.ts`: barrel exports SETTINGS_SPEC, SettingsDefaults,
  spec types, MIN_NODE_CAP, MIN/MAX_STEPPER_DEPTH.
- EDIT `src/view/constants.ts`: stepper bounds now imported+re-exported from
  `../engine` (local defs removed).
- EDIT `src/view/VicinityGraphSettingTab.ts`: dropped local MIN_NODE_CAP.

## Verification results
- `npm run check` exit 0; `npm test` exit 0 (62 files / 739 tests).
- Value drift: PASS — compared spec leaves vs HEAD~1 constants.ts +
  view/constants.ts. All identical (table in PUBLIC).
- Removed force scalars: grep confirmed no external consumers.
- Aliasing check: setting-tab metric updates spread-copy (`{...current.metrics[id],enabled}`),
  never mutate in place; types readonly → shared metric refs currently safe.

## Verdict: APPROVE
Findings: 1 MINOR (sizingSettings shares spec metric object refs — suggest
`{...metric.default}` for symmetry with nodeExclusion's array spread), 1 NIT
(Object.fromEntries casts, acceptable). No blocking/major issues.
