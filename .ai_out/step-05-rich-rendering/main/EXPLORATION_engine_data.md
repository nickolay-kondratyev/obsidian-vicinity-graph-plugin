# Step 05 Rich Rendering - Engine/Data Layer Exploration

Repo: obsidian-neighborhood-graph. Pure engine under src/engine/, Obsidian adapter under src/adapters/, persistence under src/persistence/, React-Flow view under src/view/.

Bottom line: the ENGINE already computes almost everything Step 05 needs per node (title, folder, attachments, first image, sizing score, MAIN/central tiers, per-folder hidden counts). The GAPS are mostly in the VIEW passthrough (FlowNodeData/FlowSnapshot drop the rich fields) plus two genuine engine-model gaps: (a) no per-edge link COUNT for the "collapse multiple links into one edge with count badge" requirement, and (b) no resource-URL resolution seam for image attachments.

---

## 1. Engine core (src/engine/)

### Output model - src/engine/types.ts

GraphNode (lines 72-96) - the fully-computed output node. ALREADY carries:
- path: VaultPath (74) - vault-relative path; also the React-Flow / elk node id.
- docid?: DocId (76) - echoed only for central/pinned roots; absent on ordinary neighbors.
- title: string (78) - basename without extension (display name).
- folder: FolderPath (79) - parent folder path; "" = vault root.
- sizeBytes: number (80).
- isCentral: boolean (82) - true for MAIN AND every pinned root.
- isMain: boolean (84) - true only for the MAIN (active-file) root.
- depthTags: readonly DepthTag[] (86) - per-root x per-direction depth map.
- minDepth: number (88) - min depth across all roots/directions; 0 for centrals.
- attachments: readonly AttachmentRef[] (89) - non-node files referenced, in reference order.
- firstImagePath?: VaultPath (91) - first image among attachments (thumbnail candidate).
- sizeScore: number (93) - normalized [0,1]; centrals pinned to 1.
- sizePx: number (95) - pixel size mapped from sizeScore; the diff-stable field.

AttachmentRef (46-49): { path: VaultPath; isImage: boolean }. isImage set by adapter via FileKinds.isImagePath.

DepthTag (39-43): { rootPath: VaultPath; direction: "outgoing"|"incoming"; depth: number }.

GraphEdge (102-105): { source: VaultPath; target: VaultPath } - directed (source links to target), deduplicated per (source,target); NO count/weight field.

NeighborhoodGraph (174-181) - engine output consumed by view:
- nodes: readonly GraphNode[]
- edges: readonly GraphEdge[]
- hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number> (178) - truncation badge data, per folder, ALREADY provided.
- viewSettings: ViewSettings (180) - includes groupByFolder, edgeVisibility, sizing.minPx/maxPx.

Branded types: VaultPath, DocId, FolderPath (all string & {__brand}), with asVaultPath/asDocId/asFolderPath constructors (types.ts:23-33). Direction = "outgoing"|"incoming" (36).

### Pipeline facade - src/engine/NeighborhoodEngine.ts
NeighborhoodEngine.build(request) (47-91): resolve settings -> NeighborhoodTraversal -> NodeSizer -> GraphTruncator -> assemble visible GraphNodes (adds isMain, sizeScore, sizePx) -> EdgeVisibility. Synchronous, pure, never imports obsidian/React (enforced by importGuard.test.ts). GraphBuildRequest (27-37): main, pinned[], depths, view settings/overrides - all PATH-keyed.

### Traversal - src/engine/NeighborhoodTraversal.ts
Multi-root directional BFS. TraversedNode (24-36) is the pre-sizing node (same fields as GraphNode minus sizing/isMain). assemble (113-143): title from VaultPathFacts.titleOf; firstImage = metadata.attachments.find(a => a.isImage) (128); firstImagePath = firstImage?.path.
- Edge direction: TraversalCollector.recordEdge (171-175) - for direction="incoming", swaps so edges ALWAYS point linker->linked (source links to target). Dedup via EdgeAccumulator.

