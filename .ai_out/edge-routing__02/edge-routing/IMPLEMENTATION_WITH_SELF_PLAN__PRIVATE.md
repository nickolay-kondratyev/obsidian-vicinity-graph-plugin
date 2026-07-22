# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (edge-routing__02)

## Goal
Render routed polylines in VicinityEdge (smoothed corners, tangent arrowheads, badge at
polyline midpoint) when `data.routedPoints` (len>=2) is present; OFF path unchanged.

## Plan / checklist
1. [ ] edgeGeometry.ts — add pure functions + `ROUTED_CORNER_RADIUS_PX=10`:
   - `routedPathFor(points): string` — rounded interior corners (quadratic arc, shrink clamped to half adjacent seg); 2 pts => `M..L..`.
   - `polylineMidpoint(points): {x,y}` — walk to half total length.
   - `routedGeometryFor(points): EdgePathGeometry` — composition: <=2 pts delegates to `edgePathFor(...,false)` (identical to straight); >=3 pts uses routedPathFor + tangent arrows (reuse arrowFromApproach/sourceArrowOf, target=LAST seg, source=FIRST seg, edgeLength=that seg length) + label at polylineMidpoint.
   - import type RoutedPoint from ./edgeRouting (type-only; erased => no runtime cycle).
2. [ ] edgeGeometry.test.ts — BDD failing-first: routedPathFor (2pt degenerate, right-angle rounding, short-seg clamp), polylineMidpoint (two-seg walk, 2pt midpoint), routedGeometryFor (tangent target+source angle, inset tip, 2pt==edgePathFor straight, label==midpoint, coord-space: path starts/ends at polyline endpoints untransformed).
3. [ ] VicinityEdge.tsx — branch geometry on routedPoints.length>=2 -> routedGeometryFor else edgePathFor (unchanged). WHY comment on coord space.
4. [ ] Coordinate space (item 3): verified by exploration (routedPoints absolute == RF sourceX/Y absolute, even subflow children). Add WHY comment + geometry test asserting no transform. Nothing to fix.
5. [ ] e2e edgeRouting.e2e.ts + harness.setEdgeRouting(enabled). Fixture er_c hub + er1..er6 ring w/ diameters; set edgeVisibility=all-edges (chords) + edgeRouting ON => libavoid detours around center. Assert OFF: no path has >=2 "L"; ON: >=1 path has >=2 "L" (a routed multi-seg detour). Screenshot to repo-root/.out/edge-routing-force.png.

## Key decisions
- routedGeometryFor returns SAME `EdgePathGeometry` shape as edgePathFor so VicinityEdge downstream code is unchanged (DRY). 2-pt case delegates to edgePathFor(...,false) => guaranteed identical to today's straight edge.
- Arrow edgeLength = the tangent SEGMENT's own length (not total polyline) so head scales with / sits on its approach segment; for 2 pts it equals full length so matches today.
- hasOpposite IGNORED when routed (no bow) per ticket; separation from libavoid buffers.
- Bend detector in e2e = path has >=2 "L" commands (routed >=3 pts). Straight=1 L, bow=0 L. Precise, not overfit to positions.
- edgeVisibility=all-edges in e2e because default walked-from-center yields only a radial star (no chords => no crossings). Set inline in spec (setEdgeRouting stays single-purpose per ticket).

## Status log — COMPLETE
- edgeGeometry.ts: added ROUTED_CORNER_RADIUS_PX=10, routedPathFor, polylineMidpoint, routedGeometryFor. Type-only RoutedPoint import.
- edgeGeometry.test.ts: +11 BDD tests (routedPathFor x4, polylineMidpoint x2, routedGeometryFor x5). Used `.at` initially -> replaced with index access (target lib lacks Array.at). Fixed source-angle test to use L-shaped route (avoids atan2 -0/±180 ambiguity).
- VicinityEdge.tsx: branch geometry on routedPoints.length>=2 -> routedGeometryFor; else unchanged edgePathFor. WHY comment on coord space.
- obsidianHarness.ts: added setEdgeRouting(enabled).
- e2e/edgeRouting.e2e.ts: hub+ring+diameters fixture; OFF baseline (no bends) + ON (>=1 bend) + screenshot to .out/edge-routing-force.png.

## Verification results (REAL)
- npm run check: exit 0 (clean).
- npm run test: 641 passed / 54 files (incl. 11 new; all pre-existing untouched & green).
- npm run test:e2e -- edgeRouting.e2e.ts: 2/2 PASSED against real headless Obsidian 1.12.7 (cached binary auto-resolved, --ozone-platform=headless). Screenshot 38KB written, gitignored. Visually confirmed routed bends + arrowheads on nodes.

## Coordinate-space verdict
Confirmed NO transform needed. Geometry test asserts routed path endpoints == polyline endpoints untransformed; e2e shows routed polylines connecting correct node centers in RF's absolute space.

## hasOpposite note
Fixture links are one-directional -> no bidirectional pairs in the screenshot, so no overlap to record. Routed edges render as-is (no bow) per ticket.

## No open issues.

## Iteration 1 (reviewer feedback, APPROVE-WITH-MINOR, 0 must-fix)
- Note 1 (zero-len end seg → NaN arrow): INCORPORATED. Failing-first: 5 BDD tests reproducing
  NaN on duplicate consecutive endpoints (last/first/all-coincident). Fix: `distinctSegmentFrom`
  walks past duplicate waypoints to nearest DISTINCT neighbour for the tangent; `arrowFromApproach`
  guards approachLength===0 → flat anchor on endpoint (mirrors degenerate edgePathFor). edgeGeometry.ts.
- Note 2 (tautological coord-space test): INCORPORATED. Softened comment/name — it proves only the
  pure pass-through, NOT the subflow offset claim (that rests on doc reasoning + e2e). Test kept.
- Note 3 ({@link}+"sized near" nit): INCORPORATED. Replaced unresolved {@link EDGE_ROUTING_SHAPE_BUFFER_PX}
  with plain ref "(in edgeRouting.ts, ~17px)" + "same order of magnitude".
- Note 4 (weak OFF e2e baseline): INCORPORATED. all-edges visibility now set in beforeAll → BOTH tests
  share crossing-chord graph; routing toggle is the ONLY variable. OFF now asserts "0 bends WITH
  crossings present" (real guard, not trivial star pass). Removed redundant per-test set.

## Iteration verification (REAL)
- npm run test: 646 passed / 54 files (was 641; +5 new NaN tests). Pre-existing untouched & green.
- npm run check: exit 0 clean.
- npm run test:e2e -- edgeRouting.e2e.ts: 2/2 PASSED (real headless Obsidian). OFF=0 bends w/ chords, ON>=1 bend.

## Convergence: READY. All 4 notes addressed (all incorporated); no blocking items remained.
