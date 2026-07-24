# IMPLEMENTATION (self-plan) — RESULT

## Outcome
Centralized ALL settings defaults **and** limits into one nested spec mirroring
the `PluginData` type shape. Pure structural refactor — every shipped default
value and bound stays byte-identical. `check` + full test suite green.

## New spec: name + shape
**`src/engine/SettingsSpec.ts`** exports `SETTINGS_SPEC` (const, typed
`SettingsSpec`) — the ONE source of truth. Name conveys BOTH defaults and limits
(a "spec", not just "defaults"). Leaf types:
- `BoundedNumberSpec { default, min, max, step }` — depth steppers + force-layout sliders.
- `MinBoundedNumberSpec { default, min }` — `nodeCap`.
- `DefaultSpec<T> { default }` — booleans/enums/unbounded numbers/lists/composites.

Nested structure (mirrors types, NOT UI order):
```
SETTINGS_SPEC
  globalDepths: { outgoingDepth, incomingDepth }          (BoundedNumberSpec, share DEPTH_STEPPER_BOUNDS {0,5,1})
  globalView:
    nodeCap        (MinBoundedNumberSpec {default:100, min:1})
    groupByFolder  (DefaultSpec<boolean> {true})          <- the previously-inline literal, now folded in
    edgeVisibility (DefaultSpec<EdgeVisibilityMode> {"walked-from-center"})
    sizing:
      metrics: Record<SizeMetricId, DefaultSpec<SizingMetricSetting>>  (own-file-size on, other 4 off, weight 1)
      depthDecayK, minPx, maxPx  (DefaultSpec<number>)
    forceLayout: Record<keyof ForceLayoutSettings, BoundedNumberSpec>  (6 fields, defaults+bounds co-located)
  nodeExclusion: { enabled, patterns }  (DefaultSpec)
```
All JSDoc WHY rationales for each default were **moved onto the spec fields**;
force-layout fields merge the default-WHY and the range-WHY into one comment.

## Discoverability shim
**`src/engine/SettingsDefaults.ts`** — dummy, NOT a source of truth. Re-exports
`SETTINGS_SPEC` and a non-instantiable `SettingsDefaults` class whose
`static readonly SPEC = SETTINGS_SPEC`. File doc makes it obvious the real source
is `SettingsSpec.ts` (so grepping "SettingsDefaults" lands you there).

## How adapters derive (thin, no duplicated literals)
`src/engine/constants.ts` now reads FROM the spec:
- `EngineDefaults.{depth,sizing,nodeExclusion,forceLayout,view}Settings()` project `.default`.
- `DEFAULT_NODE_CAP / DEFAULT_OUTGOING_DEPTH / DEFAULT_INCOMING_DEPTH / DEFAULT_MIN_NODE_PX / DEFAULT_MAX_NODE_PX / DEFAULT_DEPTH_DECAY_K / DEFAULT_EDGE_VISIBILITY` alias `.default`.
- `MIN_NODE_CAP`, `MIN_STEPPER_DEPTH`, `MAX_STEPPER_DEPTH` (moved into engine) alias `.min/.max`.
- `FORCE_LAYOUT_RANGES` is built by mapping `SETTINGS_SPEC.globalView.forceLayout` → `{min,max,step}`.
- `clampForceLayoutSettings`, `NEUTRAL_NORMALIZED_VALUE`, `CENTRAL_SIZE_SCORE` unchanged (last two are non-settings tuning, deliberately NOT in the spec).
- Removed the 6 per-field `DEFAULT_*_STRENGTH/PX` force scalars and the file-private `DEFAULT_METRIC_WEIGHT` (now a single local in `SettingsSpec.ts`). No consumers referenced them.

## Files
- CREATE `src/engine/SettingsSpec.ts` (spec + leaf/section types)
- CREATE `src/engine/SettingsDefaults.ts` (discoverability shim)
- CREATE `src/engine/SettingsSpec.test.ts` (baseline + adapter-derivation guards)
- EDIT `src/engine/constants.ts` (adapters derive from spec)
- EDIT `src/engine/index.ts` (barrel: export SETTINGS_SPEC, SettingsDefaults, spec types, MIN_NODE_CAP, MIN/MAX_STEPPER_DEPTH)
- EDIT `src/view/constants.ts` (stepper bounds now imported from `../engine` + re-exported; local defs removed)
- EDIT `src/view/VicinityGraphSettingTab.ts` (dropped local `MIN_NODE_CAP`; imports from `../engine`)

## Import ergonomics / purity
- Consumers keep importing from the `../engine` barrel. View re-exports stepper
  bounds from `view/constants.ts`, so `DepthStepper` etc. are unchanged.
- New engine files import only `./types` — engine purity preserved
  (`importGuard.test.ts` green).

## Tests
- New `SettingsSpec.test.ts`: pins exact shipped default values AND limits, and
  proves `EngineDefaults.*`, `FORCE_LAYOUT_RANGES`, `DEFAULT_*`, `MIN_NODE_CAP`,
  stepper bounds are projections of the spec; plus `SettingsDefaults.SPEC === SETTINGS_SPEC`.
- Existing guards untouched and green: `forceLayoutSettings.test.ts`,
  `persistedShapes.test.ts`, `settingsResolvers.test.ts`, `importGuard.test.ts`.

```
npm run check  → CHECK EXIT=0   (tsc -noEmit, strict)
npm test       → TEST EXIT=0
   Test Files  62 passed (62)
        Tests  739 passed (739)
```

## Post-review MINOR fix (defensive metric copy)
Review finding: `EngineDefaults.sizingSettings()` handed out the SAME per-metric
leaf object references held inside `SETTINGS_SPEC` on every call (whereas the
pre-refactor factory produced fresh `{enabled,weight}` literals, and
`nodeExclusionSettings()` already spreads `[...patterns]`). Currently safe
(leaves are `readonly`, all settings updates spread-on-write) but a future
in-place mutation would corrupt the global spec.

Fix (`src/engine/constants.ts`): shallow-copy each metric leaf when projecting —
`[metricId, { ...metric.default }]`. No values changed.

Audit of the other spec-derived factories: `depthSettings`, `forceLayoutSettings`,
`viewSettings` all build brand-new object literals from scalar `.default` reads,
so they never leak a shared spec reference — no change needed. `nodeExclusionSettings`
was already defensive. Only the metrics record leaked; that is the sole fix.

Added test (`SettingsSpec.test.ts`, "adapters derive from SETTINGS_SPEC" block):
two `EngineDefaults.sizingSettings()` calls return deep-equal but NOT
reference-equal metric objects.

```
npm run check  → CHECK EXIT=0   (.tmp/check2.out)
npm test       → TEST EXIT=0    (.tmp/test2.out)
   Test Files  62 passed (62)
        Tests  740 passed (740)   (+1 new defensive-copy test)
```

## Deviations / callouts
- `NEUTRAL_NORMALIZED_VALUE` and `CENTRAL_SIZE_SCORE` were intentionally left in
  `constants.ts` and NOT moved into the spec — they are internal sizing-algorithm
  tuning, not user-facing settings defaults. Flagging since they carry a
  `DEFAULT`-adjacent feel but are out of scope for "settings defaults + limits".
- `pins` (empty-list default in `defaultPluginData`) was left as an inline `[]`
  in persistence — it is not a tunable settings default, matching the task's
  stated scope (globalDepths / globalView / nodeExclusion).
- E2E (`npm run test:e2e`) not run — release gate, not part of `npm test`; no
  behavior changed so it is not implicated.
