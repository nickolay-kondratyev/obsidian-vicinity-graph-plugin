# PRIVATE — write/refresh pipeline (ticket nid_m5hxe4eo9jgt7cfic7s2o3uvi_e)

## Plan (as designed, before implementing)

**Goal**: ONE settings write pipeline. One serial chain primitive in `src/shared/`,
one pipeline object both surfaces write through, writes planned from FRESH store
reads inside the serialised slot, reset drains before redisplay, panel controls
optimistic.

### Key design decisions

1. `src/shared/SerialPromiseChain.ts` — `run(task)` + `drain()`. `drain()` returns
   the pre-caught tail, so it resolves either way and INCLUDES tasks enqueued while
   an earlier task ran. Replaces the three hand-rolled tails.
2. `src/view/settingsWritePipeline.ts` — `SettingsWritePipeline` owns the chain +
   `SettingsWriteContext` read fresh from `PluginDataStore` + `planSettingsWrite` /
   `planSettingsReset` + the persist switch + `ViewsRefreshPort` fan-out. This
   deletes the DUPLICATED persist switch (tab `persist()` vs
   `ControlsActions.executeSettings()`) and the duplicated refresh call.
   - `apply(interaction)` / `restoreDefaults(scope)` enter the chain.
   - `runSerialised(task => task(writer))` hands an already-serialised
     `SettingsWriter` INTO the task, so the re-entrancy deadlock the old
     `SettingsWriteQueue` doc warned about is structurally impossible (a task can
     only write through the writer it was handed).
   - `drain()`.
3. `SettingsInteraction` becomes FULLY GRANULAR (one field per arm). The three
   whole-object arms (`global-sizing`, `global-force-layout`,
   `global-node-exclusion`) were the sibling-clobbering vector: the merge base was
   computed by the CALLER (React props / a pre-await snapshot). Replaced by
   `global-sizing-number`, `global-sizing-metric-enabled`,
   `global-sizing-metric-weight`, `global-force-layout-field`,
   `global-exclusion-enabled`, `global-exclusion-patterns`. Now `planSettingsWrite`
   is the ONLY merger and it always merges over the pipeline's fresh read.
   `SettingsCommand` (whole-slice → store call) is unchanged; resets keep emitting
   whole-slice commands, which is correct for a reset.
4. `SizingNumberField` moved to `settingsWritePlan.ts` as
   `Exclude<keyof SizingSettings, "metrics">` (was a hand union in
   `sizingRowWrite.ts`) — one more compile-forced declaration.
5. `src/view/settingsResetSequence.ts` — `SettingsResetSequence` over a
   `SettingsResetTarget` port. Owns the ORDER: flush typed edits → write defaults →
   flush again → drain the chain → redisplay. Testable with a fake target; this is
   where the reset-races-display bug is now pinned.
6. Panel controls: `ctx` prop DELETED everywhere. Components emit interactions
   only. `ControlsActionsPort.applySettings(interaction)` +
   `restoreDefaults(scope)`.
7. Optimistic: `src/view/optimisticValue.ts` (`PendingEdits<T>`, pure + immutable,
   unit-tested) + `src/view/useOptimisticValue.ts` (thin React hook — no react
   test infra in this repo, so correctness lives in the pure class).
   Reconciliation rule: hold the override until the snapshot echoes the LATEST
   requested value; a snapshot value we never requested (external write / clamp)
   wins immediately; a rejected write clears the override. That rule is what stops
   the mid-burst echo of an EARLIER request from flickering the control back.
8. `SettingsWriteQueue` deleted (pipeline replaces it); its three
   ordering/rejection tests move into `SerialPromiseChain.test.ts`.
9. `DebouncedSettingsWrites` loses its own chain — drains through
   `pipeline.runSerialised`, so the debounce window is serialised against every
   other write instead of only against itself. Thunks take the `SettingsWriter`.

### Rejected
- Deriving optimistic reconciliation from a "revision token" threaded through
  React context: same flicker as value-identity on mid-burst echoes, plus prop
  plumbing.
- Making the chain re-entrancy-aware (detect "already inside") — stateful trickery.
- Keeping whole-object sizing/force-layout interactions and fixing freshness by
  giving React components a store read: puts a store read in the component and
  still merges outside the serialised slot.
- Putting the reset sequence on the pipeline: the pipeline would need the
  debouncer, which needs the pipeline (construction cycle).

## Wiring
`main.ts` builds ONE `SettingsWritePipeline(pluginDataStore, viewsRefresh)` →
`plugin.settingsWrites`; handed to `VicinityGraphSettingTab` (via plugin) and to
each `VicinityGraphView` → `ControlsActions`. `VicinityGraphView` no longer needs
`pluginDataStore`.

## Deviations from the plan while implementing
- `SizingRowWrite` no longer persists at all: its `persist` callback re-entered the
  chain from inside a debounced slot (deadlock). It now returns
  `interactionIfAccepted(value): SettingsInteraction | null` and the tab's thunk
  writes through the handed-in writer. One test moved to the pipeline (see PUBLIC).
- `SettingsWriter` ended up with only `apply()` (not `restoreDefaults`) — no
  in-slot caller needs a reset.
- Added `pipeline.planResetConfirmation(scope)` so the tab could drop
  `writeContext()` entirely (the confirmation was its last consumer).
- Made `VicinityGraphPlugin.refreshOpenViews()` private — a compile-time lock for
  goal 4, chosen over a source-scan guard test.
- `Array.prototype.at` is not in the TS lib config here; `PendingEdits` uses an
  index read boxed as `{ value }` so an `undefined` T stays distinguishable.

## Status
Implementation complete. `npm test` 1113/1113, `npm run check` clean. Tree dirty
and uncommitted by design; no tickets closed; no change_log entry.
Verbose outputs are in `.tmp/` (`full*.txt`, `check*.txt`, `t1.txt`, `t2.txt`).
