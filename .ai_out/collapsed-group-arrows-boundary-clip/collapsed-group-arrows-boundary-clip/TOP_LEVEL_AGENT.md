# TOP_LEVEL_AGENT — collapsed-group-arrows-boundary-clip

## Task
Execute ticket: `_tickets/collapsed-group-arrows-must-terminate-at-the-group-boundary-clip-routed-edges-to-endpoint-rects.md`
Fix: routed edges terminate at endpoint box CENTRE → clip routed polylines to source/target rects so collapsed-group arrows terminate at the group boundary.

## Branch
`collapsed-group-arrows-boundary-clip` (off `main`)

## Flow (straightforward)
- [x] Branch + dir setup
- [~] EXPLORATION (Explore agent, background)
- [SKIP] CLARIFICATION — ticket fully specified, no blocking ambiguity
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] Final commit + changelog + close ticket

## Decisions
- Skipped formal CLARIFICATION: ticket provides confirmed root cause, plan with WHY/WHY-NOT rationale, degenerate guards, spec text, test list.

## Notes
- Code-modifying agents run SERIALLY.
- Commit between phases; clean git status.
