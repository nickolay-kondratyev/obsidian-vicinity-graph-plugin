# Step 05 Rich Rendering — View/Rendering Layer Exploration

Repo: obsidian-neighborhood-graph. React Flow (`@xyflow/react` **^12.11.2**) + `elkjs` **^0.12.0**, React **^18.3.1**. All view code under `src/view/`.

## 1. View shell (built in step 04)

- **`src/view/NeighborhoodGraphView.tsx`** — the `ItemView`. `VIEW_TYPE_NEIGHBORHOOD_GRAPH = "neighborhood-graph-view"` (L13). Thin lifecycle shell: owns the React root + Obsidian events only.
  - `onOpen` (L44-57): constructs `ObsidianNoteNavigator(this.app)`, `GraphViewController(navigator, graphBuilder, new ElkLayoutRunner())`, registers events, `controller.start()`, then `createRoot(this.contentEl).render(<StrictMode><NeighborhoodGraphFlow controller={controller}/></StrictMode>)`.
  - `onClose` (L59): `controller.dispose()`, `root.unmount()`.
  - `registerGraphEvents` (L80-85): `active-leaf-change` + `file-open` -> `controller.handleActiveFileChanged(navigator.activeFilePath())`; `metadataCache.on("resolved")` -> `controller.handleMetadataResolved()`.
  - `getState`/`setState` (L72-78): deliberately persist nothing view-specific (V1).
  - Registered in **`src/main.ts` L63-66** via `this.registerView(...)`; command `open-neighborhood-graph` -> `activateView()` (L216-225) opens a right-sidebar leaf.

- **`src/view/NeighborhoodGraphFlow.tsx`** — the ONLY file that imports `@xyflow/react` (by design; pure mapping modules stay RF-free).
  - `NeighborhoodGraphFlow({controller})` (L15): subscribes via `useSyncExternalStore(controller.subscribe, controller.getSnapshot)`.
  - Maps snapshot to RF arrays with `useMemo` (L18-19). `onNodeClick` (L21-24) -> `controller.openNode(node.id)`.
  - Empty state (L26): `<div className="neighborhood-graph-empty">`.
  - Render (L30-37): `<div className="neighborhood-graph-flow"><ReactFlow nodes edges onNodeClick fitView><Background/><Controls/></ReactFlow></div>`. **No `nodeTypes`/`edgeTypes`/`ReactFlowProvider`/`MarkerType` anywhere** (grep confirmed none in `src/`).
  - `toReactFlowNode` (L40-48): builds a **default** RF node — `data: { label: node.data.title }`, `style: { width, height }`. **DROPS** isCentral/isMain/sizePx/attachments/folder — only title survives to render.
  - `toReactFlowEdge` (L50-52): `{ id, source, target }` only — no `markerEnd`, no type, no label.

- **`src/view/GraphViewController.ts`** — the rebuild pipeline + external store (`subscribe`/`getSnapshot`, L55-60).
  - `FlowStatus = "empty" | "ready"`; **`FlowSnapshot { status, nodes: readonly FlowNode[], edges: readonly FlowEdge[] }`** (L25-29). NOTE: snapshot carries only FlowNode/FlowEdge — **not** the full `NeighborhoodGraph`, so folder/attachments/hiddenNodeCountsByFolder are currently unavailable to the renderer.
  - Pipeline `runRebuild` (L104-133): `graphBuilder.build(mainPath)` -> `decideLayout(previousGraph, graph, SIZE_RELAYOUT_THRESHOLD)` -> `neighborhoodGraphToFlow(graph)`; if `"reuse-layout"` keep positions (`withPositions`), else `layoutRunner.layout(neighborhoodGraphToElk(graph))` -> `extractElkPositions`. Latest-wins via `rebuildToken` (L105/135). Debounced resolve rebuilds (`REBUILD_DEBOUNCE_MS`).
  - `openNode(path)` (L98-100) -> `navigator.openNote(path)`. Holds `previousGraph`, `positions`, `mainPath`.

- **`src/view/ElkLayoutRunner.ts`** — thin wrapper: `import ELK from "elkjs/lib/elk.bundled.js"`; `layout(graph): Promise<ElkNode>` runs in-thread (no web worker). Satisfies `GraphLayoutPort`.

- **`src/view/viewPorts.ts`** — DIP ports (types only):
  - `GraphSourcePort.build(mainPath): Promise<NeighborhoodGraph | null>`
  - `GraphLayoutPort.layout(graph: ElkNode): Promise<ElkNode>`
  - **`NoteNavigatorPort { activeFilePath(): string | null; openNote(path: string): void }`** (L25-28) — the navigation port. Only single-arg openNote; no ctrl/cmd variant, no hover.

- **`src/view/ObsidianNoteNavigator.ts`** — implements `NoteNavigatorPort`. `openNote` (L17-23): `vault.getFileByPath(path)` then `workspace.getLeaf(false).openFile(file)` (main-area editor). Holds `app: App`.

## 2. How graph data reaches React Flow today

