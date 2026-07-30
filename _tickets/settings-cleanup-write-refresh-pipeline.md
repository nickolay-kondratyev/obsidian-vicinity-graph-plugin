---
closed_iso: 2026-07-30T01:18:41Z
id: nid_m5hxe4eo9jgt7cfic7s2o3uvi_e
title: "Settings cleanup \u2014 write pipeline: one settings write/refresh pipeline\
  \ (single serial chain, reset drains it, one fan-out rule)"
status: closed
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e, nid_ez38gf1mrdgh5kxedzrdicwzl_e]
links: [nid_4zffe7mj5p1eabi9m6wfh06k0_e, nid_8b97fdqznqsncc5kgya1p871w_e, nid_7fq9y51mbucmduzf9z31hmwmq_e, nid_7qot0m6nuxxmd5z0yb9jylsd6_e, nid_itpt4tf0kkhsbbz0np304a558_e]
  nid_ez38gf1mrdgh5kxedzrdicwzl_e]
created_iso: '2026-07-29T17:29:52Z'
status_updated_iso: 2026-07-30T01:18:41Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, persistence, architecture]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Overarching context, ordering rationale and standing owner decisions: docs-internal/notes/settings.md (grouping tag: settings-cleanup, step 3 of the chain).

Part of the settings cleanup approved by the owner on 2026-07-29. Builds on the descriptor-model ticket (nid_wimjq4ewgbg21n4zx9d4qq3a0_e).

PROBLEM: the settings write path is three hand-rolled serial promise chains plus ad-hoc refresh, which produces four separate open bugs that are really ONE subsystem defect:
- nid_8b97fdqznqsncc5kgya1p871w_e -- reset display() rebuilds AHEAD of a queued write
- nid_4zffe7mj5p1eabi9m6wfh06k0_e -- three hand-rolled serial promise chains (store / debounce / write queue) want one SerialPromiseChain helper in src/shared/
- docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md -- a per-doc write does not refresh sibling views showing the same doc
- docs-internal/tickets/ticket-controls-optimistic-input-latency.md -- panel controls write from a STALE snapshot, so a sizing edit can clobber sibling fields

GOAL:
1. ONE serial chain abstraction in src/shared/ (per the layering rule: no obsidian/react imports).
2. Writes always built from FRESHLY READ globals, never from a captured snapshot -- this is what stops sibling-field clobbering.
3. Reset DRAINS the queue before rebuilding, instead of racing it.
4. ONE refresh fan-out rule that covers per-doc writes AND sibling views on the same doc.
5. Controls stay optimistic locally so typing does not feel laggy, while the persisted write is serialised.

These four tickets should be closed as merged into this ticket once it lands; do not fix them piecemeal, the whole point is that they share a cause.


## Notes

**2026-07-29T22:11:13Z**

SCOPE CHANGE (owner, 2026-07-29): per-doc saved state is being removed BEFORE this ticket — see nid_ez38gf1mrdgh5kxedzrdicwzl_e (now a dep). Adjust this ticket accordingly:
- GOAL 4 shrinks: the ONE refresh fan-out rule no longer needs to cover per-doc writes or sibling-views-on-same-doc. All writes are global and fan out to all views. docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md is now closed by the simplification ticket, NOT by this one.
- GOALs 1,2,3,5 unchanged (serial chain helper, fresh-read writes, reset drains queue, optimistic controls) — those bugs are global-path bugs.
- Tickets merged into this one are now: nid_8b97fdqznqsncc5kgya1p871w_e, nid_4zffe7mj5p1eabi9m6wfh06k0_e, ticket-controls-optimistic-input-latency.md.
- Update any specs/docs describing the write path if they still mention per-doc write scope.

**2026-07-30T01:18:41Z**

RESOLVED 2026-07-30. Commits 7588c2b (pipeline) .. be9ac20 (review iteration 1) .. 5520cfa (iteration 2). Gates: npm test 1124/1124, npm run check clean.

## How each goal was met

1. ONE serial chain — src/shared/SerialPromiseChain.ts (pure; no obsidian/react). Replaced PluginDataStore.writeChain, settingsDebounce's own chain (it now has none — its window drains onto the pipeline), and DELETED src/view/settingsWriteQueue.ts. The previously UNQUEUED fourth site (ControlsActions, incl. pins) is on the same chain, so there is exactly one serialisation point.
2. Fresh-read writes — new src/view/settingsWritePipeline.ts (one instance in main.ts, shared by the settings tab and the in-graph panel). A control emits a SettingsInteraction naming ONE field; the pipeline merges it over globals read fresh from PluginDataStore INSIDE its serialised slot, persists, then fans out. The 'ctx' snapshot prop is gone from all 6 panel components, so sibling clobbering is no longer expressible (proved red: 3 tests fail if a captured snapshot is reintroduced).
3. Reset drains — src/view/settingsResetSequence.ts: flush -> write defaults -> DRAIN the chain -> display(). display() is no longer called from inside a queued task, and every step has its own tolerating() slot so a failing flush or defaults write still drains before the rebuild.
4. ONE fan-out rule — already unified pre-change as ViewsRefreshPort.refreshAllViews(); locked by making refreshOpenViews() private and by a fan-out ORDERING test (a fan-out ahead of its write now fails). All writes are global (per the 2.5 scope change) — nothing per-doc.
5. Optimistic controls — pure PendingEdits (src/view/optimisticValue.ts) + useOptimisticValue, applied to steppers, sliders, typed fields, toggles and radios. A request records the burst baseline AND the value the write will store, so the override releases on the real echo, on an external change, on a clamp landing back on the baseline, and on a failed write. It never displays an unstored value indefinitely.

Also: clampSizingNumber extracted in src/engine/constants.ts (clampSizingSettings delegates to it) so rows share ONE clamp with the write path — no view-side copy.

## Merged-in tickets, now closed
- nid_8b97fdqznqsncc5kgya1p871w_e (reset display() raced a queued write)
- nid_4zffe7mj5p1eabi9m6wfh06k0_e (three hand-rolled chains -> one helper)
- docs-internal/tickets/ticket-controls-optimistic-input-latency.md (marked CLOSED in-file)
(ticket-per-doc-write-leaves-sibling-views-stale.md was closed earlier by nid_ez38gf1mrdgh5kxedzrdicwzl_e, not by this ticket.)

## Disclosed limitation (not a hack, deliberately not forced)
The stepper burst is pinned as a simulation of the component loop rather than a rendered component: the repo has no jsdom/React test renderer, and adding test-infra deps was not taken on agent authority. Disclosed in three places and carried by decide-ticket nid_7qot0m6nuxxmd5z0yb9jylsd6_e, which also asks whether that infra blocks chain step 4. Residual untested surface is type-checked plumbing.

## Follow-up
nid_itpt4tf0kkhsbbz0np304a558_e — one user-visible failure policy for the void-ed write promises (pre-existing; explicitly out of scope here).

Docs updated: CLAUDE.md (write-pipeline convention), docs-internal/architecture-map.md, docs-internal/plan/high-level-plan.md, docs-internal/notes/settings.md, README.md. Reports under .ai_out/settings-cleanup-write-refresh-pipeline/CC_nid_m5hxe4eo9jgt7cfic7s2o3uvi_e__settings-cleanup-write-refresh-pipeline_opus/
