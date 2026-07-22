# Layout Pipeline Exploration -- for an edge-routing pass (libavoid-js)

Scope: trace the exact data flow `engine graph -> structural diff -> elk layout
-> React Flow snapshot -> render`, so a new async routing pass can be slotted
in "after layout, before publish". All line numbers verified against the
current tree (2026-07-22).

---

## 1. End-to-end data flow, file:line by file:line

### 1.1 `GraphViewController.runRebuild` -- the pipeline driver
`src/view/GraphViewController.ts:164-195`

```ts
private async runRebuild(): Promise<void> {
    const token = ++this.rebuildToken;                                    // 165
    const mainPath = this.mainPath;
    if (mainPath === null) { this.reset(); return; }
    const result = await this.graphBuilder.build(mainPath);                // 171  (engine build, async)
    if (this.isStale(token)) return;                                       // 172
    if (result === null || result.graph.nodes.length === 0) { this.reset(); return; }
    const graph = result.graph;
    this.controls = result.controls;
    const decision = decideLayout(this.previousGraph, graph, SIZE_RELAYOUT_THRESHOLD); // 181
    const flow = vicinityGraphToFlow(graph, result.controls.mainPinned);   // 182
    if (decision === "reuse-layout") {
        console.debug("vicinity-graph: structural diff skipped elk layout (data-only refresh)");
        this.publish(graph, this.positions, this.groupDimensions, flow);  // 186
        return;
    }
    const laidOut = await this.layoutRunner.layout(vicinityGraphToElk(graph)); // 189 (elk, async)
    if (this.isStale(token)) return;                                      // 190
    this.layoutVersion += 1;                                              // 193
    this.publish(graph, extractElkPositions(laidOut), extractElkDimensionsById(laidOut), flow); // 194
}
```

Pipeline stages in order:
1. `graphBuilder.build(mainPath)` (async; the VicinityEngine + Obsidian vault reads) -> `GraphBuildResult { graph, controls }`.
2. `decideLayout(previous, next, threshold)` (pure, sync) -> `"relayout" | "reuse-layout"`.
3. `vicinityGraphToFlow(graph, mainPinned)` (pure, sync) -> `FlowGraph` (unpositioned nodes + final edges) -- computed on **every** rebuild, both branches.
4. Branch A (`reuse-layout`): skip elk, reuse `this.positions` / `this.groupDimensions` from the previous build.
   Branch B (`relayout`): `layoutRunner.layout(vicinityGraphToElk(graph))` (async; elkjs, possibly + d3-force refinement) -> laid-out `ElkNode`, then `extractElkPositions` / `extractElkDimensionsById` (pure, sync) turn it into `ReadonlyMap<string, XY>` / `ReadonlyMap<string, Dimensions>`.
5. `publish(graph, positions, groupDimensions, flow)` (`GraphViewController.ts:201-219`) -- the only place that mutates controller state and pushes a new `FlowSnapshot` to subscribers.

### 1.2 `publish` -- where routing would slot in
`src/view/GraphViewController.ts:201-219`

```ts
private publish(
    graph: VicinityGraph,
    positions: ReadonlyMap<string, XY>,
    groupDimensions: ReadonlyMap<string, Dimensions>,
    flow: FlowGraph,
): void {
    this.previousGraph = graph;
    this.positions = positions;
    this.groupDimensions = groupDimensions;
    this.setSnapshot({
        status: "ready",
        nodes: withGroupDimensions(withPositions(flow.nodes, positions), groupDimensions), // 212
        edges: flow.edges,                                                                  // 213
        groupByFolder: flow.groupByFolder,
        orphanTruncation: flow.orphanTruncation,
        controls: this.controls,
        layoutVersion: this.layoutVersion,
    });
}
```

**This is the exact seam.** By the time `publish` is called, the caller (`runRebuild`) holds everything a router needs simultaneously:
- `positions: ReadonlyMap<string, XY>` -- **absolute** elk coordinates for every node AND every folder-group container (from `extractElkPositions`, or the reused map on the reuse-layout path).
- `groupDimensions: ReadonlyMap<string, Dimensions>` -- elk-computed container sizes (width/height) for folder-group boxes (from `extractElkDimensionsById`, or reused).
- `graph: VicinityGraph` -- has `graph.nodes` (for `sizePx`/`nodeSideLengthPx`, i.e. leaf box sizes) and `graph.edges` (engine edges, pre-collapse).
- `flow: FlowGraph` -- has `flow.nodes` (still unpositioned -- `UNPLACED`) and, critically, `flow.edges: readonly FlowEdge[]` -- the **final, already-collapsed** edge list that the renderer consumes verbatim (`GraphViewController.ts:213`, wired straight through to `snapshot.edges`).

