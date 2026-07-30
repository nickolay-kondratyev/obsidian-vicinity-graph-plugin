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

## Key exploration findings (drive the plan)
- 3 hand-rolled chains: `PluginDataStore.writeChain`, `settingsDebounce.draining`,
  `settingsWriteQueue.tail` — plus a **4th, unqueued** write site in `ControlsActions.ts`.
- Goal 4 is ALREADY satisfied: one `ViewsRefreshPort.refreshAllViews()` fan-out. Verify + lock, don't reinvent.
- Reset race real: `VicinityGraphSettingTab.applyReset` calls `display()` from inside a queued task.
- Panel clobbering real: `GraphToolbar.tsx` builds one `ctx` snapshot per render; sections merge onto it.
- Ticket-2 "descriptor model" is several compile-guarded tables, not one array.

## Flow
| Phase | Status |
|---|---|
| EXPLORATION | done → `EXPLORATION_PUBLIC.md` |
| CLARIFICATION | skipped — ticket + notes are unambiguous, owner decisions recorded |
| IMPLEMENTATION_WITH_SELF_PLAN | done → `7588c2b` |
| IMPLEMENTATION_REVIEW (r1) | NEEDS ITERATION — 1 BLOCKING (goal 5 was a no-op) |
| IMPLEMENTATION_ITERATION 1 | done → `be9ac20` |
| IMPLEMENTATION_REVIEW (r2) | **CONVERGED**; 2 new non-blocking findings |
| IMPLEMENTATION_ITERATION 2 | done → `5520cfa` (both findings closed) |
| CLOSEOUT | tickets closed, change_log `jqx2h80p7ql9p4z6z4fpm10sr` |

Gates verified independently by TOP_LEVEL_AGENT: `npm test` 1124/1124, `npm run check` exit 0.
Tickets closed: nid_m5hxe4eo9jgt7cfic7s2o3uvi_e, nid_8b97fdqznqsncc5kgya1p871w_e,
nid_4zffe7mj5p1eabi9m6wfh06k0_e, ticket-controls-optimistic-input-latency.md (in-file).
Follow-ups: nid_itpt4tf0kkhsbbz0np304a558_e (new), nid_7qot0m6nuxxmd5z0yb9jylsd6_e (`decide`).
