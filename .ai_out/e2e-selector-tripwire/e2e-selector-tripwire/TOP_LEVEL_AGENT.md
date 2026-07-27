# TOP_LEVEL_AGENT — e2e-selector-tripwire

Ticket: `nid_c5acy7gm7lj3afz0vtq79k8bx_e` — feature removals cannot go red on the fast gate.

Goal: vitest tripwire in `npm test` that fails when a `.vicinity-graph-*` class asserted
under `e2e/**/*.e2e.ts` exists nowhere in `src/view/**`. `toHaveCount(0)` absence
assertions exempt.

Branch: `e2e-selector-tripwire` (off `main`).

## Flow (straightforward-flow)

| Step | Role | Status |
|------|------|--------|
| 0 | EXPLORATION | done — `e348af8` (first explorer had no Write tool; re-run with `worker`) |
| 1 | IMPLEMENTATION_WITH_SELF_PLAN | done — `b9c0d91`, `c17ca2e`, `571c730`; deliverable `e2e/selectorGuard.test.ts` |
| 2 | IMPLEMENTATION_REVIEWER | launched |
| 3 | IMPLEMENTATION_ITERATION | pending |

## Open adjudication

IMPLEMENTATION deviated from the ticket: producers scanned are `.tsx`/`.ts` only,
**not** `.css` — a surviving CSS rule would otherwise mask a `.tsx` rename and defeat
the ticket's own AC. Reviewer asked to verify both halves empirically. Flag to human
in the final summary regardless of verdict.

TOP_LEVEL_AGENT commits between phases; writes the single change_log entry at the end;
closes the ticket.
