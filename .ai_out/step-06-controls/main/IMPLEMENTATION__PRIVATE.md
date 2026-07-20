# IMPLEMENTATION — PRIVATE working state (step-06-controls)

## Status: Phases A–D COMPLETE. Implementation done (Phase E QA is a human/reviewer step).
Full suite green (49 files / 499 tests). `npm run check` clean. Production build (esbuild) OK. Nothing committed.

---
## PHASE D state (global settings tab) — DONE

### Files added
- `src/view/NeighborhoodGraphSettingTab.ts` — `class NeighborhoodGraphSettingTab extends PluginSettingTab`.
  Obsidian glue only. `display()` renders three headed sections via the native `Setting` builder:
  - **Depth defaults**: two `addSlider` (0..MAX_STEPPER_DEPTH, step 1, dynamic tooltip), seeded from
    `store.globalDepths()`; onChange → `applyInteraction({kind:"global-depth", direction, value: clampStepperDepth(v)})`.
  - **Node sizing**: per-metric `addToggle` + weight `addText[number]` for all 5 metrics (iterating the shared
    `SIZING_METRICS`); minPx / maxPx / depthDecayK number fields. Each edit merges the CURRENT
    `store.globalView().sizing` and emits `{kind:"global-sizing", sizing}`. Toggle onChange re-runs `display()`
    so the weight field's disabled state tracks the toggle (weight fields don't re-render mid-typing → no focus loss).
  - **Performance**: node-cap number field (GLOBAL-only, Q4); onChange → `{kind:"global-cap", value}` guarded to
    integer ≥ `MIN_NODE_CAP` (=1).
  - Single private write path `applyInteraction(i)`: `planSettingsWrite(i, {globalDepths, globalView})` read FRESH
    each call (so successive edits compose) → switch the resulting command onto
    `store.saveGlobalDepths`/`saveGlobalView` (the two per-doc command kinds are unreachable for global-* and
    early-return) → `plugin.refreshOpenViews()`.
- `src/view/sizingMetrics.ts` — extracted shared `SIZING_METRICS` (id+label+order) — the ONE presentation list
  consumed by BOTH `SizingSection.tsx` (in-view) and the tab, so labels/order never drift.
- `src/view/sizingMetrics.test.ts` — invariant test: list covers every engine `SizeMetricId` exactly once (via
  `EngineDefaults.sizingSettings().metrics` keys) + non-empty labels.

### Files changed
- `src/view/SizingSection.tsx` — now imports `SIZING_METRICS` (deleted its local `METRICS` copy). No behavior change.
- `src/main.ts` — import `NeighborhoodGraphSettingTab`; `this.addSettingTab(new NeighborhoodGraphSettingTab(this.app, this))`
  in `onload`; NEW public `refreshOpenViews()` iterating `getLeavesOfType(VIEW_TYPE_NEIGHBORHOOD_GRAPH)` and calling
  `view.refresh()` on each `NeighborhoodGraphView` (uses `instanceof`, not `as`, for type-safe narrowing).

### Phase D notes / decisions
- Tab imports the plugin type via `import type NeighborhoodGraphPlugin from "../main"` (TYPE-ONLY default import →
  no runtime cycle; `super(app, plugin)` needs the runtime instance, which the caller passes). `private get store()`
  = `this.plugin.pluginDataStore`.
- Depths use sliders (idiomatic, self-clamping 0..5) but still route the value through `clampStepperDepth` per task.
- Writes fire on every valid change (slider tick / keystroke), consistent with the in-view `SizingSection` — Pareto,
  no debounce in V1. `refreshOpenViews()` after each. Acceptable given serialized cheap `saveData`.

### DEVIATION (Phase D)
- None material. Judgement call on the DRY extraction: extracted ONLY the metric label/order list (`SIZING_METRICS`)
  — genuine knowledge duplication with a real test invariant. The trivial whole-object `sizing` spreads were NOT
  extracted (they are one-liners; a "sizing form" helper module would be indirection for its own sake). Both
  surfaces still route through the same pure `planSettingsWrite` `global-sizing` command → zero write-logic dup.

### Phase E (NOT code — reviewer/human)
- Run plan §13 checklist through an Obsidian restart (persistence + live refresh across the settings tab and toolbar).

---
## PHASE C state (in-view UI + CSS) — DONE

