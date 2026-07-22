# TOP_LEVEL_AGENT — edge-routing__03 (all layouts, tuning, default ON, docs)

Ticket: `_tickets/edge-routing__03-all-layouts-tuning-default-on.md`
Feature dir: `.ai_out/edge-routing__03/edge-routing/`
Workflow: IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION

## Ticket work items (summary)
1. All 3 layout modes (force/layered/radial) show routed edges; verify + fix.
2. Tune named constants (shapeBufferDistance, segmentPenalty, crossingPenalty) w/ WHY comments; 3 fixtures.
3. Perf sanity: measure routing pass on dense fixture; STOP if not well under elk+d3.
4. Flip `edgeRouting` default ON; OFF path still works.
5. Docs: arrows.md routing section, CLAUDE.md pipeline line, release notes + main.js size delta.
6. Mobile check or explicitly record "not verified on mobile".

## Status log
- [in progress] Exploration: 2 Explore agents launched (routing pipeline; tests/fixtures/docs).