The natural insertion point is **between step 4 (layout data ready) and step 5 (`publish`)**, i.e. right where `runRebuild` currently has, in each branch:
- reuse-layout branch, `GraphViewController.ts:186`: `this.publish(graph, this.positions, this.groupDimensions, flow);`
- relayout branch, `GraphViewController.ts:194`: `this.publish(graph, extractElkPositions(laidOut), extractElkDimensionsById(laidOut), flow);`

A new async routing step (e.g. `await this.routingRunner.route(obstacles, flow.edges)`) would run after positions/dimensions are known (needed to build libavoid obstacle rects) but before `publish` is called, since `publish` is what freezes the values into the snapshot object the render layer reads. Its output (e.g. `ReadonlyMap<edgeId, routed polyline>`) would need to be threaded into `publish` as a 5th argument and merged onto `flow.edges` (or a new `FlowEdge.route` field) before `edges: flow.edges` is set at line 213. Both call sites (186 and 194) would need the `await routingRunner.route(...)` call inserted, and both are already inside `async runRebuild` -- so the pipeline is already fully async-friendly; a new `await` plus the existing `isStale(token)` staleness check (pattern already used at lines 172 and 190) is the idiom to reuse for the new async boundary, to keep "latest-wins" concurrency correct if a routing pass is slow.

Note there is currently **no separate async step for edges** -- `vicinityGraphToFlow` (edges included) runs synchronously immediately after `decideLayout` (line 182), *before* layout is known to be reused or fresh. So today edges are position-INDEPENDENT data (topology only); a routing pass would be the first stage that needs edges AND final absolute positions together.

### 1.3 `GraphLayoutRunner.layout` -- what layout returns
`src/view/GraphLayoutRunner.ts:14-22`

```ts
export class GraphLayoutRunner {
    private readonly elk = new ElkLayoutRunner();
    async layout(graph: ElkNode): Promise<ElkNode> {
        const laidOut = await this.elk.layout(graph);
        const isForceRoot = graph.layoutOptions?.[ELK_ALGORITHM_OPTION] === ELK_FORCE_ROOT_OPTIONS[ELK_ALGORITHM_OPTION];
        return isForceRoot ? refineForceRootLayout(laidOut) : laidOut;
    }
}
```

Returns a full `ElkNode` tree (the "root" node with nested `children`/`edges`), coordinates **relative to each node's parent** (elk convention) -- NOT flattened, NOT absolute. This is the `laidOut` value in `GraphViewController.ts:189`. It implements the `GraphLayoutPort` interface (`src/view/viewPorts.ts:48-50`: `layout(graph: ElkNode): Promise<ElkNode>`), which is the seam the controller depends on (DIP) -- a new `RoutingPort` could be added the same way, injected via the constructor exactly like `layoutRunner` is (`GraphViewController.ts:89`).

For `force`-mode layouts (`GraphLayoutRunner.ts:19-21`), the elk force pass is only a seed; `refineForceRootLayout` (`src/view/d3ForceRefinement.ts:35-91`) re-arranges the ROOT's direct children (containers + ungrouped leaves) with a static d3-force simulation, converting d3 centre coords back to elk top-left coords at return (`d3ForceRefinement.ts:88`: `{ ...child, x: body.x - body.halfWidth, y: body.y - body.halfHeight }`). Only root-level boxes are touched; nested children (subflow members) are untouched by this refinement, so their relative-to-parent coordinates from the original elk pass stand.

---

## 2. `decideLayout` -- the reuse/relayout decision (route-cache trigger)

`src/view/GraphStructureDiff.ts:22-46`

