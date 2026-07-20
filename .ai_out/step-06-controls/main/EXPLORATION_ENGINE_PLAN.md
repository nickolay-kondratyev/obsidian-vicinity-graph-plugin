# Exploration: Engine + Plan/Requirements Context for step-06-controls

## 1. High-level plan goals 3 & 4 (verbatim intent)
`high-level-plan.md:9-10`:
- Goal 3 **Directional, per-node depth control**: Outbound and incoming depth independent, adjustable in view, remembered per document.
- Goal 4 **Pinned central nodes**: hold one or more neighborhoods on screen while browsing elsewhere.

Decisions step-06 operationalizes (`:38-44`, `:61-69`):
- Traversal (depth) per-root, no cascade: own doc override → global default. "Node X pinned at depth 3 keeps exploring at 3 while MAIN Y explores at 1."
- View settings (sizing/grouping/cap) cascade: MAIN overrides → pinned fill gaps (priority-chain) → global.
- **"Adjusting a pinned central's depth while at MAIN Y persists inside Y's doc file (`centralDepths` map keyed by docid). Returning to Y restores exact view. X's own saved setting untouched."** — source of the scenario test.
- **Pin-on-toggle**: any explicit change writes per-doc entry even if equal to global; absence=inherit, presence=pinned; per-field not per-doc.
- UI needs per-control reset-to-global (unpin), unpin on pinned nodes, pinned centrals styled distinctly from MAIN.
- No formal scenario tests in high-level plan beyond narrative; formal scenario only in step-06 doc.

