# EXPLORATION — plugin side of the edge pipeline (sparse eval 10-vs-11 edge flake)

> Produced by the read-only EXPLORE agent; transcribed verbatim by TOP_LEVEL_AGENT
> (the agent had no Write tool). Line numbers are as of branch `sparse-eval-edge-flake`
> @ 92e10c9 — re-verify before editing.
>
> NOTE: this agent and the harness-side agent (`EXPLORATION_PUBLIC__harness.md`) ran
> independently and converged on the SAME primary root cause.

## 1. Full path: active note → React Flow edges in the DOM

| Hop | File:line | What happens |
|---|---|---|
| Obsidian events | `src/view/VicinityGraphView.tsx:120-124` | `active-leaf-change` + `file-open` → `controller.handleActiveFileChanged`; `metadataCache.on("resolved")` → `controller.handleMetadataResolved` |
| Rebuild gate (pure) | `src/view/RebuildDecision.ts:16-27` | same-path / non-node-bearing → ignore |
| Controller | `src/view/GraphViewController.ts:190-245` `runRebuild()` | token → `graphBuilder.build` → `decideLayout` → `vicinityGraphToFlow` → `layoutRunner.layout` → `resolveRoutes` → `publish` |
| Adapter orchestration | `src/adapters/VicinityGraphBuilder.ts:36-70` | **builds a NEW `ObsidianLinkProvider` per rebuild** (`:41`), loads docids/doc-data, assembles the request, calls the engine |
| Provider seam | `src/adapters/ObsidianLinkProvider.ts:99-129` | `getOutgoingLinks` / `getIncomingLinks` / `getLinkCount` over the live metadata cache; canvas handled by capability |
| Engine | `src/engine/VicinityEngine.ts:54-101` | resolve settings → `VicinityTraversal` → `NodeSizer` → `GraphTruncator` → `EdgeVisibility` |
| Traversal | `src/engine/VicinityTraversal.ts:94-134`, `EdgeAccumulator.ts:15-22` | multi-root BFS, edges deduped by `source\0target`, first-insertion order |
| Truncation | `src/engine/GraphTruncator.ts:30-54` | node cap; `visibleEdges` = walked edges with both endpoints visible |
| Edge visibility | `src/engine/EdgeVisibility.ts:38-58` | `walked-from-center` passthrough, or `all-edges` induced sweep via `provider.getOutgoingLinks` over `visiblePaths` |
| Node+edge → flow model | `src/view/flowMapping.ts:165-296` | `vicinityGraphToFlow` + `buildFlowEdges` (folder-group collapse) |
| Layout | `src/view/GraphLayoutRunner.ts:24-31` → `ElkLayoutRunner.ts:15` (elk) → `d3ForceRefinement.ts:34-111` | elk `force` seed, then d3-force run **statically to convergence** |
| Routing | `GraphViewController.ts:256-314` → `src/view/edgeRouting.ts:115-168` (`extractEdgeRoutingInput`) + `:453-499` (libavoid wasm) | routes computed once per rebuild, after layout, before publish |
| Publish | `GraphViewController.ts:347-365` | `FlowSnapshot` in an external store |
| Render | `src/view/VicinityGraphFlow.tsx:40-130` | `useSyncExternalStore` → `<ReactFlow nodes edges …>`, `VicinityEdge.tsx` draws the path |

## 2. Where edges are counted / produced — and what the eval's `edges=N` actually is

**The `edges=N` number in `[eval] force/sparse:` is a MODEL number, not a DOM number.** It comes from:

```
GraphViewController.ts:297-303
console.debug("vicinity-graph: edge routing pass", {
    obstacleCount: input.obstacles.length,
    edgeCount: input.edges.length,        // ← the eval's edges=N
    …
```

`input` is `extractEdgeRoutingInput(...)` (`edgeRouting.ts:115`). Its edge list is the FlowEdge list filtered to edges whose *both endpoints produced an obstacle* (`edgeRouting.ts:160-166`). Every flow node gets an elk position and every group gets elk dimensions on the relayout path, so in practice **no edge is dropped there** — `edgeCount` ≡ post-group-collapse flow edge count ≡ engine edge count.

Consequences:
- **Viewport culling is NOT the cause of this metric.** It is logged pre-render. (It *would* matter for DOM counts — see below.)
- The edge set is derived purely from the link graph + folder-collapse: deterministic **given a fixed provider answer**. Nothing geometric removes an edge.
- Routed edge set never differs in SIZE from the model edge set in a way that changes the count: `withRoutedPoints` (`GraphViewController.ts:483-494`) only attaches points; `clipRoutesToObstacles` (`:427-447`) never drops an edge; a routing failure returns `EMPTY_ROUTES` → edges render *straight*, never removed.

