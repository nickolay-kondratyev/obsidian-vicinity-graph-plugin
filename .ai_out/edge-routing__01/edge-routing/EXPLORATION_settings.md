# Exploration: `edgeRouting` ViewSetting — follow `layoutMode` / `groupByFolder` pattern

> NOTE (TOP_LEVEL): for ticket 01 the setting only GATES whether the routing pass runs
> in `GraphViewController.runRebuild` (routedPoints ride along unused; no rendering/geometry
> change this phase). So step 7/9 "runtime wiring into elkMapping/flowMapping" below is NOT
> needed for this ticket — the gate lives in the controller. Relayout-on-flip is likely NOT
> wanted (positions don't change); instead re-route when the setting flips (route-cache concern).
> Boolean template to copy verbatim = `groupByFolder`.

## Reference patterns
- `layoutMode` — string-union ViewSetting, fully wired type→resolver→persistence→toolbar UI→runtime read→relayout trigger.
- `groupByFolder` — **boolean ViewSetting**, best copy-verbatim template for type/resolver/persistence wiring. Has NO dedicated UI control today.

## 1. Type — `src/engine/types.ts`
- `ViewSettings` interface lines 194-202. `groupByFolder: boolean` at :198, `layoutMode: LayoutMode` at :200.
- `ViewSettingsOverride = Partial<ViewSettings>` (:209) — auto-covers new field.
- **Change:** add `readonly edgeRouting: boolean;` inside `ViewSettings`.

## 2. Resolver — `src/engine/ViewSettingsResolver.ts`
- `resolve()` return object lines 46-52 enumerates each field via `field()` closure (:33-45 handles booleans incl. pinned-false).
- **Change:** add `edgeRouting: field("edgeRouting"),`.

## 3. Engine defaults — `src/engine/constants.ts`
- `EngineDefaults.viewSettings()` lines 69-77; `groupByFolder: true` at :72, `layoutMode: DEFAULT_LAYOUT_MODE` at :74. `DEFAULT_LAYOUT_MODE` const at :38 w/ doc comment.
- **Change:** add `edgeRouting: false,` (optionally a `DEFAULT_EDGE_ROUTING = false` const w/ doc comment mirroring DEFAULT_LAYOUT_MODE).

## 4. Persistence — `src/persistence/persistedShapes.ts`
- `parseViewOverride()` lines 121-142. Boolean idiom (COPY VERBATIM, swap key), lines 129-131:
  ```ts
  ...definedOnly("groupByFolder", typeof raw["groupByFolder"] === "boolean" ? raw["groupByFolder"] : undefined),
  ```
- **Change:** add analogous `edgeRouting` block. No change to `defaultPluginData`/`parsePluginData`/interfaces (generic).
- Tests to mirror: `persistedShapes.test.ts:43-50` (layoutMode fallback/roundtrip), `:88` (boolean-in-override).

## 5. Settings UI
### 5a. Toolbar (React) — `src/view/LayoutSection.tsx` (layoutMode's control)
- `<select>` bound to `view.layoutMode`, onChange → `actions.applySettings(planSettingsWrite({ kind: "global-layout", layoutMode }, ctx))`.
- Mounted in `src/view/GraphToolbar.tsx:49` `<LayoutSection view={controls.globalView} ctx={ctx} />` (SizingSection at :50).
- **For boolean**: use a checkbox (new `EdgeRoutingSection.tsx` or inline), bound like LayoutSection, mounted in GraphToolbar alongside LayoutSection/SizingSection.
### 5b. Settings tab — `src/view/VicinityGraphSettingTab.ts`
- `layoutMode`/`groupByFolder` are NOT surfaced here today. Toggle idiom exists at :74-86 (`.addToggle(...)` for sizing metrics), wired through `applyInteraction` (:187-204) → `store.saveGlobalView`.
- **TICKET 01 REQUIRES a settings-tab toggle** ("visible in settings tab"). So DO add a `.addToggle(...)` row here (unlike layoutMode). Needs a new `SettingsInteraction` kind + `applyInteraction` case landing on `saveGlobalView`, mirroring the `"global-view"` case (:196-198).

## 6. Write-plan — `src/view/settingsWritePlan.ts`
- `SettingsInteraction` union :17-34; `planSettingsWrite()` switch :58-84. `"global-layout"` variant + case is the template.
- **Change:** add `| { readonly kind: "global-edge-routing"; readonly edgeRouting: boolean }` and a case merging into `ctx.globalView`.
- Test to mirror: `settingsWritePlan.test.ts:77-82`.

## 7. Structural-diff — `src/view/GraphStructureDiff.ts`
- `groupByFolder`/`layoutMode` force `"relayout"` on change (:30-35), doc comment :14-18.
- **DECISION for ticket 01**: flipping `edgeRouting` does NOT change positions → probably should NOT force full elk relayout. Instead the controller re-runs the routing pass. Confirm with implementation plan; if reuse-layout keeps cached routes, a flip must invalidate the route cache. (Do not blindly add a relayout guard.)

## 8. Test fixtures — `src/view/testFixtures/graphFixtures.ts`
- `makeViewSettings()` :39-58 hand-builds ViewSettings — MUST add `edgeRouting: false,` or type-check breaks. `withLayoutMode()` helper :71-73; add `withEdgeRouting()` analog if tests flip it.

## 9. Runtime read (gate) — TICKET 01 SPECIFIC
- The gate site is `GraphViewController.runRebuild` (after layout, before publish): `if (viewSettings.edgeRouting) { run routing pass }`. NOT elkMapping/flowMapping.
- `layoutMode` runtime read (for reference): `elkMapping.ts:33`. `groupByFolder`: `elkMapping.ts:34`, `flowMapping.ts:147,183`.

## 10. Generic pass-through (no change needed)
VicinityEngine, GraphRequestAssembler, ControlsModel, PluginDataStore (whole-object ViewSettings). `GraphViewController.ts:214,60` projects `flow.groupByFolder` for UI — edgeRouting does NOT need projection this phase (rendering unchanged).

## Implementation checklist (settings only)
1. types.ts — add `readonly edgeRouting: boolean;`.
2. constants.ts — `edgeRouting: false,` in `viewSettings()`.
3. ViewSettingsResolver.ts — `edgeRouting: field("edgeRouting"),`.
4. persistedShapes.ts — boolean parse block.
5. graphFixtures.ts — `edgeRouting: false,` in makeViewSettings (+ optional withEdgeRouting).
6. settingsWritePlan.ts — `global-edge-routing` variant + case.
7. Settings-tab toggle (REQUIRED by ticket) in VicinityGraphSettingTab.ts + interaction wiring. Toolbar checkbox optional/nice-to-have.
8. Tests mirroring: persistedShapes, settingsResolvers, settingsWritePlan (+ tab if practical).