### Files added
- `src/view/ControlsActionsContext.ts` — React context (sibling of `GraphUiContext`) delivering
  `ControlsActionsPort`; `useControlsActions()` throws if outside the flow.
- `src/view/DepthStepper.tsx` — presentational `−/value/+` + reset (hidden unless `pinned && !disabled`);
  clamps via `clampStepperDepth`; emits `number | undefined`. `data-pinned`/`data-disabled` drive CSS.
- `src/view/CentralDepthControls.tsx` — one central row (title + 2 steppers). Builds `SettingsInteraction`
  (`main-depth` for MAIN, `central-depth` w/ `centralDocid` for pinned) → `planSettingsWrite(_, ctx)` →
  `actions.applySettings`. `editable = persistable && (main || docid!==undefined)`.
- `src/view/SizingSection.tsx` — `<details>` disclosure; 5 metric enable+weight, minPx/maxPx, depthDecayK.
  Fully CONTROLLED off `view.sizing` (snapshot) — each edit emits whole-object `global-sizing` write; no
  local form state (no drift). Inner `SizingNumber` helper guards `Number.isNaN(valueAsNumber)`.
- `src/view/GraphToolbar.tsx` — the `<Panel top-left>` body. Whole panel = native `<details>` (collapsed by
  default, no JS state). MAIN row always visible; pinned centrals behind a nested `<details>`; sizing behind
  its own disclosure. `nowheel nodrag nopan`. Returns null when `centrals` empty.

### Files changed
- `src/view/ControlsModel.ts` — **`ControlsModel` now carries `globalDepths: DepthSettings` +
  `globalView: ViewSettings`** (single source for `planSettingsWrite` ctx + sizing seed; builder already
  loaded them). `build()` returns them; +1 test in `ControlsModel.test.ts`.
- `src/view/GraphViewController.ts` + `.test.ts` — `EMPTY_CONTROLS` now seeds globals from `EngineDefaults`
  (`depthSettings()`/`viewSettings()`); GVC imports `EngineDefaults` (value).
