# PLANNER — PRIVATE working state (step-06-controls)

Role: PLANNER. Deliverable = `DETAILED_PLANNING__PUBLIC.md`. Read-only for code.
Status: FIRST pass complete (2026-07-20). No prior PRIVATE existed.

## Inputs consumed (all read)
- Spec: `docs-internal/plan/steps/step-06-controls.md`
- EXPLORATION_{PUBLIC,VIEW,PERSISTENCE,ENGINE_PLAN}.md — treated as ground truth, not re-derived.
- CLARIFICATION__PUBLIC.md — BINDING. Q1 single Panel top-left collapsed-by-default; Q2 MAX_STEPPER_DEPTH=5 min 0; Q3 pin/unpin via hover button AND context menu, MAIN not pinnable; Q4 node-cap GLOBAL-only (settings tab); Q5 sizing GLOBAL-only, toolbar section mirrors settings tab.
- Real code read: main.ts, NeighborhoodGraphView.tsx, GraphViewController.ts(+test), NeighborhoodGraphFlow.tsx, NoteNode.tsx, ObsidianGraphUi.ts, GraphUiContext.ts, attachmentMenu.ts, flowMapping.ts, viewPorts.ts, view/constants.ts, obsidianPorts.ts, PersistenceServices.ts, PluginDataStore.ts, DocDataMutations.ts, DocDataStore.ts, DocPersistEligibility.ts, engine/types.ts, engine/constants.ts, TraversalSettingsResolver.ts, ViewSettingsResolver.ts, GraphRequestAssembler.ts, NeighborhoodGraphBuilder.ts, NeighborhoodEngine.ts(GraphBuildRequest), persistedShapes.ts, graph-view.css (theming conventions).

## Load-bearing facts (don't re-look-up)
- `FlowNodeData` (flowMapping.ts:36) carries `path`, `tier` — NOT `docid`. Pinned centrals DO have `node.docid` on the engine `GraphNode`. → add `docid?` to FlowNodeData for unpin.
- `GraphSourcePort.build` returns `NeighborhoodGraph | null` (viewPorts.ts:15). Controller test fake `FakeGraphSource` implements it (GraphViewController.test.ts:38). Changing return type ripples to fake + graphOf helper.
- `GraphRequestInputs` (GraphRequestAssembler.ts:14) already holds EVERYTHING controls need: mainPath, mainDocId(null if not persistable), mainDocData(own depths + centralDepths), pins, resolvePinPath, docDataByDocid, globalDepths, globalView. Builder.build assembles these (Builder.ts:47) then DISCARDS. → feed same inputs into a pure ControlsModelBuilder; no new IO, no new DocDataStore method.
- Assembler pin-skip rules (Assembler.ts:58-68): skip unresolved path, skip main-as-pin. Central depth merge (Assembler.ts:79-86): `{...ownDepths, ...mainDocData.centralDepths[pin.docid]}` per-field, centralDepths wins. → controls model must mirror EXACTLY. Extract shared `resolvePinnedDescriptors` (DRY the skip rule).
- Reset-to-global = write field value=undefined (DocDataMutations.setOrRemove deletes; resolver `??` falls through). Pin-on-toggle = ALWAYS write field even if ==global (never suppress).
- PersistenceServices doc-scoped writes take `VaultFilePort` (file, not path); resolve via `app.vault.getFileByPath`. Global writes bypass (PluginDataStore direct). `not-persistable` verdict → Notice.
- `saveGlobalDepths(DepthSettings)` / `saveGlobalView(ViewSettings)` take WHOLE object → global command must merge field into current full object (needs current-globals context).
- PluginDataStore.saveGlobal* updates in-memory synchronously before await; DocDataStore.update resolves post-write, serialized per docid → toolbar `await write` THEN rebuild reads fresh. No debounce needed for correctness.
- CSS: edit graph-view.css only (styles.css generated). All colors from theme vars. BEM `neighborhood-graph-*`. Tier styling via data-tier (main solid / pinned-central dashed accent border already exist).

## Design decisions locked
1. **Inherited-vs-pinned + central selector = ONE pure module** `ControlsModelBuilder` over `GraphRequestInputs`. Presence-based (NOT value-diff — pin-on-toggle means value can ==global yet be pinned). Recommended over threading flags through engine (keeps engine pure, SRP).
2. **Read path** = builder returns `GraphBuildResult{graph, controls}`; controller publishes `controls` in FlowSnapshot. Single load, no race. Accept ripple to GraphSourcePort + controller test fake.
3. **Settings-write layer** = pure `planSettingsWrite(interaction, ctx) -> SettingsCommand` (#1 test target) + thin obsidian executor `ControlsActions`. Command union decides WHICH persistence call; executor is trivial switch glue.
4. **Rebuild** = new `GraphViewController.handleSettingsChanged()` → immediate `runRebuild()` (bypass active-file gate). rebuildToken latest-wins covers spam. No debounce.
5. **Pin/unpin** = pure `planNodePinAction(tier)` drives BOTH hover button + context menu (DRY). New `ControlsActionsPort` + context (sibling of GraphUiContext). ObsidianGraphUi gains `showNodeMenu` + `showNotice`.
6. **Settings tab** = `NeighborhoodGraphSettingTab extends PluginSettingTab`; register main.ts; refresh open views via plugin fan-out over `getLeavesOfType(VIEW_TYPE)` → `view.refresh()`.
7. **MAX_STEPPER_DEPTH=5 / MIN=0** in `src/view/constants.ts` (UI input bound, engine honors any depth). `clampStepperDepth` pure.
8. Add `docid?` to FlowNodeData (flowMapping) for unpin.

## OPEN — #QUESTION_FOR_HUMAN (recommended defaults given, non-blocking)
- Q-A: pinned-central stepper "pinned" badge + reset layer semantics when the central ALSO has its OWN depth override. Recommend: badge reflects the layer THIS control writes (Y.centralDepths[X]); resolved value shows full resolution; reset clears Y.centralDepths[X][dir] only (X's own untouched — matches scenario test). Slight oddity: a central pinned only via its own depths shows "inherited" at Y.
- Q-B (minor): sizing mirror parity — full (5 metric toggles+weights, minPx/maxPx, depthDecayK) vs subset. Recommend full parity, scrollable disclosure.
- Q-C (minor): settings-tab writes refresh open views — recommend yes (plugin fan-out).

## Sub-step sequencing (committable)
A pure planners+tests → B builder/controller/plumbing wiring → C in-view UI+CSS → D settings tab → E manual QA. Detail in PUBLIC.
