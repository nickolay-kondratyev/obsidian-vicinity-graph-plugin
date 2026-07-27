# IMPLEMENTATION REVIEW — side-aware straight-edge anchoring

Reviewed `git diff 4eab96c..HEAD` (`58f5ede` code, `4ee4233` write-up) on
`feat/side-aware-straight-edge-anchoring`. Ticket `nid_var2o7krxq7ribq3iofni3aw1_e` (scope CORRECTED).

## Verified test results (run by me, not taken on trust)

| Command | Result |
|---|---|
| `npm test` | **81 files passed / 1103 tests passed**, exit 0 |
| `npm run check` (`tsc -noEmit` src + e2e) | exit 0, no output |
| `npm run test:e2e` | **84 passed, 1 skipped** (54.9s), exit 0 |
| `src/view/edgeGeometry.test.ts` alone | 49 passed |

All three match the implementer's claims exactly. No `sanity_check.sh` in this repo; no lint script.
The `routedGeometryFor([2 pts]) == edgePathFor` byte-identity parity test still passes, and
`edgePathFor`'s signature/output are untouched.

## What changed

`facingSideAnchorsFor(sourceRect, targetRect)` (exported, pure, `edgeGeometry.ts`) returns the
centre→centre crossing of each endpoint rect's border, built on private `rectBorderPointToward` which
delegates to the EXISTING Liang–Barsky `segmentRectEntryPoint` + `isStrictlyInsideRect`. `VicinityEdge`
pulls rects from the RF store via `useInternalNode` (`clipRectOf`) and `??`-falls back to today's
handle endpoints. 9 new BDD tests; spec section in `docs-internal/specs/graph/arrows.md`; one
follow-up ticket filed.

**Constraint compliance (all honored):** one intersection routine (no second math), `ClipRect` reused
and still local, `edgePathFor` untouched, geometry pure and in `edgeGeometry.ts`, `VicinityEdge` thin,
`useInternalNode | undefined` handled, rects from `positionAbsolute` + `measured ?? explicit` (no DOM),
handles/layout/routed branch untouched, no stale `edgeRouting`/`LayoutMode` symbols reintroduced.
The code is clean, well-commented (WHY-comments, not WHAT), and reads well. Two real problems below.

---

## BLOCKING

### B1 — Partially overlapping boxes produce a REVERSED edge (arrowhead points the wrong way)

`facingSideAnchorsFor` guards only "either centre strictly inside the other rect". Two boxes can
overlap **without** either centre being inside the other, and then the two anchors come out in the
wrong order along the centre line: the source anchor ends up BEYOND the target anchor, so the drawn
segment — and both arrowheads — point opposite to the true source→target direction.

Reproduced by executing the real module (not by inspection):

```
source rect {x:0,  y:0, w:100,h:100}  (centre  50,50)
target rect {x:60, y:0, w:100,h:100}  (centre 110,50)   // 40px overlap, neither centre inside the other

facingSideAnchorsFor(...) => { sourceX:100, sourceY:50, targetX:60, targetY:50 }
edgePathFor(...)          => path "M 100,50 L 60,50",  arrowAngleDeg = 180
```

True direction is +x; the rendered line and arrowhead run −x. For a `bidirectional` group-collapsed
edge both heads land on the wrong ends. Same failure for the "centre exactly on the other border"
case (`source {0,0,100,100}` vs `target {50,0,100,100}` → `M 100,50 L 50,50`, angle 180).

This is a strict **regression** versus the handle endpoints, which always pointed the right way, and
arrow direction is the semantic payload of this graph — POLS/"behavior must match naming" violation.
Reachability is limited (needs the non-routed branch AND overlapping boxes), but the fix is trivial
and the failure mode is a lie about the data.

**Fix (≈3 lines, pure, testable):** after computing both anchors, reject an inverted ordering —

```ts
const drawnX = target.x - source.x, drawnY = target.y - source.y;
const centreX = targetCentre.x - sourceCentre.x, centreY = targetCentre.y - sourceCentre.y;
// Overlapping boxes can put the anchors in the WRONG ORDER along the centre line; a
// backwards segment would point the arrowhead at the wrong node, so keep the handles.
if (drawnX * centreX + drawnY * centreY <= 0) return null;
```

