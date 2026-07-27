# IMPLEMENTATION — side-aware straight-edge anchoring

Ticket `nid_var2o7krxq7ribq3iofni3aw1_e`. Branch `feat/side-aware-straight-edge-anchoring`,
commit `58f5ede`. Tree clean.

## Plan (as executed)

1. `edgeGeometry.ts`: private `rectBorderPointToward` on top of the EXISTING Liang–Barsky
   `segmentRectEntryPoint` + `isStrictlyInsideRect`. No second intersection routine.
2. `edgeGeometry.ts`: exported `facingSideAnchorsFor(...)` composing the two endpoint anchors.
3. `edgeGeometry.test.ts`: 9 BDD tests.
4. `VicinityEdge.tsx`: `useInternalNode` + a `clipRectOf` helper + one `??` line.
5. `docs-internal/specs/graph/arrows.md`: new section + two amendments.
6. `npm test`, `npm run check`, `npm run test:e2e`.
7. Follow-up ticket for the stale culling comment.

## What changed and why

**Problem.** A straight (non-routed) edge anchored at each node's fixed `<Handle>` — pinned to
Top/Bottom by `NoteNode` / `FolderGroupNode`. An edge to a node on the LEFT therefore departed from
the bottom and looped back up, reading as a detour that isn't in the data. The routed path already
gets facing-side attachment for free from `clipRouteToEndpointRects`; the straight path was the
remaining offender.

**Fix.** React Flow's "floating edge" pattern: intersect the centre→centre segment with each
endpoint rect's border and feed those two points into the unchanged `edgePathFor`.

### New helper — exact signature & contract

```ts
/** Endpoint pair for a STRAIGHT edge, ABSOLUTE flow coords — the 4 values edgePathFor takes. */
export interface StraightEdgeAnchors {
	readonly sourceX: number;
	readonly sourceY: number;
	readonly targetX: number;
	readonly targetY: number;
}

export function facingSideAnchorsFor(
	sourceRect: ClipRect | undefined,
	targetRect: ClipRect | undefined,
): StraightEdgeAnchors | null;
```

Contract:

- Returns the point where the **centre→centre** segment crosses each rect's border — the anchor on
  the side each box faces.
- Returns **`null` = "keep the caller's existing handle endpoints"** when
  (a) either rect is `undefined` (React Flow has not registered the node yet), or
  (b) either centre is **strictly inside** the other rect (nested/overlapping boxes, e.g. a note
  inside its folder-group container), or (c) the crossing is indeterminate.
  Same fallback spirit as `clipRouteToEndpointRects`'s degenerate chord.
- A point exactly ON a border is not "inside" — inherited from `isStrictlyInsideRect`, consistent
  with the route clipper.
- Pure, total, never NaN. Accepting `| undefined` (rather than making the caller branch) is
  deliberate: it moves the "node not in the store" case into the **testable** layer, leaving
  `VicinityEdge` — which this repo cannot unit-test — with a single `??`.

Private support: `rectBorderPointToward(rect, toward)` = `isStrictlyInsideRect` guard +
`segmentRectEntryPoint(toward, rectCentre, rect)`, and `rectCentreOf(rect)`.

### Files modified

| File | Change |
|---|---|
| `src/view/edgeGeometry.ts` | `StraightEdgeAnchors`, `facingSideAnchorsFor`, private `rectBorderPointToward` / `rectCentreOf`. |
| `src/view/edgeGeometry.test.ts` | New describe block, 9 BDD tests. |
| `src/view/VicinityEdge.tsx` | `useInternalNode(source/target)`, `clipRectOf`, anchors spliced into the `edgePathFor` call. |
| `docs-internal/specs/graph/arrows.md` | New `## Straight (non-routed) edge anchoring`; amended the straight-line-fallback bullet and `## Test coverage`. |
| `_tickets/stale-comment-…-render-no-handle.md` | New follow-up ticket (see below). |

## Decisions & trade-offs

- **DRY, one intersection routine.** `rectBorderPointToward` inverts `segmentRectEntryPoint`'s
  contract (`from` outside, `to` inside) by passing the *other* node's centre as `from` and *this*
  rect's centre as `to`. Zero new math.
