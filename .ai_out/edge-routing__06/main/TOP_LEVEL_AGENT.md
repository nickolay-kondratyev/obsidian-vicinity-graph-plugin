# TOP_LEVEL_AGENT — edge-routing__06

Ticket: `_tickets/edge-routing06-non-exclusive-group-boundary-pins-reduce-and-expose-the-libavoid-shape-buffer.md`
Branch: `main` · Feature dir: `.ai_out/edge-routing__06/main/`

## Sequencing (each its own commit)

| # | Step | Status |
|---|------|--------|
| 0 | Exploration (3 agents) | DONE — `EXPLORATION_PUBLIC*.md` (commit f-docs) |
| 0b | CLARIFICATION — human decisions D1/D2 | DONE — `CLARIFICATION__PUBLIC.md` |
| 1 | Repair `e2e/edgeRoutingEval.e2e.ts` (chore ticket) + print detour ratios | DONE — `b4a9d57`, baseline in `STEP0_E2E_REPAIR__PUBLIC.md` |
| 1b | Fix pre-existing red `SettingsSpec.test.ts` (D2) | DONE — `258ec5a`, `npm test` green |
| 2 | (a) `setExclusive(false)` — RED real-wasm test first, then 1-line change + loader type narrowing | DONE — `2d08ab1` |
| 2b | (a) IMPLEMENTATION_REVIEW (verdict READY) + iteration (5/5 incorporated) | DONE — `9f92e77` |
| 3 | (b) sweep 5/8/11/14/17, record table + screenshots | DONE — `0703634`, `SWEEP__PUBLIC.md` |
| 4 | (b) **HUMAN DECISION** on invariants, default, clamp, UI | DONE — `a15ef8f`, decisions D3-D6 |
| 4b | `facing` dev-vault fixture (replaces the manual real-vault smoke) | DONE — `3786495`, `STEP4_FIXTURE__PUBLIC.md` |
| 5a | (b) CORE: constant extraction, replaced invariants, engine setting, routing plumbing + cache fix | RUNNING |
| 5b | (b) SURFACE: settings tab row, README, "six sliders" copy, e2e count bump, facing-side assertion, AFTER measurement | pending |
| 6 | IMPLEMENTATION_REVIEW of (b) + iteration | pending |
| 7 | Ticket notes + close, chore ticket close, change_log | pending |

## Human decisions (see CLARIFICATION__PUBLIC.md)
- D1 7th `ForceLayoutSettings` field · D2 fix red `SettingsSpec` baseline
- D3 default **11**, clamp **6-14**, option 3 with two REPLACEMENT invariants
- D4 label "Edge clearance", in *Advanced spacing*
- D5 recreate the scenario as a dev-vault fixture (not the real vault)
- D6 all four follow-ups; plus: facing-side becomes a committed e2e assertion in 5b, fan-in accepted with the ticket left open

## Follow-up tickets filed
`nid_oy3vas85xhr34n2dby1mvows4_e` wasm abort on routing throw ·
`nid_g1zb4b06gew54gnwcn5hx237j_e` pin fan-in ·
`nid_li45606h8uvcnjm7fss17xl1u_e` sparse fixture nondeterminism ·
`nid_se3h2v45c10x9j42utbm8v2sn_e` e2e vault override

Note: ticket lists ask-human before sweep, but also says "bring the sweep table to that conversation" — so sweep runs first (temporary constant override, uncommitted), human decides with data.

## Exploration outputs
- `EXPLORATION_PUBLIC.md` (index)
- `EXPLORATION_PUBLIC__routing.md`
- `EXPLORATION_PUBLIC__e2e.md`
- `EXPLORATION_PUBLIC__settings.md`

## Log
- (start) Spawned 3 Explore agents.
