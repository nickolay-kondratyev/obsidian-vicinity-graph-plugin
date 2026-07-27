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

---

# ROUND 2 — convergence check (`0d509ca`, diff `4ee4233..HEAD`)

Fresh reviewer instance. Round 1 above is unchanged and kept for audit.

## Verified test results (run by me, this round)

| Command | Result |
|---|---|
| `npm test` | **`Test Files 81 passed (81)` / `Tests 1109 passed (1109)`**, exit 0 |
| `npm run check` (`tsc -noEmit`, src + e2e) | exit 0, no diagnostics |
| `npm run test:e2e` | **NOT re-run this round** — see note below |

Matches the implementer's claims (1109, +6 over round 1's 1103). Logs: `.tmp/r2-npm-test.log`,
`.tmp/r2-npm-check.log`.

**Why no e2e re-run:** the only `src/view` change touching rendering this iteration is `clipRectOf`'s
early return, which I read line-by-line and which is behaviour-identical to the previous
`node?.…` form (same three `undefined` outcomes, same rect). The routed branch, `hasOpposite` bow,
bidirectional arrowhead block and `routedGeometryFor` are byte-unchanged in the iteration diff, and
the `routedGeometryFor([2 pts]) === edgePathFor(...)` parity test (`edgeGeometry.test.ts:352`) is
green. Round 1's e2e run (84 passed / 1 skipped) therefore still stands. Stated plainly rather than
claimed as re-verified.

## B1 — reversed/zero-length segment: **FIXED, and verified far beyond the reported counterexample**

The three round-1 counterexamples now all return `null`:

```
{0,0,100,100}/{60,0,100,100}  (partial overlap)   => null
{0,0,100,100}/{50,0,100,100}  (centre on border)  => null
{0,0,100,100}/{100,0,100,100} (touching)          => null
```

I did not stop there. Two brute-force sweeps executing the real module
(`.tmp/scratch3.ts`, `.tmp/scratch4.ts`, esbuild-bundled and run under node):

- **structured grid** — 5×5×5×5 size combinations × integer offsets over ±300 in both axes:
  **2,846,638 non-`null` results, 0 violations**;
- **random floats** at plugin-realistic sizes (20–900 × 20–600, positions ±1000), 3M pairs:
  **2,711,199 non-`null` results, 0 violations**.

Invariants asserted on every non-`null` result — all held:
NaN-free; `(targetAnchor − sourceAnchor) · (targetCentre − sourceCentre) > 0` (never reversed, never
zero); source anchor exactly on the SOURCE rect border and target anchor on the TARGET rect border;
neither anchor strictly inside the *other* rect; and `edgePathFor(...).arrowAngleDeg` within 90° of
the true centre→centre bearing (i.e. the arrowhead never points at the wrong node).

Also probed the awkward extremes by hand: `Infinity` width → `null`; sub-pixel `1e-9` rects and
`1e15` coordinates → correctly-ordered finite anchors. The dot-product guard is correct and complete
as far as I can drive it.

**The tests are genuine.** I checked out `58f5ede`'s `edgeGeometry.ts` into a throwaway worktree
against the CURRENT test file: `Tests 5 failed | 50 passed (55)` — the partial-overlap,
degenerate-chord pin, touching, non-finite and zero-size tests all fail without the guards. (The
write-up says "4 failed | 50 passed (54)"; that was an honest intermediate snapshot taken before the
degenerate-chord pin was written — the count is 5 at final state, not fewer.) The `assert(anchors
!== null, …)` replacing `?? 0` is vitest's real `assert`, imported at line 1 and throwing on `null` —
a genuine assertion, not a silent pass.

## B2(a) — truthfulness: **CORRECTED, and the correction is truthful, not softened**

`docs-internal/specs/graph/arrows.md` now (a) *removes* the degenerate boundary clip from the
straight-line-fallback list and states outright that it "is a `routedPoints` polyline like any other
and renders through `routedGeometryFor`", and (b) carries a **"Reach — read this before assuming a
visual change"** paragraph saying in so many words that this is **"a no-op in normal operation"**.
ITERATION 1's CALLOUT 1 correction says the same and labels the original claim "**Both halves are
wrong**". That is the honest statement, not a hedge.

Their added claim checks out: `GraphViewController.runRebuild` does `await this.resolveRoutes(...)`
at line 234 and only then `this.publish(..., withRoutedPoints(flow, routes))` at line 244 — there is
no un-routed first frame.

Minor: the "Reach" paragraph lists three fallback triggers and omits `routedPoints.length < 2`, which
`VicinityEdge:97` also treats as non-routed. Incomplete, not false — noted under CONSIDER.

## B2(b) — ticketed rather than implemented: **defensible, and the mutual-exclusivity argument is a real proof**

I scrutinised this hardest, because "0 out of 200k random samples" is not a proof and structured
real-world geometry is not uniformly random. It holds anyway — I derived it from the code rather than
from the sample:

For a 2-point centre→centre chord `[cS, cT]`, `clipRouteToEndpointRects` degenerates in exactly three
ways, and each one forces `facingSideAnchorsFor` to `null`:

1. `cS` strictly inside `targetRect` → `rectBorderPointToward(targetRect, cS)` returns `null` on the
   identical `isStrictlyInsideRect` test.
2. `segmentRectEntryPoint(cS, cT, targetRect)` indeterminate → `facingSideAnchorsFor` makes the
   *literally identical call* (`rectBorderPointToward(targetRect, cS)` = `segmentRectEntryPoint(cS,
   rectCentreOf(targetRect), targetRect)`, and `cT === rectCentreOf(targetRect)` for a centre chord).