```ts
export function decideLayout(
    previous: VicinityGraph | null,
    next: VicinityGraph,
    sizeGrowthThreshold: number,
): LayoutDecision {
    if (previous === null) return "relayout";                                          // first build
    if (previous.viewSettings.groupByFolder !== next.viewSettings.groupByFolder) return "relayout";
    if (previous.viewSettings.layoutMode !== next.viewSettings.layoutMode) return "relayout";
    if (!sameIds(nodeIdsOf(previous), nodeIdsOf(next))) return "relayout";              // node added/removed
    if (!sameIds(edgeIdsOf(previous), edgeIdsOf(next))) return "relayout";              // edge added/removed
    if (anyNodeGrewBeyond(previous.nodes, next.nodes, sizeGrowthThreshold)) return "relayout"; // sizePx grew > threshold
    return "reuse-layout";
}
```

`LayoutDecision = "relayout" | "reuse-layout"` (`GraphStructureDiff.ts:20`).

Triggers for `"relayout"` (full elk pass, and -- by the same reasoning -- where a routing cache MUST be invalidated):
- first build ever (`previous === null`)
- `groupByFolder` toggled (folder-group containers appear/disappear -- obstacle set changes shape)
- `layoutMode` switched (`layered`/`radial`/`force` -- positions entirely rearranged)
- node id set changed (any node/obstacle added or removed)
- edge id set changed (`edgeIdOf` -- see `graphIdentity.ts:16-18`, `${source}->${target}`) -- any edge topology change
- a **surviving** node's `sizePx` grew by more than `SIZE_RELAYOUT_THRESHOLD = 1.0` (100%) of its previous size (`GraphStructureDiff.ts:75-89`, `constants.ts:15`) -- obstacle box grew materially

