# TOP_LEVEL_AGENT — settings-cleanup spec-driven tests

Ticket: nid_x6hgehsu5il1d1shuraz3ufqy_e (step 5 of settings-cleanup chain).
Branch: nid_x6hgehsu5il1d1shuraz3ufqy_e_2026-07-29T19-51-59PDT

## Scope decision (TOP_LEVEL_AGENT)
- Deliver GOAL 1 (spec-iterating structural tests: parse / round-trip / reset-to-default /
  bounds, walking the descriptor list) and GOAL 2 (tab-vs-panel parity test over the row model).
- GOAL 3 (e2e that TYPES into a settings-tab input) stays in its own open ticket
  nid_ek3wrqoh1rsftk6ulg836mghf_e, which `deps` on THIS ticket — i.e. it is scheduled after.
  This ticket only re-scopes/annotates it; it does not implement it.
- Per the 2026-07-29 owner scope change: GLOBAL round-trip/reset/bounds only. No per-doc
  override tests.
- Keep a SMALL set of literal assertions for product-meaningful defaults (e.g. nodeCap 100).

## Flow
1. EXPLORATION (sonnet, bg) → EXPLORATION_PUBLIC.md
2. IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md
3. IMPLEMENTATION_REVIEWER → IMPLEMENTATION_REVIEW__PUBLIC.md
4. IMPLEMENTATION_ITERATION (max 4 rounds)
5. TOP_LEVEL_AGENT: single change_log entry, ticket close, commits between phases.

## Log
- [t0] deps verified closed (wimj, m5hx, armo, ez38). Explore spawned.
- [t1] EXPLORATION done → EXPLORATION_PUBLIC.md. Headlines:
  - `src/engine/SettingsSpec.ts` = single source of truth (defaults/bounds, 2 compile-time guards).
  - `src/view/settingsRows.ts` (`SETTINGS_GROUPS` / `EVERY_SETTINGS_ROW`) = flat pure row enumeration.
  - GOAL 2 largely SHIPPED in step 4: `settingsRows.test.ts` + source-scan
    `settingsRowParity.test.ts`. Implementation only VERIFIES/closes holes, no rebuild.
  - Real remaining gap = `src/engine/SettingsSpec.test.ts` and
    `src/engine/forceLayoutSettings.test.ts` — still `toEqual` every default/limit;
    these are the two that went stale twice.
  - No jsdom/@testing-library harness exists (own ticket) → stay source-scan/structural.
  - `CentralDepthRoundTrip.test.ts` confirmed deleted (347dc77). Baseline: 87 files / 1139 green.
  - Scaffolding committed as fdf4214.
- [t2] IMPLEMENTATION_WITH_SELF_PLAN spawned (goals 1 + 2-verification; e2e excluded).
