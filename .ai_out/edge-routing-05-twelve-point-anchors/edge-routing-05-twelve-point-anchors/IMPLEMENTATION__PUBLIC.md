# IMPLEMENTATION__PUBLIC — 12-point edge-routing anchors

## Status: COMPLETE. `npm run check` PASS · `npm test` PASS (681/681). No deviations.

## Files changed

### `src/view/edgeRouting.ts`
- **Added fraction constants** `PIN_EDGE_Q1 = 0.25` and `PIN_EDGE_Q3 = 0.75` beside
  `PIN_EDGE_MIN/MID/MAX`, and extended the block doc comment to cover 1/4, 1/2, 3/4 (no
  magic numbers).
- **Rewrote `BOUNDARY_PIN_SPECS`** from the 8-pin set (4 side-midpoints + 4 `"all"` corners)
  to the 12-pin side-only set (4 sides × {0.25, 0.5, 0.75}, each outward-perpendicular). The
  4 corner entries are removed. Rewrote its doc comment (12 pins + WHY-no-corners; kept the
  WHY-NOT-on-note-squares rationale, degeneralised "8 pins ×… 64×" to "many pins … far over
  budget").
- **Exported** `BOUNDARY_PIN_SPECS` and the `BoundaryPinSpec` type for the pure spec test
  (inert data — no coupling risk).
- **Fixed 2 stale doc comments**: `RoutingObstacle.kind` JSDoc ("the 8 boundary pins" → "the
  boundary pins") and `registerPinsForShape` JSDoc ("the 8 {@link BOUNDARY_PIN_SPECS}" → "the
  {@link BOUNDARY_PIN_SPECS}"). (The array's own "eight" comment was the 3rd site, replaced by
  the rewrite above.)
- **Untouched** (per plan): `CENTRE_PIN_SPEC`, `registerPinsForShape`'s note-square branch,
  `visDirsFor` (keeps `"all"` for the centre pin), the cost model, arena, router.

### `src/view/edgeRouting.test.ts`
- **New `describe("BOUNDARY_PIN_SPECS")`** — pure, no-wasm, the durable anchor. 4 BDD tests:
  exactly 12 pins; none on a corner (both fracs extreme); every dir ≠ "all"; each of the 4
  sides has pins at {0.25, 0.5, 0.75} with dir matching the side's outward perpendicular.
- **New real-WASM corner-removal tests** in the existing `LibavoidEdgeRouter with real wasm`
  block: helpers `CORNER_CLEARANCE_TOL_PX = 12`, `cornersOf`, `minCornerDistance` next to
  `isStrictlyInside`; two BDD tests on diagonally-offset group boxes
  (`boxL {0,0,100,100}`, `boxR {300,300,100,100}`) asserting source/target endpoints each clear
  every box corner by > 12px. Reuses the existing `routePair` helper.
- **Existing facing-side tests unchanged** and stay green (verified) — no tolerance loosening.

### `docs-internal/CHANGELOG.md`
- One entry at the top under the edge-routing lineage (12 pins/3-per-side/corners-removed,
  note squares unchanged, no cost-model change).

Docs confirmed no-ops per plan: `architecture-map.md`, `high-level-plan.md`. Build artifacts
(`main.js`, `styles.css`) not touched; build not run (per instructions).

## Final `BOUNDARY_PIN_SPECS`

```ts
export const BOUNDARY_PIN_SPECS: readonly BoundaryPinSpec[] = [
	{ xFrac: PIN_EDGE_Q1, yFrac: PIN_EDGE_MIN, dir: "up" }, // top 1/4
	{ xFrac: PIN_EDGE_MID, yFrac: PIN_EDGE_MIN, dir: "up" }, // top 1/2
	{ xFrac: PIN_EDGE_Q3, yFrac: PIN_EDGE_MIN, dir: "up" }, // top 3/4
	{ xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_Q1, dir: "right" }, // right 1/4
	{ xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_MID, dir: "right" }, // right 1/2
	{ xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_Q3, dir: "right" }, // right 3/4
	{ xFrac: PIN_EDGE_Q3, yFrac: PIN_EDGE_MAX, dir: "down" }, // bottom 3/4
	{ xFrac: PIN_EDGE_MID, yFrac: PIN_EDGE_MAX, dir: "down" }, // bottom 1/2
	{ xFrac: PIN_EDGE_Q1, yFrac: PIN_EDGE_MAX, dir: "down" }, // bottom 1/4
	{ xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_Q3, dir: "left" }, // left 3/4
	{ xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_MID, dir: "left" }, // left 1/2
	{ xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_Q1, dir: "left" }, // left 1/4
];
```

## Test results

- `npm run check` (tsc strict) — **EXIT 0** (`> tsc -noEmit`, no errors).
- `npm test` (vitest) — **EXIT 0**: `Test Files 55 passed (55) · Tests 681 passed (681)`.
- Verbose edgeRouting run confirms the real-WASM block loaded (facing + diagonal tests ran
  with real assertions, 1ms each — not the `if (!loaded) return` skip path):
  - `… THEN there are exactly 12 boundary pins` ✓
  - `… THEN none sits on a corner (both fracs at an extreme)` ✓
  - `… THEN every pin faces outward-perpendicular (never 'all')` ✓
  - `… THEN each of the 4 sides has pins at 1/4, 1/2, 3/4 facing outward` ✓
  - facing-side horizontal + vertical ✓ (unchanged, green as-is)
  - diagonal source endpoint clears every corner ✓
  - diagonal target endpoint clears every corner ✓

## Deviations from the plan

None. The plan's optional §2b "on-face" extra assertion (reviewer Minor Suggestion) was not
added — corner-clearance is the stated contract and is sufficient (PARETO); the pure §2c spec
test already locks the full face geometry.
