# TOP_LEVEL_AGENT — edge-routing__02 (render routed edges)

Branch: `edge-routing`. Feature dir: `.ai_out/edge-routing__02/edge-routing/`.
Ticket: `_tickets/edge-routing__02-render-routed-edges.md`.

## Workflow
IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION.

## Status log
- [x] Setup + created output dir.
- [x] EXPLORATION done + committed (9ce3e6a). Files: EXPLORATION_PUBLIC.md + rendering + coords_e2e.
- [~] IMPLEMENTATION_WITH_SELF_PLAN (running)
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] Final: changelog, close ticket, commit.

## Key facts
- Depends on phase 01 (done, commit 1c2c282): `routedPoints` on FlowEdge/VicinityEdgeData, behind `edgeRouting` setting (default off).
- Routing OFF must be pixel-identical to today (all pre-existing tests untouched).