`"reuse-layout"`: everything else -- same node ids, same edge ids, same `groupByFolder`/`layoutMode`, no node grew past the threshold. In this branch the controller reuses `this.positions` / `this.groupDimensions` verbatim (`GraphViewController.ts:186`) and only refreshes node/edge DATA via a freshly computed `flow` (topology-derived fields like counts, titles, badges can change even though positions don't -- e.g. a title rename or a size score change below the relayout threshold).

**Implication for route caching**: a routing pass's cache should key on the *same* signal `decideLayout` uses (or the decision's output value directly) -- on `"reuse-layout"`, routed edge paths computed on a previous build (same absolute positions/dimensions, same node/edge id sets) remain valid and can be reused unchanged, exactly parallel to how `this.positions`/`this.groupDimensions` are carried over. On `"relayout"`, the previous route cache must be invalidated/rerun because positions and/or obstacle boxes changed. Note: `decideLayout` does NOT consider whether the edge SET is literally identical when node data changes (data-only refresh) -- the `flow` edges list can still change shape (e.g. a projected/collapsed edge's `count` or `bidirectional` flag) even on `"reuse-layout"`, if that's driven only by data recomputed in `vicinityGraphToFlow`. In practice, on `reuse-layout`, `buildFlowEdges` (section 4 below) is deterministic given the same graph node/edge id sets and the same `groupFolderByMemberPath`, which is itself derived purely from `graph.nodes`/`groupByFolder` (`folderGrouping.ts:36`) -- so as long as node/edge ids didn't change, the edge topology used for routing is stable too, reinforcing that route caching keyed off `decideLayout`'s decision is safe.

`SIZE_RELAYOUT_THRESHOLD = 1.0` lives at `src/view/constants.ts:15`; `REBUILD_DEBOUNCE_MS = 500` at `constants.ts:21` (debounces vault "resolved" events into one rebuild, `GraphViewController.ts:145-151`).

---

## 3. `FlowSnapshot`, `FlowGraph`, `FlowEdge`, `FlowNode` shapes

### 3.1 `FlowSnapshot` (external-store value the render layer subscribes to)
`src/view/GraphViewController.ts:30-47`

```ts
export interface FlowSnapshot {
    readonly status: FlowStatus;                          // "empty" | "ready"
    readonly nodes: readonly FlowNode[];
    readonly edges: readonly FlowEdge[];
    readonly groupByFolder: boolean;
    readonly orphanTruncation: OrphanTruncation;
    readonly controls: ControlsModel;
    readonly layoutVersion: number;                        // bumped ONLY on fresh elk layout (relayout branch, line 193)
}
```

### 3.2 `FlowGraph` (pure mapping output, pre-position)
`src/view/flowMapping.ts:125-131`

```ts
export interface FlowGraph {
    readonly nodes: readonly FlowNode[];
    readonly edges: readonly FlowEdge[];
    readonly groupByFolder: boolean;
    readonly orphanTruncation: OrphanTruncation;
}
```

### 3.3 `FlowNode` (`flowMapping.ts:76-100`)

```ts
interface FlowNodeBase {
    readonly id: string;         // vault path (notes) or folderGroupIdOf(...) (groups)
    readonly position: XY;       // relative to parentId's origin if present, absolute otherwise (RF subflow convention)
    readonly width: number;
    readonly height: number;
    readonly parentId?: string;  // rendered folder-group container id
}
export interface NoteFlowNode extends FlowNodeBase { readonly kind: "note"; readonly data: FlowNodeData; }
export interface GroupFlowNode extends FlowNodeBase { readonly kind: "folder-group"; readonly data: FlowGroupData; }
export type FlowNode = NoteFlowNode | GroupFlowNode;
```

Before layout, every node gets `position: UNPLACED = { x: 0, y: 0 }` (`flowMapping.ts:134,157`) and group nodes get `width/height = UNSIZED_GROUP_PX = 0` (`flowMapping.ts:140,158-159`) -- real values are patched in by `withPositions`/`withGroupDimensions` at publish time (section 4).

### 3.4 `FlowEdge` (`flowMapping.ts:102-123`)

```ts
export interface FlowEdge {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly count: number;          // distinct links source->target, the count badge (1 = no badge)
    readonly hasOpposite: boolean;    // reverse edge ALSO rendered as a separate FlowEdge -> both curve away from center line
    readonly bidirectional: boolean;  // group-collapsed edge unioning BOTH directions into ONE straight line, arrowhead each end
}
```

`hasOpposite` and `bidirectional` are mutually exclusive by construction (comment at `flowMapping.ts:112-114`): `hasOpposite` only applies to plain note-to-note passthrough pairs (curved), `bidirectional` only to a folder-group-collapsed edge (straight, dual arrowhead). This distinction matters for a router: `hasOpposite` pairs are two SEPARATE `FlowEdge`s (source/target reversed) that must route as two distinct, ideally non-overlapping paths (today handled visually by symmetric curvature, `edgeGeometry.ts` -- a libavoid router would need to route both and likely wants awareness that they are a logical pair to keep them visually distinct); a `bidirectional` edge is a SINGLE `FlowEdge` representing traffic in both directions and needs only one route with two arrowheads.

### 3.5 How `FlowEdge`s reach the renderer today (no server-side routing -- RF/geometry does it)
- `GraphViewController.publish` passes `edges: flow.edges` straight through, untouched (`GraphViewController.ts:213`).
- `VicinityGraphFlow.tsx:42`: `const edges = useMemo<Edge[]>(() => snapshot.edges.map(toReactFlowEdge), [snapshot.edges]);`
- `toReactFlowEdge` (`VicinityGraphFlow.tsx:174-183`) maps a `FlowEdge` to an RF `Edge` carrying only `{ count, hasOpposite, bidirectional }` as `data` -- **no geometry/points are precomputed**; React Flow itself computes `sourceX/sourceY/targetX/targetY` from live node positions/handles at render time and hands them to the custom edge component.
- `VicinityEdge.tsx:34-77` (custom edge renderer, registered as `EDGE_TYPES = { vicinity: VicinityEdge }` at `VicinityGraphFlow.tsx:28`) receives `sourceX/Y, targetX/Y, data` from RF and calls `edgePathFor(sourceX, sourceY, targetX, targetY, data.hasOpposite)` (`src/view/edgeGeometry.ts:62-120`, pure SVG path math: straight line normally, quadratic Bezier bowed `EDGE_PAIR_CURVATURE_PX = 34`px right-of-travel when `hasOpposite`) to get an SVG path string, an inset arrowhead anchor/angle, and a badge label position.

**This is the second seam a routing pass affects**: to make libavoid-computed routes actually render, either (a) `FlowEdge` needs a new field carrying the computed polyline/waypoints (e.g. `readonly route?: readonly XY[]`), threaded through `publish` -> `snapshot.edges` -> `toReactFlowEdge`'s `data` -> `VicinityEdge` (which would then draw a polyline through the waypoints instead of calling `edgePathFor`'s straight/quadratic logic), or (b) routing happens in the controller and only feeds `edgeGeometry`/`VicinityEdge` a pre-baked path. Given RF computes `sourceX/Y`/`targetX/Y` itself from node positions/handles (not from the snapshot), option (a) -- carrying explicit route points on the `FlowEdge`/RF `Edge.data`, with `VicinityEdge` switching to draw them when present -- is the natural least-invasive path; `edgePathFor` would need a sibling function (or a branch) that turns a waypoint list into an SVG polyline path plus arrow/label anchors, still keeping the module RF-free and node-testable per its existing header comment.

