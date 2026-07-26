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
- [ ] Exploration launched.
