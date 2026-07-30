# TOP_LEVEL_AGENT — settings-cleanup-write-refresh-pipeline

Ticket: nid_m5hxe4eo9jgt7cfic7s2o3uvi_e (step 3 of settings-cleanup chain).
Deps nid_wimjq4ewgbg21n4zx9d4qq3a0_e (descriptor model) and
nid_ez38gf1mrdgh5kxedzrdicwzl_e (global-only settings) are both CLOSED. ✅

## Scope (post owner scope-change 2026-07-29)
1. ONE serial chain abstraction in `src/shared/` (no obsidian/react imports).
2. Writes built from FRESHLY READ globals, never a captured snapshot.
3. Reset DRAINS the queue before rebuilding display().
4. ONE refresh fan-out rule — all writes are global, fan out to all views.
5. Controls stay optimistic locally; persisted write serialised.

Merged-in tickets to close on landing: nid_8b97fdqznqsncc5kgya1p871w_e,
nid_4zffe7mj5p1eabi9m6wfh06k0_e, docs-internal/tickets/ticket-controls-optimistic-input-latency.md.
(ticket-per-doc-write-leaves-sibling-views-stale.md was closed by the global-only ticket, NOT here.)

## Flow
| Phase | Status |
|---|---|
| EXPLORATION | running |
| CLARIFICATION | pending exploration |
| IMPLEMENTATION_WITH_SELF_PLAN | pending |
| IMPLEMENTATION_REVIEW | pending |
| IMPLEMENTATION_ITERATION | pending |