---

## 4. Absolute vs. parent-relative coordinates -- the exact conversion point

There are exactly two coordinate spaces in play, and exactly one conversion function.

### 4.1 Absolute space: `extractElkPositions` (elk output -> flat map)
`src/view/elkMapping.ts:138-157`

```ts
/**
 * Flattens a laid-out elk graph into absolute node positions. elk reports child
 * coordinates relative to their parent; the offset accumulation keeps this
 * correct for nodes nested under folder containers (step-05). The RF-side
 * conversion back to parent-relative coordinates happens in `withPositions`.
 */
export function extractElkPositions(laidOut: ElkNode): ReadonlyMap<string, XY> {
    const positions = new Map<string, XY>();
    collectPositions(laidOut, 0, 0, positions);
    return positions;
}
function collectPositions(node: ElkNode, offsetX: number, offsetY: number, out: Map<string, XY>): void {
    for (const child of node.children ?? []) {
        const x = (child.x ?? 0) + offsetX;
        const y = (child.y ?? 0) + offsetY;
        out.set(child.id, { x, y });
        collectPositions(child, x, y, out);   // recurse, accumulating offsets
    }
}
```

Elk's raw `ElkNode.x/y` are relative to the immediate parent. `extractElkPositions` walks the tree accumulating offsets, so the returned `ReadonlyMap<string, XY>` (`positions` in `GraphViewController`) has **absolute** coordinates for EVERY id in the tree -- both folder-group container ids (`folder-group:<folder>`) and leaf note ids (vault paths) -- all in one shared coordinate space, top-level root at origin. This is the map stored as `this.positions` (`GraphViewController.ts:75`) and passed into `publish`.

`extractElkDimensionsById` (`elkMapping.ts:164-177`) similarly flattens container/leaf sizes into one `ReadonlyMap<string, Dimensions>` (width/height), no offset math needed since sizes aren't nested.

### 4.2 Parent-relative space: `withPositions` (flat absolute map -> RF subflow convention)
`src/view/flowMapping.ts:305-326`

```ts
/**
 * Applies laid-out (or preserved) positions to freshly mapped nodes. ... Positions
 * in the map are ABSOLUTE (extractElkPositions); children of a rendered group are
 * converted to parent-relative coordinates here, because that is what React Flow
 * subflows expect. ...
 */
export function withPositions(nodes: readonly FlowNode[], positions: ReadonlyMap<string, XY>): readonly FlowNode[] {
    return nodes.map((node) => {
        const absolute = positions.get(node.id);
        if (absolute === undefined) return node;
        const parentOrigin = (node.parentId === undefined ? undefined : positions.get(node.parentId)) ?? UNPLACED;
        return { ...node, position: { x: absolute.x - parentOrigin.x, y: absolute.y - parentOrigin.y } };
    });
}
```

**This is the exact conversion point**: for a node with a `parentId` (a note inside a rendered folder group), the FINAL `FlowNode.position` is `absolute - parentAbsolute`; for a node with no `parentId` (ungrouped note, or the group container itself), `position` stays absolute (parentOrigin falls back to `UNPLACED = {0,0}`).

`withGroupDimensions` (`flowMapping.ts:338-349`) is the dimension-side counterpart, applying elk-computed container width/height onto `FlowGroupData` nodes only (note nodes keep their engine-driven square size).

Both are called together at `publish` time: `GraphViewController.ts:212`:
```ts
nodes: withGroupDimensions(withPositions(flow.nodes, positions), groupDimensions),
```