Flow: `NeighborhoodGraphBuilder.build(mainPath)` (`src/adapters/NeighborhoodGraphBuilder.ts`) -> `NeighborhoodEngine.build` -> `NeighborhoodGraph`. Controller maps it through the **pure, RF-free** mapping modules:

- **`src/view/flowMapping.ts`** (`neighborhoodGraphToFlow`, L47-68): engine `GraphNode` -> `FlowNode`.
  - `FlowNodeData { path, title, isCentral, isMain, sizePx }` (L16-22). **This is the current node payload — it OMITS `folder`, `attachments`, `firstImagePath`, `sizeScore`, `depthTags`, `minDepth` that the engine already produces.**
  - `FlowNode { id (=vault path), position: XY, width, height, data }` (L24-31). Nodes rendered as **squares**: `width=height=nodeSideLengthPx(node)=node.sizePx`.
  - `FlowEdge { id, source, target }` (L33-37) — no direction/count metadata.
  - `withPositions(nodes, positions)` (L77-82): applies elk/preserved positions.
- **`src/view/elkMapping.ts`**: `neighborhoodGraphToElk(graph)` (L20-34) -> flat `ElkNode` (nodes = root `children`, edges hang off root). `extractElkPositions` (L41-54) recursively accumulates parent offsets — **already compound-ready** (comments L11-17 explicitly note folder-group nesting will reuse this unchanged).
- **`src/view/graphIdentity.ts`**: `edgeIdOf(edge)` = `` `${source}->${target}` `` (L15-17); `nodeSideLengthPx(node)=node.sizePx` (L24-26). Shared truth for RF + elk + diff.
- **`src/view/constants.ts`** — elk options baseline (L40-46): `elk.algorithm=layered`, `elk.direction=DOWN` (`ELK_DIRECTION` L29), **`elk.hierarchyHandling=INCLUDE_CHILDREN`** (already set for future folder groups), `nodeNodeBetweenLayers=80`, `spacing.nodeNode=40`. `ELK_ROOT_ID="root"`. Also `SIZE_RELAYOUT_THRESHOLD=1.0`, `REBUILD_DEBOUNCE_MS=500`.
- **`src/view/GraphStructureDiff.ts`**: `decideLayout(previous, next, threshold)` -> `"relayout" | "reuse-layout"` by node-id set + edge-id set + size growth.

Conversion boundary summary: engine output -> `flowMapping`/`elkMapping` (plain objects) -> controller snapshot (`FlowNode`/`FlowEdge`) -> `NeighborhoodGraphFlow.toReactFlowNode/Edge` (actual `@xyflow/react` `Node`/`Edge`).

### Engine data already available (src/engine/types.ts) but not yet surfaced
`GraphNode` (L73-96) has: `path, docid?, title, folder: FolderPath, sizeBytes, isCentral, isMain, depthTags, minDepth, attachments: AttachmentRef[], firstImagePath?, sizeScore (0..1), sizePx`. `AttachmentRef { path, isImage }` (L46-49). `NeighborhoodGraph` (L174-181) also has **`hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>`** (truncation badges) and `viewSettings` (incl. `groupByFolder`, default **true** — `src/engine/constants.ts` L64). Sizing bounds: `minPx=40`, `maxPx=160`.

## 3. Current styling approach

- **`src/view/graph-view.css`** is the AUTHORED source (only rules: `.neighborhood-graph-flow{width/height:100%}`, `.neighborhood-graph-empty{padding:var(--size-4-4);color:var(--text-muted)}`). Already uses Obsidian CSS vars.
- **`styles.css`** (repo root) is **GENERATED** at build time = `@xyflow/react/dist/style.css` + `graph-view.css` (see `esbuild.config.mjs` L26-44, `generateStylesCss`). **Do NOT edit styles.css directly — edit `src/view/graph-view.css`.** RF base CSS exposes `--xy-*` custom-property theming with a `.react-flow.dark` variant.
- No CSS-in-JS except inline `style={{width,height}}` on nodes (NeighborhoodGraphFlow L46). Class-naming convention: `neighborhood-graph-*` (kebab, BEM-ish).
- Obsidian theme vars in use: `--text-muted`, `--size-4-4`. Step 05 should key colors/borders off Obsidian vars (`--background-*`, `--text-*`, `--interactive-accent`, `--color-*`) rather than RF `--xy-*` defaults.

## 4. Current interaction handling

- Click: `onNodeClick` (NeighborhoodGraphFlow L21-24) -> `controller.openNode(id)` -> `navigator.openNote` -> `workspace.getLeaf(false).openFile`. **No ctrl/cmd-click handling, no hover handler, no `hover-link` event** (grep: zero `hover-link`/`getResourcePath`/`hoverPopover` in src). `<Controls/>` gives pan/zoom/fit; `fitView` on mount.
- No node/edge selection styling beyond RF defaults. `<Background/>` dots.

## 5. Extension points vs. required modification for Step 05

