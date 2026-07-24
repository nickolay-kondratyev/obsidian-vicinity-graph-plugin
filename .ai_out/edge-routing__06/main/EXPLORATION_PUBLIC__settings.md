# EXPLORATION_PUBLIC__settings — end-to-end path of a numeric user setting

Traced setting: **`linkGapPx`** ("Link distance", px) — closest existing analogue to a px-valued routing buffer.

## 0. TL;DR decision points for `shapeBufferDistance`

- Two viable placements: **(A) 7th field on `ForceLayoutSettings`** (cheapest — tables are `Record<keyof ForceLayoutSettings, …>`, so TS compile-forces most touchpoints) or **(B) new sibling field on `ViewSettings`** (honest: it is a routing knob, not force-layout). Costs in §8.
- **No `PERSISTED_SHAPE_VERSION` bump needed** for an added field — the parser is per-field with default fallback (§3), with a precedent test.
- The routing call site **does NOT receive any settings object**; `EdgeRouter.route(input)` takes only `EdgeRoutingInput`. `graph.viewSettings` IS in scope one frame up (§5).
- **Trap:** `routingSignature()` hashes only obstacles+edges → a buffer-only change serves a **stale cached route** (§5.4).
- **Pre-existing RED test (unrelated, flag before starting):** `src/engine/SettingsSpec.test.ts:98` expects `linkStrengthFactor.max: 2` but `src/engine/SettingsSpec.ts:182` ships `max: 4`.

## 1. `src/engine/SettingsSpec.ts` — THE single source of truth

- `:1-17` doc: spec is the SINGLE source for every default AND limit; mirrors the persisted `PluginData` shape.
- Leaf shapes: `BoundedNumberSpec {default,min,max,step}` `:31-36`; `MinBoundedNumberSpec` `:39-42`; `DefaultSpec<T>` `:45-47`.
- Section shapes: `DepthSpec :53`, `SizingSpec :58`, `ForceLayoutSpec = Readonly<Record<keyof ForceLayoutSettings, BoundedNumberSpec>> :65`, `ViewSpec :67-73`, `NodeExclusionSpec :75`, `SettingsSpec :80-84`.
- Spec object `:105-224`; `globalView.forceLayout :147-217`.
- **Convention (load-bearing):** every numeric field carries multi-paragraph JSDoc: UI label, mechanism, explicit `[min, max]` rationale naming the degeneracy each bound prevents. E.g. `linkGapPx :183-194` → `{ default: 40, min: 10, max: 250, step: 5 }`.
- Shared literals as module consts (`DEPTH_STEPPER_BOUNDS :96`, `DEFAULT_METRIC_WEIGHT :99`).

## 2. `src/engine/constants.ts` — mechanical projections of the spec

- Header `:11-15`: "Thin adapters over SETTINGS_SPEC … mechanical projections". `DEFAULT_*` aliases `:17-43`.
- `ForceLayoutRange {min,max,step}` `:70-74`.
- `FORCE_LAYOUT_RANGES` `:76-82` — `Object.fromEntries(Object.entries(SETTINGS_SPEC.globalView.forceLayout)...)`. **Auto-populates from the spec.**
- `clampForceLayoutSettings` `:85-98` — hand-listed per field (`:91-97`). **New field must be added by hand** (TS errors otherwise). `:84`: steps are UI affordance, only min/max enforced.
- `EngineDefaults` `:105-156`: `forceLayoutSettings() :134-144` hand-listed; `viewSettings() :146-155`.
- Non-settings tuning constants deliberately outside the spec (`:45-59`) — the file states the rule: "NOT user-facing defaults → not in the spec". `EDGE_ROUTING_SHAPE_BUFFER_PX` is today exactly such a constant, but lives in the view.

Types: `src/engine/types.ts:202-223` (`ForceLayoutSettings`), `:226-233` (`ViewSettings`), `:240` (`ViewSettingsOverride`).

## 3. Persistence — `src/persistence/persistedShapes.ts`

