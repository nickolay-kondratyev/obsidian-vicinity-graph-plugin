# IMPLEMENTATION_REVIEWER — PRIVATE (edge-routing__03) — rehydration

## Verdict: APPROVE-WITH-MINOR. Commit reviewed: f00a36e (baseline a80d7e2).

## What I verified (done, don't redo)
- Read ticket, EXPLORATION_PUBLIC, IMPLEMENTATION_..._PUBLIC. No prior PRIVATE existed.
- Diffed all touched src/test/doc/e2e files.
- Ran `npm run check` → EXIT 0 (.tmp/check.log). `npm test` → 650 passed / 54 files
  (.tmp/test.log). e2e NOT run (slow) — trusted implementer's "32 passed".

## Key confirmations
- Gate: GraphViewController.ts:245 gate (`!edgeRouting || isRoutingSkippedLayout`),
  nulls routeCache, returns EMPTY_ROUTES. resolveRoutes called unconditionally at
  :223 after both layout branches → no stale routes on mode switch. Named const
  ROUTING_SKIPPED_LAYOUT_MODE at :345, typed LayoutMode="radial", good WHY.
- Constants: segmentPenalty=50, crossingPenalty=0 both wired via setRoutingParameter
  (edgeRouting.ts:241-242); Avoid interface types them (libavoidLoader.ts:25-26).
  crossingPenalty=0 is a real applied knob, not dead code. buffer=17 unit-checked vs
  imported EDGE_ARROWHEAD_INSET_MIN_PX. All defer-to-__03 comments resolved.
- Default flip: persistedShapes.test.ts honest (explicit false round-trips; non-bool
  → true). OFF path covered (unit "router never invoked" + e2e pins false).
- Radial-gate unit test genuine: FakeEdgeRouter.callCount (incr in route() :98),
  asserts 0 with withLayoutMode(...,"radial") + edgeRouting ON.
- Docs (arrows.md §5, CHANGELOG) accurate. No deferred-item leakage.

## Open NOTES (non-blocking)
- N1: perf timing not appended to ticket via `ticket add-note` (it IS in CHANGELOG +
  PUBLIC + runtime perf e2e). Acceptance crit 3 = PARTIAL.
- N2: eval e2e uses fixed waitForTimeout(4500) — brittle but acceptable for eval spec.
- N3: cosmetic main.js byte count mismatch in notes (CHANGELOG consistent at 2,610,310).

## No MUST-FIX / SHOULD-FIX. No #QUESTION_FOR_HUMAN raised.
Outputs written: IMPLEMENTATION_REVIEW__PUBLIC.md + this file. Did NOT git commit.
