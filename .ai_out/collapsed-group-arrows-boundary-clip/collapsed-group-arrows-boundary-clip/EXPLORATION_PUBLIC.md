# EXPLORATION_PUBLIC — collapsed-group-arrows-boundary-clip

Repo: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin`

## 1. `src/view/edgeGeometry.ts` (346 lines)
- Imports `RoutedPoint` type-only from `./edgeRouting` (line 9) — no runtime cycle (comment lines 7-8). New `clipRouteToEndpointRects` can type-import `RoutingObstacle` from `edgeRouting.ts` or define a local rect type.
- `RoutedPoint` (defined in `edgeRouting.ts:17-20`): `{ readonly x: number; readonly y: number }`.
- `EdgePathGeometry` interface (11-30): `path, labelX, labelY, arrowX, arrowY, arrowAngleDeg, sourceArrowX, sourceArrowY, sourceArrowAngleDeg`.
- Arrowhead inset constants (44-46):
  ```ts
  export const EDGE_ARROWHEAD_INSET_FRACTION = 0.12;
  export const EDGE_ARROWHEAD_INSET_MIN_PX = 14;
  export const EDGE_ARROWHEAD_INSET_MAX_PX = 48;
  ```
- `routedGeometryFor(points: readonly RoutedPoint[]): EdgePathGeometry` (243-268). `points.length <= 2` delegates to `edgePathFor`. ≥3 pts: tangents via `distinctSegmentFrom`, anchors via `arrowFromApproach`, badge midpoint via `polylineMidpoint`. Takes ONLY `points` — clip must happen UPSTREAM (controller). Clipped polyline is fed in as `points`.
- `distinctSegmentFrom(points, fromIndex, step)` (298-315): walks skipping zero-length dup points, returns `{deltaX, deltaY, length}` (zero vector if degenerate). This is the guard convention to mirror.
- `arrowFromApproach(targetX, targetY, approachX, approachY, edgeLength): ArrowAnchor` (322-346): inset clamped MIN/MAX of `edgeLength * FRACTION`; guards `approachLength === 0` → angle 0, no NaN.
- NO existing rect-intersection/line-clip helper in this file.

## 2. `src/view/GraphViewController.ts` (385 lines)
- `resolveRoutes(graph, flow, positions: ReadonlyMap<string,XY>, groupDimensions: ReadonlyMap<string,Dimensions>, token): Promise<EdgeRouteMap>` (238-283).
  - Builds `input = extractEdgeRoutingInput({ nodes: flow.nodes, edges: flow.edges, positions, groupDimensions })` (249-254). `input.obstacles: RoutingObstacle[]` (each `{id,x,y,widthPx,heightPx}`, absolute top-left) = rect data for clipping. `input.edges: RoutingEdge[]` (`{id,sourceId,targetId}`) maps edge→obstacle ids.
  - Calls `routes = await this.edgeRouter.route(input)` (line 264) → `EdgeRouteMap`, caches by signature (line 273).
  - **BEST CLIP INSERTION POINT:** right after line 264 (`route()` returns), before line 273 (cache write). Build `Map<string,RoutingObstacle>` from `input.obstacles` keyed by id; for each `{id,sourceId,targetId}` in `input.edges`, clip its route via `clipRouteToEndpointRects(points, byId.get(sourceId), byId.get(targetId))`, store clipped map, cache THAT. Then `withRoutedPoints` needs NO change.
- `withRoutedPoints(flow, routes): FlowGraph` (374-385, module-level free function): attaches `routedPoints` from route map. Has NO access to obstacle rects — would need a new param if clip done here. AVOID; clip in `resolveRoutes` instead.
- `runRebuild` (179-228) caller. `positions`/`groupDimensions` available at call site but node→id rect join already done by `extractEdgeRoutingInput`; reuse `input.obstacles`/`input.edges`.
- `FlowEdge.routedPoints?: readonly RoutedPoint[]` defined in `src/view/flowMapping.ts:129` (optional; `undefined` = straight fallback).

## 3. `src/view/edgeRouting.ts` (293 lines)
- `RoutingObstacle` (23-29) — the Rect type at clip site:
  ```ts
  export interface RoutingObstacle {
    readonly id: string;
    readonly x: number;      // top-left, absolute
    readonly y: number;
    readonly widthPx: number;
    readonly heightPx: number;
  }
  ```
- `RoutingEdge` (32-36): `{id, sourceId, targetId}` — endpoint ids reference obstacle ids (note squares or `folder-group:*`).
- `EdgeRoutingInput` (38-41): `{obstacles, edges}`. `EdgeRouteMap = ReadonlyMap<string, readonly RoutedPoint[]>` (44), keyed by edge id.
- `extractEdgeRoutingInput` (109-141): note obstacles use `FlowNode.width/height` at abs pos (129); folder-group use `groupDimensions.get(node.id)` at abs pos (122-127). Edges matched by `edge.source`/`edge.target` against obstacle id set (134-139) — collapsed edge source/target already `folder-group:*` id or note path; `RoutingEdge.sourceId/targetId` line up 1:1 with `RoutingObstacle.id`.
- `rectOf(obstacle): AvoidRect` (286-293): `x1=x, y1=y, x2=x+widthPx, y2=y+heightPx`.
- `PIN_CENTRE_FRACTION = 0.5` (147); `ShapeConnectionPin(shape, CENTRE_PIN_CLASS, 0.5, 0.5, true, 0, ConnDirAll)` (249-257) = root cause (routes start/end at centres).

## 4. Test conventions
- `src/view/edgeGeometry.test.ts` (229 lines): vitest, `describe`/`it "WHEN...THEN..."`. Local `pt = (x,y): RoutedPoint => ({x,y})` helper. One-assert focus. Named imports from `./edgeGeometry`, `RoutedPoint` type-only from `./edgeRouting`. New clip tests reuse `pt` + add `rect(x,y,w,h)` helper.
- `src/view/edgeRouting.test.ts` (191 lines): same style; `makeGraph/makeNode/makeEdge` from `./testFixtures/graphFixtures`; hand-built Maps; `scenario()` helper; `obstacle(id)` extractor. Real-wasm block uses `isStrictlyInside(point, rect)` point-in-rect (`eps=0.01`) — precedent for epsilon boundary assertions.
- `src/view/testFixtures/graphFixtures.ts` (86): `makeNode, makeEdge, makeGraph, withLayoutMode, withEdgeRouting`. Defaults `edgeRouting:false`, `layoutMode:"layered"`.
- `src/view/GraphViewController.test.ts` (416-529, `"GraphViewController edge-routing pass"`): `FakeEdgeRouter` (`EdgeRouteMap | Error`, `callCount`), `routedGraphOf(central,...neighbours)` = `withEdgeRouting(graphOf(...),true)`, `edgeById(snapshot,id)`. **Natural home for controller-level clipped-routedPoints test** (folder-group target vs note target).
- `e2e/edgeRouting.e2e.ts` (158): bend detection `(d.match(/L/g)??[]).length >= 2` on `.vicinity-graph-flow .react-flow__edge-path` `d`. Harness `setEdgeRouting`/`setLayoutMode`/`openFile`/`openGraphView`.
- `e2e/edgeRoutingEval.e2e.ts` (198): eval/perf harness (screenshots + perf-log), NOT tight regression.
- `e2e/obsidianHarness.ts` (470): `launch({extraFixtures?})`, `page`, `openGraphView()`, `openFile(vaultPath)`, `setEdgeRouting(enabled)` (298), `setLayoutMode("layered"|"radial"|"force")` (310), `close()`.

## 5. Running tests (`package.json`)
```
"check": "tsc -noEmit"                 # typecheck
"test": "vitest run"                   # unit (vitest v4)
"test:watch": "vitest"
"test:e2e": "bash scripts/run-e2e.sh"  # playwright
"build": "npm run check && node esbuild.config.mjs production"
```

## 6. Existing rect-intersection helpers
Repo-wide grep (`intersect|clipLine|lineRect|rectIntersect|clampToRect|boundaryPoint`) → ZERO matches. `clipRouteToEndpointRects` is genuinely new pure math. Only prior art: `isStrictlyInside` point-in-rect in `edgeRouting.test.ts:148-156`.

## Spec doc
`docs-internal/vicinity-graph-specs/arrows.md` section 5 "Obstacle-avoiding edge routing" (104-137) — append normative clip statement. Currently documents routing pass, straight-line fallback, bidirectional/paired-bow; nothing about boundary clipping.
