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

## Flow (phased to avoid compaction; code agents serial)
- [x] Branch + dirs
- [x] EXPLORATION (engine/perf/readme) — committed bf6aced
- [x] CLARIFICATION — committed bf6aced
- [x] PHASE A: engine dense-fixtures + cap edge cases → APPROVE-WITH-NITS (0 blocking) → 29f4a77
- [x] PHASE B: perf pass → APPROVE-WITH-NITS (0 blocking) → 0025b47
- [x] PHASE C: README + release checklist + ticket triage → APPROVE-WITH-NITS (0 blocking)
- [x] Closeout: ONE changelog entry (step-07), hover-pin ticket closed, culling-smoke ticket created, full suite green (559 main + 69 sublib, tsc + build EXIT 0)

## DONE. All exit criteria met. 0 blocking findings across all 3 phase reviews.

## Confirmed decisions (see CLARIFICATION__PUBLIC.md)
- Perf: structural asserts + one loose 150ms engine build ceiling.
- Committed fixture generator under src/engine/testFixtures/.
- Keep dense suite in default `npm test`.
- Fix-now: hover-pin bug only. Ticket the rest.
- License KSAL-2.3 stated plainly (LICENSE.md authority). Keep plugin id (rename+repo-move later). Store submission out of scope.

## Open items to resolve in CLARIFICATION
1. Perf budget numbers (rebuild time at cap=100).
2. Fixture generators committed vs one-off (lean: committed).
3. Triage tickets parked in steps 01-06.