### Edges / direction / dedup - CRITICAL for Step 05 edge requirement
- src/engine/EdgeAccumulator.ts (13-20): dedups per source+NUL+target key, preserving first-insertion order. A-to-B and B-to-A have different keys so are preserved as two separate edges. Multiple links between the SAME ordered pair are collapsed to ONE edge and the count is discarded (only {source,target} stored, no counter).
- src/engine/EdgeVisibility.ts: "walked-from-center" (default) passes truncator's walked edges; "all-edges" sweeps induced subgraph over visible nodes via provider.getOutgoingLinks. Both funnel through EdgeAccumulator, so still no count.
- EdgeVisibilityMode default is "walked-from-center" (constants).

### Sizing - src/engine/NodeSizer.ts
NodeSize (8-12): { sizeScore, sizePx }. computeSizes (37-56): centrals get CENTRAL_SIZE_SCORE (maps to maxPx); others compose enabled/weighted metrics. Metric registry (77-84): own-file-size, total-linker-size, backlink-count, outlink-count, depth-decay. Score to px: minPx + score*(maxPx-minPx) (52). Node renders as a SQUARE of side sizePx (see graphIdentity.nodeSideLengthPx).

### Pinned / central concepts
- Tier flags on GraphNode: isMain (MAIN only) and isCentral (MAIN + pinned). To distinguish "pinned central" from MAIN in Step 05: isCentral && !isMain. There is no separate isPinned boolean; pinned centrals are exactly the centrals that are not main. docid/pinTimestamp come from PinnedNodeDescriptor (types.ts:67-70) but pinTimestamp is NOT propagated onto the output GraphNode (only docid is).
- Pins are cap-exempt in truncation.

### Truncation / hidden-node logic - src/engine/GraphTruncator.ts
truncate (30-54): ranks non-central candidates via NodePriorityChain using undirected distance-to-MAIN, keeps nodeCap, and builds hiddenNodeCountsByFolder (45-48) counting truncated nodes per node.folder. TruncationResult (15-21): visiblePaths, visibleEdges, hiddenNodeCountsByFolder. Per-folder hidden counts are ready for Step 05 badges - but the map is keyed by folder path only; there is NO per-node "was hidden" list and no global "hidden but no surviving folder group" count.

---

## 2. Obsidian adapter layer (src/adapters/)

### The seam - src/engine/LinkProvider.ts
FileMetadata (9-23): { folder: FolderPath; sizeBytes; isNodeBearing; attachments: readonly AttachmentRef[] }. LinkProvider (34-41): getOutgoingLinks, getIncomingLinks, getFileMetadata. Synchronous (async construction, sync queries).

### src/adapters/ObsidianLinkProvider.ts
- getFileMetadata (93-104): folder from file.parent.path (Obsidian "/" root maps to engine ""; see engineFolderOf 170-173); sizeBytes from file.stat.size; attachments from attachmentsOf.
- attachmentsOf (163-167): outgoing resolved references filtered to NON-node-bearing files, each mapped to { path, isImage: FileKinds.isImagePath(target) }, in reference order. So the engine's attachment list already covers "images and other files with extensions."
- Node-bearing rule = .md + .canvas; attachments = everything else. Canvas has a fallback parser path.

### src/shared/FileKinds.ts
- NODE_BEARING_EXTENSIONS = {md, canvas} (8).
- IMAGE_EXTENSIONS = {png, jpg, jpeg, gif, svg, webp} (11) - drives isImage/firstImagePath.
- isImagePath / isNodeBearingPath classify by VaultPathFacts.extensionOf.
- Step 05 "icon strip per attachment extension with counts": the extension is derivable from AttachmentRef.path via VaultPathFacts.extensionOf (in src/shared/VaultPathFacts.ts). The engine does NOT pre-group attachments by extension - grouping/counting is a pure view-side transform to write (and unit-test) in Step 05.

