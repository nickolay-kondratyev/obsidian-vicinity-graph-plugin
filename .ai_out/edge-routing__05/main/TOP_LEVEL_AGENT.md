# TOP_LEVEL_AGENT — edge-routing__05 (facing-side attachment)

Ticket: `_tickets/edge-routing05-over-stretched-wrap-around-routes-pick-the-facing-side-when-a-better-attachment-exists.md`
Feature dir: `.ai_out/edge-routing__05/main/`
Branch: `main`

## Flow

| Phase | Status |
|-------|--------|
| EXPLORATION (code / bindings / docs) | done — committed `101938f` |
| CLARIFICATION | done — 3 human decisions, see `CLARIFICATION__PUBLIC.md` |
| DETAILED_PLANNING | running (THINK_HARD) |
| DETAILED_PLAN_REVIEW | pending |
| PLAN_ITERATION | pending |
| IMPLEMENTATION | pending |
| IMPLEMENTATION_REVIEW | pending |
| IMPLEMENTATION_ITERATION | pending |
| PARETO_COMPLEXITY_ANALYSIS | pending |

## Notes

- PREREQ spike RESOLVED: **no blocker**. `setConnectionCost`, `setExclusive`/`isExclusive` and
  `portDirectionPenalty` are all bound in `libavoid-js@0.4.5`. Only `src/view/libavoidLoader.ts`
  type narrowing widens. `Avoid.ClusterRef` is NOT bound.
- HARD CONSTRAINT from ticket: `crossingPenalty` stays 0; no routing perf regression.
- Human scope decision: Design **step 1 only**; steps 2 (no-op), 3 (perf pathology) and 5
  become follow-up tickets. Eval harness repaired first; Epictetus becomes a dev-vault fixture.
- Env: `node_modules/` absent — IMPLEMENTATION must `npm ci`.

## Open risk to watch

The crux the PLANNER must resolve honestly: pins are registered **per shape**, but "facing side"
is a property of an **edge pair**. A shape with many edges cannot have per-counterpart pin costs.
If the plan papers over this, reject it.