plus a BDD test `WHEN the boxes partially overlap THEN it reports no facing side` (and ideally one
pinning that touching boxes do not degenerate — see S2).

### B2 — The write-up and the spec overstate the change's reach: the degenerate-clip case is NOT affected

The exploration named the `clipRouteToEndpointRects` degenerate chord as the one straight path that
"FIRES IN NORMAL OPERATION", and the write-up's CALLOUT 1 says that path "is improved only when the
boxes overlap **partially**". **It is not improved at all.** The degenerate chord is a *2-point
`routedPoints` array*, so `VicinityEdge` takes the **routed** branch
(`routedPoints.length >= 2 → routedGeometryFor`), and `routedGeometryFor` calls `edgePathFor`
internally with the raw chord points (`edgeGeometry.ts:509-511`). The new anchors are never consulted.

Consequently the new code is live only when `routedPoints` is absent/`<2`: whole-pass router failure,
edge missing from the route map, endpoint dropped from the routing input. In normal, working operation
this change is visually a no-op. That may still be the right (literal) reading of the corrected ticket,
but the human must not be told otherwise.

**Required:**
1. Correct CALLOUT 1 in `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` — the degenerate chord renders via
   `routedGeometryFor`, so it is untouched; state plainly that the normal-operation win is nil.
2. Correct `docs-internal/specs/graph/arrows.md`. The amended straight-line-fallback bullet now lists
   "the boundary clip hits its degenerate case" alongside the other fallbacks, and the new
   `## Straight (non-routed) edge anchoring` section then implies those edges get facing-side anchors.
   They do not — the degenerate chord goes through the routed code path. Either drop that clause or
   say explicitly that the degenerate chord keeps its centre→centre points.
3. File a ticket (do not silently implement — it touches the routed branch, which was out of scope):
   *"Feed `facingSideAnchorsFor` into `clipRouteToEndpointRects`'s degenerate chord fallback"*. That
   is the cheap change that actually delivers the motivating win — replace the raw first/last chord
   with the facing-side anchors when they exist, keeping the chord as the second fallback. Pure,
   unit-testable, and it reuses everything this ticket just built.

---

## SHOULD

### S1 — Non-finite rects yield NaN anchors and make the edge disappear; the documented "never NaN" contract is not enforced

The write-up states the helper is "Pure, total, never NaN". It is not:

```
facingSideAnchorsFor({x:NaN,y:0,w:100,h:100}, {x:200,y:0,w:100,h:100})
  => { sourceX: NaN, sourceY: 50, targetX: NaN, targetY: 50 }   // path "M NaN,50 L NaN,50"
```

`isStrictlyInsideRect` returns `false` for NaN (all comparisons false), so the guard passes, and
Liang–Barsky propagates NaN (`Math.max(0, NaN) === NaN`, and `NaN > leave` is false, so no `null`).
An SVG path with `NaN` renders nothing — the edge vanishes.

This is not merely theoretical here: `extractEdgeRoutingInput` drops obstacles failing
`hasFiniteGeometry` (`edgeRouting.ts:154,189-196`), and edges touching them are dropped from routing —
i.e. **exactly the edges that now take the new straight branch**. A node with a finite position but a
non-finite width would previously still render a (correct) handle-to-handle line and would now
disappear.

**Fix:** mirror the existing precedent — a `hasFiniteRect` guard at the top of `facingSideAnchorsFor`
returning `null`, plus a `WHEN a rect is non-finite THEN it reports no facing side` test. Cheap, and it
makes the doc comment true.

### S2 — Test gaps: the two cases that actually break are untested

The 9 new tests are genuinely good — BDD, one behavior each, exact-integer expectations that would
fail if the anchor landed on the wrong border (not tautological), degenerate/nested/missing pinned.
But the suite tests only the well-separated and the fully-nested extremes. Missing:

- **partial overlap** (B1) — the case that is wrong today;
- **touching boxes** (`{0,0,100,100}` vs `{100,0,100,100}` → both anchors `(100,50)`, a zero-length
  edge routed into `edgePathFor`'s degenerate branch with `arrowAngleDeg: 0`, i.e. an arrowhead
  pointing +x regardless of the true direction). Decide whether that is acceptable and pin it either
  way; the `dot <= 0` guard from B1 also covers it (dot is exactly 0);