3. The target crossing `T` lands strictly inside `sourceRect` → parametrise the centre line from `cS`
   (t=0) to `cT` (t=1): the source anchor `S` is `sourceRect`'s exit crossing, so `t_T < t_S`, hence
   `(T − S) · (cT − cS) < 0` and the new dot guard returns `null`.

So the exclusion is structural for the named case, not statistical. My own independent structured
sweep (15M pairs, 549,036 degenerate 2-point chords, 14.6M non-`null` anchor results) found
**BOTH = 0**, consistent.

The pinning test is **not tautological**: it `assert`s the clip actually degenerates for that
configuration and *then* expects `null`, so it fails if either side of the relation changes. It is a
single sample where the underlying property is universal — thin, but as a maintainer tripwire it does
its job, and the WHY comment carries the reasoning.

The residual value is the **3-point / multi-vertex** case, which the ticket honestly reports as
191/~37,600 (~0.5%), all corner-overlap, with an explicit caveat that the anchors are not guaranteed
to fall outside both boxes there. Editing `clipRouteToEndpointRects` is the routed branch, explicitly
out of this ticket's scope. Ticketing ~0.5% of an already-rare fallback with the measurement, the
exact 5-line change and the caveat written down (`nid_bq5k5gx5k3112otsbz1u0h7ba_e`, `[decide]`) is
textbook Pareto, not a dodge. **Accepted.**

## S1 / S3 — **both genuinely fixed**

`isAnchorableRect` (finite `x/y/w/h` **and** positive extent) rejects before any arithmetic. Swept
`NaN`, `±Infinity`, `0` and negative extents across every field on both rects: **0 NaN leaks, 0
non-finite rects accepted**. The "never NaN" doc claim is now true. Restating the predicate instead
of importing `edgeRouting.hasFiniteGeometry` is the right call for the layering (same rationale as
the local `ClipRect`) and the WHY-comment names the precedent.

S3: the implementer took the *narrowing* option, so `segmentRectEntryPoint`'s original contract
("`to` strictly inside") is once again true at every call site — the positive-extent half of
`isAnchorableRect` guarantees a rect strictly contains its own centre, and `rectBorderPointToward`'s
doc now records *why* the precondition holds. Contract and call sites agree; no widening. Correct
resolution.

## S2 / C1 / C2 — spot-checked, all fine

S2: 6 tests added (partial overlap, degenerate-chord pin, touching, target-undefined symmetry,
non-finite, zero-size), each BDD, one behaviour, exact expectation, all proven to fail pre-fix. The
`?? 0` silent fallback is gone. C1: `clipRectOf` early-returns first — behaviour-identical, reads
forward now. C2: accepted as a framing correction in CALLOUT 5, honestly restated; no code change
needed.

## C5 — rejection is reasonable

Declining to edit `CLAUDE.md` on a sub-agent's say-so is the correct instinct, `docs-internal/tickets/`
does still exist (so the line is incomplete rather than false), and it is flagged for the human in
CALLOUT 7. Not re-litigated.

## Regression check

No regressions found. Cumulative `git diff 4eab96c..HEAD -- src/ e2e/` removes no test, no
`ap_XXX_E` anchor and no behaviour; the only deleted source lines are the two `VicinityEdge` lines
this feature replaces plus one test-file import line. Routed branch, `routedGeometryFor`,
`hasOpposite` bow, bidirectional arrowhead and `edgePathFor` are untouched; the OFF-parity
byte-identity test is intact and green.

---

## BLOCKING

None.

## SHOULD

None.

## CONSIDER

- **The "Reach" paragraph in `arrows.md` omits `routedPoints.length < 2`** from the list of triggers
  that reach the straight branch (`VicinityEdge.tsx:97` treats a 0- or 1-point route as non-routed).
  One clause, purely additive; the paragraph's headline claim is unaffected.
- **`VicinityEdge.tsx:81`'s inline comment** still says `null` means "node not in the store yet, or
  nested/overlapping rects" — now also non-finite/zero-size/backwards-ordered. Still true, just no
  longer exhaustive; `facingSideAnchorsFor`'s doc is the authoritative and complete list.
- **The degenerate-chord pin is one sample of a universal property.** If the human wants it stronger,
  a small table of overlap configurations would make the mutual exclusivity harder to break silently.
  Not required — the WHY comment plus the ticket carry the reasoning.

## Documentation Updates Needed

None blocking. `CLAUDE.md`'s `docs-internal/tickets/` line remains a human call (round-1 C5).

---

## VERDICT: READY

Both round-1 blockers are properly resolved and the resolutions survive far harder scrutiny than the
originals. B1 is fixed by construction, not patched around the reported counterexample: 5.5M
non-`null` results across structured-integer and realistic-float sweeps produced zero reversed, zero
zero-length, zero off-border, zero misdirected-arrowhead and zero NaN outcomes. B2(a) is corrected
honestly — the spec now says "no-op in normal operation" in plain words rather than softening the
claim, and the no-un-routed-first-frame assertion checks out in `GraphViewController`. B2(b) is the
one I expected to push back on, and it survives: the mutual exclusivity is provable from the code
(three degeneracy branches, each forcing `null`), not merely sampled, and the ~0.5% multi-vertex
remainder — routed-branch, out of scope, with a real correctness caveat — is exactly what a `[decide]`
ticket is for. S1 and S3 are fixed, not documented away. The new tests are real: 5 of them fail
against the pre-fix module, and the `?? 0` smell is now a throwing `assert`. Nothing was removed or
weakened. `npm test` 1109/1109 and `npm run check` are green, verified by me.

The human still owns the judgement ITERATION 1 correctly surfaces: this change improves only the
router-failure fallback path. That is a value question, not a correctness one, and it is now stated
truthfully everywhere it is stated at all — which is what round 1 asked for.
