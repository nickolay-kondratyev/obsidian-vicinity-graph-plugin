# IMPLEMENTATION — PRIVATE working state (step-06-controls)

## Status: Phase A + Phase B COMPLETE. Phases C/D NOT started.
Full suite green (48 files / 496 tests). `npm run check` clean. Nothing committed (TOP_LEVEL commits).

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