| Step-05 feature | Where it plugs in | Current gap |
|---|---|---|
| Custom node component (title/thumbnail/icon strip/tiers/size) | `nodeTypes` prop on `<ReactFlow>` (NeighborhoodGraphFlow L32) + new `.tsx` node component | No `nodeTypes` today; nodes are RF default rendering `data.label`. |
| Node payload (attachments, firstImage, folder, sizeScore, tiers) | `FlowNodeData` (flowMapping.ts L16-22) + `toReactFlowNode` (L40-48) | Payload drops everything but title; must widen `FlowNodeData` + mapping. |
| Snapshot exposing folder/hidden counts | `FlowSnapshot` (GraphViewController L25-29) | Snapshot lacks `hiddenNodeCountsByFolder`, `viewSettings`, folder membership — controller must carry them (or full graph) through. |
| Folder-group subflows | `neighborhoodGraphToElk` (elkMapping L20-34) must nest children under folder container nodes + move intra-folder edges onto them; `flowMapping` must emit RF group/parent nodes (`parentId`, `extent:"parent"`, group `type`) | Flat today; `extractElkPositions` already handles nesting. `elk.hierarchyHandling=INCLUDE_CHILDREN` already set. New pure module for group-membership (2+ rule) + folder-color hash. |
| Directed edges w/ arrowheads + A<->B offset curvature | `edgeTypes` + `markerEnd`/`type` in `toReactFlowEdge` (NeighborhoodGraphFlow L50-52); custom edge component | Edges plain, no markers/type; engine edges are already directed (`GraphEdge {source,target}`). |
| Collapsed multi-edge + count badge | New pure edge-collapsing module before `FlowEdge` emission; engine already dedups per ordered pair, so counts come from pairing A->B with B->A | `FlowEdge` has no count field. |
| Truncation badges | `NeighborhoodGraph.hiddenNodeCountsByFolder` (types L178) -> surface via snapshot -> group/overlay node | Not currently threaded to view. |
| Thumbnails | New port method (e.g. `resourcePath(path)` -> `vault.getResourcePath`) on `NoteNavigatorPort`/`ObsidianNoteNavigator` | Not present. |
| ctrl/cmd-click alternate open | `onNodeClick` reads `event.metaKey/ctrlKey`; extend `NoteNavigatorPort.openNote(path, opts)` + `ObsidianNoteNavigator` | Single-target only. |
| hover -> `hover-link` native preview | node `onMouseOver` -> `app.workspace.trigger("hover-link", {...})`; needs `app`/hover port | Absent. |
| Theme CSS vars | `src/view/graph-view.css` (authored source; rebuilt into styles.css) | Minimal; add node/group/edge classes keyed to Obsidian vars. |

## 6. React Flow version + wrappers

- `@xyflow/react` **^12.11.2** (package.json). `elkjs` **^0.12.0**, React/ReactDOM **^18.3.1**.
- Wrappers: RF is fully encapsulated in **`src/view/NeighborhoodGraphFlow.tsx`** (only importer). Pure mapping modules (`flowMapping.ts`, `elkMapping.ts`, `graphIdentity.ts`, `GraphStructureDiff.ts`) are intentionally RF/elk-runtime-free (`import type` only) and node-tested. No `ReactFlowProvider` currently (needed if step-05 node/edge components call `useReactFlow`/`useStore`).

## Modification Map (concise)

1. **flowMapping.ts** — widen `FlowNodeData` (add folder, attachments, firstImagePath, sizeScore, tier flags); add group/parent node emission; add edge-collapse + direction/count fields to `FlowEdge`. Keep pure + tested (folder-color hash, edge collapsing, 2+ group rule, attachment->icon mapping all belong here per plan's "pure logic vitest-covered").
2. **elkMapping.ts** — emit compound children under folder containers + relocate intra-folder edges; container sizing. `extractElkPositions` unchanged.
3. **GraphViewController.ts** — thread `hiddenNodeCountsByFolder` + `viewSettings`/group data into `FlowSnapshot`.
4. **NeighborhoodGraphFlow.tsx** — register `nodeTypes` (rich node, group node) + `edgeTypes` (arrow/curved), pass `markerEnd`, handle ctrl/cmd-click + hover in `onNodeClick`/`onNodeMouseEnter`, possibly wrap in `ReactFlowProvider`.
5. **New node/edge `.tsx` components** (thumbnail lazy-load via resource path, icon strip, dropdown — lean Obsidian `Menu`, count badges).
6. **viewPorts.ts / ObsidianNoteNavigator.ts** — extend navigator: `openNote(path, {newLeaf})`, `resourcePath(path)`, hover-link trigger (needs `app`).
7. **src/view/graph-view.css** — all new classes theme via Obsidian CSS variables; verify light/dark. (styles.css regenerates automatically.)
8. New pure modules + vitest: folder-color hash, edge collapsing/pairing, group-membership (2+), attachment->icon-strip mapping.

Blocking issues: none. Note two non-obvious facts: (a) `styles.css` is generated — never hand-edit it; (b) the controller snapshot currently truncates engine node data to 5 fields, so most step-05 node content requires widening `FlowNodeData`/`FlowSnapshot` before any rich component can render it.
