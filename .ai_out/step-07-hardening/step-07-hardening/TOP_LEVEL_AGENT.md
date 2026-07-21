# TOP_LEVEL_AGENT — step-07-hardening

**Task:** docs-internal/plan/steps/step-07-hardening.md
**Branch:** step-07-hardening
**Feature dir:** .ai_out/step-07-hardening/step-07-hardening/

## Scope (from step doc)
1. Dense-vault fixtures + engine-level assertions (caps/determinism/timing) via FakeLinkProvider.
2. Cap edge cases (centrals alone exceed cap; ±1 boundary; every tiebreaker; runtime cap change; pinned disconnected under tight cap).
3. Performance pass (image lazy/culling; rebuild debounce + structural-diff skip; orphan sweep chunk-yield). Fix or ticket.
4. README + release readiness (public README, fresh-clone dev, release checklist).

## Exit criteria
- Dense-fixture suite green + fast (default `npm test` or explicit `test:heavy`).
- No perf item unfixed without a ticket.
- README accurate to shipped behavior; fresh clone → running dev build via README only.

## Flow
- [x] Branch + dirs
- [~] EXPLORATION (3 Explore agents: engine, perf, readme)
- [ ] CLARIFICATION (align on open items 1-3 + perf budgets)
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] Closeout: changelog, tickets, final summary

## Open items to resolve in CLARIFICATION
1. Perf budget numbers (rebuild time at cap=100).
2. Fixture generators committed vs one-off (lean: committed).
3. Triage tickets parked in steps 01-06.
