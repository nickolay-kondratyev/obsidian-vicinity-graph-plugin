# TOP_LEVEL_AGENT — edge-routing__09-warn-latch

Ticket: `nid_eim1ftv60ybxzcucgf7rf4gk8_e` — warn-once latch in
`GraphViewController.resolveRoutes()` swallows later, distinct routing failures.

Branch: `edge-routing__09-warn-latch` (from `main` @ e2bcaf2).
Flow: straightforward — EXPLORE → IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → ITERATION.

## Status — COMPLETE

- [x] Branch + output dir created
- [x] EXPLORATION — `EXPLORATION_PUBLIC.md` (explorer had no Write tool; persisted by TOP_LEVEL_AGENT)
- [x] IMPLEMENTATION_WITH_SELF_PLAN — `8745644`
- [x] IMPLEMENTATION_REVIEW — `7bd2599`, verdict READY / 0 blocking / 1 should-fix / 2 minor
- [x] IMPLEMENTATION_ITERATION — `f680a7d` (fix) + `f8ad5d3` (confirmation) → CONVERGED at iteration 1
- [x] change_log `jrzx41yfca5bvozjexsmjhyfy` + ticket closed + follow-up filed + merged to main

## Outcome

Boolean `routingFailureWarned` → `warnedRoutingFailures: Set<string>` keyed by
failure signature. Flood protection kept; distinct later failures no longer
swallowed. Stringification guarded so the failure reporter cannot itself throw.

Gates: `npm run check` exit 0; `npm test` 68 files / 922 tests passed — re-run
independently by the reviewer, not taken on the implementer's word.

## Notes worth carrying forward

- The explorer claimed the pre-existing `"…THEN it warns exactly once"` test would
  need changing. It did not — it throws the SAME Error twice, which is exactly the
  "repeated identical failure" criterion. Challenged before implementation; the
  test is byte-identical and green. Sub-agent conclusions need checking.
- Reviewer mutation-verified the new tests in a throwaway worktree (against the old
  boolean latch, and against a bare `String(error)`) rather than reasoning about
  them — that is what turned "tests pass" into "tests discriminate".
- No-cap on the signature set is a deliberate, reviewer-endorsed decision: a cap
  would reintroduce the swallowing bug this ticket fixed. Do not "optimise" it later.

## Follow-up

`nid_r8lm69vcsybjkgffqyrfex6j1_e` — `EdgeRouter.route()` has no typed error channel
(p4, design-quality only; closing it as WONTFIX is an acceptable outcome).
