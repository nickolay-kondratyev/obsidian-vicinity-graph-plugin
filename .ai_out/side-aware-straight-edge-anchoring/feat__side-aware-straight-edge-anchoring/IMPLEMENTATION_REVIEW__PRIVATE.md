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

---

# ROUND 2 (fresh instance) — reviewed `0d509ca`. **VERDICT: READY.**

## Numbers I ran myself
- `npm test` → 81 files / **1109** tests, exit 0 (`.tmp/r2-npm-test.log`).
- `npm run check` → exit 0 (`.tmp/r2-npm-check.log`).
- e2e **not re-run** (only view change was `clipRectOf`'s early return, behaviour-identical;
  routed branch byte-unchanged). Round 1's 84/1-skipped still stands. Said so plainly in the review.

## Techniques worth reusing
- Scratch probe (round-1 recipe still works): `.tmp/scratchN.ts` → `npx esbuild --bundle
  --platform=node` → `node`. **Watch the angle-wrap formula**: my first attempt inverted the
  hemisphere test AND used `viol.length<12` as both the print cap and the counter, producing 12
  fake violations. Re-derived with a `counts` map — 0 real violations.
- **Proving the tests fail pre-fix**: `git worktree add .worktree/r2-prefix HEAD`, symlink
  `node_modules` from the main checkout, `git checkout 58f5ede -- src/view/edgeGeometry.ts
  src/view/VicinityEdge.tsx`, `npx vitest run src/view/edgeGeometry.test.ts`. Got
  `5 failed | 50 passed (55)`. Remove with `git worktree remove --force`.

## Verification outcomes
- **B1 fixed by construction.** 2,846,638 non-null structured-grid + 2,711,199 random-float
  non-null results → 0 violations on: NaN, reversed/zero dot, off-border anchor, anchor inside the
  other rect, arrow angle outside the correct hemisphere. Extremes fine (Infinity→null, 1e-9 rects,
  1e15 coords).
- **B2(b) mutual exclusivity is a REAL PROOF, not just sampling.** 2-point centre→centre chord
  degenerates in exactly 3 ways, each forcing `facingSideAnchorsFor` null: (1) `cS` inside
  targetRect → same `isStrictlyInsideRect` test; (2) indeterminate crossing → the *identical*
  `segmentRectEntryPoint` call; (3) target crossing T inside sourceRect → t_T < t_S along the centre
  line → dot < 0. My own sweep: 549,036 degenerate chords, 14.6M non-null anchors, BOTH = 0.
  The ~0.5% remainder is the 3-point routed case only → correctly `[decide]`-ticketed
  (`nid_bq5k5gx5k3112otsbz1u0h7ba_e`).
- **B2(a) truthful**: spec says "no-op in normal operation" outright; `GraphViewController` line 234
  `await resolveRoutes` precedes line 244 `publish` → no un-routed first frame. Confirmed.
- S1/S3 fixed (narrowing option chosen → original `segmentRectEntryPoint` precondition true again).
  S2/C1/C2 fine. `assert` is vitest's real throwing assert.
- No regressions: cumulative diff removes no test, no `ap_XXX_E`, no behaviour; OFF-parity
  byte-identity test (`edgeGeometry.test.ts:352`) intact and green.

## Left as CONSIDER only (do not escalate)
"Reach" paragraph omits `routedPoints.length < 2`; `VicinityEdge.tsx:81` comment no longer
exhaustive; degenerate-chord pin is one sample of a universal property. C5 (`CLAUDE.md` ticket dir)
is a human call — implementer's refusal to self-edit `CLAUDE.md` is correct.

## If a round 3 somehow arrives
Everything above was re-verified from the code, not the write-up. Re-run only `npm test` +
`npm run check`, then diff against `0d509ca`; the geometry is settled.