- `PERSISTED_SHAPE_VERSION = 2` `:33`; WHY `:22-32` — v2 was bumped when `edgeRouting` was **removed**; a foreign version parses to defaults/null and the next write rewrites.
- `PluginData` `:42-49`; `DocData` `:56-64`; `parsePluginData` `:87-99`.
- **Version mismatch:** `:89-91` `if (!isRecord(raw) || raw["version"] !== PERSISTED_SHAPE_VERSION) return defaults;` → **discards all user data wholesale**; `parseDocData :103-105` returns `null`. A bump is destructive, not a migration.
- **UNKNOWN extra field:** silently ignored — `parseViewOverride :132-150` picks only known keys. Tests `persistedShapes.test.ts:45-52` (removed `layoutMode`), `:54-61` (removed `edgeRouting`).
- **KNOWN field MISSING:** falls back to engine default per field — `parsePluginData :94-95` spreads defaults; `parseForceLayout :184-197` fills each missing/mistyped member then **clamps**.
- **Therefore adding a field needs NO version bump.** Precedent test name: `persistedShapes.test.ts:158` — *"WHEN an old data.json lacks forceLayout THEN the global view gets the engine default (backward compatible, no version bump)"*.
- `parseForceLayout :190-195` hand-lists each field → **new force-layout field added by hand**.
- If instead a NEW top-level `ViewSettings` field: touch `parseViewOverride :137-149` (`definedOnly("shapeBufferPx", numberOrUndefined(raw["shapeBufferPx"]))`) **plus a clamp** — `parseViewOverride` clamps nothing today (only `forceLayout` clamps). `numberOrUndefined :252-254`.
- Store: `src/persistence/PluginDataStore.ts:27-28` `globalView()`, `:47-48` `saveGlobalView()`.

## 4. Settings tab — `src/view/VicinityGraphSettingTab.ts`

- Class doc `:25-36`: pure Obsidian glue; controls seed from `PluginDataStore`, write via pure `planSettingsWrite`.
- `display() :66-78`: `renderDepthDefaults / renderSizing / renderForceLayout / renderExclusion / renderPerformance / renderRestoreAll`.
- `createSection() :84-86` → `div.vicinity-graph-settings-section`; heading via `new Setting(section).setName(...).setHeading()` (e.g. `:160`).
- Each card ends with `addSectionReset(section, scope) :95-110`; tab-wide reset outside cards `renderRestoreAll :132-145`.
- `renderForceLayout() :158-170` — `FORCE_LAYOUT_MAIN_FIELDS`, then `details.vicinity-graph-settings-advanced` + `summary "Advanced spacing"` (`:164-165`) for `FORCE_LAYOUT_ADVANCED_FIELDS`, then section reset.
- **`addForceLayoutSlider(container, field) :374-389`** — pattern to copy:
```ts
const range = FORCE_LAYOUT_RANGES[field];
const meta  = FORCE_LAYOUT_FIELD_META[field];
new Setting(container).setName(meta.label).setDesc(meta.description)
  .addSlider((s) => s.setLimits(range.min, range.max, range.step)
    .setValue(this.store.globalView().forceLayout[field])
    .setDynamicTooltip()
    .onChange((value) => { void this.applyForceLayout({ ...this.store.globalView().forceLayout, [field]: value }); }));
```
  Bounds from the engine table, never hardcoded (`:369-373`). Value read FRESH from the store on every change.
- Write path: `applyForceLayout :391-393` → `applyInteraction :405-408` → `planSettingsWrite` → `persist :440-455` → `plugin.refreshOpenViews()`. `writeContext() :427-433`.
- Other row idioms: `addSizingNumber :346-366` (number input with min/step); node-cap text input `:303-317`.
- UI copy: `src/view/forceLayoutFieldMeta.ts:16-41` (`FORCE_LAYOUT_FIELD_META`, compile-time exhaustive `:15`), grouping `:48-58`, partition assert `:65-67` (`_assertEveryForceLayoutFieldGrouped` — ungrouped new field is a compile error).
- **Second write surface**: `src/view/ForceLayoutSection.tsx:38-52` (in-graph sliders from the same tables), restore `:53-60`. A 7th field auto-appears.
- Reset scopes: `src/view/settingsResetPlan.ts:78-149`; force-layout scope `:92-98` — `:94` description literally says "Resets all **six** force layout sliders" (**must update** if a 7th is added); `all` scope `:136-140`.
- Write contract: `src/view/settingsWritePlan.ts:25-44` (`SettingsInteraction`, `global-force-layout :42`), `:47-62`, `:65-69`, `planSettingsWrite :71-100` (merge `:95-96`). A NEW top-level view field needs its own interaction kind + case.

## 5. Persisted value → render-time routing call

### 5.1 Today's constant
`src/view/edgeRouting.ts:71` `export const EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2;` (=17); rationale `:60-70`; consumed `:374` `router.setRoutingParameter(avoid.shapeBufferDistance, EDGE_ROUTING_SHAPE_BUFFER_PX)`. Typing `src/view/libavoidLoader.ts:32`, `setRoutingParameter :77`. `EDGE_PAIR_CURVATURE_PX = 34` at `src/view/edgeGeometry.ts:58`.

