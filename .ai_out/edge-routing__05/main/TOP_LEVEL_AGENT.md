# TOP_LEVEL_AGENT — edge-routing__05 (facing-side attachment)

Ticket: `_tickets/edge-routing05-over-stretched-wrap-around-routes-pick-the-facing-side-when-a-better-attachment-exists.md`
Feature dir: `.ai_out/edge-routing__05/main/`
Branch: `main`

## Flow

| Phase | Status |
|-------|--------|
| EXPLORATION (code / bindings / docs) | running |
| CLARIFICATION | pending |
| DETAILED_PLANNING | pending |
| DETAILED_PLAN_REVIEW | pending |
| PLAN_ITERATION | pending |
| IMPLEMENTATION | pending |
| IMPLEMENTATION_REVIEW | pending |
| IMPLEMENTATION_ITERATION | pending |
| PARETO_COMPLEXITY_ANALYSIS | pending |

## Notes

- PREREQ spike delegated to EXPLORATION_BINDINGS: are `setConnectionCost` /
  `setExclusive` / `portDirectionPenalty` exposed by the installed `libavoid-js`?
  If NOT → likely blocking issue → surface to human before planning.
- HARD CONSTRAINT from ticket: `crossingPenalty` stays 0; no routing perf regression.
