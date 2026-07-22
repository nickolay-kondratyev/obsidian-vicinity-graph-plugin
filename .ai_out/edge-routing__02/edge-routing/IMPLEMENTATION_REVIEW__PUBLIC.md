# IMPLEMENTATION REVIEW — edge-routing__02 (render routed edges)

Reviewed commit `8d23bbe` (branch `edge-routing`). Files: `src/view/edgeGeometry.ts`, `src/view/edgeGeometry.test.ts`, `src/view/VicinityEdge.tsx`, `e2e/obsidianHarness.ts`, `e2e/edgeRouting.e2e.ts`.

## VERDICT: APPROVE-WITH-MINOR
Correct, DRY, honest tests, no OFF-path regression, no out-of-scope creep. Zero blocking issues. Four non-blocking notes below.

## What I verified myself (REAL results)
- `npm run check` (`tsc -noEmit`): **exit 0, clean.**
- `npm run test` (vitest): **641 passed / 54 files.** The test-file diff has **0 removed lines** → all pre-existing behavior-capturing edge tests untouched.
- `.out/edge-routing-force.png` confirmed **gitignored** (`git check-ignore`).
- e2e NOT re-run (needs a real Obsidian binary). Implementer's claimed 2/2 pass is **credible and consistent**: `setEdgeRouting` mirrors the existing `setGlobalNodeCap` persistence path, the `>=2 L` bend detector is precise (straight=1 L, bow=0, detour>=2), and the seeded LCG layout (`d3ForceRefinement`) makes the diameter-chord-through-hub detour deterministic, not flaky.

## Correctness (traced by hand)
- **Rounded corners** (`routedPathFor`): per-corner `shrink = min(ROUTED_CORNER_RADIUS_PX, inLen/2, outLen/2)`. I proved the no-overlap/no-invert claim: on any shared interior segment of length L, the two corner shrinks are each `<= L/2`, so their sum `<= L`. Clamp is correct. 2-point case is byte-identical to today's straight `M..L..`. Empty and duplicate-waypoint cases guarded (no NaN). SVG commands well-formed (verified the L-shape example reproduces the test's exact expected string).
- **Arrowheads**: target from LAST segment tangent, source from FIRST segment tangent, each inset scaled by its own segment length. Genuinely **reuses** `arrowFromApproach`/`sourceArrowOf` — the inset constants (`EDGE_ARROWHEAD_INSET_*`) live in exactly one place. DRY satisfied.
- **`polylineMidpoint`**: correct half-total-arc-length walk; degenerate (zero-length) → first point; boundary handled.
- **`routedGeometryFor`**: `<=2` pts delegates to `edgePathFor(...,false)` → guaranteed OFF parity (test asserts deep equality).

## No-regression + out-of-scope adherence
- `VicinityEdge` routed branch fires **only** when `routedPoints` present and length `>= 2`; otherwise the call is EXACTLY the prior `edgePathFor(...)`. Render JSX unchanged. OFF path pixel-identical.
- Default remains OFF (untouched). No routing-parameter tuning (only the required new `ROUTED_CORNER_RADIUS_PX`). No bidirectional collapse; `hasOpposite` bow intentionally not applied to routed edges (separation deferred to libavoid buffers, per ticket). Clean.
- Coordinate-space claim (item 3) is **sound**: subflow-child node positions are parent-relative in RF (`flowMapping.ts:81/330`), but `routedPoints` are computed from ABSOLUTE positions (`edgeRouting.ts:63`) and RF renders edges in absolute viewport space with absolute `sourceX/Y` — so no transform is needed.

## MUST-FIX (blocking)
None.

## SHOULD-FIX / NICE-TO-HAVE (non-blocking)
1. **Zero-length first/last segment not guarded** — `edgeGeometry.ts:239-263` (`routedGeometryFor` `>=3` branch). If the router ever emits duplicate consecutive endpoints, `arrowFromApproach` divides by a zero `approachLength` → NaN arrow `transform`. Inconsistent with the guards already present in `routedPathFor` (`:166`) and `edgePathFor` (`length===0`). Low likelihood, but cheap: fall back to a zero-angle anchor when the segment length is 0.
2. **Coord-space unit test slightly overclaims** — `edgeGeometry.test.ts:144-150` is framed as the "coordinate-space guard (ticket item 3)" but is tautological (it only shows the pure geometry layer is a pass-through). The subflow-child coordinate case has no dedicated automated coverage; its real verification is the reasoning above plus the e2e screenshot. Consider softening the comment to avoid implying it guards the subflow offset.
3. **Doc `{@link}` nit** — `edgeGeometry.ts:132` links `EDGE_ROUTING_SHAPE_BUFFER_PX`, which lives in `edgeRouting.ts` and is not imported here (only the `RoutedPoint` type is). Harmless (tsc clean); the link may not resolve. Also 10 vs 17 makes "sized near" loose.
4. **e2e OFF baseline is a weak guard** — the OFF test runs under the default `walked-from-center` visibility (radial star, no crossings), so "0 bent edges" is trivially satisfied and would pass even if routing were mistakenly active on non-crossing edges. Acceptable for a smoke test; noting for awareness.

## Documentation updates needed
None required. Ticket acceptance criteria are met (check clean, new geometry fully unit-tested, OFF unchanged, e2e asserts a bend + screenshots to gitignored `/.out`).
