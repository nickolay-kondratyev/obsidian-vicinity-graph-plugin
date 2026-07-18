# EXPLORATION: Engine + Adapter API (Step 04 View Shell)

## 0. Exact call path (active file → graph)
```
active file path (string)
  → NeighborhoodGraphBuilder.build(mainPath): Promise<NeighborhoodGraph | null>   [adapters/NeighborhoodGraphBuilder.ts:34]
      → ObsidianLinkProvider.create(vault, metadataCache, canvasParseCache)  (async index)
      → GraphRequestAssembler.assemble(...) → GraphBuildRequest  (docid→path translation)
      → new NeighborhoodEngine(provider).build(request): NeighborhoodGraph   [engine/NeighborhoodEngine.ts:47]
```
- Composition root wires builder in `main.ts:50-58`; exposed as `plugin.graphBuilder`. **View calls `await plugin.graphBuilder.build(activeFile.path)`.**
- Reference impl: `logNeighborhoodGraph()` (main.ts:141-173): `getActiveFile()` → `build(path)` → render nodes/edges.
- `build()` returns `null` when `mainPath` doesn't resolve to a vault file (NeighborhoodGraphBuilder.ts:35-38). **View must handle null.**
- View constructor currently `new NeighborhoodGraphView(leaf)` (main.ts:63) — wiring builder/plugin in is step-04 work.

## 1. Engine PUBLIC API
- `new NeighborhoodEngine(provider: LinkProvider).build(request: GraphBuildRequest): NeighborhoodGraph` — pure, synchronous, never imports obsidian/React (importGuard.test.ts).
- **Input `GraphBuildRequest`** (NeighborhoodEngine.ts:27-37) — PATH-keyed; view does NOT assemble this (assembler/builder do).
- **Output `NeighborhoodGraph`** (types.ts:174-181):
  ```ts
  interface NeighborhoodGraph {
    nodes: readonly GraphNode[];
    edges: readonly GraphEdge[];
    hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>;  // folder badges
    viewSettings: ViewSettings;   // ACTUAL post-cascade settings used
  }
  ```
- **`GraphNode`** (types.ts:73-96) → React Flow nodes:
  `path: VaultPath` (**node id**), `docid?`, `title` (basename, label), `folder: FolderPath` ("" = root; drives elk groups), `sizeBytes`, `isCentral` (MAIN + all pinned roots), `isMain` (only active-file root), `depthTags`, `minDepth`, `attachments`, `firstImagePath?`, `sizeScore [0,1]`, **`sizePx`** (pixel size — diff-stable field).
- **`GraphEdge`** (types.ts:98-105): `{ source: VaultPath; target: VaultPath }`, directed (linker→linked), deduped, **no id — synthesize `${source}->${target}`**. Both endpoints always visible nodes (attachments never endpoints).
- Supporting: `DepthTag {rootPath, direction, depth}`; `AttachmentRef {path, isImage}`; `Direction = "outgoing"|"incoming"`; branded `VaultPath`/`DocId`/`FolderPath` w/ `asVaultPath`/`asDocId`/`asFolderPath`; `EdgeVisibilityMode = "walked-from-center"|"all-edges"`.

## 2. Engine pipeline stages
`NeighborhoodEngine.build()` (NeighborhoodEngine.ts:47-91): resolve view settings → multi-root BFS → sizing → truncation → assemble → edge visibility.
- **NeighborhoodTraversal** (`.ts:55`): `traverse(roots): TraversalResult`. Multi-root directional BFS, unioned/deduped by path. Skips non-node-bearing roots.
- **NodeSizer** (`.ts:30`): `computeSizes(nodes, sizing): ReadonlyMap<VaultPath, NodeSize>`. See §5.
- **GraphTruncator** (`.ts:29`): `static truncate(input): TruncationResult` — caps NON-central nodes (centrals exempt), ranked by NodePriorityChain. Result: `{visiblePaths, visibleEdges, hiddenNodeCountsByFolder}`.
- **EdgeVisibility** (`.ts:27`): `static edgesFor(input)`. walked-from-center passes walked edges; all-edges sweeps induced subgraph.
- **NodePriorityChain** (`.ts:33`): `static compare(a,b)` — deterministic order: minDepth asc → sizeScore desc → distanceToMain asc → pinTimestamp desc → docid → path.
- **NodeEligibility** (`.ts:10`): `isNodeBearing(path): boolean`.

