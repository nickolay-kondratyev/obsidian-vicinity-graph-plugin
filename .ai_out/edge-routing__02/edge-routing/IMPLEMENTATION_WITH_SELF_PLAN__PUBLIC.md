# IMPLEMENTATION PUBLIC — edge-routing__02 (render routed edges)

Exploration facts are in `EXPLORATION_*.md` (not repeated here).

## Summary of changes

| File | What |
|------|------|
| `src/view/edgeGeometry.ts` | New pure functions + constant (below). Type-only `RoutedPoint` import (erased -> no runtime cycle with edgeRouting.ts). |
| `src/view/edgeGeometry.test.ts` | +11 BDD vitest cases (rounded path, 2-pt degenerate, short-seg clamp, coord-space guard, midpoint walk, tangent arrowheads, inset, badge=midpoint, 2-pt==edgePathFor parity). |
| `src/view/VicinityEdge.tsx` | Branch: `data.routedPoints` (len>=2) -> `routedGeometryFor`; else EXACTLY prior `edgePathFor` path. Rest of render unchanged. |
| `e2e/obsidianHarness.ts` | Added `setEdgeRouting(enabled)` (mirrors `setGlobalNodeCap`). |
| `e2e/edgeRouting.e2e.ts` | NEW visual-smoke spec (fixture + OFF baseline + ON bend assertion + screenshot). |

## New geometry API (all pure, RF-free)

- `export const ROUTED_CORNER_RADIUS_PX = 10;`
- `routedPathFor(points: readonly RoutedPoint[]): string` — rounded interior corners (quadratic arc, shrink clamped to half each adjacent segment); **2 points => `M x,y L x,y`** identical to today's straight case; duplicate consecutive points pass straight through (no NaN).
- `polylineMidpoint(points): {readonly x; readonly y}` — walks polyline to half TOTAL arc length.
- `routedGeometryFor(points): EdgePathGeometry` — SAME shape as `edgePathFor` (so VicinityEdge renders both through one code path). `<=2` pts delegates to `edgePathFor(...,false)` => guaranteed identical to the straight edge. `>=3`: `routedPathFor` path; **target arrowhead = LAST segment tangent, source = FIRST segment tangent**, reusing `arrowFromApproach`/`sourceArrowOf` (inset constants NOT duplicated); badge at `polylineMidpoint`. `hasOpposite` bowing intentionally NOT applied when routed.

## Key decisions
- Arrow inset `edgeLength` for routed edges = the tangent SEGMENT's own length (not total polyline) so the head scales with / sits on its approach segment; for the 2-pt case it equals full length -> matches today exactly.
- `routedGeometryFor` returning `EdgePathGeometry` keeps VicinityEdge's arrowhead/badge JSX untouched -> zero risk to the OFF path (all pre-existing tests pass unmodified).
- e2e bend detector = path with `>=2 "L"` commands: a routed detour (>=3 pts) has >=2 L, straight has 1, bow has 0. Precise, not overfit to coordinates.
- e2e enables `edgeVisibility: "all-edges"` (inline in spec) so sibling "diameter" chords render; the default `walked-from-center` shows only a radial star with no crossings. `setEdgeRouting` kept single-purpose per ticket.

## Coordinate-space verdict (ticket item 3)
**No transform needed — confirmed.** routedPoints are ABSOLUTE flow coords and RF gives custom edges absolute `sourceX/Y`/`targetX/Y` (even subflow children). Verified two ways: (1) a geometry unit test asserts the routed path starts/ends exactly at the polyline endpoints (geometry layer applies no offset); (2) the e2e screenshot shows routed polylines connecting the correct node centers with arrowheads landing on nodes. WHY comment added in `VicinityEdge.tsx` and `routedGeometryFor` doc. Nothing to fix at the mapping layer.

## hasOpposite overlap observation
Fixture links are one-directional, so no bidirectional pairs appear in the screenshot — no overlap to record. Routed edges render as-is (no bow) per ticket; if real bidirectional overlap shows up later, defer to `docs-internal/vicinity-graph-specs/arrows.md:88-94` (do NOT add a third mechanism).

## EXACT verification results (REAL — not faked)
- `npm run check` (`tsc -noEmit`): **exit 0, clean.**
- `npm run test` (vitest): **641 passed / 54 files** (11 new; all pre-existing untouched & green).
- `npm run test:e2e -- edgeRouting.e2e.ts`: **2/2 PASSED** against real headless Obsidian 1.12.7 (cached binary auto-resolved by `scripts/run-e2e.sh`, `--ozone-platform=headless --disable-gpu`). Screenshot `/.out/edge-routing-force.png` (38 KB) written and gitignored (`git check-ignore` confirms). Visually confirmed: edges route around nodes with smooth corners and arrowheads on the final approach.

## For the reviewer to scrutinize
- `ROUTED_CORNER_RADIUS_PX = 10` is an initial value (tuning is edge-routing__03). Corner rounding clamps to half each adjacent segment.
- e2e ON-assertion asserts `>=1` bent edge. It is deterministic (seeded LCG layout) and currently passes; if the fixture layout ever changes it could need a nudge. The diameter-chord-through-hub construction is what forces the detour.
- Type-only cross-import `edgeGeometry -> edgeRouting` for `RoutedPoint` (edgeRouting already imports a value from edgeGeometry). Erased at runtime; tsc happy. Flagged for awareness.
