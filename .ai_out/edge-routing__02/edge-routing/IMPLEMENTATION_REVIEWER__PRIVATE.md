# IMPLEMENTATION_REVIEWER — PRIVATE state (edge-routing__02)

Reviewed commit: 8d23bbe. Branch edge-routing.

## Verified myself (REAL)
- `npm run check` (tsc -noEmit): exit 0, clean.
- `npm run test` (vitest): 54 files / 641 tests PASSED. 0 removed lines in edgeGeometry.test.ts diff → pre-existing behavior tests untouched.
- `.out/edge-routing-force.png` is gitignored (`git check-ignore` confirms).
- Did NOT re-run e2e (needs real Obsidian binary). Implementer claims 2/2 pass; credible — harness `setEdgeRouting` mirrors existing `setGlobalNodeCap`, bend detector (>=2 `L`) is sound, seeded LCG makes layout deterministic.

## Geometry correctness (traced by hand)
- routedPathFor: 2-pt → `M..L..` byte-identical to straight. >=3 → per corner shrink=min(R,inLen/2,outLen/2). Proved no overlap on shared segment: shrink_A<=L/2 (outA), shrink_B<=L/2 (inB) ⇒ sum<=L. Clamp claim holds. L-shape example reproduces the test's expected string exactly. Empty→"M 0,0 L 0,0"; duplicate interior waypoint passes straight through (guard at :166).
- polylineMidpoint: half-total arc walk correct; zero-total→first point; boundary handled by `walked+segment>=half`.
- routedGeometryFor: <=2 delegates to edgePathFor(...,false) → OFF parity. >=3 target arrow=LAST seg tangent, source=FIRST seg tangent, inset scaled by each seg's own length. REUSES arrowFromApproach/sourceArrowOf — inset constants (EDGE_ARROWHEAD_INSET_*) live once. DRY confirmed.

## VicinityEdge
- Routed branch only when routedPoints!==undefined && length>=2; else EXACT prior edgePathFor call. Render JSX (arrowhead polygon, badge) unchanged. No OFF regression.

## Coordinate-space (item 3)
- flowMapping.ts:81/330: subflow-child node positions are parent-RELATIVE in RF. edgeRouting.ts:63 computes routes from ABSOLUTE positions ⇒ routedPoints absolute. RF renders edges in absolute viewport space (not nested in parent transform) and gives absolute sourceX/Y. ⇒ no transform needed; claim sound.
- Gap: the "coordinate-space guard" unit test (test:144-150) is tautological (geometry layer is a pass-through); it does NOT cover the subflow case. Real coverage = reasoning + e2e screenshot. Non-blocking.

## Out-of-scope adherence
- Default still OFF (untouched). No param tuning beyond introducing needed ROUTED_CORNER_RADIUS_PX=10. No bidirectional collapse; hasOpposite bow intentionally not applied to routed. Clean.

## Findings
MUST-FIX: none.
SHOULD/NICE:
1. routedGeometryFor >=3 branch: no guard for zero-length first/last segment (duplicate endpoints) → arrowFromApproach divides by 0 → NaN transform. Inconsistent with routedPathFor(:166) and edgePathFor(len===0) guards. Low likelihood, cheap fix.
2. Coord-space unit test comment overclaims re item 3; subflow case lacks dedicated automated coverage.
3. Doc `{@link EDGE_ROUTING_SHAPE_BUFFER_PX}` (edgeGeometry.ts:132) points at a symbol not imported here (edgeRouting.ts); harmless, tsc clean. Value 10 vs 17 "near" is loose.
4. e2e OFF baseline runs under default walked-from-center (no crossings) → "0 bends" trivially true; weak regression guard but fine for smoke.

VERDICT: APPROVE-WITH-MINOR.

## Confirmation re-review (commit 157058d)

Re-verified myself (REAL):
- `npm run check` (tsc -noEmit): exit 0, clean.
- `npm run test` (vitest): 54 files / 646 tests PASSED (was 641; +5 new NaN tests). No pre-existing test lines removed — only test-name/comment softening on the coord-space test (assertions unchanged) + 5 appended tests.
- e2e NOT re-run (needs Obsidian binary); implementer claims 2/2, credible.

Note resolution (all 4 INCORPORATED, none rejected):
1. NaN guard — CORRECT and non-hacky. New pure `distinctSegmentFrom(points,fromIndex,step)` walks past zero-length duplicates to nearest DISTINCT neighbour; returns vector FROM endpoint TO neighbour, negated at call site → direction AT endpoint (matches arrowFromApproach contract). For normal (no-dup) routes it returns the immediate neighbour → identical to prior behavior, so no OFF/ON regression. Terminal fallback is sound: all-coincident → zero vector → `arrowFromApproach` `approachLength===0` guard anchors flat {x,y,0°}, mirroring degenerate edgePathFor. `-0` handled (Math.hypot(-0,-0)===0). `edgeLength` param now = distinct-segment length (better inset for degenerate case; unchanged for normal). Traced all 5 tests by hand — they genuinely reproduce-then-prevent NaN, not assertion-fudge (finite checks + real angle 0°/-90°).
2. Coord-space test — name/comment softened to state it only proves pass-through; assertions kept. Honest.
3. Doc `{@link}` replaced with plain "~17px" ref + "same order of magnitude". Fine.
4. e2e OFF baseline strengthened: `all-edges` set once in beforeAll so both tests share crossing chords; OFF now a real guard. Removed redundant per-test visibility set. No new fixtures.

No new must-fix. No regression, no weakened tests, no out-of-scope creep. CONVERGED.
FINAL VERDICT: APPROVE.
