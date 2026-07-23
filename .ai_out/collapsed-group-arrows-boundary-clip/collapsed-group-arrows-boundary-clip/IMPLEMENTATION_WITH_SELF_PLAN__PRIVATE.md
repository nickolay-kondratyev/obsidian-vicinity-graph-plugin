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

## ITERATION 1 (REVIEW feedback — APPROVE-WITH-MINOR, 2 minors)

### MINOR #1 ACCEPTED — direct folder-group controller clip test (ticket §4 acceptance criterion)
`src/view/GraphViewController.test.ts`:
- Enhanced shared `FakeLayout.layout` (~line 73): a top-level child that carries `children`
  (a folder-group container) now also gets a fixed box `FAKE_GROUP_WIDTH_PX=150` ×
  `FAKE_GROUP_HEIGHT_PX=100` (new consts). Faithful to elk (it wraps containers; the prior
  fake left them UNSIZED so `extractElkDimensionsById` emitted nothing for the group and the
  obstacle was skipped). Width 150 ≠ 100px note square so a terminus at x=150 is UNMISTAKABLY
  the group boundary. Leaves unchanged (they already echo their engine square). No existing
  test asserts group dimensions → safe (step-05 richGraph tests still green).
- New fixture `collapsedGroupGraph()` in the edge-routing describe: c.md (root, ungrouped) +
  notes/a.md, notes/b.md (folder "notes", 2 members → groups), edge c.md→notes/a.md, routing ON.
  buildFlowEdges collapses it to `c.md->folder-group:notes`.
- New test: FakeEdgeRouter returns raw route [{250,50},{100,50},{75,50}] (c.md centre → THROUGH
  group interior → group centre). Group obstacle [0..150]x[0..100] comes from the REAL
  `extractEdgeRoutingInput` folder-group branch (reads groupDimensions) — the branch the
  note→note test never exercised. Asserts clipped `routedPoints` == [{200,50},{150,50}]: source
  clipped to c.md left border x=200, target clipped to GROUP right border x=150 (NOT the interior
  centre 75). One-assert toEqual, same rigor as the note→note test.

### MINOR #2 REJECTED — `isStrictlyInside` test-local duplication (edgeGeometry.test.ts:129)
Rationale: (1) the reviewer rated it "acceptable; noting only"; (2) DRYing via exporting the
production `isStrictlyInsideRect` would make the assertion CIRCULAR (validate the clip's output
with the same predicate the clip uses to decide inside-ness) — the reviewer's own "genuine
geometric guarantee" bar argues for an INDEPENDENT test predicate; (3) a 3-line pure helper used
across 2 test files does not justify a shared test-helper module (KISS/PARETO — over-engineering).

### Verify (iteration): `.tmp/check2.log` tsc exit 0 · `.tmp/test2.log` 658 pass (54 files, +1).

## Nothing half-done. Not committed (TOP_LEVEL_AGENT commits).