- **`edgePathFor` untouched** (signature and output bytes). The `routedGeometryFor([2 pts])` ↔
  `edgePathFor` byte-identity assertion (`edgeGeometry.test.ts:255`) and the positional call at
  `routedGeometryFor:443` both still hold. Composition happens at the call site.
- **`ClipRect` reused**, still local to `edgeGeometry.ts` — the prior deliberate decision that this
  pure-math layer imports no routing types is preserved.
- **Rects from the RF store, not the DOM.** `internals.positionAbsolute` +
  (`measured.width ?? node.width`, `measured.height ?? node.height`). `onlyRenderVisibleElements`
  unmounts culled nodes but keeps them in the store, so DOM measurement would be wrong.
- **Anchors are computed even on the routed branch** (React hooks must be unconditional, and the
  `??` is evaluated eagerly). A handful of arithmetic ops per edge per render — not worth branching
  around. Called out rather than micro-optimised.
- **Not touched:** the hidden `<Handle>`s (RF still needs them to address an edge at all), layout,
  the routed branch, the arrowhead inset constants, the edge-path CSS selector.

> ⚠ **CALLOUTS 1 and 2 below are the ORIGINAL (pre-review) text and CALLOUT 1 is
> WRONG.** They are kept verbatim for audit; read **ITERATION 1** at the bottom for
> the corrected statements and the point-by-point review response.

## CALLOUTS

1. **The ticket's stated scope is STALE — I did not chase it.** It motivates the work with the
   `edgeRouting` ViewSetting being toggled OFF and with `radial` layout / `ROUTING_SKIPPED_LAYOUT_MODE`.
   **None of those symbols exist in `src/` any more** — they were deleted by closed tickets
   `01-force-layout-only…` and `02-remove-edge-routing-setting…` (2026-07-24); routing is now
   unconditional. Nothing was reintroduced. The straight path is still reachable via: whole-pass
   router/wasm failure, an edge missing from the route map, an endpoint dropped from the routing
   input, `routedPoints.length < 2`, `hasOpposite` bowed note↔note pairs, and — the real
   justification — **the degenerate `clipRouteToEndpointRects` chord fallback
   (`edgeGeometry.ts:190-201`), which fires in NORMAL operation** on overlapping/nested rects, where
   libavoid's centre pins make that chord a centre→centre line. The spec and the commit message both
   record this correction.
   *Caveat worth knowing:* that same degenerate case (nested/overlapping rects) is exactly the case
   `facingSideAnchorsFor` returns `null` for. So the strongest motivating path is improved only when
   the boxes overlap **partially** (a facing side still exists); fully nested boxes keep today's
   handle endpoints, because there is genuinely no facing side to anchor to. I did not invent a
   heuristic to fake one — that would be a hack.

2. **User-visible behaviour change: arrowheads on straight edges now sit just OUTSIDE the box,
   pointing inward,** instead of at a handle on the top/bottom edge. This is the same look the
   routed path has had since the boundary-clip ticket (whose PUBLIC file recorded the inset
   constants as reviewed and deliberately unchanged) — so this change makes the two paths
   **consistent** rather than introducing a new look. Straight edges also no longer emerge from the
   node's top/bottom only; they radiate from whichever side faces the other node.

3. **No e2e coverage for the new behaviour, by design.** No e2e fixture can currently produce a
   non-routed edge: routing is unconditional (no setting), `ObsidianHarness` has no seam to disable
   it, and the router does not fail under e2e. I did **not** invent a hacky test-only seam. The
   existing e2e suite was run and is green (see below), which proves no regression on the routed
   path, but it does not exercise `facingSideAnchorsFor`. `e2e/selectorGuard.test.ts:205` is a
   tripwire on the edge-path selector — not touched, and it should not need to be.

4. **Tickets live in `_tickets/`, not `docs-internal/tickets/`.** My brief said the latter, but the
   `ticket` CLI writes to `_tickets/` and the parent ticket itself lives there;
   `docs-internal/tickets/` is the older set. I followed the live convention.

## Test results (verbatim)

- `npm test` → **`Test Files 81 passed (81)` / `Tests 1103 passed (1103)`**, exit 0.
  (`src/view/edgeGeometry.test.ts` alone: 49 passed, up from 40.)
