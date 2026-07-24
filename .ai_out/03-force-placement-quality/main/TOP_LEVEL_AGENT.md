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
- [x] DETAILED_PLANNING (Think Hard) — plan written. Key: Enchiridion is degree-1 so weak-link-strength is NOT its cause (Mechanism B: charge + local minimum off large container). Fix = pin forceLink.strength~1 (Lever 1) + moderate charge reduction (Lever 2); reserve re-heat. Metric = per-edge stretch ratio. Automated test = self-contained makeGraph fixture; dev-vault notes for manual visual check.
  - Q_FOR_HUMAN resolved by ticket text (ticket explicitly directs mirroring repro into dev-vault). Not a blocker.
- [ ] DETAILED_PLAN_REVIEW — PLAN_REVIEWER running
- [ ] PLAN_ITERATION
- [ ] IMPLEMENTATION
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] PARETO_COMPLEXITY_ANALYSIS

## Notes
- Commit between phases; keep git clean.
- Think Hard during planning (per human instruction).
