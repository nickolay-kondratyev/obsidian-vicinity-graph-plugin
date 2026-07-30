# TOP_LEVEL_AGENT — settings-tab typed-input e2e

Ticket: nid_ek3wrqoh1rsftk6ulg836mghf_e — "e2e: no spec types into a settings-tab text/number input"
Branch: nid_ek3wrqoh1rsftk6ulg836mghf_e_2026-07-29T23-30-55PDT
Flow: straightforward — IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION

## Goal (from ticket AC)
One `e2e/*.e2e.ts` spec that TYPES into the unified settings-tab rows:
- inverted maximum node size → inline rejection visible, value did NOT persist
- invalid regex line → the offending line is named
- must handle the `SETTINGS_WRITE_DEBOUNCE_MS` window (establish the pattern; no existing spec controls timers)
- assert feedback element appears under the row; `.vicinity-graph-settings-error` styled as intended

## Log
- [x] EXPLORATION spawned (Explore, sonnet) → EXPLORATION_PUBLIC.md
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] commit + change_log + close ticket