- `npm run check` (`tsc -noEmit` for `src/` + `e2e/`) → exit 0, no output.
- `npm run test:e2e` → **ran successfully in this environment**: `1 skipped`, **`84 passed (55.2s)`**,
  `E2E_EXIT=0`. Includes `edgeRouting.e2e.ts` (bend detection, the `facing/` border-attachment spec)
  and `vicinityGraph.e2e.ts` (one arrowhead per edge, arrowhead theming). All exercise the ROUTED
  path — green means no regression, not coverage of the new code.

New tests (all BDD, one behaviour each, exact-integer rects so no epsilon is needed):
target RIGHT/LEFT/ABOVE/BELOW/DIAGONAL lands on the facing border; the source anchor mirrors onto
its own facing border; nested rects → `null`; missing rect → `null`; the `hasOpposite` bow is drawn
between the new border endpoints.

## Tickets filed

- `nid_ub30ndqyp6ikq76hv4ba6yqss_e` — *Stale comment: VicinityGraphFlow claims folder groups render
  no Handle*. `VicinityGraphFlow.tsx:96-99` justifies `onlyRenderVisibleElements` with "group
  parents render no `<Handle>`", but `FolderGroupNode.tsx:26-31,45-50` do render hidden ones — so
  the `forceInitialRender` rationale may no longer hold and a group container could be culled out
  from under its children. Left untouched here (the rationale needs verifying, not just the comment
  rewriting). Linked to the parent ticket.

---

# ITERATION 1 — response to IMPLEMENTATION_REVIEW (NEEDS_ITERATION)

Verdict handled item by item. Nothing was accepted on trust: every claim below was
re-derived by executing the real module in a throwaway vitest harness (deleted).

## Disposition table

| Item | Disposition |
|---|---|
| B1 reversed segment on overlapping boxes | **INCORPORATED** (failing test first, then dot-product ordering guard) |
| B2(a) false claims in CALLOUT 1 + spec | **INCORPORATED** (corrected below and in `arrows.md`) |
| B2(b) route the degenerate chord through the anchors | **REJECTED with measurement + ticket** — provably a no-op for the named case |
| S1 non-finite rect → NaN anchors | **INCORPORATED** (`isAnchorableRect` guard + test) |
| S2 test gaps + `?? 0` smell | **INCORPORATED** (4 tests added, `?? 0` replaced by `assert`) |
| S3 widened precondition of `segmentRectEntryPoint` | **INCORPORATED** — precondition RESTORED (not widened) by rejecting zero-size rects; doc records why it holds |
| C1 `clipRectOf` reads before the undefined check | **INCORPORATED** (early return) |
| C2 per-edge store subscription is a real coupling change | **INCORPORATED as a framing correction** (below); no code change — RF's own floating-edge example does exactly this |
| C3 no e2e coverage is defensible | **ACKNOWLEDGED**, unchanged |
| C4 no faked facing side | **ACKNOWLEDGED**, unchanged |
| C5 `CLAUDE.md` points at `docs-internal/tickets/` | **REJECTED for this branch** — see CALLOUT 7 |

## B1 — reversed segment (FIXED)

Reproduced first as a **failing** test, then fixed, then re-run green.

`facingSideAnchorsFor` now rejects an inverted ordering: it dots the DRAWN vector
(`source anchor → target anchor`) against the CENTRE vector
(`source centre → target centre`) and returns `null` when the result is `<= 0`.

- `<0` is the reviewer's partial-overlap case (`{0,0,100,100}` / `{60,0,100,100}`
  used to yield `M 100,50 L 60,50`, `arrowAngleDeg 180` — the arrowhead aimed at the
  wrong node). Now `null` → the caller keeps its handle endpoints, which always
  point the right way.
- `==0` is the touching-boxes case (both anchors collapse onto the shared border
  point, a zero-length segment whose direction `edgePathFor` has to invent). Also
  `null`, pinned by its own test.

Why `null` rather than swapping the anchors: when the boxes overlap there is no
honest facing side to draw from — swapping would invent one. Falling back is the
same discipline as CALLOUT 4's.

## B2(a) — CORRECTED CALLOUT 1 (supersedes the original above)

The original CALLOUT 1 claimed the degenerate `clipRouteToEndpointRects` chord
"fires in NORMAL operation" and is "improved when the boxes overlap partially".
**Both halves are wrong.** The truth, verified by execution:

