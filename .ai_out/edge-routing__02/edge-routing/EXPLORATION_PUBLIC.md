# EXPLORATION_PUBLIC — edge-routing__02 (render routed edges)

Index of exploration artifacts (read the detail files as needed):
- `EXPLORATION_rendering.md` — VicinityEdge.tsx, edgeGeometry.ts (+test), routedPoints threading.
- `EXPLORATION_coords_e2e.md` — coordinate space, d3 seeding, e2e harness, edgeRouting setting, commands.

## Highest-signal facts for implementation

### Geometry (pure, RF-free module `src/view/edgeGeometry.ts`)
- Existing: `edgePathFor` (:62), `arrowFromApproach` (:142, clamped inset — REUSE), `sourceArrowOf` (:123). Constants: inset FRACTION 0.12/MIN 14/MAX 48; `EDGE_PAIR_CURVATURE_PX=34`.
- `RoutedPoint {x,y}` defined `src/view/edgeRouting.ts:17-20`.
- NEW work: `routedPathFor(points): string` (rounded corners via new `ROUTED_CORNER_RADIUS_PX`, clamp to half adjacent segment length; 2 points ⇒ plain `M..L..`); generalized arrowheads (target=last-seg tangent, source=first-seg tangent, reuse arrowFromApproach/sourceArrowOf); `polylineMidpoint(points): {x,y}` (walk to half total length).
- Tests: vitest, strict BDD `it("WHEN ... THEN ...")`, import named constants, `toBeCloseTo` for trig. Add degenerate cases.

### Rendering (`src/view/VicinityEdge.tsx`)
- `VicinityEdgeData.routedPoints?` (:26-37) typed but unused. Branch: `routedPoints` length ≥ 2 → routed rendering (routedPathFor path, tangent arrowheads, badge at polylineMidpoint). Else EXACTLY current behavior (no regression — pre-existing tests untouched).
- `hasOpposite` pairs while routing ON: render each polyline as-is (no bow). Record overlap issues, defer to arrows.md:88-94 follow-up. NO third mechanism.

### Coordinate space (ticket item 3) — RESOLVED, verify only
- routedPoints ABSOLUTE; RF sourceX/Y/targetX/Y ABSOLUTE (even subflow children). extractEdgeRoutingInput fed PRE-withPositions absolute maps. **No offset needed.** Add a verifying test/comment; expect nothing to fix. (flowMapping.ts:312-333 stores parent-relative Node.position but that's not what edges consume.)

### e2e (ticket item 4)
- Harness `e2e/obsidianHarness.ts`. Clone `setGlobalNodeCap` → add `setEdgeRouting(enabled)` (`store.saveGlobalView({...store.globalView(), edgeRouting})`).
- NO screenshot helper / `.out/` writer exists yet — add both. Screenshot path explicit `<repo-root>/.out/edge-routing-*.png` (gitignored, NOT .tmp/e2e-artifacts).
- Default layout `force` (constants.ts:40), deterministic (LCG seed=1, d3ForceRefinement.ts:108-115). Build fixture where straight A→B would cross C; edgeRouting ON → assert edge path `d` has >2 points/bends; screenshot.
- Locator likely `.vicinity-graph-flow .react-flow__edge-path`.

### Commands
- `npm run check` = tsc -noEmit. `npm run test` = vitest run. `npm run test:e2e` = bash scripts/run-e2e.sh (single spec: `npm run test:e2e -- <spec>.e2e.ts`).
