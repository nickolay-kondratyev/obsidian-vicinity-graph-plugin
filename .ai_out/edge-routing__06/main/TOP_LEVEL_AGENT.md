# TOP_LEVEL_AGENT — edge-routing__06

Ticket: `_tickets/edge-routing06-non-exclusive-group-boundary-pins-reduce-and-expose-the-libavoid-shape-buffer.md`
Branch: `main` · Feature dir: `.ai_out/edge-routing__06/main/`

## Sequencing (each its own commit)

| # | Step | Status |
|---|------|--------|
| 0 | Exploration (3 agents) | DONE — `EXPLORATION_PUBLIC*.md` (commit f-docs) |
| 0b | CLARIFICATION — human decisions D1/D2 | DONE — `CLARIFICATION__PUBLIC.md` |
| 1 | Repair `e2e/edgeRoutingEval.e2e.ts` (chore ticket) + print detour ratios | DONE — `b4a9d57`, baseline in `STEP0_E2E_REPAIR__PUBLIC.md` |
| 1b | Fix pre-existing red `SettingsSpec.test.ts` (D2) | DONE — `258ec5a`, `npm test` green |
| 2 | (a) `setExclusive(false)` — RED real-wasm test first, then 1-line change + loader type narrowing | DONE — `2d08ab1` |
| 2b | (a) IMPLEMENTATION_REVIEW (verdict READY) + iteration (5/5 incorporated) | DONE — `9f92e77` |
| 3 | (b) sweep 5/8/11/14/17, record table + screenshots | RUNNING |
| 4 | (b) **HUMAN DECISION** on the two invariants (`buffer = curvature/2`, `buffer > arrowhead inset`) | pending |
| 5 | (b) implement setting end-to-end with chosen default (7th force-layout field per D1) | pending |
| 6 | Ticket notes, change_log, close chore ticket | pending |

Note: ticket lists ask-human before sweep, but also says "bring the sweep table to that conversation" — so sweep runs first (temporary constant override, uncommitted), human decides with data.

## Exploration outputs
- `EXPLORATION_PUBLIC.md` (index)
- `EXPLORATION_PUBLIC__routing.md`
- `EXPLORATION_PUBLIC__e2e.md`
- `EXPLORATION_PUBLIC__settings.md`

## Log
- (start) Spawned 3 Explore agents.