### 5.2 The chain
1. `data.json` → `parsePluginData` (`persistedShapes.ts:87`) → `PluginDataStore.globalView()` (`:27`).
2. `src/adapters/VicinityGraphBuilder.ts:63` — `globalView: this.pluginDataStore.globalView()`.
3. `src/adapters/GraphRequestAssembler.ts:35` (`readonly globalView: ViewSettings`), `:64` → engine request.
4. Engine cascade `src/engine/ViewSettingsResolver.ts:29-53` — MAIN override → pinned → global; returned object hand-listed `:47-52` (**a new `ViewSettings` field must be added here**; a field *inside* `forceLayout` need not — `forceLayout` resolves wholesale).
5. `VicinityGraph.viewSettings` — `src/engine/types.ts:253-254`.
6. `GraphViewController.ts:189` build → `:197` `const graph = result.graph`.
7. Layout hop (precedent for threading a tuning object): `GraphViewController.ts:213`
   `await this.layoutRunner.layout(vicinityGraphToElk(graph), graph.viewSettings.forceLayout);`
   Port `src/view/viewPorts.ts:52-54`; impl `src/view/GraphLayoutRunner.ts:26`; consumers `src/view/d3ForceRefinement.ts:34,81-94`, `src/view/elkMapping.ts:34`.
8. **Routing hop (the gap):** `GraphViewController.ts:226` → `resolveRoutes :241-252` builds `extractEdgeRoutingInput({nodes, edges, positions, groupDimensions})` → `:262` `await this.edgeRouter.route(input)`.

### 5.3 Is a settings object threaded to the routing call site?
**No.** `resolveRoutes` gets `flow`, `positions`, `groupDimensions`, `token` — no settings. `EdgeRouter.route(input)` (`edgeRouting.ts:56-58`) has no settings param; `EdgeRoutingInput` (`:47-50`) carries only obstacles + edges.
**But `graph.viewSettings` is in scope one frame up** (`GraphViewController.ts:197`, already used at `:213`). Options in order of least surprise:
- mirror the layout port: `route(input, shapeBufferPx?)` and pass from `resolveRoutes`; or
- widen `EdgeRoutingInput` with `shapeBufferPx` populated by `extractEdgeRoutingInput` (also fixes 5.4 if added to `routingSignature`).
Construction: `src/view/VicinityGraphView.tsx:55-60`. Plugin wiring `src/main.ts:63`, `:95`, `:42-43`.

### 5.4 Two traps that make a naive implementation silently no-op
1. **Route cache** — `GraphViewController.ts:253-256` returns cached routes when `routingSignature(input)` unchanged; `routingSignature :362-370` hashes ONLY obstacle geometry + edge endpoints → slider appears dead. Fix: include the buffer.
2. **Relayout decision** — `src/view/GraphStructureDiff.ts:35` forces relayout on any force-layout change via `FORCE_LAYOUT_FIELDS = Object.keys(FORCE_LAYOUT_RANGES)` (`:56`, derived deliberately, WHY at `:50-55`). As a `forceLayout` field the buffer gets live-rebuild for free (but also a needless elk+d3 relayout); as a separate `ViewSettings` field nothing compares it.

## 6. `README.md` — "Settings model" format

- `## Settings model` at `:54`, intro `:56-57`, `### Global defaults …` `:59`, bullets `:61-79`.
- Force-layout bullet `:67-71`: "**Force layout** — four sliders named like Obsidian's native graph (**Center force**, **Repel force**, **Link force**, **Link distance**) plus an *Advanced spacing* group (**Node spacing**, **Group member spacing**). Changes re-layout open graphs immediately; ranges are clamped … and a **Restore defaults** button resets all six."
- Convention: one bullet per settings card, bold names matching UI labels verbatim, one sentence on behaviour + clamping. The literal counts ("all six", four/two split) must be updated.

## 7. Tests to extend

Engine / spec:
- `src/engine/SettingsSpec.test.ts:25-77` (shipped DEFAULTS baseline; `forceLayout` literal `:67-74`), `:79-104` (LIMITS baseline; `:95-102`) — **currently RED**, `:107-141` adapter projections.
- `src/engine/forceLayoutSettings.test.ts:14-30` (shipped-defaults guard, literal `:16-23`), `:32-58` (clamp; `:33`,`:43` range-table-driven → auto-cover; `:53` anti-collapse invariant — model for a "buffer > arrowhead inset" invariant test).
- `src/engine/settingsResolvers.test.ts:101-115` (forceLayout cascade); `:116-133` (edgeVisibility precedent for a new top-level field).

Persistence:
- `src/persistence/persistedShapes.test.ts:121-164` — round-trip `:126`, partial-mangle repair `:132`, **clamping `:141`**, non-object inherit `:153`, **missing-field → default, no version bump `:158`**; `:5-62` plugin-data suite (`:27` foreign version, `:45`/`:54` removed fields).
- `src/persistence/PluginDataStore.test.ts:14-35`.