### src/adapters/NeighborhoodGraphBuilder.ts
Async orchestration per rebuild: live Obsidian state -> ObsidianLinkProvider.create -> assemble request from persisted pins/overrides -> engine.build. READ path (getDocId only). build(mainPath) returns NeighborhoodGraph | null. This is what the view's GraphSourcePort wraps.

### Answer: does engine output already include attachments/images/folders?
YES. folder, attachments (with isImage), and firstImagePath are all present on every GraphNode. Step 05 does NOT need to extend the engine model for these. It DOES need to extend the VIEW passthrough (see Gaps).

---

## 3. Edge direction & duplicate links
- Direction preserved: edges stored source->target = linker->linked (NeighborhoodTraversal.recordEdge 171-175). A-to-B and B-to-A are two distinct edges (different dedup keys). Step 05's "two arrows with offset opposite curvature" is fully supported by the model.
- Duplicate links between same ordered pair: collapsed and count LOST in EdgeAccumulator.add (EdgeAccumulator.ts:13-20). GraphEdge has no count. Step 05's "count badge" needs a NEW field.
- View edge id: src/view/graphIdentity.ts edgeIdOf (15-17) = source + "->" + target (relies on per-pair dedup for uniqueness).

---

## 4. Persistence (src/persistence/) - persistedShapes.ts
- PluginData (35-40): { version; globalDepths; globalView: ViewSettings; pins: PinnedDocEntry[] } in data.json.
- PinnedDocEntry (29-32): { docid; pinTimestamp }. Pins are docid-keyed; adapter maps docid to path before the engine.
- DocData (47-55): per-doc depths?, view? (ViewSettingsOverride), centralDepths?.
- ViewSettings (types.ts:158-164): nodeCap, groupByFolder, edgeVisibility, sizing{ metrics, depthDecayK, minPx, maxPx }.
- Nothing persisted about styling tiers or folder colors. Step 05 folder colors must be a deterministic hash of folder path (no persistence; user-assignable is V2 per the step doc). groupByFolder flag exists and is surfaced on NeighborhoodGraph.viewSettings.
- View persists nothing view-specific in V1 (NeighborhoodGraphView.getState, lines 66-78).

---

## 5. Resource / image path resolution
- No getResourcePath / getResource / hover-link / registerHoverLink usage anywhere in src/ (grep clean). This is greenfield for Step 05.
- Attachments carry only a VaultPath string, not a displayable URL. To render a thumbnail you must resolve VaultPath -> TFile -> app.vault.getResourcePath(file) at the Obsidian boundary.
- Where App is available: NeighborhoodGraphView.onOpen has this.app (src/view/NeighborhoodGraphView.tsx:45); ObsidianNoteNavigator wraps App (src/view/ObsidianNoteNavigator.ts). The controller and pure modules are deliberately obsidian-free via ports (src/view/viewPorts.ts).
- Recommended seam for Step 05: add a resolve method to NoteNavigatorPort (viewPorts.ts:25-28) or a new small port, e.g. resourcePath(path: string): string | null, implemented in ObsidianNoteNavigator via this.app.vault.getFileByPath(path) + this.app.vault.getResourcePath(file). hover-link would be fired from the ItemView/component layer where this.app/leaf are reachable. VaultPort (obsidianPorts.ts:28-32) currently has no getResourcePath; the real Vault does, so extending the structural port is trivial.

---