### 4.3 Implication for a routing pass
A libavoid router needs **absolute** coordinates for every obstacle (note squares, group container rects) and endpoint, because obstacles nested in different groups must be checked for overlap in one shared space. The `positions`/`groupDimensions` maps available in `runRebuild` right before `publish` (section 1.2) are ALREADY in exactly this absolute space (pre-`withPositions` conversion) -- this is the ideal input for the router, not `flow.nodes` (which are still `UNPLACED`) and not the final `snapshot.nodes` (which are parent-relative for grouped children and hence NOT directly comparable/overlap-testable across group boundaries without re-adding each node's parent offset).

Concretely, to build a libavoid obstacle for a grouped note node, a router would need: `absoluteX = positions.get(notePath)`, `size` (i.e. `graph.nodes` matching `sizePx`, or `extractElkDimensionsById` for the rare case a leaf's elk-echoed size is wanted) -- all available before `withPositions` is applied. If the router instead produces relative-to-parent route points to match what `VicinityEdge` will ultimately need to draw (since RF passes `sourceX/Y`/`targetX/Y` computed in whatever space RF nodes live in -- parent-relative + RF's own absolute-position resolution internally), the safest design is: route in the SAME absolute space as `positions`, then apply the identical `absolute - parentOrigin` conversion (reusing or mirroring `withPositions`'s math) per waypoint before attaching them to a `FlowEdge`, OR route entirely in absolute space and let RF (which internally tracks each node's absolute position for edge-connection purposes) resolve everything -- matching how RF already computes `sourceX/sourceY/targetX/targetY` in absolute screen/flow space for `VicinityEdge` regardless of subflow nesting.

---

## 5. Obstacles: how "root note squares / folder-group container rects / subflow child squares" map to snapshot data

### 5.1 Node sizing -- one shared invariant
`src/view/graphIdentity.ts:38-45`

```ts
/**
 * Nodes render (and lay out) as squares of the engine's diff-stable `sizePx`.
 * Both the elk input and the React Flow node must use the SAME number or layout
 * positions and rendered boxes drift apart.
 */
export function nodeSideLengthPx(node: GraphNode): number {
    return node.sizePx;
}
```

`GraphNode.sizePx` (`src/engine/types.ts:95`, "Pixel size mapped from `sizeScore`; the stable field step-04 diffs against") is the SINGLE sizing source of truth. Both `vicinityGraphToElk` (`elkMapping.ts:37-39`: `const side = nodeSideLengthPx(node); return [node.path, { id: node.path, width: side, height: side }];`) and `vicinityGraphToFlow` (`flowMapping.ts:168,174-175`: `const side = nodeSideLengthPx(node); ... width: side, height: side`) call the SAME function, so elk's obstacle geometry and RF's rendered box are guaranteed identical -- this is exactly the invariant a router must also respect (obstacle rects must match rendered squares 1:1 or routed paths will visually clip/overlap the boxes).

### 5.2 Three obstacle kinds, all traceable to elk + `graph.nodes`

1. **Root/ungrouped note squares** -- every `GraphNode` not claimed by a rendered folder group (`grouping.groupFolderByMemberPath` from `deriveFolderGroups`, `folderGrouping.ts:36-61`, only populated when `groupByFolder` is true AND a folder has `>= MIN_GROUP_MEMBER_COUNT = 2` members, `folderGrouping.ts:25,52`). In elk these become `ungroupedLeaves` at the ROOT level (`elkMapping.ts:59-62`); in the flow/RF layer these are `NoteFlowNode`s with no `parentId` (`flowMapping.ts:176`: `...(groupFolder === undefined ? {} : { parentId: ... })`). Obstacle rect = `{ position: positions.get(path) [absolute], width: sizePx, height: sizePx }`.

2. **Folder-group container rects** -- one per `FolderGroup` (`folderGrouping.ts:11-15`, `{ folder, memberPaths }`), rendered ONLY when `groupByFolder` is on and the folder has 2+ visible members. In elk these are `containers: ElkNode[]` (`elkMapping.ts:41-58`) -- id = `folderGroupIdOf(group.folder)` (`graphIdentity.ts:29-31`, prefix `"folder-group:"`), with `children` = the member leaves and internal layout options (`ELK_GROUP_PADDING = "[top=36.0,left=16.0,bottom=16.0,right=16.0]"`, `constants.ts:134`, extra top padding reserved for the folder-name label). elk computes the wrapped-around-children container size, extracted via `extractElkDimensionsById` (which walks `children` recursively collecting any node with defined `width`/`height`, `elkMapping.ts:170-176` -- this captures BOTH containers and leaves, though only group nodes actually consume it via `withGroupDimensions`). In the flow layer these are `GroupFlowNode`s (`flowMapping.ts:153-166`), initially `UNSIZED_GROUP_PX = 0` until `withGroupDimensions` patches in the elk size. Obstacle rect = `{ position: positions.get(folderGroupId) [absolute], width/height: groupDimensions.get(folderGroupId) }`.

3. **Subflow child squares (nested member notes)** -- member notes of a rendered group. In elk these are `children` of their `container` `ElkNode` (`elkMapping.ts:44-46`), positioned relative to the container by elk, then flattened to ABSOLUTE by `extractElkPositions`'s offset accumulation (`elkMapping.ts:150-156`, recursing with `offsetX/offsetY` = the container's own absolute position). In the flow layer these are `NoteFlowNode`s with `parentId = folderGroupIdOf(groupFolder)` (`flowMapping.ts:176`), whose FINAL rendered `position` is parent-relative (`withPositions`, section 4.2) but whose obstacle geometry for routing purposes should use the ABSOLUTE value straight out of `positions` (pre-conversion), same as case 1 -- this is why the routing pass belongs before `withPositions`/`withGroupDimensions` are applied, working directly off the `positions`/`groupDimensions` maps in `runRebuild`.