View:
- `src/view/forceLayoutFieldMeta.test.ts:12` (grouping completeness — fails until grouped).
- `src/view/settingsWritePlan.test.ts:78`; `src/view/settingsResetPlan.test.ts:83-95`, `:129`, `:223`.
- `src/view/GraphViewController.test.ts:90-107` (`FakeLayout.lastForceLayout` pattern; `:315-322` assertion pattern to copy for the router), `FakeEdgeRouter :113-131` (`lastInput` — extend if widening).
- `src/view/edgeRouting.test.ts:109-120` — the two invariants the ticket renegotiates.
- `src/view/GraphStructureDiff.test.ts`.

E2E (release gate):
- `e2e/settingsUxVisual.e2e.ts:87` + `:96` `toHaveCount(6)` for force-layout `input[type=range]` — **a 7th field breaks this**; `:99-100` advanced sliders; `:155-167` the five section restore rows listed verbatim (a NEW card breaks this).
- `e2e/settingsResetVerify.e2e.ts`, `e2e/settingsResetReview.e2e.ts`.

## 8. Layering — both sides, factually

Rules: `CLAUDE.md:19-25`; `docs-internal/architecture-map.md:10-41`. Engine may not import `obsidian`/`obsidian-id-lib`/`react` (`src/engine/importGuard.test.ts`); import via `src/engine/index.ts` (re-exports `FORCE_LAYOUT_RANGES :94`, `clampForceLayoutSettings :99`, `EngineDefaults :93`, `SETTINGS_SPEC :105`, spec types `:107-117`, `ForceLayoutSettings :45`).

**FOR the engine spec:**
- The engine already owns px-valued, view-only settings: `sizing.minPx/maxPx` (`SettingsSpec.ts:136-137`), `linkGapPx`, `collidePaddingPx`, `elkNodeSpacingPx` (`:194-216`) — none consumed by the engine; interpreted by `d3ForceRefinement.ts`/`elkMapping.ts`. `ForceLayoutSettings` JSDoc (`types.ts:194-201`) says field names describe "what the value drives in the view's elk+d3 pipeline".
- The persistence parser must clamp with the *same* table (`constants.ts:61-67`, `persistedShapes.ts:176-183`); persistence imports from `../engine` and cannot import from `src/view/`. **Any bound enforced at parse time must live in the engine (or `src/shared/`).**
- Settings-tab bounds must come from the engine table (`VicinityGraphSettingTab.ts:369-373`).

**AGAINST (view concern):**
- All libavoid lives in `src/view/`. Nothing in the engine knows routing exists; `edgeRouting` was in fact *removed* from `ViewSettings` in v2 (`persistedShapes.ts:22-25`) — the codebase once decided routing config does not belong in persisted view settings.
- Sibling routing knobs are plain view constants with rationale JSDoc (`edgeRouting.ts:71, 82, 96`); `constants.ts:45-47` reserves that treatment for non-user-facing tuning. Only the decision to make it user-facing flips this.
- Naming stress inside `ForceLayoutSettings`: a routing clearance in a type documented as driving "the elk+d3 pipeline", inheriting force-layout relayout semantics (`GraphStructureDiff.ts:35`) — a buffer change would trigger a full elk+d3 relayout it does not need.

**Cost comparison**
- **(A) 7th `ForceLayoutSettings` field** — touch: `types.ts:202`, `SettingsSpec.ts:147` block, `constants.ts:91-97` + `:137-143`, `persistedShapes.ts:190-195`, `forceLayoutFieldMeta.ts:16` + a group array, plumb into `edgeRouting`. Free: `FORCE_LAYOUT_RANGES`, both slider surfaces, cascade, reset scopes, relayout diff. Breaks: `settingsResetPlan.ts:94` copy, `e2e/settingsUxVisual.e2e.ts:96` (`toHaveCount(6)`), README `:71`, literal baselines in `SettingsSpec.test.ts:67-102` / `forceLayoutSettings.test.ts:16-23`.
- **(B) new sibling on `ViewSettings`** — additionally: `types.ts:226-233`, `ViewSettingsResolver.ts:46-52`, `parseViewOverride` + new clamp, new `SettingsInteraction`/case (`settingsWritePlan.ts`), a reset scope (`settingsResetPlan.ts`), a new tab section/row, possibly `GraphStructureDiff.ts`. Gains: honest naming, no false force-layout grouping, no six-count churn.

## 9. Anchors / guardrails

- `_assertEveryForceLayoutFieldGrouped` (`forceLayoutFieldMeta.ts:67`) and `_assertEveryResetScopePlaced` (`settingsResetPlan.ts:173`) are compile-time completeness asserts — do not delete.
- Tests are BDD `WHEN … THEN …`, one behavior per test, colocated.
- Ticket acceptance line 110 ("explicit call on whether `PERSISTED_SHAPE_VERSION` bumps") → per §3, **no bump required**.