## 6. Test setup
- vitest.config.ts: include src/**/*.test.{ts,tsx} only. Submodule tests run separately (npm run test:sublib).
- package.json scripts: test = vitest run && test:sublib; test:watch = vitest; check = tsc -noEmit; build = check + esbuild; setup:dev-vault = bash scripts/setup-dev-vault.sh; dev = esbuild watch.
- BDD style: tests use describe/it with GIVEN/WHEN/THEN comments. See src/engine/NodeSizer.test.ts (fixtures via FakeLinkProvider / FakeVaultSpec). Pure-logic tests live beside sources (*.test.ts). View-layer pure tests exist: flowMapping.test.ts, elkMapping.test.ts, GraphStructureDiff.test.ts, RebuildDecision.test.ts, GraphViewController.test.ts.
- View test fixtures: src/view/testFixtures/graphFixtures.ts - makeNode(overrides), makeEdge(source,target), makeGraph(overrides). makeNode builds a full GraphNode with sane defaults (attachments [], folder "", sizeScore 0.5, sizePx 100). Step 05 pure tests (folder color hashing, edge collapsing/pairing, group-membership 2+ rule, attachment-to-icon-strip mapping) should extend these fixtures.
- Engine fixture provider: src/engine/FakeLinkProvider.ts - FakeFileSpec/FakeVaultSpec; attachments derived from outgoing links to non-node files; per-file image flag (defaults to FileKinds.isImagePath).
- Dev-vault / manual QA: scripts/setup-dev-vault.sh builds the plugin and seeds .dev-vault/ (gitignored) with note1/note2/note3, test.canvas, and a 1x1 pic.png (embedded as ![[pic.png]] in note1 - the first-image thumbnail candidate). Auto-enables the plugin. Idempotent. .dev-vault/ currently contains those fixtures + .obsidian config. This is the harness for the light/dark theme + rich-node visual checklist Step 05 requires.
- Build/deploy to test vault: npm run setup:dev-vault (or npm run build, which esbuild copies artifacts into .dev-vault/.obsidian/plugins/).

---

## GAPS FOR STEP 05 (data the engine/view does NOT yet expose)

1. View passthrough is lossy (biggest gap). src/view/flowMapping.ts FlowNodeData (16-22) only carries path, title, isCentral, isMain, sizePx. It DROPS folder, attachments, firstImagePath, sizeScore, docid, minDepth. All of these already exist on GraphNode. Step 05 must widen FlowNodeData + neighborhoodGraphToFlow (47-68) to forward them. No engine change needed for node data.
2. FlowSnapshot/controller drop hiddenNodeCountsByFolder and viewSettings. FlowSnapshot (GraphViewController.ts:25-29) is { status, nodes, edges } only. hiddenNodeCountsByFolder (needed for truncation badges) and groupByFolder are on NeighborhoodGraph but never reach the React layer. Must thread them through the snapshot.
3. Edge link COUNT missing (genuine engine gap). GraphEdge has no count; EdgeAccumulator discards duplicate-link multiplicity. Step 05 "collapse multiple links into one edge with a count badge" needs the engine (EdgeAccumulator + GraphEdge + EdgeVisibility) to accumulate and expose a per-ordered-pair count. The provider even exposes raw counts (MetadataCachePort.resolvedLinks is source-to-target-to-count), so the data is available upstream - it is thrown away at accumulation time.
4. No resource-URL seam. No getResourcePath anywhere; attachments are vault-path strings. Step 05 must add a resolution method (view port + ObsidianNoteNavigator/VaultPort extension) to turn firstImagePath/attachment paths into displayable URLs.
5. Attachments not grouped by extension. Icon-strip-with-counts requires grouping attachments by VaultPathFacts.extensionOf(path) - a pure view transform to write + test; engine gives the flat ordered list only.
6. pinTimestamp not on output nodes. Only docid is echoed to GraphNode; if Step 05 wants to order/label pinned centrals by recency it would need pinTimestamp propagated (currently lives only on the descriptor / PinnedDocEntry). "Pinned vs MAIN" tier styling itself is fine via isCentral && !isMain.
7. hover-link not wired. No registerHoverLink; must be added at the ItemView/component boundary where this.app + leaf are available.
8. Folder-group geometry / 2+ membership / color hash - correctly absent from the engine (UI concern). groupByFolder flag + per-node folder + hiddenNodeCountsByFolder are the inputs; the 2+ rule, palette hash, and elk compound subflow mapping are all Step 05 view work. Current elkMapping.ts produces a flat elk graph (no compound groups yet) - will need extension.
