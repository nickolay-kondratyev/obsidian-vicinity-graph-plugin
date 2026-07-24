# TOP_LEVEL_AGENT — 03 force placement quality

Feature: `03-force-placement-quality` · Branch: `main`
Ticket: `_tickets/03-force-placement-quality-linked-nodes-stranded-far-from-neighbors.md`

## Task
Fix force-layout quality: linked nodes stranded far from neighbors (long crossing edges).
Root-cause hypotheses: (1) forceLink.strength unset → weak links at hub; (2) static run from
elk seed stuck in local minimum; (3) elk force seed untuned. Fix DEFAULTS, not user settings.
Bring repro data into dev-vault / unit fixture (public vault not source-controlled).

## Phase tracking
- [x] EXPLORATION — pipeline + vault reports written; consolidated in EXPLORATION_PUBLIC.md
- [x] CLARIFICATION — SKIPPED: requirements unambiguous (fix defaults, failing-test-first, deterministic, mirror data to dev-vault)
- [ ] DETAILED_PLANNING (Think Hard) — PLANNER running
- [ ] DETAILED_PLAN_REVIEW
- [ ] PLAN_ITERATION
- [ ] IMPLEMENTATION
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] PARETO_COMPLEXITY_ANALYSIS

## Notes
- Commit between phases; keep git clean.
- Think Hard during planning (per human instruction).