- `src/view/viewPorts.ts` — added `NodeMenuEntry` + `NodeMenuRequest`; `GraphUiPort.showNodeMenu(request)`.
- `src/view/ObsidianGraphUi.ts` — implemented `showNodeMenu` (native `Menu`, one item, `showAtMouseEvent`;
  item `onClick` = the entry's carried closure — adapter needs no actions ref). Mirrors `showAttachmentMenu`.
- `src/view/NoteNode.tsx` — hover `PinButton` (`nodrag nopan`, icon via `ui.renderIcon`, stopPropagation →
  `runPinAction`) + `onContextMenu` (preventDefault+stopPropagation; none→no menu; else `ui.showNodeMenu`).
  `pinAction = useMemo(planNodePinAction(data.tier))`; `runPinAction` routes `actions.pinNode(path)` /
  `unpinNode(docid)`. Uses `useControlsActions()`.
- `src/view/NeighborhoodGraphFlow.tsx` — new `actions: ControlsActionsPort` prop; wraps tree in
  `ControlsActionsContext.Provider`; renders `<Panel position="top-left"><GraphToolbar controls=…/></Panel>`.
- `src/view/NeighborhoodGraphView.tsx` — passes `actions={controlsActions}` into the flow render.
- `src/view/graph-view.css` — toolbar/header/body, central rows, stepper (button/value/reset,
  inherited=muted vs pinned=normal+accent-dot + accent left-border), disclosures, sizing grid, hover
  pin-button (`opacity:0` until `.neighborhood-graph-node:hover`/`:focus-visible`). Node got
  `position:relative`. ALL theme vars (0 own colors; only pre-existing `b1b1b7` comment ref). ~260px max,
  body `max-height:60vh; overflow-y:auto`.

### Phase C notes / gotchas
- Collapse uses native `<details>` throughout (toolbar + both nested disclosures) — zero `useState`.
  Chevron = CSS border-triangle rotated 90° on `[open]`; `list-style:none` + `::-webkit-details-marker`.
- SizingSection is CONTROLLED from the snapshot, relying on the immediate-rebuild loop (`handleSettingsChanged`)
  to feed fresh values back. Fine for V1; number inputs write on every valid change (Pareto — no debounce).
- `planSettingsWrite` ctx everywhere = `{ globalDepths: controls.globalDepths, globalView: controls.globalView }`
  computed once in `GraphToolbar`, passed to `CentralDepthControls` + `SizingSection`.

### DEVIATION (Phase C)
- Task item 10 wording said "MAIN + pinned depth controls always visible"; I placed **pinned centrals behind
  a nested disclosure** (MAIN always visible) to honor the BINDING **CLARIFICATION Q1** ("pinned centrals and
  sizing section behind expand/disclosure toggles"). Sizing also behind a disclosure per Q1/Q5. If the human
  prefers pinned rows always-visible, move the `<CentralDepthControls>` map out of the nested `<details>` in
  `GraphToolbar.tsx` (one-line structural change).
- `showNotice` port NOT added — Phase B routes the not-persistable/not-pinnable `Notice` directly inside
  `ControlsActions` (its own obsidian glue), so no node surface needs a `showNotice` port. `GraphUiPort` gained
  only `showNodeMenu`.

### Remaining Phase D checklist (NOT started)
- `src/view/NeighborhoodGraphSettingTab.ts` (`extends PluginSettingTab`): global depth defaults (clamp
  `clampStepperDepth`) → `saveGlobalDepths`; sizing (REUSE the SAME `planSettingsWrite` `global-sizing` shape
  — could even extract SizingSection's field set, but tab uses obsidian `Setting`); node cap → `saveGlobalView`.
- `main.ts`: `this.addSettingTab(new NeighborhoodGraphSettingTab(this.app, this))` + `refreshOpenViews()`
  helper iterating `app.workspace.getLeavesOfType(VIEW_TYPE_NEIGHBORHOOD_GRAPH)` → `view.refresh()` after each
  global save. `view.refresh()` already exists (Phase B).
- Phase E QA: run plan §13 checklist through an Obsidian restart.

---
### (historical) Status before Phase C

---
## PHASE B state (builder + controller + plumbing) — for Phase C

### Files changed
- `src/view/viewPorts.ts`: `GraphSourcePort.build` now returns `Promise<GraphBuildResult | null>`.
  Added `GraphBuildResult { graph: NeighborhoodGraph; controls: ControlsModel }` and
  `ControlsActionsPort { applySettings(cmd); pinNode(path); unpinNode(docid) }` (all `Promise<void>`).
  Imports `ControlsModel` + `SettingsCommand` as TYPES only (no cycle).
- `src/adapters/NeighborhoodGraphBuilder.ts`: `build` extracts one `const inputs: GraphRequestInputs`,
  feeds BOTH `GraphRequestAssembler.assemble(inputs)` AND `ControlsModelBuilder.build(inputs)` →
  returns `{ graph, controls }`. Imports `ControlsModelBuilder` (runtime) + `GraphBuildResult` (type)
  from `../view/*` — adapter→view import is intentional (ControlsModel lives in view, built from
  adapter inputs). No import cycle at runtime (view/ControlsModel never imports the builder).
- `src/view/GraphViewController.ts`: `FlowSnapshot` gains `controls: ControlsModel`; `EMPTY_CONTROLS =
  { centrals: [] }` + `EMPTY_SNAPSHOT.controls`. New private `controls` field (set from `result.controls`
  in runRebuild, reset in `reset()`, republished in `publish()`). runRebuild destructures `result.graph`.
  NEW public: `handleSettingsChanged(): void` (clearDebounce + immediate `void runRebuild()`, bypasses
  decideActiveFileRebuild) and `currentMainPath(): string | null` (returns private `mainPath`). Controller
  stays obsidian-free.
- `src/view/flowMapping.ts`: `FlowNodeData.docid?: string` added (before `tier`); `toFlowNodeData`
  spreads `...(node.docid === undefined ? {} : { docid: node.docid })`.
- `src/view/ControlsActions.ts` (NEW, obsidian glue): `class ControlsActions implements ControlsActionsPort`.
  Ctor `(controller, persistenceServices, pluginDataStore, app)`. `applySettings` switches SettingsCommand →
  `setDocDepthField`/`setCentralDepthField`(via `mainFile()` = getFileByPath(controller.currentMainPath()),
  null-safe no-op) / `saveGlobalDepths` / `saveGlobalView`; `pinNode`=resolve TFile→pinDoc; `unpinNode`=unpinDoc.
  Every persist path ends with `controller.handleSettingsChanged()`. `Notice` shown directly (imported from
  obsidian) when `PersistableIdentity.kind==="not-persistable"` — see DEVIATION below. Not unit-tested (glue);
  typechecks.
- `src/view/NeighborhoodGraphView.tsx`: ctor `(leaf, graphBuilder, pluginDataStore, persistenceServices)`.
  onOpen builds `this.controlsActions = new ControlsActions(controller, persistenceServices, pluginDataStore, app)`.
  NEW `refresh(): void` (→ `controller?.handleSettingsChanged()`, the settings-tab fan-out target) and
  `getControlsActions(): ControlsActionsPort | null` (Phase C consumes). onClose nulls controlsActions.
- `src/main.ts`: `registerView` callback passes `this.pluginDataStore, this.persistenceServices` to the view
  ctor. `logNeighborhoodGraph` destructures `const { graph } = result` from the new build result.

### Tests changed/added
- `GraphViewController.test.ts`: `FakeGraphSource` now `Deferred<GraphBuildResult|null>`; `resolveBuild(i, graph)`
  wraps `{ graph, controls: EMPTY_CONTROLS }` (local `const EMPTY_CONTROLS: ControlsModel = { centrals: [] }`).
  +3 tests (handleSettingsChanged rebuild, currentMainPath null / returns path).
- `NeighborhoodGraphBuilder.test.ts`: 3 sites `const graph = (await builder.build("main.md"))?.graph;`.
- `flowMapping.test.ts`: +2 docid tests (central forwards docid; regular omits); imported `asDocId`.

### How Phase C consumes Phase B
- Toolbar model: `snapshot.controls` (`ControlsModel { centrals: CentralControl[] }`, MAIN first). Empty view →
  `centrals: []`.
- Actions: `NeighborhoodGraphView.getControlsActions()` → `ControlsActionsPort`. Phase C passes it into
  `NeighborhoodGraphFlow` and provides via a new `ControlsActionsContext` (NOT built yet).
- Node docid for unpin: `FlowNodeData.docid` (present on centrals).
- planSettingsWrite CONTEXT (globalDepths/globalView) is NOT yet in the snapshot. Phase C must either add
  globals to the snapshot OR read them another way to call `planSettingsWrite` before `applySettings`.
  (Chosen split: React builds the `SettingsCommand`; `applySettings` just executes it.)

### Remaining C/D checklist
- Phase C: `ControlsActionsContext` + provide in flow; `<Panel top-left>` `GraphToolbar` +
  `CentralDepthControls` + `DepthStepper`(reset/inherited-vs-pinned) + `SizingSection`; `NoteNode` hover
  `PinButton` + `onContextMenu`; `ObsidianGraphUi.showNodeMenu` + `showNotice`; `graph-view.css`.
  Wire `getControlsActions()` into the flow render in the view. Thread globals for planSettingsWrite context.
- Phase D: `NeighborhoodGraphSettingTab` + `addSettingTab` + `refreshOpenViews()` fan-out (calls `view.refresh()`).

### DEVIATIONS (Phase B)
- Notice: `ControlsActions` imports `Notice` from obsidian DIRECTLY instead of routing through a
  `GraphUiPort.showNotice` (plan §7). Rationale: ControlsActions is already obsidian glue, so owning its own
  Notice avoids adding a port method / dependency in Phase B (KISS). Phase C may still add `showNotice` for the
  NoteNode surface if desired, but the pin/depth not-persistable notices are handled here.

## What I built (Phase A) — files
- `src/view/constants.ts` (extended): `MIN_STEPPER_DEPTH=0`, `MAX_STEPPER_DEPTH=5`, `clampStepperDepth`.
- `src/view/clampStepperDepth.test.ts`
- `src/view/settingsWritePlan.ts` + `.test.ts`
- `src/view/nodePinAction.ts` + `.test.ts`  (imports `NodeTier` from `./flowMapping`)
- `src/adapters/resolvePinnedDescriptors.ts` (class `PinnedRootResolver`) — SHARED skip-rule.
- `src/view/ControlsModel.ts` (`ControlsModelBuilder`) + `.test.ts`
- `src/adapters/CentralDepthRoundTrip.test.ts` (§11.5a)
- `src/engine/NeighborhoodEngine.test.ts` (appended §11.5b describe at EOF)
- CHANGED: `GraphRequestAssembler.ts` (+`mainPersistable` in `GraphRequestInputs`; assemble refactored
  to `PinnedRootResolver.resolve`), `NeighborhoodGraphBuilder.ts` (computes+passes `mainPersistable`),
  `GraphRequestAssembler.test.ts` (`inputs()` +`mainPersistable:true`).

## Critical facts / gotchas learned from the real code
- `DocData` (persistence/persistedShapes.ts): `{ version; depths?: DepthOverride; view?; centralDepths?: Record<docid, DepthOverride> }`.
- Assembler merge for a pinned root X: `{...docDataByDocid[X].depths, ...mainDocData.centralDepths[X]}` (centralDepths wins per field). `PinnedRootResolver` now owns this.
- `TraversalSettingsResolver.resolveForRoot(global, override?)` returns full `DepthSettings`; index by `keyof DepthOverride` ("outgoingDepth"/"incomingDepth") → number. This is how ControlsModel derives `value`.
- `mainPersistable` gate = `mainDocId !== null && DocPersistEligibility.isFilenameSafeDocId(mainDocId)` — SAME gate `loadDocDataIfPersistable` uses. Cannot derive from `mainDocData !== null` (a persistable doc with no saved settings also loads null).
- ALL toolbar depth writes target the MAIN file → every `CentralControl.persistable` = `inputs.mainPersistable` (both main and pinned rows). Pinned central depth write = `setCentralDepthField(mainFile, X.docid, ...)`.
- `NodeTier = "main" | "pinned-central" | "regular"` lives in `src/view/flowMapping.ts`.
- Engine `depthTags` are keyed by ROOT path: `{ rootPath, direction, depth }`. For pinned X the rootPath is X's path.
- Branded types: map keys are `VaultPath` (`asVaultPath`), docids `DocId` (`asDocId`) — remember to brand when calling `depthOverridesByRoot.get(...)` in tests.
- VaultPathFacts.titleOf = basename without extension (used for CentralControl.title).
- Test env: obsidian NEVER imported in tests; use FakeLinkProvider + plain DocData objects + real DocDataMutations. `check` script = `tsc -noEmit` only (no separate lint).

## Q-A decision encoded (CLARIFICATION round 2)
Pinned central X's stepper `pinned` = presence in `MAIN.centralDepths[X]` ONLY (`mainAdjustedDepthOverride`), NOT X's own depths. `value` = full resolution. So X pinned only via own depths → reads "inherited" at MAIN Y even if value≠global. Test: "X has its OWN override but MAIN did not adjust it".

## For Phase B (next) — precise threading needed
1. `NeighborhoodGraphBuilder.build(mainPath)` currently returns `NeighborhoodGraph | null`. Change to
   `GraphBuildResult { graph: NeighborhoodGraph; controls: ControlsModel } | null`. Build `controls`
   from the SAME `inputs` object already passed to `GraphRequestAssembler.assemble` — extract that
   inputs object to a local `const inputs = {...}` and pass to BOTH `GraphRequestAssembler.assemble(inputs)`
   and `ControlsModelBuilder.build(inputs)` (single disk read).
2. COMPILE BREAKS to fix when changing build() return type:
   - `src/main.ts` `logNeighborhoodGraph` reads `graph.nodes/...` from `build(...)` → destructure `{ graph }`.
   - `src/view/GraphViewController.test.ts` `FakeGraphSource`/`graphOf`/`resolveBuild` return `{graph, controls}` (controls can be `{ centrals: [] }`).
   - `GraphSourcePort.build` return type in `viewPorts.ts`.
3. `ControlsActions` executor switches on `SettingsCommand` → `PersistenceServices.setDocDepthField` /
   `setCentralDepthField` / `PluginDataStore.saveGlobalDepths` / `saveGlobalView`; resolves MAIN `TFile`
   via `GraphViewController.currentMainPath()` (new getter). Notice on not-persistable. Then `handleSettingsChanged()`.
4. `handleSettingsChanged()` = immediate `void this.runRebuild()` (not debounced) — see plan §6.

## Do NOT
- Do not change engine algorithm. Do not add per-view sizing / per-doc cap (V2). Do not touch the
  pinned-view-override behavior. Keep `mainAdjustedDepthOverride` semantics as-is (reset scope).
