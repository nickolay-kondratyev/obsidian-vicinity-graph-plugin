# CLARIFICATION — Settings Defaults centralization

## Task
Make all settings defaults live in a single file with a **nested structure mirroring the settings shape**, so all defaults are easy to find and adjust.

## Human-confirmed decisions

1. **Scope = defaults + limits together.**
   - Include the min/max/step bounds/ranges *alongside* the defaults (co-located per field where they apply): `FORCE_LAYOUT_RANGES`, `MIN_NODE_CAP`, depth-stepper bounds (`MIN_STEPPER_DEPTH`/`MAX_STEPPER_DEPTH`).
   - Because both live together, **rename the file/structure** to a name that encompasses *defaults AND limits* (NOT literally `SettingsDefaults`). Suggested: `SettingsSpec.ts` exporting a nested `SETTINGS_SPEC` (impl may pick a clearer name — must convey defaults+limits).
   - Additionally keep a **dummy `SettingsDefaults` class/file** that simply points to (re-exports / references) the real structure — purely for navigation/discoverability (someone grepping "SettingsDefaults" lands on the real spec).

2. **Structure = single nested source, thin adapters.**
   - The new nested structure is the ONE source of truth. Existing `EngineDefaults` factory methods and any still-needed `DEFAULT_*` named constants must **derive FROM** it (thin adapters), not duplicate it. Remove duplication.

## Design guidance (from EXPLORATION_PUBLIC.md)
- Mirror the **type shape** (`PluginData` → `globalDepths` / `globalView` → `sizing.metrics`, `forceLayout` / `nodeExclusion`), NOT the UI section order.
- Fold in the currently-inline `groupByFolder: true` literal so it becomes part of the nested spec.
- Place the real spec in `src/engine/` (or `src/shared/`) to satisfy **engine purity** (`importGuard.test.ts`): import only `./types` + pure libs. No obsidian/react/id-lib.
- Preserve the existing **JSDoc WHY rationales** for each default when centralizing.
- Per-field leaf idea: numeric slider fields carry `{ default, min, max, step }`; booleans/enums carry just `{ default }`. Adapters read `.default` (EngineDefaults) and `.min/.max/.step` (ranges).
- Redirect consumers via the barrel `src/engine/index.ts`; consumers keep importing from `"../engine"`.
- Keep all existing tests green (`forceLayoutSettings.test.ts` asserts exact baseline; `persistedShapes.test.ts`, `settingsResolvers.test.ts`).

## Non-goals
- No behavior/value changes — pure refactor. Every shipped default value & bound stays identical.
