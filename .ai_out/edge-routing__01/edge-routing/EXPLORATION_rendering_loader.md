# Exploration: RF edge rendering (Part A) + libavoid loader shim (Part B)

## PART A — RF edge rendering / threading

### A1. FlowEdge → RF edge
- `FlowEdge` type — `src/view/flowMapping.ts:102-123`:
  `{ id, source, target, count, hasOpposite, bidirectional }` (pure, RF-free).
- `toReactFlowEdge` — `src/view/VicinityGraphFlow.tsx:174`:
  ```ts
  data: { count: edge.count, hasOpposite: edge.hasOpposite, bidirectional: edge.bidirectional }
  ```
  Called from edges memo `:42` `snapshot.edges.map(toReactFlowEdge)`. Edge type registered `:28` `{ vicinity: VicinityEdge }`, wired `:77`.
- **Threading point (ticket 01)**: add `readonly routedPoints?: RoutedPoint[]` to FlowEdge; add `routedPoints: edge.routedPoints` to `data` (omit-when-undefined style acceptable).

### A2. VicinityEdgeData
- `src/view/VicinityEdge.tsx:25-30`: `{ count, hasOpposite, bidirectional }`. `VicinityEdgeType = Edge<VicinityEdgeData,"vicinity">`.
- Component `:34-77` uses RF props `sourceX/sourceY/targetX/targetY` (NOT from data) → `edgePathFor(...)`. data only toggles straight/curved + arrowheads.
- **Threading point**: add `readonly routedPoints?: RoutedPoint[]` to VicinityEdgeData. **DO NOT branch rendering on it this phase** (that's ticket 02). Type+thread only.

### A3. edgeGeometry.ts — coordinate space (DESIGN DECISION #2 confirmation)
- `EDGE_PAIR_CURVATURE_PX = 34` at `:54` (basis for `EDGE_ROUTING_SHAPE_BUFFER_PX`).
- `edgePathFor(sourceX,sourceY,targetX,targetY,hasOpposite)` `:62-120`: straight `M s L t` when no opposite; quadratic Bézier when hasOpposite. Arrow inset back along tangent.
- **CONFIRMED coordinate space**: RF `EdgeProps` endpoint coords are **absolute flow-space** — RF re-derives each node's absolute rect from parent chain even for subflow children. `withPositions` (`flowMapping.ts:305-326`) makes NODE.position parent-relative for subflow children, but the `positions` map fed in is absolute (from `extractElkPositions`). ⇒ **routedPoints computed in ABSOLUTE coords need NO transform to render later.** Put this as the code comment ticket decision #2 asks for.

### A4. Publish path
- `GraphViewController.runRebuild` `:164-193` builds `flow=vicinityGraphToFlow(...)`, reuse cached positions (`decideLayout==="reuse-layout"` `:183-187`) or elk `:189-193`, then `publish(...)` `:195-209` sets `edges: flow.edges` verbatim. **Insert routing pass here (after layout, before publish).**

## PART B — libavoid loader shim + spike throwaway

### B1. `src/view/libavoidLoader.ts` (STAYS — production-shaped)
- Exports `interface Avoid` (`:20-48`, narrowed WebIDL surface: consts PolyLineRouting/OrthogonalRouting/ConnDirAll/shapeBufferDistance/segmentPenalty/crossingPenalty; ctors Point/Rectangle/Router/ShapeRef/ShapeConnectionPin/ConnEnd/ConnRef; `destroy(obj)`; index signature).
- `AvoidPoint{x,y}`, opaque `AvoidRectangle`/`AvoidShapeRef`/`AvoidConnEnd`, `AvoidPolyLine{size();get_ps(i)}`, `AvoidRouter{processTransaction();setRoutingParameter(p,v);setRoutingOption(o,b)}`, `AvoidConnRef{displayRoute()}`.
- **`loadAvoid(): Promise<Avoid>`** `:105-120` — lazy singleton (`cached` `:87`), only successful promise memoized; failed attempt resets `cached` for retry `:113-117`; concurrent callers share in-flight promise. `WASM_DATA_URL` `:85` = `data:application/octet-stream;base64,${libavoidWasmBase64}` from virtual import.

### B2. `src/types/libavoidWasm.d.ts` (STAYS) — `declare module "libavoid-wasm"` default string. Exists because libavoid-js exports map blocks deep `.wasm` import.

### B3. `esbuild.config.mjs` (STAYS) — `:9-24` virtual-module `onResolve` plugin mapping `libavoid-wasm` → on-disk `dist/libavoid.wasm`; `:111-113` `loader:{".wasm":"base64"}` + plugins list. libavoid-js pinned `0.4.5`.

### B4. THROWAWAY — delete list
- **Delete files**: `src/view/libavoidSpike.ts` (214 lines), `src/view/libavoidSpike.test.ts` (64 lines), `e2e/libavoidSpike.e2e.ts` (81 lines).
- **Surgical edits to `src/main.ts`**:
  - `:18-20` throwaway imports (`loadAvoid` from libavoidLoader, `runNestedScenario/runObstacleScenario/runStressLoop` from libavoidSpike) — remove (main.ts has no other use of loadAvoid).
  - `:91-98` `addCommand({ id:"debug-spike-libavoid-routing", ... })` — remove.
  - `:178-211` `private async spikeLibavoidRouting()` method — remove.
  - Leave everything else (open-vicinity-graph, debug-log-vicinity-graph, refreshOpenViews, lifecycle) untouched.

### B5. ⚠ CRITICAL DISCREPANCY — `AvoidArena` is in the THROWAWAY file
- The spike ticket's closing note says `AvoidArena` is in `libavoidLoader.ts` ("stays"). **It is NOT.** `grep AvoidArena src/` → only `src/view/libavoidSpike.ts:40,118,153`.
- `AvoidArena` (`libavoidSpike.ts:40-87`) encodes the load-bearing memory rule:
  - **Router OWNS** ShapeRef, ConnRef, ShapeConnectionPin — freed by `avoid.destroy(router)`. Destroying them yourself = double-free/heap corruption/abort.
  - **Only leaf allocs YOU make** — Point, Rectangle, ConnEnd — must be tracked + destroyed explicitly. Router destroyed LAST in `dispose()` `finally`.
  - `newRouter()/point()/connEnd()` track in `this.owned`; `shape(router,rect)` allocs Point×2+Rectangle (tracked) but returns router-owned ShapeRef (NOT tracked). Wrap scenario in `try{...}finally{arena.dispose()}`.
- **ACTION for ticket 01**: `edgeRouting.ts`'s `LibavoidEdgeRouter` must own an equivalent arena internally (satisfies decision #5 "no libavoid object escapes the class"). Either move `AvoidArena` into `libavoidLoader.ts` before deleting the spike, OR re-implement equivalent inside `edgeRouting.ts`. Do NOT lose these memory rules.

### B6. `Avoid.` grep acceptance
- Today ALL real `avoid.<Member>` call sites live in `libavoidSpike.ts` (+ its test). `libavoidLoader.ts` only uses `AvoidLib.load`/`getInstance` (factory), never an Avoid instance member.
- After deleting spike files, `edgeRouting.ts` becomes the SOLE file reintroducing `avoid.<Member>` calls → satisfies acceptance criterion "`Avoid.` only appears in edgeRouting.ts + loader shim".

## File map
| Concern | File |
|---|---|
| FlowEdge→RF | VicinityGraphFlow.tsx:174 |
| Edge data shape | VicinityEdge.tsx:25 |
| Path math / coord space | edgeGeometry.ts (curvature :54) |
| FlowEdge type + build | flowMapping.ts:102, :218-277 |
| Routing pass wiring point | GraphViewController.ts:164-209 |
| Loader (stays) | libavoidLoader.ts |
| wasm ambient decl (stays) | src/types/libavoidWasm.d.ts |
| esbuild wasm loader (stays) | esbuild.config.mjs:9-24,111-113 |
| Delete | libavoidSpike.ts, libavoidSpike.test.ts, e2e/libavoidSpike.e2e.ts |
| Surgical edit | main.ts:18-20, 91-98, 178-211 |
| AvoidArena (relocate!) | libavoidSpike.ts:40-87 |
