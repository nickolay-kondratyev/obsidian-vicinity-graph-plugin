# TOP_LEVEL_AGENT — e2e-breadcrumb-red-gate

Ticket: `nid_yccejkvl0ccqc77olsgg5deka_e` — e2e release gate RED:
`e2e/vicinityGraph.e2e.ts:160` breadcrumb never appears for `solo/gamma.md`.

Branch: `e2e-breadcrumb-red-gate` (off `main`).

## Acceptance
`npm run test:e2e` exits 0, all specs run, breadcrumb behaviour either fixed in `src/`
or the test corrected with written rationale.

## Flow (straightforward-flow)
1. EXPLORATION (2 parallel Explore agents) — breadcrumb render path + e2e harness/fixture.
2. IMPLEMENTATION_WITH_SELF_PLAN
3. IMPLEMENTATION_REVIEW
4. IMPLEMENTATION_ITERATION (max 4)

## Log
- [x] Exploration (2 parallel Explore agents) → committed `f45082d`.
      Both concluded: breadcrumb unimplemented in `src/`; sibling `:85` test passes vacuously.
- [x] IMPLEMENTATION_WITH_SELF_PLAN → commits `60b6383`, `c2ea883`.
      **Reversed the exploration hand-off**: found `998fdac` (2026-07-23,
      "snug capped node width + remove folder prefix") deliberately removed the breadcrumb
      end-to-end. Declared the e2e test stale; retired the expectations; **no `src/` behaviour
      change**. Claims gate green: `test:e2e` exit 0, 78 passed, 0 did-not-run.
- [ ] IMPLEMENTATION_REVIEW — running. Tasked to adjudicate the stale-test reversal
      independently and to **re-run the gate itself** rather than trust the claims.
- [ ] IMPLEMENTATION_ITERATION (if needed).
- [ ] TOP_LEVEL: change_log entry, ticket close, merge to `main`.

## Open item for the human (surfaced by IMPLEMENTATION)
Ungrouped non-root notes now show no folder context at all. Reviving it is a product/UX
decision, deliberately not reopened here.