**Viewport culling can remove an edge from the DOM** (relevant to `.react-flow__edge-path` counts in `vicinityGraph.e2e.ts:125`, and to the known culling ticket):
- `VicinityGraphFlow.tsx:102` `onlyRenderVisibleElements`
- `node_modules/@xyflow/react/dist/esm/index.js:2403-2427` `useVisibleEdgeIds` → `isEdgeVisible`
- `node_modules/@xyflow/system/dist/esm/index.js:1020-1035`: edge visible iff the **union bbox of the two endpoint node rects** overlaps the viewport rect. So yes — culling depends on settled node positions and the current transform, i.e. on `fitView` timing.

## 3. Async / racy seams

| Seam | file:line |
|---|---|
| `active-leaf-change` handler | `VicinityGraphView.tsx:121` |
| `file-open` handler (**second** event for one note open; deduped by same-path ignore `RebuildDecision.ts:24`) | `VicinityGraphView.tsx:122` |
| `metadataCache "resolved"` → **500 ms debounce → an EXTRA rebuild** | `VicinityGraphView.tsx:123`, `GraphViewController.ts:170-177`, `constants.ts:26` (`REBUILD_DEBOUNCE_MS = 500`) |
| Async engine build (docid + doc-data IO, new provider each time) | `GraphViewController.ts:197`, `VicinityGraphBuilder.ts:41-61` |
| Async elk layout | `GraphViewController.ts:221` |
| Async wasm routing (lazy `import("./libavoidLoader")`) | `GraphViewController.ts:279`, `edgeRouting.ts:458` |
| Latest-wins token + stale checks | `GraphViewController.ts:191, 198, 226, 243, 304` |
| **Routing perf log emitted BEFORE the stale check** — stale passes are logged too (deliberate, documented `:291-295`) | `GraphViewController.ts:297` vs `:304` |
| Route cache: identical signature → cached, **logs nothing** | `GraphViewController.ts:271-273`, signature `:408-418` |
| `requestAnimationFrame(fitView)` on `layoutVersion` / `paneReady` | `VicinityGraphFlow.tsx:147-153` |
| Orphan sweep timer (unrelated) | `main.ts:165` |

**Routing is NOT recomputed per simulation tick.** d3-force is `.stop()`ped and ticked synchronously to convergence inside one layout call (`d3ForceRefinement.ts:95-98`); routing then runs exactly once per rebuild.

So: **one note activation can produce two rebuild passes** — the immediate one and the debounced `resolved` one 500 ms later — and *both* log an `edge routing pass` line if their routing signatures differ.

## 4. Truncation / limits / tie-breaks — ruled out

- Only cap is `nodeCap` (`GraphTruncator.ts:42`); the sparse fixture (~9 notes) is far under it, and the spec's own overlay assertion (`vicinityGraph.e2e.ts:141`) shows nothing hidden.
- The only score `sort(` in `src/engine` is `GraphTruncator.ts:33` → `NodePriorityChain.compare`, which is a **total order** ending in `lexicographic(a.path, b.path)` (`NodePriorityChain.ts:41`) — no arbitrary tie possible.
- Other sorts: `ViewSettingsResolver.ts:30` (pins), `truncationBadges.ts:48` (`localeCompare`), `flowMapping.ts:284` (2-element key sort — deterministic), `ReferenceOrder.ts:45` (numeric offsets).
- Map/Set iteration order is insertion order and only affects edge *order*, never count (`EdgeAccumulator.ts`, `EdgeVisibility.ts:50-58`).
- **No max-edge cap and no degree limit exists anywhere.**

## 5. Existing determinism tests / can this be a fast test?

- `src/engine/EdgeVisibility.test.ts:122` — "same input twice → identical edge lists".
- `src/engine/VicinityEngine.test.ts:163` — "same request built twice → identical outputs".
- `src/engine/GraphTruncator.test.ts:122`, `GraphTruncator.denseFixtures.test.ts:75,296`, `NodePriorityChain.test.ts:86`, `VicinityEngine.denseFixtures.test.ts:51`.

The engine **is** deterministic given a fixed `FakeLinkProvider`, so the flake cannot be reproduced at the engine layer. It **can** be reproduced fast one layer up: drive `ObsidianLinkProvider` + `VicinityEngine` from a fake `MetadataCachePort` whose `resolvedLinks` (a) lacks and (b) contains a `.canvas` key, and assert the edge count differs by exactly one. Existing scaffolding: `src/adapters/ObsidianLinkProvider.test.ts`, `CanvasCapability.test.ts`, `FakeObsidianPorts.ts`.

## 6. Window globals / test hooks

- **None.** `grep window.|globalThis` over `src/view` + `src/adapters` + `src/main.ts` yields only `GraphViewController.test.ts:799` (`vi.stubGlobal`) and the `window.setTimeout/clearTimeout` uses.
- e2e reaches the plugin through Obsidian's own registry: `window.app.plugins.plugins["vicinity-graph"].pluginDataStore` (`e2e/edgeRoutingEval.e2e.ts:102-106`), possible because `main.ts:28-32` exposes `persistenceServices`, `graphBuilder`, `pluginDataStore` as public fields.
- **There is no settled-state signal a Playwright spec could poll.** `VicinityGraphView.controller` is private (`VicinityGraphView.tsx:28`) and `FlowSnapshot.layoutVersion` / `edges.length` are not reachable from the page. Adding a getter (view → `controller.getSnapshot()`) would give the harness a deterministic condition to poll instead of `waitForTimeout(4500)`.

