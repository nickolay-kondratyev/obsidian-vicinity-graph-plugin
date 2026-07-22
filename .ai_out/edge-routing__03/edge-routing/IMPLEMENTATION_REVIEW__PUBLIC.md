# IMPLEMENTATION_REVIEW — PUBLIC (edge-routing__03)

## VERDICT: APPROVE-WITH-MINOR

Phase 3 is well-executed and honest. The radial gate is correct and robust, the
tuning constants are genuinely named with truthful WHY comments, the default-flip
tests are real behavior changes (not assertion-alignment hacks), and the new
radial-gate unit test is a genuine "router never invoked" proof. `npm run check`
(tsc EXIT 0) and `vitest` (650 passed / 54 files) confirmed green independently;
the e2e result is trusted per the implementer's report. No MUST-FIX or SHOULD-FIX
code issues. Two minor NOTES (traceability + eval-spec brittleness) that do not
block the ship.

---

## MUST-FIX
None.

## SHOULD-FIX
None.

## NOTE

**N1 — Acceptance criterion 3 traceability: timing not appended as a `ticket
add-note`.** The criterion says "Routing pass timing measured and recorded on this
ticket (`ticket add-note`)". The numbers ARE thoroughly recorded — CHANGELOG
(`docs-internal/CHANGELOG.md`, force ~140ms vs ~1460ms layout; layered ~185ms vs
~300ms; radial gated) and `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` — and the
`e2e/edgeRoutingEval.e2e.ts` PERF BUDGET test re-derives and asserts them at
runtime. But `_tickets/edge-routing__03-...md` carries no note with these figures.
Suggested fix (orchestrator/human, not a code change): run `ticket add-note` with
the perf numbers before closing, so the ticket is self-contained.

**N2 — `e2e/edgeRoutingEval.e2e.ts:renderFixture` uses a fixed
`page.waitForTimeout(4500)`.** A hard-coded settle window is brittle (it assumes the
dense force layout never exceeds ~1.5s across machines). Acceptable here because
this is an explicitly-labelled *evaluation* spec (screenshots + perf eyeballing),
NOT the tight regression (`edgeRouting.e2e.ts`), and the tuning e2e is not the
correctness gate. Suggested future improvement: poll for the expected perf entry
(`expect.poll` on `pendingPerf` length) instead of a flat timeout. Not blocking.

**N3 — Cosmetic main.js byte-count inconsistency in the PRIVATE/PUBLIC notes**
(`2,610,230` in one line vs `2,610,310` elsewhere). The shipped doc
(`CHANGELOG.md`) is internally consistent at `2,610,310 B (+732,601 B)`. Cosmetic,
notes-only.

---

## Focused-area findings (per review brief)

### 1. Correctness of the gate — SOLID
- `GraphViewController.ts:245` gates `resolveRoutes` on
  `!edgeRouting || isRoutingSkippedLayout(layoutMode)` → returns `EMPTY_ROUTES`
  and sets `this.routeCache = null` for radial. wasm never loads (the `await
  import` lives only inside `LibavoidEdgeRouter.route`, never reached).
- No stale-routes path: `resolveRoutes` is called **unconditionally** at
  `GraphViewController.ts:223` after BOTH the `reuse-layout` and fresh-layout
  branches, and its result is applied via `withRoutedPoints(flow, routes)` at
  `:227`. On a force→radial switch the gate returns empty → every edge renders
  straight; on radial→force `routeCache` was nulled so it re-routes. Robust
  regardless of the layout-reuse decision.
- `ROUTING_SKIPPED_LAYOUT_MODE: LayoutMode = "radial"`
  (`GraphViewController.ts:345`) is a typed named constant with a thorough WHY
  comment (perf rationale, human decision, deferred web-worker path) — no buried
  magic string, satisfies the no-magic standard.

### 2. Tuning constants — HONEST, correctly named
- `EDGE_ROUTING_SEGMENT_PENALTY_PX = 50`, `EDGE_ROUTING_CROSSING_PENALTY_PX = 0`
  (`edgeRouting.ts`) — both NEW named constants, both actually wired via
  `router.setRoutingParameter(avoid.segmentPenalty/…crossingPenalty, …)` at
  `edgeRouting.ts:241-242` (the `Avoid` interface types both,
  `libavoidLoader.ts:25-26`). `crossingPenalty=0` is a real, applied knob (not
  dead code) — it is genuinely passed to libavoid, just at the disabled value,
  with an honest O(connectors²)/~1700ms-vs-~140ms rationale.
- `EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2` (=17) — kept; WHY
  updated with the buffer-vs-inset relationship (17 > 14px arrowhead min inset, so
  a route clears a box further out than the head ever sits; small vs node
  spacing). Sound. Unit-checked at `edgeRouting.test.ts` against the imported
  `EDGE_ARROWHEAD_INSET_MIN_PX` (not a hard-coded 14).