### 5.3 Collapsed (group-to-group / group-to-note) edges vs. child-level (note-to-note) edges

Two independent pipelines produce parallel-but-separate collapsing logic that MUST agree (documented explicitly as a cross-module contract):

**Layout-side collapsing** -- `projectedRootEdges`, `src/view/elkMapping.ts:84-122`, used only for `radial`/`force` (`SEPARATE_CHILDREN`) layout modes; for `layered` mode (`INCLUDE_CHILDREN`), cross-boundary edges instead reference nested leaves directly (`elkMapping.ts:72-74`). Rule (`intraGroupContainerOf`, `elkMapping.ts:124-136`): an edge whose two endpoints project to the SAME folder-group container is emitted as a genuine member-to-member intra-group edge, attached to that container's own `edges` array (`elkMapping.ts:64-70`: `if (container?.edges !== undefined) container.edges.push(...)`). An edge whose endpoints project to DIFFERENT containers (or one grouped + one ungrouped) is a `crossBoundaryEdge`; under `SEPARATE_CHILDREN` modes these get PROJECTED -- grouped endpoint replaced by its container id (`projectedIdOf`, `elkMapping.ts:101-104`) -- deduped by projected pair (`edgesById` keyed by `${from}->${to}`, `elkMapping.ts:110,116-119`), and oriented centre-outward by `minDepth` (`elkMapping.ts:105-115`) purely to steer elk's radial tree derivation -- these edges exist ONLY to influence layout, never rendered directly (comment: "Positions are all the pipeline consumes... so these edges exist purely to steer the layout").

**Render-side collapsing** -- `buildFlowEdges`, `src/view/flowMapping.ts:218-257`, is the ACTUAL edge set that reaches the renderer (`flow.edges` -> `snapshot.edges`). Same `projectId`/mirrors-`projectedRootEdges` logic (comment at `flowMapping.ts:206-207`: "mirrors `projectedRootEdges` in elkMapping, so layout and rendering agree"), but with different semantics:
  - **PASSTHROUGH** (`flowMapping.ts:229-243`): `!wasProjected || projSource === projTarget` -- neither endpoint projected (both ungrouped), OR both project to the SAME group (intra-group, kept member-to-member, "never a group self-loop"). These keep normal `hasOpposite` curved-pair semantics (`hasOpposite: renderedEdgeIds.has(edgeIdOf({source: edge.target, target: edge.source}))`, checking the reverse engine edge exists, line 239).
  - **COLLAPSED** (`flowMapping.ts:244,259-277` `accumulateCollapsedEdge`): projected endpoints differ AND at least one endpoint was actually projected (`wasProjected`). These union by UNORDERED projected pair (`sort().join(UNORDERED_PAIR_KEY_SEPARATOR)`, line 265, where the separator is a U+0000 NUL character chosen as collision-proof, line 202) -- direction-agnostic accumulator (`CollapsedEdgeAccumulator`, lines 193-199: `{from, to, forwardSeen, backwardSeen, count}`), first-seen orientation fixes `{from,to}` deterministically (no sort on emission, only on the dedup key), later edges union `forwardSeen`/`backwardSeen` and sum `count`. Final emission (`flowMapping.ts:246-255`): `id: "${pair.from}->${pair.to}"`, `source: pair.from`, `target: pair.to`, `hasOpposite: false` (always, by construction -- a collapsed pair is ONE edge not two), `bidirectional: pair.forwardSeen && pair.backwardSeen`.

