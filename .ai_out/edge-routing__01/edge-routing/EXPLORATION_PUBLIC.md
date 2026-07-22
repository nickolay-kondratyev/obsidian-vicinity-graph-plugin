# EXPLORATION_PUBLIC — edge-routing__01 (routing pass + snapshot threading)

Index of exploration findings for CLARIFICATION / PLANNING / REVIEW. Read the
detailed files as needed; this page is the map + the load-bearing facts.

## Detailed exploration files (read these)
- `EXPLORATION_layout.md` — layout pipeline: data flow layout→publish, reuse/relayout decision, FlowSnapshot/FlowEdge shapes, absolute-vs-relative coords, obstacle mapping + edge attachment.
- `EXPLORATION_settings.md` — `edgeRouting` boolean ViewSetting wiring (copy `groupByFolder`/`layoutMode`), settings-tab toggle, gate site.
- `EXPLORATION_rendering_loader.md` — RF edge data threading (FlowEdge→RF→VicinityEdge), libavoid loader shim (stays), throwaway spike delete-list, AvoidArena relocation.

## Spike (ticket 00) inherited facts
- WASM loads via primary data-URL path in real Obsidian/Electron. `wasmBinary` fallback unreachable (not implemented).
- Nested-shape endpoint attachment WORKS — no "attach to group" fallback needed for the common case.
- Memory rule: Router OWNS ShapeRef/ConnRef/ShapeConnectionPin (freed by `destroy(router)`); only Point/Rectangle/ConnEnd are destroyed explicitly. Double-free → wasm abort.
- `loadAvoid()` lazy singleton; caches only success, resets on failure for retry. libavoid-js pinned `0.4.5`.

## Load-bearing facts for implementation
1. **Insertion seam**: `GraphViewController.runRebuild` (`src/view/GraphViewController.ts:164-195`) is one async method; both reuse + elk branches converge on `publish(graph, positions, groupDimensions, flow)` (`:201-219`). Insert `await router.route(...)` right before the two `publish` calls (~:186, ~:194). Reuse the existing `isStale(token)` staleness guard (`:172,:190`) for latest-wins.
2. **Coordinates**: `positions`/`groupDimensions` available just before `publish` are ABSOLUTE (`extractElkPositions` `elkMapping.ts:144-157` flattens elk tree to absolute). The only convert-to-parent-relative happens inside `publish`→`withPositions` (`flowMapping.ts:315-326`). ⇒ route in absolute space. RF renders edges in absolute flow-space too, so routedPoints need NO transform to render later (decision #2 confirmed — put as code comment).
3. **Route cache key**: `decideLayout` (`GraphStructureDiff.ts:22-46`) returns `relayout` on first build, groupByFolder/layoutMode change, node/edge id-set change, or node sizePx growth > `SIZE_RELAYOUT_THRESHOLD=1.0`. Cache the EdgeRouteMap alongside reused positions; re-route when edges changed but positions reused; skip when inputs unchanged. (Do NOT force elk relayout on `edgeRouting` flip — positions don't change; instead invalidate route cache.)
4. **Obstacles** (all keyed by `nodeSideLengthPx = node.sizePx`, `graphIdentity.ts:43-45`): ungrouped leaf squares; folder-group container rects (elk dims via `extractElkDimensionsById`); grouped member leaf squares (nested, absolute). Collapsed folder-group edges attach to the GROUP container rect; passthrough intra-group edges attach to member squares. Router needs `groupFolderByMemberPath` (from `deriveFolderGroups`, `folderGrouping.ts:36`) to know which obstacle is "self" for an edge. Two collapsing pipelines exist — `projectedRootEdges` (`elkMapping.ts:96-122`, layout-only) and `buildFlowEdges`/`accumulateCollapsedEdge` (`flowMapping.ts:218-277`, rendered). The ROUTED edges are the rendered ones (buildFlowEdges output).
5. **Threading**: FlowEdge (`flowMapping.ts:102-123`) gains `readonly routedPoints?: RoutedPoint[]`; thread into `toReactFlowEdge` data (`VicinityGraphFlow.tsx:174`) → `VicinityEdgeData` (`VicinityEdge.tsx:25`). Rendering does NOT branch on it this phase.
6. **New module `src/view/edgeRouting.ts`** (RF-free): `interface EdgeRouter { route(input): Promise<EdgeRouteMap> }` (DIP, fake in tests), `LibavoidEdgeRouter` impl. `EdgeRoutingInput`={obstacles: named type w/ id,x,y,widthPx,heightPx (absolute) + edges: named type w/ id,sourceId,targetId}. `EdgeRouteMap = Map<edgeId, RoutedPoint[]>`, `RoutedPoint={x,y}`. `EDGE_ROUTING_SHAPE_BUFFER_PX` named const (relate to `EDGE_PAIR_CURVATURE_PX=34`, `edgeGeometry.ts:54`).
7. **Memory ⚠**: `AvoidArena` currently lives in the THROWAWAY `src/view/libavoidSpike.ts:40-87`, NOT in `libavoidLoader.ts` (spike ticket note was inaccurate). `LibavoidEdgeRouter` must own an equivalent arena internally (decision #5: no libavoid object escapes the class). Preserve the memory rules verbatim.
8. **Failure containment**: wasm init or routing throws → `console.warn` ONCE with plugin prefix, publish snapshot WITHOUT routedPoints. Single pass-level fallback, no per-edge silent fallbacks.
9. **Setting gate**: `edgeRouting` boolean default OFF. When OFF: pass never runs, wasm never loads. Copy `groupByFolder` wiring; ticket REQUIRES a settings-tab toggle (`VicinityGraphSettingTab.ts`).

## Throwaway spike cleanup (this ticket)
- Delete: `src/view/libavoidSpike.ts`, `src/view/libavoidSpike.test.ts`, `e2e/libavoidSpike.e2e.ts`.
- Surgical edit `src/main.ts`: remove throwaway imports (`:18-20`), `debug-spike-libavoid-routing` command (`:91-98`), `spikeLibavoidRouting()` method (`:178-211`).
- After cleanup, `Avoid.`/`avoid.<Member>` usage must appear ONLY in `edgeRouting.ts` + `libavoidLoader.ts` (acceptance criterion).

## Stays (production-shaped from spike)
- `src/view/libavoidLoader.ts` (`loadAvoid()` + Avoid types), `src/types/libavoidWasm.d.ts`, esbuild `.wasm` base64 wiring (`esbuild.config.mjs:9-24,111-113`).
