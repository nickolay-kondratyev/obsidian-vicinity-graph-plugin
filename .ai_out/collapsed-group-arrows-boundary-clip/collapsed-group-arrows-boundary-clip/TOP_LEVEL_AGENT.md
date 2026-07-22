# TOP_LEVEL_AGENT — collapsed-group-arrows-boundary-clip

## Task
Execute ticket: `_tickets/collapsed-group-arrows-must-terminate-at-the-group-boundary-clip-routed-edges-to-endpoint-rects.md`
Fix: routed edges terminate at endpoint box CENTRE → clip routed polylines to source/target rects so collapsed-group arrows terminate at the group boundary.

## Branch
`collapsed-group-arrows-boundary-clip` (off `main`)

## Flow (straightforward) — COMPLETE
- [x] Branch + dir setup
- [x] EXPLORATION (Explore agent) → EXPLORATION_PUBLIC.md
- [SKIP] CLARIFICATION — ticket fully specified, no blocking ambiguity
- [x] IMPLEMENTATION_WITH_SELF_PLAN (commit 1a48aa9) — check PASS, test 657 PASS
- [x] IMPLEMENTATION_REVIEW — APPROVE-WITH-MINOR (0 blocking/major, 2 minor)
- [x] IMPLEMENTATION_ITERATION (commit e13a3c9) — MINOR#1 accepted (folder-group test), MINOR#2 rejected (circular-assert); test 658 PASS
- [x] Final commit + changelog + close ticket

## Result: DONE. Ticket nid_wku3029kwmnei7e86rbb1dk7w_e closed. 658/658 tests, tsc clean.

## Decisions
- Skipped formal CLARIFICATION: ticket provides confirmed root cause, plan with WHY/WHY-NOT rationale, degenerate guards, spec text, test list.

## Notes
- Code-modifying agents run SERIALLY.
- Commit between phases; clean git status.