**Attachment point for routing**: a collapsed `FlowEdge`'s `source`/`target` are folder-group ids (or one group id + one ungrouped note id) -- i.e. they attach to the GROUP CONTAINER RECT (obstacle kind 2, section 5.2), not to any individual member note inside it. A passthrough intra-group `FlowEdge`'s `source`/`target` are the actual member note paths -- i.e. they attach to SUBFLOW CHILD SQUARES (obstacle kind 3) nested inside the same container, and a router routing this edge should almost certainly treat it as an internal route WITHIN that container's local space (or treat the container as non-obstructing for its own children, since both endpoints are its own children) -- the layout math already knows this via elk's own container child ownership; the equivalent knowledge for the router is `groupFolderByMemberPath` from `deriveFolderGroups` (`folderGrouping.ts`), invoked identically by BOTH `elkMapping.ts:34` and `flowMapping.ts:147` -- the same pure/deterministic contract a router would need to call a third time (or receive as a shared derived value) to know which obstacles are "inside" which container for exclusion purposes.

---

## 6. Summary: what a routing pass needs and where it plugs in

Inputs available simultaneously right before either `publish` call site (`GraphViewController.ts:186` and `:194`):
- `graph: VicinityGraph` -- `graph.nodes` (sizePx per note), `graph.edges` (pre-collapse engine topology), `graph.viewSettings.groupByFolder`/`layoutMode`.
- `positions: ReadonlyMap<string, XY>` -- ABSOLUTE position for every note AND every folder-group container id (same coordinate space, ready-made for obstacle rects and routing waypoints).
- `groupDimensions: ReadonlyMap<string, Dimensions>` -- container width/height (leaf note width/height instead comes from `graph.nodes[i].sizePx` / `nodeSideLengthPx`).
- `flow.edges: readonly FlowEdge[]` -- the FINAL collapsed/passthrough edge list (source/target ids already resolved to whichever obstacle -- note or group -- they logically attach to); this is what needs routed geometry attached before `publish` sets `edges: flow.edges` (`GraphViewController.ts:213`).
- `grouping`/`groupFolderByMemberPath` (currently recomputed independently inside both `vicinityGraphToElk` and `vicinityGraphToFlow` via `deriveFolderGroups`) -- needed to know which obstacles are "children of" which container, for excluding self-containment from collision checks.

Insertion shape (conceptually, without prescribing final code): an async `routingRunner.route(positions, groupDimensions, graph, flow.edges)` call added right after the `laidOut`/reuse branch resolves and right before `this.publish(...)`, at BOTH call sites (186, 194), producing e.g. `ReadonlyMap<edgeId, readonly XY[]>` (absolute-space waypoints) that `publish` merges onto `flow.edges` (or a parallel structure) before setting `snapshot.edges`. The existing `token`/`isStale` guard (already checked right after each `await`, lines 172/190) is the idiom to reuse to keep the new async boundary consistent with the controller's documented "latest-wins" concurrency model (`GraphViewController.ts:22-25`). `decideLayout`'s `"reuse-layout"` vs `"relayout"` output (section 2) is the correct cache-invalidation signal for routed paths, mirroring exactly how `this.positions`/`this.groupDimensions` are reused today.

Render-side, `VicinityEdge.tsx`/`edgeGeometry.ts` currently compute their own straight/curved path purely from RF-supplied endpoint coordinates and the `hasOpposite` flag -- no waypoint list exists yet in the `FlowEdge`/RF `Edge.data` shape; wiring libavoid output through to actually change what's drawn requires extending `FlowEdge` (`flowMapping.ts:102-123`) with route data, threading it through `toReactFlowEdge` (`VicinityGraphFlow.tsx:174-183`), and adding a polyline-drawing branch in `VicinityEdge`/`edgeGeometry`.
