# TOP_LEVEL_AGENT — controls-global-refresh-fanout

Ticket: `nid_u36pqr4zljs44jt42lk9ln8ry_e` — a controls-panel settings write does not refresh OTHER open graph views.

Branch: `controls-global-refresh-fanout` (from `main` @ a14972a).

Flow: straightforward-flow
1. EXPLORATION (Explore agent) → EXPLORATION_PUBLIC.md — **running**
2. IMPLEMENTATION_WITH_SELF_PLAN
3. IMPLEMENTATION_REVIEW
4. IMPLEMENTATION_ITERATION (max 4)

Acceptance: global-scope write from controls panel refreshes every open vicinity-graph view;
per-doc writes keep narrower behaviour; unit-tested with a fake recording refreshed views.

## Log
- Branch + .ai_out created; EXPLORATION spawned.