- The degenerate chord is a 2-point `routedPoints` array, so `VicinityEdge` takes
  the **routed** branch (`routedPoints.length >= 2 → routedGeometryFor`, which calls
  `edgePathFor` internally with the raw chord). The new anchors are never consulted.
- Therefore **this change is a visual no-op in normal, working operation.** It is
  live only when `routedPoints` is absent or `<2`: whole-pass wasm/router failure,
  an edge missing from the route map, or an endpoint dropped from the routing input
  (e.g. no position, no group dimensions, or `hasFiniteGeometry` rejecting an
  obstacle — `edgeRouting.ts:154,189-196`).
- There is also **no un-routed first frame** to benefit: `GraphViewController.runRebuild`
  awaits `resolveRoutes` *before* `publish`, so the graph is never published un-routed.

The value shipped here is therefore: **the fallback path is now correct and
consistent with the routed path instead of springing from a top/bottom handle**,
plus the NaN/reversed-arrow guards. That is worth the ~70 lines, but it is not the
normal-operation win the ticket's headline implied. `docs-internal/specs/graph/arrows.md`
now carries a "**Reach** — read this before assuming a visual change" paragraph
saying exactly this, and the straight-line-fallback bullet no longer lists the
degenerate clip.

## B2(b) — REJECTED, with the measurement that decides it

The proposal: when the boundary clip degenerates, emit the facing-side anchors
instead of the raw centre→centre chord. I did **not** implement it. Not because it is
expensive — it is ~5 lines — but because **for the case the review names it is
provably a no-op**, and it would touch the routed branch for nothing.

Brute force over 200k random rect pairs, counting only the cases where
`clipRouteToEndpointRects` actually degenerates back to the raw chord:

| Route fed to the clipper | Degenerate cases | …of which have usable facing anchors |
|---|---|---|
| 2-point centre→centre chord (**the case B2(b) names**) | ~37,700 | **0** |
| 3-point route (interior vertex) | ~37,600 | 191 (~0.5%), all corner-overlap |

The reason is structural, not statistical: a 2-point chord degenerates exactly when
one box swallows the other's border crossing — which is exactly when the anchors come
out reversed or inside, i.e. when the B1 guard returns `null`. **The two conditions
are mutually exclusive.** Pinned by a new test,
*"WHEN the centre→centre chord DEGENERATES on overlapping boxes THEN there is no
facing side either"*, so a future maintainer cannot re-derive the same dead end.

The ~0.5% multi-vertex remainder is real but tiny, sits on corner-overlap geometry
where the anchors are not guaranteed to fall outside both boxes, and requires editing
the routed branch that was explicitly out of scope. Filed for a human decision rather
than shipped or dropped:

- **`nid_bq5k5gx5k3112otsbz1u0h7ba_e`** — *[decide] Degenerate boundary-clip chord
  could use facing-side anchors — measured value is ~0.5% of degenerate cases*.
  Carries the measurement, the exact 5-line change, and the corner-overlap caveat.
  Linked to the parent ticket.

## S1 — non-finite / zero-size rects (FIXED)

New private `isAnchorableRect`: finite `x/y/widthPx/heightPx` **and** a positive
extent. Rejecting a bad rect returns `null` (handles kept) instead of emitting
`M NaN,50 …`, which renders nothing and makes the edge vanish. This matters
concretely, as the review noted: `extractEdgeRoutingInput` drops non-finite obstacles
and the edges touching them — i.e. exactly the edges that reach this new branch.

The predicate is **restated**, not imported from `edgeRouting.hasFiniteGeometry`: the
pure math layer deliberately carries no routing types (the same reason `ClipRect` is
local). The duplication is 6 lines of `Number.isFinite`, and the WHY-comment names the
precedent so the two stay conceptually linked. The doc comment's "never NaN" claim is
now true.

## S2 — test gaps and the `?? 0` smell (FIXED)

Added, all BDD, one behaviour each: partial overlap → `null`; touching boxes → `null`;
non-finite rect → `null`; zero-size rect → `null`; TARGET rect undefined → `null`
(the missing symmetry case); and the degenerate-chord/anchor mutual-exclusivity pin.
The old "a node rect is unavailable" test is renamed to name the SOURCE side.