---

## Ranked candidate root causes

### 1. (Most likely, PLUGIN-side) Per-rebuild canvas-capability re-detection races the metadata cache
`VicinityGraphBuilder.ts:41` constructs a fresh `ObsidianLinkProvider` on **every** rebuild, and `ObsidianLinkProvider.create` (`:74`) re-runs `CanvasCapabilityDetector.detect(Object.keys(metadataCache.resolvedLinks))` (`CanvasCapability.ts:20-27`), which returns `"core-indexed"` only if a `.canvas` key is already present in `resolvedLinks`.

- **fallback-required** → canvas outgoing links come from `CanvasFallbackParser`, which parses **file-type nodes only** and deliberately skips text-node wikilinks (`CanvasFallbackParser.ts:7-8, 50-58`).
- **core-indexed** → canvas links come from `resolvedLinks`, which **includes** the text node's `[[note2]]`.

The sparse fixture's `test.canvas` has exactly one such text node: `scripts/setup-dev-vault.sh:72` — `{ "id": "n3", "type": "text", "text": "Text node with a [[note2]] wikilink — skipped in V1." }`. That is **exactly one edge** (`test.canvas → note2.md`), and both endpoints are already nodes either way, so the **node/obstacle count stays 13** — matching the ticket's "obstacles=13 stable, edges 10↔11".

**For:** exact ±1 magnitude; node count invariant; sparse is the only fixture containing a canvas (`medium`/`dense`/`facing` are self-contained, `setup-dev-vault.sh:142,208,241,330`) and is also the **first** test in a serial file → coldest cache. **Against:** by the first test the view is already open and settings were written, so resolvedLinks is probably warm — needs a measurement (log the detected capability per build).

### 2. (Likely co-factor, HARNESS-side) Two logged passes + arbitrary tie-break in `lastDurations`
`edgeRoutingEval.e2e.ts:137-141` picks the heaviest routing entry by `obstacleCount` with `.sort((a,b)=>sizeOf(b)-sizeOf(a))[0]`. Two passes tying at 13 obstacles but differing in edges resolve by V8's *stable* sort → the **earlier** pass wins. Whether an earlier (colder) pass is logged at all depends on (a) the 500 ms `resolved` debounce firing inside the 4500 ms window (`GraphViewController.ts:173`), (b) the route cache suppressing an identical pass (`:271`), and (c) stale passes being logged before the stale check (`:297` vs `:304`). This alone can flip the reported number even if the plugin converges to a single correct value.

### 3. (Plausible, weaker) General metadata-cache warm-up in the `all-edges` induced sweep
`EdgeVisibility.ts:49-58` re-asks `provider.getOutgoingLinks` for every visible node; `ObsidianLinkProvider.outgoingPathsOf` (`:221-239`) resolves each reference via `getFirstLinkpathDest`, falling back to raw `resolvedLinks` keys when `getFileCache` is not yet indexed. An unresolved link during warm-up drops an edge. **Against:** the sparse fixture's markdown links are trivial and the vault is indexed at startup; also the induced sweep never consults backlinks, so `BacklinksAdapter` timing cannot change the edge count (only the node set, which is stable).

### 4. (Ruled out) Truncation / tie-break instability
Total order with a path-lexicographic terminator (`NodePriorityChain.ts:41`); cap not binding on a 9-node fixture; no edge cap exists. Cannot produce a 10↔11 flip.

### 5. (Ruled out for this metric; real elsewhere) React Flow viewport culling
`edgeCount` is logged from the model at `GraphViewController.ts:297`, before render. Culling (`VicinityGraphFlow.tsx:102`; `@xyflow/react` `useVisibleEdgeIds`; `@xyflow/system` `isEdgeVisible`) *can* remove an edge from the DOM based on settled positions + `fitView` timing (`VicinityGraphFlow.tsx:147-153`), which is the mechanism behind `ticket-e2e-headless-culling-unmounts-main-node.md` — but it cannot explain the `[eval] edges=` number.

### 6. (Ruled out) Layout nondeterminism
d3-force uses a fixed-seed LCG (`d3ForceRefinement.ts:133-140`) and runs statically; elk sets no `elk.randomSeed` (`constants.ts:99-103`, ELK's default is 1). Even if positions varied, they cannot change the edge *count* — only the routing signature, i.e. whether an extra pass gets logged (feeds cause #2).

**Recommended next measurement (cheap, decisive):** add a one-line `console.debug` of the detected `CanvasCapability` + `graph.edges.length` per build, run the sparse fixture 5×, and see whether the 10-runs correlate with `"fallback-required"`. If yes → cause #1 (real plugin bug: capability should be detected once and/or the canvas fallback should be cache-invalidated, not re-decided per rebuild). If capability is always `core-indexed` and two passes are logged with different edge counts → cause #2/#3.
