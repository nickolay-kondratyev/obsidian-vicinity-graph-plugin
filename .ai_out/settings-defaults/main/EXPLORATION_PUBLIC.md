# Vicinity Graph — Settings Defaults Exploration

## 1. Settings type/interface definitions (nested shape)
All settings shapes declared in pure engine file `src/engine/types.ts`:
- `DepthSettings` (L137): `outgoingDepth`, `incomingDepth`
- `NodeExclusionSettings` (L150): `enabled`, `patterns`
- `SizingMetricSetting` (L173): `enabled`, `weight`; `SizeMetricId` (L178) = 5-metric union
- `SizingSettings` (L186): `metrics: Record<SizeMetricId, SizingMetricSetting>`, `depthDecayK`, `minPx`, `maxPx`
- `ForceLayoutSettings` (L202): `centerPullStrength`, `repelStrength`, `linkStrengthFactor`, `linkGapPx`, `collidePaddingPx`, `elkNodeSpacingPx`
- `ViewSettings` (L226): `nodeCap`, `groupByFolder`, `edgeVisibility`, `sizing` (nested), `forceLayout` (nested)

Persisted top-level shape `src/persistence/persistedShapes.ts`:
- `PluginData` (L42): `version`, `globalDepths: DepthSettings`, `globalView: ViewSettings`, `pins`, `nodeExclusion: NodeExclusionSettings`

**Nested**: `PluginData.globalView.{sizing,forceLayout}`, `sizing.metrics` keyed record.

## 2. Where DEFAULTS live today
Canonical home: `src/engine/constants.ts` — named `DEFAULT_*` scalar constants + `EngineDefaults` factory class:
- `DEFAULT_NODE_CAP=100`, `DEFAULT_OUTGOING_DEPTH=1`, `DEFAULT_INCOMING_DEPTH=1`
- `DEFAULT_MIN_NODE_PX=40`, `DEFAULT_MAX_NODE_PX=160`, `DEFAULT_DEPTH_DECAY_K=1`
- `DEFAULT_EDGE_VISIBILITY="walked-from-center"`, `DEFAULT_METRIC_WEIGHT=1` (file-private)
- Force: `DEFAULT_CENTER_PULL_STRENGTH=0.05`, `DEFAULT_REPEL_STRENGTH=300`, `DEFAULT_LINK_STRENGTH_FACTOR=1`, `DEFAULT_LINK_GAP_PX=40`, `DEFAULT_COLLIDE_PADDING_PX=20`, `DEFAULT_ELK_NODE_SPACING_PX=40`
- Non-default tuning: `NEUTRAL_NORMALIZED_VALUE=0.5`, `CENTRAL_SIZE_SCORE=1`

`EngineDefaults` class (L152-202): `depthSettings()`, `sizingSettings()` (own-file-size enabled, other 4 disabled, weight 1), `nodeExclusionSettings()` (`{enabled:false, patterns:[]}`), `forceLayoutSettings()`, `viewSettings()`.
- **Only inline literal not backed by a named const: `groupByFolder: true` (L196).**

Bounds (NOT defaults, co-located): `FORCE_LAYOUT_RANGES` (L126-133 min/max/step). Also `MIN_NODE_CAP=1` (`VicinityGraphSettingTab.ts:31`), `EXCLUSION_TEXTAREA_ROWS=4` (L34), `MIN_STEPPER_DEPTH=0`/`MAX_STEPPER_DEPTH=5` (`src/view/constants.ts:136-137`).

Consumption sites (read, don't define): `TraversalSettingsResolver.ts:12-13`, `ViewSettingsResolver.ts:35-46`, `persistedShapes.ts` parseSizing/parseForceLayout (`?? defaults.*`).

Seeding call sites (all delegate to EngineDefaults): `persistedShapes.ts:69 defaultPluginData()`, `GraphViewController.ts:55-57`, `GraphLayoutRunner.ts:26`, `ForceLayoutSection.tsx:57`, `VicinityGraphSettingTab.ts:109`.

## 3. Persistence / versioning
- `PERSISTED_SHAPE_VERSION=2` (persistedShapes.ts:33). Mismatched/foreign version → full defaults; parsing never throws; malformed → defaults. Parser merges partial over `EngineDefaults` base.

## 4. Settings UI structure (mirror the type shape, NOT UI order)
`VicinityGraphSettingTab.ts` display() renders 5 framed cards: Depth defaults, Node sizing, Force layout (main + `<details>` Advanced spacing + restore button), Node exclusion, Performance (node cap). Field metadata in `forceLayoutFieldMeta.ts`, `sizingMetrics.ts`.
- UI order ≠ ViewSettings field order. `groupByFolder`/`edgeVisibility` are toolbar-only (no settings-tab control). New file should mirror `PluginData`/`ViewSettings` nesting.

## 5. Tests covering defaults
- `src/engine/forceLayoutSettings.test.ts` (asserts exact shipped baseline)
- `src/engine/settingsResolvers.test.ts`, `src/persistence/persistedShapes.test.ts` (first-run/foreign-version/partial-repair)
- `PluginDataStore.test.ts`, `GraphViewController.test.ts`, `sizingMetrics.test.ts` (indirect)

## 6. Purity / conventions
- Engine purity test-enforced (`src/engine/importGuard.test.ts`): no obsidian/react/id-lib in `src/engine/` or `src/shared/`. New `SettingsDefaults.ts` in `src/engine/` must import only `./types` + pure libs (like `constants.ts`).
- Barrel `src/engine/index.ts` re-exports (L86-98); consumers import from `"../engine"`.
- Naming: `DEFAULT_<UPPER_SNAKE>` scalars; `EngineDefaults.<camel>()` factories return immutable shapes. Heavy JSDoc WHY rationales — **preserve** when centralizing.

## Guidance for new `SettingsDefaults.ts`
- Place in `src/engine/`; import types from `./types`.
- Nested object mirroring `PluginData` → `globalDepths` / `globalView` (→ `sizing.metrics`, `forceLayout`) / `nodeExclusion`.
- Fold in scattered `groupByFolder: true`.
- Redirect `EngineDefaults` + `defaultPluginData` to read from it. Bounds/ranges are distinct — decide co-location.
