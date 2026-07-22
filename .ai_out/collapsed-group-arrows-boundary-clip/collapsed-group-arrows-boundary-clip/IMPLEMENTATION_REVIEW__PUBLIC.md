# IMPLEMENTATION_REVIEW — PUBLIC

Ticket: collapsed-group arrows must terminate at the group boundary (clip routed edges to endpoint rects).
Branch `collapsed-group-arrows-boundary-clip`, HEAD `1a48aa9`.

## Verdict: APPROVE-WITH-MINOR

- BLOCKING: 0
- MAJOR: 0
- MINOR: 2 (1 test-coverage gap, 1 nit)

`npm test` → 657 pass (54 files). `npm run check` (tsc) → clean. Verified at review time.

## Correctness assessment (the clip math)

The core `clipRouteToEndpointRects` (`src/view/edgeGeometry.ts:171-284`) is **correct** across the edge cases the ticket called out:

- **Strict interior test** (`isStrictlyInsideRect`, :235): a point exactly ON the border is NOT inside, so an already-boundary terminus is left untouched — no double-clipping, POLS-clean.
- **Trailing-inside drop + crossing** (`clipTrailingInsideRect`, :204): walks from the end, drops the strictly-inside run, and moves the terminus to the true segment↔border crossing.
- **Liang–Barsky** (`segmentRectEntryPoint`, :252): textbook implementation. `from` outside / `to` inside guarantees `enter ∈ (0,1]`; parallel-and-outside and `enter>leave` both return `null` → caller falls back to the chord. No NaN geometry can escape. Hand-verified the corner case `(100,-100)→(250,50)` into `[200..300]×[0..100]` enters at `(200,0)` — matches the test.
- **Source mirror**: reverse → clip trailing → reverse. The reversed array is a fresh `.map` copy, so the in-place `.reverse()` is safe; the chord fallback uses the first/last ORIGINAL points as specified.
- **Degenerate/overlap** (whole polyline inside a rect, nested rects, indeterminate crossing) → unclipped 2-point chord. Never empty/NaN. Confirmed by the overlap test.
- `points.length < 2` → returned as a copy. Safe.

## Wiring assessment

`clipRoutesToObstacles` (`GraphViewController.ts:373-403`) applies the clip right after `route()` and **before the cache write** (:278-279), so a reuse-layout rebuild (cache hit at :257-259) serves the clipped routes. Missing source/target obstacle → route left unclipped (no drop, no crash). `obstacleById` is built from `input.obstacles`, which includes folder-group rects sized from `groupDimensions` with `id == node.id` (`edgeRouting.ts:122-127`); a `folder-group:*` endpoint therefore resolves to the GROUP rect correctly. Wiring is rect-agnostic and correct.

## Arrowhead inset (ticket §2) — reasoning is sound

No constant change is correct. After clipping, the terminus is ON the boundary and `arrowFromApproach` insets the tip 14–48px back along the approach, i.e. just OUTSIDE the box pointing inward. This is the **same** behavior the existing straight `edgePathFor` already produces (React Flow hands custom edges boundary handle coords, and the tip is inset into the inter-node gap). So routed edges are now **consistent** with straight edges rather than regressed. The PUBLIC CALLOUT 1 ("note heads moved from ~inside to ~outside") is an honest description of an intended consistency improvement, backed by the "tip outside interior" test. Recommend a quick visual eyeball on a dense fixture (the ON-routing e2e screenshot `.out/edge-routing-force.png` covers this), but not blocking.

## Test quality

Tests are **real geometric guarantees**, not tautologies: they assert concrete clipped coordinates (`{200,50}`, corner `{200,0}`, chord fallback `[{10,10},{30,30}]`) and that a fed-through `routedGeometryFor` tip is outside the rect interior. BDD one-assert style. The controller test asserts against the **real** obstacle-extraction pipeline (FakeLayout 100px squares → real note rects), not a hand-faked rect — good, it cannot silently drift. No silent-fallback masking. They would genuinely fail pre-fix (un-clipped route ends at centre `{250,50}`, not `{200,50}`).

## Findings

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | MINOR (optional) | `src/view/GraphViewController.test.ts:465` | The only controller-level clip test covers **note→note**. The headline bug scenario — a `folder-group:*` endpoint clipped to its `groupDimensions` GROUP rect — has no direct automated regression gate; it relies on rect-agnostic wiring + pure-math unit tests (arbitrary rects) + the downgraded e2e screenshot. Ticket §4 explicitly asked for the "group rect for `folder-group:*` endpoints" case. Risk is low (wiring proven above), but a small added controller test with a collapsed group target would lock the actual scenario. |
| 2 | NIT | `src/view/edgeGeometry.test.ts:127` | `isStrictlyInside` re-implements production `isStrictlyInsideRect` (also present in `edgeRouting.test.ts`). Test-local duplication is acceptable; noting only. |

## Acceptance criteria

- Routed collapsed group arrow terminates at the GROUP boundary (never inside), source side equally clipped — **MET** (algorithm + wiring; direct group-case test is the MINOR-1 gap).
- Note↔note routed arrows remain boundary-anchored, no regression — **MET** (now consistent with straight edges; §2 reasoning sound).
- Spec entry added to `docs-internal/vicinity-graph-specs/arrows.md` §5 — **MET** (accurate, normative).
- Unit tests for clip fn + attachment pass; e2e attempted or downgrade documented — **MET** (downgrade explicitly documented, ticket §4 permits it).
- Full `npm test` + suites pass — **MET** (657 pass, tsc clean).

## `#QUESTION_FOR_HUMAN`
None blocking. Optional: do you want MINOR-1 (a folder-group clip controller test) addressed now, or tracked as a follow-up given the wiring is rect-agnostic?
