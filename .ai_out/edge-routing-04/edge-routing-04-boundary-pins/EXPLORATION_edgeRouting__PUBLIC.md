# Exploration: edge-routing__04 (boundary pins + detour-ratio telemetry)

## 1. `src/view/edgeRouting.ts` — `LibavoidEdgeRouter` (294 lines)

**Constants (~143-147, private, not exported):**
```ts
const CENTRE_PIN_CLASS = 1;      // pin class id shared by every shape + every ConnEnd
const PIN_CENTRE_FRACTION = 0.5; // proportional pin at shape centre
```
**Tuning constants (exported):** `EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX/2 = 17` (~62),
`EDGE_ROUTING_SEGMENT_PENALTY_PX = 50` (~73), `EDGE_ROUTING_CROSSING_PENALTY_PX = 0` (~87, disabled for perf).

**`AvoidArena` (~167-211):** owns libavoid allocations, `dispose()` frees them. Tracks ONLY leaf
objects it allocates (Points, Rectangles, ConnEnds). Router owns ShapeRefs/ConnRefs/**pins** and
frees them itself — pushing a pin into `arena.owned` = double-free → wasm abort. Current pin code
already does NOT track pins; 8×pins keeps this contract.

**`route()` (~231-283) — the method to modify.** Current obstacle loop:
```ts
for (const obstacle of input.obstacles) {
  const shape = arena.shape(router, rectOf(obstacle));
  new avoid.ShapeConnectionPin(shape, CENTRE_PIN_CLASS, PIN_CENTRE_FRACTION, PIN_CENTRE_FRACTION, true, 0, avoid.ConnDirAll);
  shapeById.set(obstacle.id, shape);
}
```
Connector loop uses `arena.connEnd(shape, CENTRE_PIN_CLASS)` for src/dst (~269-270) — references
pins **by class id ONLY, never by individual pin**. So Phase A registers MORE same-class pins per
shape; **connector-creation code needs NO change**. Then `router.processTransaction()` once (~274).

Phase A: 8 pins/shape at sides `(0.5,0)/(1,0.5)/(0.5,1)/(0,0.5)` + corners `(0,0)/(1,0)/(0,1)/(1,1)`,
side pins get facing `ConnDir*`, corners `ConnDirAll`.

**`extractEdgeRoutingInput` (~109-141, pure):** iterates `input.nodes: FlowNode[]`; folder-group
uses `groupDimensions.get(id)`, note uses `node.width/height`. Skips nodes without position; drops
edges whose endpoint isn't an obstacle. `FlowNode` is discriminated union tagged
`kind: "note" | "folder-group"` (flowMapping.ts:91-101).

**`RoutingObstacle` (~22-29): NO kind field today:**
```ts
export interface RoutingObstacle { id; x; y; widthPx; heightPx; }
```
If Phase A fallback ("boundary pins on folder-group shapes only") is needed, thread `kind` from
`FlowNode.kind` → `RoutingObstacle` → `route()`.

**The `console.debug("vicinity-graph: edge routing pass", …)` line is NOT here** — it's in
GraphViewController.ts (see §3).

## 2. `src/view/libavoidLoader.ts` — `Avoid` interface (~20-48)

Only `ConnDirAll` is typed (`readonly ConnDirAll: number`); everything else via
`readonly [key: string]: unknown`. Compiled binding HAS `ConnDirNone/Up/Down/Left/Right/All`
(grepped in dist). Accessing `avoid.ConnDirLeft` today = `unknown` (needs cast). **Add:**
```ts
readonly ConnDirUp: number; readonly ConnDirDown: number;
readonly ConnDirLeft: number; readonly ConnDirRight: number;
```
`ShapeConnectionPin` ctor returns `unknown` intentionally (pins never read back) — keep as-is.

## 3. `src/view/GraphViewController.ts`

`resolveRoutes()` (~239-289) is sole call site of `edgeRouter.route()` (DIP seam, prod=Libavoid,
tests=fake). Flow: guard (skip if routing off or radial) → `extractEdgeRoutingInput` → cache check
via `routingSignature` → `route()` → **debug log (~266-270)** → `clipRoutesToObstacles(routes, input)` → cache.

Debug line (Phase B extends this object with max/mean detour ratio):
```ts
console.debug("vicinity-graph: edge routing pass", {
  obstacleCount: input.obstacles.length, edgeCount: input.edges.length,
  durationMs: performance.now() - routeStart });
```
`clipRoutesToObstacles` (~383-403) calls `clipRouteToEndpointRects(route, sourceRect, targetRect)`
per edge (RoutingObstacle structurally = ClipRect). **KEEP unchanged** (ticket). Radial layout
skips routing (`ROUTING_SKIPPED_LAYOUT_MODE = "radial"`, ~351) — untouched.
`routingSignature` (~366-374) hashes only x/y/w/h + edge ids — adding `kind` to RoutingObstacle
won't require signature change (verify).

## 4. `src/view/edgeGeometry.ts` — Phase B home (492 lines, pure, RF-free)

Exports incl.: `EDGE_PAIR_CURVATURE_PX = 34`, `edgePathFor(...)`, `ROUTED_CORNER_RADIUS_PX = 10`,
`ClipRect` interface (LOCAL, not imported from edgeRouting — keeps math layer routing-type-free),
`clipRouteToEndpointRects(points, sourceRect, targetRect)` (~171-194), `routedPathFor`,
`polylineMidpoint` (arc-length walk via `Math.hypot` accumulation — reuse pattern), `routedGeometryFor`.

**Phase B `detourRatio`:** compute AFTER clipping ⇒ `arcLength(points) / chordLength(points[0], points[last])`
(clip already moves termini to boundaries, so chord = `Math.hypot(last.x-first.x, last.y-first.y)`,
no rect math). Guard chord length 0 (return 1 or skip) — match file's "never emit NaN" convention.

## 5. Test conventions

- `import { describe, expect, it, vi, beforeAll } from "vitest";`
- Names: `"WHEN <trigger> THEN <outcome>"`, one behavior per test.
- `edgeGeometry.test.ts` (287 lines): PURE math, no wasm/mocks. Helpers:
  `const pt = (x,y): RoutedPoint => ({x,y})`, `const rect = (x,y,w,h): ClipRect => ({x,y,widthPx:w,heightPx:h})`.
  Phase B: add `describe("detourRatio", ...)` reusing these.
- `edgeRouting.test.ts`: (1) pure `extractEdgeRoutingInput` tests + (2) REAL-wasm integration block
  `describe("LibavoidEdgeRouter with real wasm", ...)` — dynamically imports libavoid-js NODE build
  via `createRequire`+`AvoidLib.load()`, mocked into `loadAvoid` (hoisted `vi.mock`). Degrades
  gracefully `if (!loaded) return;` (commented NOT a fake-pass). Fixtures from
  `./testFixtures/graphFixtures` (`makeGraph/makeNode/makeEdge`) → real `vicinityGraphToFlow`.
  Phase A boundary-pin behavior (attaches on facing side; no waypoint inside obstacle) tested here.

## 6. Perf budget (edge-routing__03)

Dense fixture (~100 nodes / ~292 edges): routing ~140ms vs layout ~1460ms (force). Documented at
`edgeRouting.ts:76-86` (crossing penalty rationale) and edge-routing__03 `.ai_out` PUBLIC docs.
Measured via `console.debug("vicinity-graph: edge routing pass", ...durationMs)` (GraphViewController.ts:266)
vs `"elk+d3 layout pass"` (~212). **Perf gate**: 8 pins × ~100 obstacles must stay well under layout.
Fallback if blown: boundary pins on folder-group shapes only (note squares keep centre pin).

## Key files
- `src/view/edgeRouting.ts` — route() + extractEdgeRoutingInput + constants (+ RoutingObstacle for fallback)
- `src/view/edgeRouting.test.ts` — real-wasm integration pattern to extend
- `src/view/libavoidLoader.ts` — add ConnDirUp/Down/Left/Right
- `src/view/edgeGeometry.ts` — detourRatio (Phase B)
- `src/view/edgeGeometry.test.ts` — BDD pattern
- `src/view/GraphViewController.ts` — resolveRoutes / clipRoutesToObstacles / debug line ~266
- `src/view/flowMapping.ts` — FlowNode kind discriminant (~91-101)

## STOP condition (from task)
If after Phase A repro edges still visibly roundabout, OR routing pass exceeds perf budget even with
group-only pins → STOP and report. Do NOT improvise alternative routing strategies (Phase C is out of scope).