## 3. Settings resolution
- View does NOT resolve settings — engine does internally, returns effective set as `graph.viewSettings`.
- **Effective `ViewSettings`** (types.ts:158-164): `{ nodeCap; groupByFolder; edgeVisibility; sizing }`.
  - `SizingSettings` (types.ts:149-155): `{ metrics: Record<SizeMetricId,{enabled,weight}>; depthDecayK; minPx; maxPx }`.
  - `SizeMetricId`: own-file-size | total-linker-size | backlink-count | outlink-count | depth-decay.
- **Defaults** (constants.ts EngineDefaults): nodeCap 100, depths 1/1, minPx 40, maxPx 160, depthDecayK 1; `viewSettings()`: groupByFolder true, only own-file-size enabled.

## 4. Adapters
- **NeighborhoodGraphBuilder** (`.ts:22`): async orchestration / **view entry point**. `build(mainPath: string): Promise<NeighborhoodGraph|null>`. READ path (getDocId, not ensureDocId). Main doc without docid still builds.
- **GraphRequestAssembler** (`.ts:41`): `static assemble(inputs): GraphBuildRequest` — pure docid→path translation.
- **ObsidianLinkProvider** (`.ts:32`) implements LinkProvider. `static async create(vault, metadataCache, canvasParseCache)`. resolvedLinks + getBacklinksForFile w/ fallback; canvas fallback parser.
- **obsidianPorts.ts**: structural ports (DIP) — VaultPort, MetadataCachePort, DocIdPort (`ensureDocId`/`getDocId`/`isEligible`), VaultFilePort.
- **BacklinksAdapter** (`.ts:10`): single place touching `getBacklinksForFile`.
- **LinkProvider** seam (LinkProvider.ts:34-41): `getOutgoingLinks`/`getIncomingLinks`/`getFileMetadata`. `FileMetadata { folder, sizeBytes, isNodeBearing, attachments }`.
- **PluginDataStore** API (`.ts:23-55`): `globalDepths()`, `globalView()`, `pins()`, `hasPin`, `saveGlobalDepths`, `saveGlobalView`, `addPin`, `removePins`. On plugin as `this.pluginDataStore` (step-06 settings UI).

## 5. NodeSizer computed size — for SIZE_RELAYOUT_THRESHOLD
- Field: **`sizePx`** on GraphNode (types.ts:94-95) / NodeSize (NodeSizer.ts:8-12). Units: **pixels**.
- Formula (NodeSizer.ts:52): `sizePx = minPx + sizeScore*(maxPx-minPx)`. Default `[40,160]`.
- Centrals pinned to sizeScore 1 → maxPx.
- Documented as "the stable field step-04 diffs against". **Diff by `node.path`; compare old vs new `sizePx`; delta beyond threshold → relayout.**

## 6. isEligible (md/canvas) for MAIN active-file tracking
- Adapter: `DocIdPort.isEligible(file): boolean` (obsidianPorts.ts:66) — used by builder at :40.
- Pure rule: **`FileKinds.isNodeBearingPath(path: string): boolean`** (src/shared/FileKinds.ts:19) — `NODE_BEARING_EXTENSIONS = {md, canvas}`. Also `isImagePath`.
- **View MAIN tracking: gate on `FileKinds.isNodeBearingPath(file.path)` (pure, sync) before calling `build`** — active attachment/image should NOT trigger rebuild (matches Obsidian local-graph behavior).

## Key gotchas
- Node id (RF/elk) = `node.path` (string). Edge id synthesized from source+target.
- `folder=""` for vault root; use for elk group containers when `groupByFolder`.
- `build()` is async + returns null — debounce/guard rapid active-file changes.
- Centrals cap-exempt, sized to maxPx; `isMain` = single active-file root (center focus).
- `hiddenNodeCountsByFolder` → folder-group "N more" badges.
- Engine pure/sync; view only touches `plugin.graphBuilder.build(path)`.
