# IMPLEMENTATION ITERATION — edge-routing__02

Responds to `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict APPROVE-WITH-MINOR, 0 must-fix, 4 non-blocking notes). Each note critically evaluated below.

## Note 1 — Zero-length first/last segment → NaN arrow transform: **INCORPORATED**
Genuine robustness bug (anti-fragile). If the router emits duplicate consecutive endpoints, the
`>=3` branch computed a zero-length tangent → `arrowFromApproach` divided by zero → NaN
`arrowX/arrowY`.
- **Failing-first**: added 5 BDD tests reproducing the NaN (duplicate last pair, duplicate first
  pair, all-coincident route). Confirmed 4 failed with `arrowX/Y = NaN` before the fix.
- **Fix (no hack)**: new pure helper `distinctSegmentFrom(points, fromIndex, step)` walks PAST
  duplicate waypoints to the nearest DISTINCT neighbour, so the tangent follows the real segment
  (angle still correct: last-segment +x → 0°, first-segment +y → source -90°). As a documented
  last-resort fallback for a fully-degenerate end, `arrowFromApproach` now guards
  `approachLength === 0` → anchors flat on the endpoint with zero angle (mirrors the existing
  degenerate `edgePathFor` case). Consistent with the guards already in `routedPathFor`.
- Files: `src/view/edgeGeometry.ts`, `src/view/edgeGeometry.test.ts`.

## Note 2 — Coord-space unit test tautological / overclaims: **INCORPORATED**
Valid honesty point — the test only proves the pure geometry layer is a pass-through, not the
subflow absolute-vs-parent-relative coordinate claim. Softened the test name and comment to say
exactly that; the subflow claim explicitly rests on `routedGeometryFor`'s doc reasoning plus the
e2e screenshot. Test kept (it is a valid pass-through assertion). Did NOT weaken or delete it.
- File: `src/view/edgeGeometry.test.ts`.

## Note 3 — `{@link}` doc nit + loose "sized near": **INCORPORATED**
`{@link EDGE_ROUTING_SHAPE_BUFFER_PX}` referenced a symbol not imported here (only the type is), so
it may not resolve; and 10 vs 17 made "sized near" loose. Replaced with a plain reference
"(in edgeRouting.ts, ~17px)" and reworded to "same order of magnitude". Cheap, improves doc honesty.
- File: `src/view/edgeGeometry.ts`.

## Note 4 — Weak OFF e2e baseline: **INCORPORATED**
The reviewer flagged this as awareness-only, but the strengthening is cheap and turns a trivial
assertion into a real guard, so I did it. `all-edges` visibility is now set once in `beforeAll`, so
BOTH tests share the crossing-chord graph and the routing toggle is the ONLY variable. The OFF test
now asserts "0 bends **even though crossing chords are present**" (previously ran under the default
no-crossing radial star, where 0 bends was trivially true). Removed the now-redundant per-test
visibility set from the ON test. Not over-engineering: no new fixtures, same detector.
- File: `e2e/edgeRouting.e2e.ts`.

## Files touched
- `src/view/edgeGeometry.ts` — `distinctSegmentFrom` helper; `SegmentVector`; zero-approach guard in `arrowFromApproach`; routed target/source tangents walk to distinct neighbour; doc-ref fix.
- `src/view/edgeGeometry.test.ts` — +5 NaN-tolerance BDD tests; softened coord-space test name/comment.
- `e2e/edgeRouting.e2e.ts` — shared `all-edges` graph in `beforeAll`; strengthened OFF assertion; header comment updated.

## Verification (REAL results)
- `npm run test`: **646 passed / 54 files** (was 641; +5 new NaN tests). Pre-existing behaviour tests untouched & green.
- `npm run check` (`tsc -noEmit`): **exit 0, clean.**
- `npm run test:e2e -- edgeRouting.e2e.ts`: **2/2 PASSED** against real headless Obsidian (exit 0). OFF = 0 bends with crossing chords present; ON >= 1 bend; screenshot re-written to gitignored `/.out`.

## Readiness
**CONVERGED / READY.** All 4 notes incorporated; none were rejected (each was a real, cheap improvement aligned with the ticket). No routing-default change, no out-of-scope creep. No `#QUESTION_FOR_HUMAN` needed.
