# TOP_LEVEL_AGENT — e2e-selector-tripwire

Ticket: `nid_c5acy7gm7lj3afz0vtq79k8bx_e` — feature removals cannot go red on the fast gate.

Goal: vitest tripwire in `npm test` that fails when a `.vicinity-graph-*` class asserted
under `e2e/**/*.e2e.ts` exists nowhere in `src/view/**`. `toHaveCount(0)` absence
assertions exempt.

Branch: `e2e-selector-tripwire` (off `main`).

## Flow (straightforward-flow)

| Step | Role | Status |
|------|------|--------|
| 0 | EXPLORATION | launched |
| 1 | IMPLEMENTATION_WITH_SELF_PLAN | pending |
| 2 | IMPLEMENTATION_REVIEWER | pending |
| 3 | IMPLEMENTATION_ITERATION | pending |

TOP_LEVEL_AGENT commits between phases; writes the single change_log entry at the end;
closes the ticket.