- Every "defer tuning to __03" WHY comment is resolved to final rationale
  (`constants.ts`, `edgeRouting.ts` buffer block, `edgeGeometry.ts`
  `ROUTED_CORNER_RADIUS_PX`). No leftover deferral text.

### 3. Default flip integrity — HONEST
- `DEFAULT_EDGE_ROUTING = true` (`constants.ts:47`) with an updated WHY.
- `persistedShapes.test.ts`: the two default-value tests are real behavior changes,
  not assertion-alignment: explicit `false` still round-trips (does NOT snap to the
  new default), and a non-boolean now falls back to `true`. Both assertions match
  the flipped default and the "user can still disable" contract.
- OFF straight-edge path still genuinely covered: the `edgeRouting OFF → router
  never invoked` unit test remains (`GraphViewController.test.ts:430`), and the
  e2e OFF test now pins `edgeRouting=false` explicitly
  (`edgeRouting.e2e.ts:67`) since ON is the shipped default — correct.
- `graphFixtures.ts` kept at `edgeRouting:false` — accepted reasoned decision
  (fixture is deliberately decoupled from engine defaults; flipping would make
  every mapping test implicitly invoke wasm). Comment expanded to document it.

### 4. Tests are real, not fake — CONFIRMED
- Radial-gate unit test (`GraphViewController.test.ts:438-448`): GIVEN
  `withLayoutMode(routedGraphOf(...), "radial")` (edgeRouting ON), THEN
  `h.router.callCount === 0`. `FakeEdgeRouter.callCount` increments inside
  `route()` (`:98`) — a genuine spy/callCount proof that the router is never
  invoked, not a tautology.
- e2e `layered` asserts a real detour (`bentEdgeCount > 0`) around a hub-crossing
  chord; `radial` asserts `0` bends WITH a WHY that it proves the gate. The eval
  spec's radial test additionally asserts `routingMs` is `undefined` (no timing
  logged = pass never ran) — a stronger gate proof than "routes happen to be
  cheap". No silent fallbacks, no weakened assertions.

### 5. Acceptance-criteria walkthrough
- **All 3 modes routed; e2e extended to layered + radial** — MET (with the
  approved caveat that radial is intentionally gated → straight, proven by e2e 0
  bends + unit callCount 0). `edgeRouting.e2e.ts` adds `setLayoutMode`, a layered
  detour case, a radial 0-bend case.
- **Tuned constants + WHY; dense route quality eyeballed + screenshot under
  /.out** — MET (constants + WHY present; `/.out` is gitignored so screenshots
  aren't in-repo — expected; the eval spec regenerates them). Trust per brief.
- **Routing timing measured + recorded on ticket via `ticket add-note`** —
  PARTIAL. Measured and recorded in CHANGELOG + PUBLIC + a runtime perf-budget
  e2e, but not appended as a ticket note (see N1).
- **`edgeRouting` defaults ON; OFF path verified by existing tests** — MET.
- **`arrows.md` updated; release-notes drafted** — MET (`arrows.md` §5;
  CHANGELOG Phase-3 entry).
- **Full suite green (check, vitest, e2e)** — MET for check (EXIT 0) + vitest
  (650/650), independently reproduced; e2e trusted (32 passed reported).

### 6. Scope / deferred-item leakage — CLEAN
No OrthogonalRouting, no collapse-all-bidirectional, no live re-drag routing, no
web-worker offload implemented. `crossingPenalty` kept as a disabled named knob is
tuning, not the deferred crossing feature.

### 7. Docs accuracy — ACCURATE
`arrows.md` §5 correctly describes force+layered apply / radial excluded /
straight-line + wasm-failure fallback / bidirectional-bow suppression for routed
edges (buffer already separates opposite routed edges) / tuning summary. CHANGELOG
is factual: main.js `2,610,310 B (+732,601 B ~+715 KiB)`, mobile "NOT verified",
radial gated, version left at 0.1.1 per the per-phase pattern.

### 8. Code quality — GOOD
DRY (`isRoutingSkippedLayout` predicate + named constant; `setLayoutMode` mirrors
`setEdgeRouting`), SRP (gate is a one-line predicate), POLS (gate documented),
immutable spreads in the fixtures/harness helpers, and the geometry NaN hardening
from phase 02 is untouched (e2e `allPathsWellFormed` guards no-NaN across modes).
The two `console.debug` perf lines are debug-level (silent by default) — fine.

## Documentation Updates Needed
None required for merge. Optional: append the perf numbers to the ticket via
`ticket add-note` (N1) before closing so acceptance criterion 3 is fully
self-contained on the ticket.
