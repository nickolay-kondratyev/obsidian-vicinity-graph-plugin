# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC summary

Ticket: collapsed-group arrows must terminate at the group boundary (clip routed edges to endpoint rects).

## Outcome: DONE. `npm run check` PASS · `npm test` 657 PASS · `npm run test:e2e` (routing spec) 4/4 PASS.

## Changes

### `src/view/edgeGeometry.ts` (the fix — pure, RF-free, vitest-testable)
- New `export interface ClipRect { x, y, widthPx, heightPx }` (absolute top-left) — a `RoutingObstacle`
  is structurally assignable to it, so callers pass obstacles directly; the math layer stays free of
  routing types.
- New `export function clipRouteToEndpointRects(points, sourceRect, targetRect): RoutedPoint[]` plus
  private helpers `clipTrailingInsideRect`, `isStrictlyInsideRect`, `segmentRectEntryPoint` (Liang–Barsky).

### `src/view/GraphViewController.ts` (apply the clip)
- `resolveRoutes` clips every route to its endpoint obstacle rects right after `route()` and before
  caching, via new module-level `clipRoutesToObstacles(routes, input)`. The cached map is the CLIPPED
  one (reuse-layout serves clipped). `withRoutedPoints` unchanged.

### `docs-internal/vicinity-graph-specs/arrows.md`
- Section 5: new "Boundary clipping (endpoint terminus)" bullet with the normative statement.

### Tests
- `src/view/edgeGeometry.test.ts`: 6 new BDD one-assert tests (centre→border, several trailing-inside →
  single crossing, source-side mirror, corner entry, degenerate overlap → 2-point chord fallback,
  clipped route → `routedGeometryFor` tip outside the interior).
- `src/view/GraphViewController.test.ts`: 1 new test — attached `routedPoints` are clipped to the
  correct obstacle borders (centre-to-centre route → `[{100,50},{200,50}]`).

## Clip algorithm contract
`clipRouteToEndpointRects(points, sourceRect, targetRect)`:
- Walks from the END, drops points STRICTLY inside `targetRect`, and moves the terminus to the border
  crossing of the last outside→inside segment; mirrors from the START against `sourceRect`.
- A point exactly ON a border is kept (strict inside test), so an already-boundary terminus is untouched.
- Degenerate (overlapping/nested rects, or the whole polyline inside a rect, or an indeterminate
  crossing) → returns the UNCLIPPED 2-point chord of the first & last ORIGINAL points. Never empty/NaN.
- `points.length < 2` → returned as a copy (nothing to clip).
- Missing source/target obstacle at the controller call site → route left unclipped (no crash/drop).

## Arrowhead inset review (ticket §2) — conclusion: NO constant change
After clipping, the terminus is ON the boundary and `arrowFromApproach` insets the arrowhead 14–48px
BACK along the approach segment — i.e. the head sits just OUTSIDE the box on the line, pointing inward.
This is exactly the boundary-anchored behaviour we want and is asserted by the new "tip outside the
interior" test. `EDGE_ARROWHEAD_INSET_MIN/MAX/FRACTION` unchanged.

## CALLOUTS
1. **Notes' arrowhead now sits just OUTSIDE the boundary (was just inside).** Previously the route ended
   at the box CENTRE and the head was inset back to just inside a small note (centre≈boundary
   coincidence). Now every routed terminus is boundary-anchored, so the head is just outside, on the
   line, pointing in — consistent across notes AND groups, heads still fan apart and stay legible. This
   is the intended consequence of the fix, not a regression; existing `edgeGeometry`/`GraphViewController`
   arrow tests remain green.
2. **E2E geometry assertion DOWNGRADED to screenshot capture (ticket §4 explicitly allows this).** The
   e2e environment works and the existing `e2e/edgeRouting.e2e.ts` passes 4/4 with the change (no routing
   regression; screenshot `.out/edge-routing-force.png` captured by its ON test). I did NOT add a new
   collapsed-group boundary geometry-assertion e2e: the new CONTROLLER test already asserts the EXACT
   clipped coordinates against the real obstacle-extraction pipeline (a deterministic, stronger gate),
   whereas an e2e coordinate check would require a group fixture plus flow/DOM rect mapping for weaker,
   flakier coverage. Pareto call, sanctioned by the ticket. If a true e2e geometry gate is later desired,
   read the group node's flow-space rect from its `.react-flow__node` inline `translate()` + offset size
   (same coordinate space as the edge path `d`) to avoid viewport-transform math.

## ITERATION 1 — REVIEW feedback (APPROVE-WITH-MINOR)

`npm run check` PASS (tsc exit 0) · `npm test` 658 PASS (was 657, +1 new test).

### MINOR #1 ACCEPTED — direct folder-group controller clip test (the HEADLINE scenario, ticket §4)
Added to `src/view/GraphViewController.test.ts`:
- `FakeLayout` now sizes folder-group CONTAINERS (`FAKE_GROUP_WIDTH_PX=150 × FAKE_GROUP_HEIGHT_PX=100`).
  Elk wraps containers to a real box; the prior fake left them unsized, so a group never became a
  routing obstacle. 150px (≠ the 100px note square) makes a terminus at x=150 unambiguously the
  GROUP boundary. No existing test asserts group dimensions → no regression.
- New `collapsedGroupGraph()` fixture (c.md → 2-member `notes` folder) whose engine edge collapses
  to `c.md->folder-group:notes`. The FakeEdgeRouter feeds a raw route that runs from c.md's centre
  THROUGH the group interior to the group centre; the test asserts the attached `routedPoints`
  terminus is clipped to the group's right border **x=150** (derived from `groupDimensions` via the
  REAL `extractEdgeRoutingInput` folder-group branch), NOT the interior centre x=75. This closes the
  coverage gap: the note→note test never exercised the `node.kind === "folder-group"` obstacle path.

### MINOR #2 REJECTED — `isStrictlyInside` test-local duplication (nit)
Rejected. The reviewer rated it "acceptable; noting only". DRYing by reusing the production
predicate would make the assertion circular (checking the clip's output with the same inside-test
the clip uses), which undercuts the independent-geometric-guarantee goal; and a 3-line pure helper
across 2 test files does not warrant a shared test-helper module (KISS/PARETO). No change.

## No #QUESTION_FOR_HUMAN items.