The bow test's four `anchors?.… ?? 0` are gone: it now
`assert(anchors !== null, …)` on its own line first, so a `null` fails as a `null`
instead of silently redrawing the bow from the origin. CLAUDE.md forbids silent
fallbacks in tests; that was one.

## S3 — precondition (RESTORED, not widened)

I chose the reviewer's first option: rather than documenting a wider contract, the
`widthPx > 0 && heightPx > 0` half of `isAnchorableRect` makes the ORIGINAL
precondition true again — a rect with a real extent strictly contains its own centre,
so `segmentRectEntryPoint` is still only ever called with `to` strictly inside. Its
doc comment is unchanged in substance; `rectBorderPointToward`'s now states *why* the
precondition holds at this call site. Honest contract, no widening.

## Files changed in this iteration

| File | Change |
|---|---|
| `src/view/edgeGeometry.ts` | Dot-product ordering guard + `isAnchorableRect`; rewritten `facingSideAnchorsFor` doc (full `null` list); `rectBorderPointToward` doc records why the precondition holds. |
| `src/view/edgeGeometry.test.ts` | +6 tests (4 written failing first); `?? 0` → `assert`; source/target-undefined naming. |
| `src/view/VicinityEdge.tsx` | `clipRectOf` early return (C1). |
| `docs-internal/specs/graph/arrows.md` | "Reach" paragraph (no-op in normal operation); degenerate clip removed from the straight-fallback list; fallback bullet lists every `null` case; test-coverage bullet updated. |
| `_tickets/decide-degenerate-boundary-clip-chord-…md` | New `[decide]` ticket (B2(b)). |

## Additional CALLOUTS from this iteration

5. **Framing correction (review C2), accepted.** The original write-up framed the cost
   of the two `useInternalNode` calls as "a handful of arithmetic ops". That understates
   it: `VicinityEdge` previously used **no** RF store hooks, and each edge now subscribes
   to both endpoints' internals. This is the same shape as React Flow's own floating-edge
   example and e2e shows no perf regression, so it stands — but it is a real coupling
   change, not just arithmetic.

6. **The B1 bug was reachable only on the fallback path** (the same path B2 shows is
   rare). It was still a genuine lie about the data — a reversed arrowhead — and is now
   impossible by construction, with tests.

7. **`CLAUDE.md` vs the ticket location (review C5): I did NOT edit `CLAUDE.md`.**
   `docs-internal/tickets/` still exists and holds the older ticket set, so the line is
   incomplete rather than false; and editing `CLAUDE.md` is a project-configuration change
   I will not make on a sub-agent's say-so. Flagging it for the human instead: the live
   `ticket` CLI writes to `_tickets/`, and "Orient here first" mentions only
   `docs-internal/tickets/`.

## Verification (verbatim, run after all edits)

| Command | Result |
|---|---|
| `npm test` | `Test Files 81 passed (81)` / `Tests 1109 passed (1109)`, `TEST_EXIT=0` (was 1103 — +6) |
| `npm run check` (`tsc -noEmit`, src + e2e) | `CHECK_EXIT=0`, no diagnostics |
| `npm run test:e2e` | `1 skipped` / `84 passed (55.1s)`, `E2E_EXIT=0` |
| `src/view/edgeGeometry.test.ts` alone | `Tests 55 passed (55)` (was 49) |

Before the fix, the four new geometry tests failed exactly as predicted
(`Tests 4 failed | 50 passed (54)`) — the B1 partial-overlap, touching, non-finite and
zero-size cases. e2e is unchanged in scope: it exercises the ROUTED path only, so green
means no regression, not coverage of the new branch (CALLOUT 3 still stands).

## Readiness

**READY for re-review / merge**, with one thing the human must weigh rather than the
reviewer: per B2(a) this change is a **no-op in normal operation** and improves only the
router-failure / missing-route fallback. If that is not worth shipping, the honest move is
to drop the branch, not to expand its reach — the expansion that was proposed is measured
to be worth ~0.5% of a rare fallback and is captured in ticket
`nid_bq5k5gx5k3112otsbz1u0h7ba_e`.

## Not done (owned by TOP_LEVEL_AGENT)

`change_log` entry; closing ticket `nid_var2o7krxq7ribq3iofni3aw1_e`.