- symmetry: only `facingSideAnchorsFor(undefined, box)` is tested, not the target-undefined side.

Also, the bow test uses `anchors?.sourceX ?? 0` four times. The hard-coded expected path means it
cannot silently pass, but `?? 0` in a test is the silent-fallback smell CLAUDE.md warns about — prefer
a preceding `expect(anchors).not.toBeNull()` (or `assert`) so a `null` fails on its own line.

### S3 — `rectBorderPointToward` widens `segmentRectEntryPoint`'s documented precondition

`segmentRectEntryPoint`'s contract is "`from` outside/on the border and `to` **strictly inside**". The
new caller passes `to = rectCentre`, which is strictly inside only when both dimensions are `> 0`. A
zero-size rect happens to behave benignly (I checked: returns the rect point, no NaN), so this is a
latent contract violation rather than a live bug — but it is exactly the kind that bites the next
maintainer. Either add `widthPx > 0 && heightPx > 0` to the guard (folds naturally into the S1 finite
check) or amend `segmentRectEntryPoint`'s doc to state that a `to` on the border is tolerated.

---

## CONSIDER

- **C1 — `clipRectOf` reads the node before the undefined check.** It computes `node?.measured.width`
  and only then tests `node === undefined`, which reads backwards. An early `if (node === undefined)
  return undefined;` then plain `node.measured.width ?? node.width` is the same length and obvious.
- **C2 — new store subscription per edge.** `useInternalNode` × 2 subscribes every edge to its
  endpoints' internals; previously `VicinityEdge` used no store hooks. RF's own floating-edge example
  does exactly this and e2e shows no perf regression, so this is fine — just noting it is a real
  (accepted) coupling change, not only "a handful of arithmetic ops" as the write-up frames it.
- **C3 — CALLOUT 3 (no e2e coverage) is defensible.** There is genuinely no seam to force a non-routed
  edge, and inventing a test-only one would be the hack CLAUDE.md forbids. The prior boundary-clip
  ticket set the precedent of trading an e2e geometry assertion for stronger pure unit tests. Accept —
  provided B1/S1/S2 land, since the pure layer is then the only safety net. If the B2 follow-up
  (degenerate chord uses the anchors) is ever implemented, the existing `facing/` e2e fixture WOULD
  cover it, which is another argument for that ticket.
- **C4 — CALLOUT 1's "I did not invent a heuristic to fake a facing side" is the right call.** Fully
  nested boxes genuinely have no facing side; falling back to the handles is honest. No objection.
- **C5 — CALLOUT 4 (`_tickets/` vs `docs-internal/tickets/`)** — following the live `ticket` CLI
  convention is correct. `CLAUDE.md` still points at `docs-internal/tickets/`; worth a one-line fix
  there (see below).

## Documentation Updates Needed

- `docs-internal/specs/graph/arrows.md` — B2 items 2 (accuracy of which edges get facing-side anchors).
- `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` CALLOUT 1 — B2 item 1.
- `CLAUDE.md` "Orient here first" says `docs-internal/tickets/` is where active follow-ups live; the
  live location is `_tickets/` (C5). Not this ticket's job — worth a one-liner or a ticket.

---

## VERDICT: NEEDS_ITERATION

The implementation is architecturally exactly right — it honors every binding constraint (one
Liang–Barsky routine, `ClipRect` reused, `edgePathFor` byte-identical, pure math in the testable layer,
a one-line `??` in the untestable component, no DOM measurement, no stale symbols revived), the
comments explain WHY, the tests are real BDD tests that would catch a wrong-side anchor, and all three
suites are green exactly as claimed. Two things must change before merge. **B1** is a genuine
correctness regression: partially overlapping boxes — the very case the write-up claims as the win —
produce a backwards segment with the arrowhead pointing at the wrong node, fixable with a three-line
ordering guard plus a test. **B2** is a transparency problem rather than a code defect: the degenerate
`clipRouteToEndpointRects` chord renders through `routedGeometryFor`, so the new anchors never reach
the path both the exploration and the spec present as the motivation, meaning this change is a visual
no-op in normal operation; the write-up and the spec must say so, and the cheap follow-up that would
actually deliver that win belongs in a ticket. With B1 fixed, S1/S2 landed, and the docs corrected,
this is ready.
