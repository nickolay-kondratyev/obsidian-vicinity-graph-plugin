# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory

Ticket: `_tickets/collapsed-group-arrows-must-terminate-at-the-group-boundary-clip-routed-edges-to-endpoint-rects.md`
Branch: `collapsed-group-arrows-boundary-clip`

## Status: COMPLETE. check PASS, unit test PASS (657), e2e PASS (existing routing spec, 4/4).

## What I did (file:line anchors)

### 1. Pure clip function — `src/view/edgeGeometry.ts`
Inserted between `ROUTED_CORNER_RADIUS_PX` const and `routedPathFor` doc (~line 141 area):
- `export interface ClipRect { x, y, widthPx, heightPx }` — LOCAL rect type (not imported
  from edgeRouting) so the math layer stays routing-type-free. `RoutingObstacle` is
  structurally assignable to it, so the controller passes obstacles directly.
- `export function clipRouteToEndpointRects(points, sourceRect, targetRect): RoutedPoint[]`
  - Guards `points.length < 2` → returns a shallow copy.
  - `chordFallback = [{first}, {last}]` (ORIGINAL first & last points).
  - Clips target end via `clipTrailingInsideRect(points, targetRect)`; if null → chord.
  - Clips source end by reversing the target-clipped array, `clipTrailingInsideRect(_, sourceRect)`,
    reverse back; if null → chord.
- private `clipTrailingInsideRect(points, rect): RoutedPoint[] | null`
  - Scans from END for the last point NOT strictly inside `rect` (`lastOutside`).
  - `-1` (all inside) → null. `lastOutside == n-1` (terminus already outside/on border) →
    unchanged copy. Else replaces trailing inside run with the border crossing.
- private `isStrictlyInsideRect(point, rect)` — strict `<`/`>` so a point ON the border is KEPT.
- private `segmentRectEntryPoint(from, to, rect): RoutedPoint | null` — Liang–Barsky entry
  point (from outside, to inside → entry param ∈ [0,1]); null on parallel-and-outside/degenerate.

### 2. Controller wiring — `src/view/GraphViewController.ts`
- Imports (top): added `import { clipRouteToEndpointRects } from "./edgeGeometry";` and added
  `RoutedPoint` to the `import type { ... } from "./edgeRouting"`.
- `resolveRoutes`: after `routes = await this.edgeRouter.route(input)` and the stale check,
  before caching: `const clippedRoutes = clipRoutesToObstacles(routes, input);` then cache &
  return the CLIPPED routes (so reuse-layout serves clipped from cache). `withRoutedPoints`
  unchanged.
- New module-level `clipRoutesToObstacles(routes, input): EdgeRouteMap` (next to `withRoutedPoints`):
  builds `Map<id,obstacle>` from `input.obstacles`; per `input.edges` clips each route against
  source/target obstacle; a MISSING source/target obstacle → route left unclipped (no crash);
  empty map → no-op.

### 3. Spec — `docs-internal/vicinity-graph-specs/arrows.md` section 5
Appended a "Boundary clipping (endpoint terminus)" bullet with the ticket's normative statement.

### 4. Tests
- `src/view/edgeGeometry.test.ts`: imported `clipRouteToEndpointRects` + `type ClipRect`; added
  `rect()` helper + local `isStrictlyInside()`; new describe with 6 one-assert BDD tests:
  centre→border, several trailing inside → single crossing, source mirror, corner entry,
  degenerate overlap → chord fallback, and clipped route → `routedGeometryFor` tip outside interior.
- `src/view/GraphViewController.test.ts`: added one test in the edge-routing describe — a
  centre-to-centre route (50,50)->(250,50) with FakeLayout's 100px boxes at x=index*200 clips to
  `[{100,50},{200,50}]`. Verified existing routing tests still green (their single-point/inside
  routes hit the copy / chord-fallback paths and keep prior `toEqual` values).

## Decisions
- Rect type = local `ClipRect`, NOT `RoutingObstacle` import — keeps edgeGeometry free of routing
  types; obstacles are structurally assignable. (Ticket allowed either; chose cleaner.)
- Clip in `resolveRoutes` (cache the clipped map), NOT in `withRoutedPoints` (which lacks obstacle
  rects) — per EXPLORATION §2.
- Arrowhead inset (§2 review): NO constant change. After clipping the terminus is ON the boundary;
  `arrowFromApproach` insets the head 14–48px BACK along the approach (i.e. just OUTSIDE the box,
  on the line, pointing in). This is correct and is what the tip-outside test asserts. Notes
  previously had the head just INSIDE (centre≈boundary); now just OUTSIDE — consistent boundary
  anchoring, heads still fan/legible. No regression; existing edgeGeometry arrow tests unchanged.

## E2E — DOWNGRADED (see PUBLIC CALLOUT)
Ran existing `e2e/edgeRouting.e2e.ts` (auto-downloads Obsidian; env works) → 4/4 PASS, proving no
routing regression. Did NOT add a new group-boundary geometry-assertion e2e: the controller test
already asserts EXACT clipped coords against the real obstacle-extraction pipeline (a stronger,
deterministic gate); a coordinate e2e would need group-fixture + flow/DOM rect mapping for weaker,
flakier coverage. Ticket explicitly permits this downgrade. Screenshot capture already exists
(`.out/edge-routing-force.png` via the existing ON test).

## Logs
`.tmp/check.log` (tsc, exit 0), `.tmp/test.log` (657 pass), `.tmp/newtests.log` (73 pass),
`.tmp/e2e.log` (4 pass).

## Nothing half-done. Not committed (TOP_LEVEL_AGENT commits).
