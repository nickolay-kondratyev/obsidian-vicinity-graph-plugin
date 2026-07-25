# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (rehydration memory)

Ticket `nid_a7uwpxayt6w5vdnw8ogwskwvh_e`, branch `edge-routing__08-nonfinite-geometry`.

## Goal
Drop obstacles with non-finite x/y/widthPx/heightPx in `extractEdgeRoutingInput`
(`src/view/edgeRouting.ts`) so libavoid's `processTransaction()` can never abort the
load-once wasm module.

## Plan
1. [x] Verify exploration leads (edgeRouting.ts:114-162 extraction, :359-394 dispose comment,
       NodeSizer.ts:143 reachability, SizingSection.tsx:87-93/121-125 unclamped input).
2. [x] Restructure the obstacle loop to build ONE `RoutingObstacle` candidate then guard it with a
       module-private `hasFiniteGeometry` (Number.isFinite x4). DRY: one check, both kinds.
3. [x] Update `extractEdgeRoutingInput` doc comment (new contract) + WHY comment at the guard
       carrying the reachability finding.
4. [x] Update the stale forward reference in `AvoidArena.dispose()` (residual now CLOSED).
5. [x] Add 4 pure BDD tests in the `describe("extractEdgeRoutingInput")` block. No real-wasm test
       (feeding non-finite geometry to the shared module would abort it and poison the file).
6. [x] `npm run check`, `npm test`, commit.

## Key facts learned
- `route()` THROWS (edgeRouting.ts:445) on an edge whose endpoint has no shape ⇒ dropping the
  obstacle MUST also drop its edges. It does, via the existing `obstacleIds` membership pass
  (:156-158). Covered by a dedicated test.
- Real-wasm `describe` block: the session-survival guard pair MUST stay last (comment ~:645).
  Untouched.
- No logging added: extraction stays pure; the caller's `console.debug("… edge routing pass", …)`
  already reports `obstacleCount`/`edgeCount`.

## State
Complete. Tree committed. See PUBLIC.md for results.
