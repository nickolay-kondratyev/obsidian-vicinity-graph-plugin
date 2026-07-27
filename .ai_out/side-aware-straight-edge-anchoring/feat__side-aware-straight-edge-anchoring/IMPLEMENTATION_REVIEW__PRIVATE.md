# REVIEWER PRIVATE — rehydration memory (side-aware straight-edge anchoring)

Round 1 review of `58f5ede`. Verdict NEEDS_ITERATION. Public review:
`IMPLEMENTATION_REVIEW__PUBLIC.md` (same dir).

## Verified myself (do not re-trust the write-up blindly, but it was accurate)

- `npm test` → 81 files / 1103 tests, exit 0. `npm run check` → exit 0.
  `npm run test:e2e` → 84 passed / 1 skipped, exit 0. `edgeGeometry.test.ts` alone → 49.
- Logs in `.tmp/review-npm-test.log`, `.tmp/review-npm-check.log`, `.tmp/review-e2e.log`.
- No `sanity_check.sh`, no lint script in this repo.

## How I probed the math (repeat this technique)

vitest only includes `src/**` and `e2e/**`, so a scratch test file will not run. Instead:

```bash
cat > .tmp/scratch.ts   # imports ../src/view/edgeGeometry
npx esbuild .tmp/scratch.ts --bundle --platform=node --outfile=.tmp/scratch.js --log-level=error
node .tmp/scratch.js
```

Executing the real module (rather than reasoning on paper) is what found B1 and S1.

## The two findings, with the exact numbers

- **B1 (blocking, real regression).** `source {0,0,100,100}` vs `target {60,0,100,100}` — overlap,
  neither centre inside the other, so the nested guard does NOT fire. Result
  `{sourceX:100, targetX:60}` → path `M 100,50 L 60,50`, `arrowAngleDeg 180` = arrowhead points at the
  wrong node. Same for centre-exactly-on-border (`{50,0,100,100}`). Touching boxes give a zero-length
  edge (dot == 0). Proposed fix: dot-product ordering guard (`drawn · centreDelta <= 0 → null`), which
  covers both.
- **S1.** NaN rect field → NaN anchors → `M NaN,50` → edge vanishes. `isStrictlyInsideRect` returns
  false for NaN, Liang–Barsky propagates it, `NaN > leave` is false so no null. Precedent for the fix:
  `hasFiniteGeometry` in `edgeRouting.ts:189`. Non-trivially reachable because `extractEdgeRoutingInput`
  drops non-finite obstacles → those edges are precisely the ones on the new straight branch.

## The structural insight (B2) — most important thing to carry forward

The degenerate `clipRouteToEndpointRects` chord — sold by the exploration as the one straight path
firing in NORMAL operation, and the ticket's strongest justification — **is a 2-point `routedPoints`
array**. `VicinityEdge` branches on `routedPoints.length >= 2`, so it takes the ROUTED branch and
`routedGeometryFor` (`edgeGeometry.ts:509-511`) calls `edgePathFor` internally with the raw chord.
The new anchors are never consulted there. So this change is live only on router-failure /
edge-missing-from-map / endpoint-dropped paths → a visual no-op in working operation.
The implementer's CALLOUT 1 ("improved only when boxes overlap partially") and the amended spec bullet
both assert otherwise. Fix = docs + a follow-up ticket to use `facingSideAnchorsFor` as
`clipRouteToEndpointRects`'s degenerate fallback instead of the raw chord (that WOULD be covered by the
existing `facing/` e2e fixture).

If a round 2 arrives: re-run the scratch probe on the partial-overlap and NaN cases first; if both now
return `null` and the docs in B2 are corrected, everything else was already fine.

## Things I checked and found GOOD (don't re-litigate)

- Every binding constraint honored: one Liang–Barsky routine, `ClipRect` reused/local, `edgePathFor`
  signature + output bytes untouched (parity test at `edgeGeometry.test.ts` still green), pure math in
  `edgeGeometry.ts`, `VicinityEdge` is a thin `??`, `useInternalNode | undefined` handled,
  `positionAbsolute` + `measured ?? explicit` (no DOM), handles/layout/routed branch untouched.
- No stale `edgeRouting` setting / `LayoutMode` symbols reintroduced.
- No behavior-capturing test or anchor point removed (diff is additive in `src/`; only doc prose edited).
- The 9 new tests are non-tautological — exact border coordinates on named sides.
- Fixture `rect`/`pt` helpers are pre-existing module-scope (`edgeGeometry.test.ts:123-124`); reuse is DRY.
- Follow-up ticket `nid_ub30ndqyp6ikq76hv4ba6yqss_e` (stale `VicinityGraphFlow` handle comment) is a
  legitimate spot-and-file, correctly left unpatched.
- CALLOUT 3 (no e2e possible) and CALLOUT 4 (`_tickets/` is the live dir) are both correct.
