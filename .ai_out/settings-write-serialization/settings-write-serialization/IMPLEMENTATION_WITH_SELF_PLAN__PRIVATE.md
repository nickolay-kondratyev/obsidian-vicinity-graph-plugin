# IMPLEMENTATION_WITH_SELF_PLAN__PRIVATE — settings write serialization

## State: COMPLETE

Committed `c1315ac` on `settings-write-serialization`. `npm test` 1143/1143 green, `npm run check`
exit 0. Ticket NOT closed (top-level agent's job). No change_log entry written (same).

## Plan (all steps done)

1. [x] Read EXPLORATION_PUBLIC.md + ticket + the tab's write path.
2. [x] New `src/view/settingsWriteQueue.ts` (one `tail` field, pre-caught).
3. [x] New `src/view/settingsWriteQueue.test.ts` with a gated write (4 tests).
4. [x] Verify tests FAIL against a pass-through stub → 2 failed / 2 passed. Restored.
5. [x] Wire `writeQueue` + `enqueueWrite()` into `VicinityGraphSettingTab`, converting every
       interaction handler to a thunk.
6. [x] `npm test` + `npm run check`, commit, artifacts.

## Facts worth keeping if resumed

- Call sites now queued: exclusion toggle (~L370), sizing metric toggle (~L522), outline-depth slider,
  node-preview radio, depth sliders, force-layout slider, both `requestReset` paths.
- NOT queued on purpose: debounced thunks (`debounced.schedule(...)` at exclusion textarea, metric
  weight, node cap, `SizingRowWrite.persistIfAccepted`) — queueing them DEADLOCKS, because a queued
  task's `settlePendingWrites()` drains them from inside the task. This is the single most important
  thing to not "fix" later. Documented on `enqueueWrite`'s jsdoc and in the module header.
- Safety argument for leaving them unqueued: `applyInteraction` → `persist` → `store.saveGlobalView` →
  `PluginDataStore.persist`'s `this.data = updated` all execute in one synchronous stretch (async fn
  bodies run sync until an await suspends), so a read→write cannot be interleaved.
- `PluginDataStore` is last-CALLED-wins in memory and serialized on disk; the reordering bug lived
  entirely above it, in the tab.
- No formatter/linter configured in this repo (no prettier/eslint config, no lint script). Tabs, ~120 col.
- Docs: `docs-internal/architecture-map.md` is directory-level and does not enumerate `src/view/*`
  modules, so no doc update was required.

## If asked to extend

- e2e version would need a delay hook on `saveData` in the Electron build — judged not worth it, see PUBLIC.md.
- Follow-up candidates noted in PUBLIC.md: unhandled rejection on `void enqueueWrite(...)`; no
  user-visible feedback for a failed settings write.
