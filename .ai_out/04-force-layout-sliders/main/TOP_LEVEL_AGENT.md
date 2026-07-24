# TOP_LEVEL_AGENT — ticket 04: force-layout tuning sliders

Ticket: `_tickets/04-expose-4-force-layout-sliders-mirroring-native-graph.md`
(id `nid_lhandama1t1d3q9z6p4jefa4i_e`, status: in_progress)
Feature dir: `.ai_out/04-force-layout-sliders/main/`
Branch: `main` (consistent with ticket-03 convention)

## Flow (straightforward-flow)
1. [x] Setup: ticket started, dir created
2. [ ] EXPLORATION (background sub-agent, haiku) → `EXPLORATION_PUBLIC.md`
3. [ ] CLARIFICATION — SKIPPED: ticket carries two human-aligned DECISION notes with
   explicit scope (native-parity 4 sliders + Advanced: Node spacing, Group member
   spacing), explicit INTERNAL list, clamping constraints, defaults policy, and
   acceptance criteria. No ambiguity of WHAT.
4. [ ] IMPLEMENTATION_WITH_SELF_PLAN (background sub-agent) → `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`
5. [ ] Commit
6. [ ] IMPLEMENTATION_REVIEW (background sub-agent, readonly) → `IMPLEMENTATION_REVIEW__PUBLIC.md`
7. [ ] IMPLEMENTATION_ITERATION (max 4) → `IMPLEMENTATION_ITERATION__PUBLIC.md`
8. [ ] Final commit, ticket close, single change_log entry, callouts to human

## Key requirements (from ticket)
- Native-parity sliders: Center force, Repel force, Link force, Link distance.
- Advanced: Node spacing (D3_FORCE_COLLIDE_PADDING_PX), Group member spacing (ELK_NODE_SPACING).
- Clamped ranges (center pull << link strength; spacings bounded).
- Live re-layout on change (no plugin reload). Restore-defaults affordance.
- Defaults == ticket-03 shipped values; ticket-03 stranding metric test stays green.
- Wiring: ViewSettings + engine defaults + resolver + settingsWritePlan + persistence
  (version field) + BDD tests. npm test + npm run check pass.

## Log
- Exploration agent spawned (background).