## 2. Engine settings surface (`src/engine`)
- **Depth** `types.ts:136-146`: `DepthSettings{outgoingDepth,incomingDepth}`, `DepthOverride{outgoingDepth?,incomingDepth?}`. Resolved by `TraversalSettingsResolver.resolveForRoot(global, override)` (`:12-17`): `override?.field ?? global.field`, one layer only. Defaults `DEFAULT_OUTGOING_DEPTH=DEFAULT_INCOMING_DEPTH=1`.
- **Depth 0 semantics** `NeighborhoodTraversal.ts:78-92`: BFS seeds `visited={root:0}`, records depth-0 tag for root, stops when `currentDepth>=depthLimit`. So **depth 0 = only the central itself, no expansion in that direction**; depth 1 = immediate neighbors. (Answers open item #2.)
- **Cap** `ViewSettings.nodeCap` default `DEFAULT_NODE_CAP=100`; centrals exempt (GraphTruncator).
- **Sizing** `types.ts:161-168`: `SizingSettings{metrics:Record<SizeMetricId,{enabled,weight}>, depthDecayK, minPx, maxPx}`. `SizeMetricId="own-file-size"|"total-linker-size"|"backlink-count"|"outlink-count"|"depth-decay"`. Defaults: only `own-file-size` enabled (weight 1), minPx=40, maxPx=160, depthDecayK=1. `NodeSizer.ts` composes enabled/weighted metrics→[0,1]→[minPx,maxPx]; centrals bypass→`CENTRAL_SIZE_SCORE=1`→maxPx.
- **View cascade** `ViewSettingsResolver.resolve` (`:29-52`): per-field `mainOverride → ranked pinnedOverrides (NodePriorityChain, recency+docid tiebreak) → global`. Also `groupByFolder`, `edgeVisibility`.
- **Facade** `NeighborhoodEngine.build(request: GraphBuildRequest)` (`:44-104`): resolves view → per-root depth → BFS → sizing → truncation → edges. `GraphBuildRequest` (`:27-37`) path-keyed: `depthOverridesByRoot: Map<VaultPath,DepthOverride>`, `mainViewOverride`, `pinnedViewOverrides`.

## 3. The pin-X-depth-3/MAIN-switch scenario
`step-06-controls.md:43`: pin X at depth 3 while MAIN Y at depth 1 → X keeps exploring at 3; switch MAIN to Z and back to Y → exact view restored; X's own saved settings untouched.

**Nothing like this exists as a test yet** (grepped engine + assembler tests; no matches).

Mechanism already implemented piecemeal, not as one end-to-end scenario:
- `GraphRequestAssembler.depthOverrides` (`:70-88`): for pinned root, `merged={...ownDepths, ...mainAdjusted}` where `mainAdjusted=mainDocData?.centralDepths?.[pin.docid]??{}` — **current MAIN's centralDepths[X] wins per-field over X's own persisted depth**. Narrowly covered `GraphRequestAssembler.test.ts:61-77` (single MAIN, not round trip).
- `PersistenceServices.setCentralDepthField(mainFile,centralDocid,field,value)` (`:56-65`) write path; narrowly tested `PersistenceServices.test.ts:91-97`.
- `DocDataMutations.setCentralDepthField` (`:23-37`) pure mutation.

**Home**: new `describe` in `NeighborhoodEngine.test.ts` (engine-level per step doc) building `GraphBuildRequest` thrice (Y-main-X-adjusted, Z-main, Y-main-again) asserting X's depth tags/neighborhood identical to first + X's own depths untouched — OR assembler-level round trip chaining `assemble()` with evolving `DocData`. Both probably wanted (assembler round-trip for persistence semantics + engine end-to-end proving BFS re-explores X at 3).

## 4. What steps 02–05 already built (step-06 is "mostly UI over")
Already implemented + tested, no new engine/persistence logic for happy path:
- Depth read/resolve: `TraversalSettingsResolver.resolveForRoot`, `PluginDataStore.globalDepths()`.
- Depth write: `PersistenceServices.setDocDepthField`, `.setCentralDepthField` (both do ensureDocId + pin-on-toggle + persist).
- Global depth write: `PluginDataStore.saveGlobalDepths`.
- View read/resolve: `ViewSettingsResolver.resolve`, `PluginDataStore.globalView()`.
- View write: `PersistenceServices.setDocViewField`, `PluginDataStore.saveGlobalView`.
- Pin/unpin: `PersistenceServices.pinDoc→PersistableIdentity` (handles null-id), `.unpinDoc` (centralDepths cleanup left to sweep), `PluginDataStore.addPin/removePins/pins/hasPin`.
- Assembly: `GraphRequestAssembler.assemble(inputs)` (docid→path, skip unresolved/is-MAIN, centralDepths merge).
- Rebuild: `GraphViewController` owns pipeline (`handleActiveFileChanged`, subscribe/getSnapshot, `openNode`).
- Node data for affordances: `GraphNode.isCentral`, `isMain`, `depthTags`, `docid` already emitted (`types.ts:73-96`).

Net: step-06 = (a) build toolbar/settings-tab UI, (b) wire events to existing `PersistenceServices`/`PluginDataStore`, (c) trigger rebuilds, (d) add `PluginSettingTab`. No new engine algorithm. The "settings-write layer" pure tests (`step-06-controls.md:42`) likely a thin new mapping layer (UI control → persistence method+field), analogous to `DocDataMutations`.

## 5. Test conventions
- **BDD pervasive**: `describe("<Unit> <topic>", ()=>{ it("WHEN <action> THEN <outcome>", ()=>{}) })`, one behavioral focus per `it`. Leading `// GIVEN` comments for shared fixtures.
- **vitest.config.ts**: `include:["src/**/*.test.{ts,tsx}"]`. Submodule suite excluded, run via `npm run test:sublib`. Plain node env; Obsidian faked via ports, never imported in engine/persistence tests.
- Naming `<Unit>.test.ts` colocated; fakes separate named files (`FakeLinkProvider.ts`, `FakePluginDataPort.ts`), reused. Persistence tests build real stores over fakes + `await init()`.

## 6. Open items needing human decisions (unresolved in repo)
`step-06-controls.md:46-51`:
1. **Toolbar placement/overflow at ~300px sidebar** — no decision anywhere. Needs design input (step-05 loaded `${MY_DEEP_MEM}/my-frontend-design.md` for UI-heavy steps).
2. **Depth stepper bounds** — min unambiguously 0 (only central). **No max-depth constant exists**; needs decision + new named constant (e.g. `MAX_STEPPER_DEPTH`).
3. **Unpin-node affordance placement** — hover button vs right-click menu vs both; unresolved.
4. **Whether cap is per-view** — resolver already supports via cascade; `setDocViewField(file,"nodeCap",value)` works. Needs explicit UX call: does cap live per-central like depth, or once in toolbar (writing MAIN's view setting)?

**Human-input decisions**: toolbar layout/overflow @300px; max depth-stepper bound; unpin affordance placement; cap control presentation (MAIN-view vs cascade).
