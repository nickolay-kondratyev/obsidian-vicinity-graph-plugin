# IMPLEMENTATION — PRIVATE working state (step-06-controls)

## Status: Phase A COMPLETE. Phases B/C/D NOT started.
Full suite green (48 files / 491 tests). `npm run check` clean. Nothing committed (TOP_LEVEL commits).

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
