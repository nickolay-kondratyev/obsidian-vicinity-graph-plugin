# PRIVATE memory — pin writes under the settings failure policy (nid_o5a1055jyynn9nohpb5rj2vqp_e)

## Status: iteration 2 DONE (review round 1 addressed; NOT committed — orchestrator owns git)

## Goal
Pin/unpin `data.json` writes go through the ONE caught failure policy in
`src/view/settingsWritePipeline.ts` — one notice via `UserNoticePort`, caller promise resolves.

## Iteration 1 shape (commit `b3a7220`) — still standing
1. `src/persistence/RejectingPluginDataPort.ts` — shared rejecting test double, counts `saveAttempts`.
2. `src/view/settingsWriteFailureNotice.ts` — `NonSettingsWriteSubject = "pinned-set"` +
   `forNonSettingsWrite(subject)`, reusing the SAME sentence. No call site types copy.
3. `SettingsWritePipeline.guarded(...)` — THE one `try`; `runGuarded(subject, task)` lends it
   to the pinned set. `ControlsActions.pinNode/unpinNode` run through it. No `try` outside.

## Iteration 2 changes (this round — the MAJOR review item)
Chose the reviewer's option (a): the failure path FANS OUT, same as the settings half.
- NEW exported `GuardedWriteOutcome = "store-changed" | "store-unchanged"` in
  `settingsWritePipeline.ts`. It asks about the STORE, not the disk.
- `guarded()` is now THE catch AND THE fan-out: `let outcome = "store-changed"` BEFORE the
  `try` (so a THROW fans out — `PluginDataStore.persist()` already moved memory), assigned
  from the body on success, `refreshAllViews()` iff `store-changed`. Rule 3 now lives in
  exactly one place; `write()` no longer calls `refreshAllViews` itself (body returns
  `"store-changed"` unconditionally → identical settings behavior).
- `runGuarded` task type is now `() => Promise<GuardedWriteOutcome>`.
- `ControlsActions`: `viewsRefresh` ctor param + private `refreshEveryView()` + local
  `WriteOutcome` type DELETED (fan-out is entirely the pipeline's now). Bodies return the
  outcome; `persistOutcome` returns `GuardedWriteOutcome`. Ctor arity dropped 5 → 4, updated
  in `VicinityGraphView.tsx` and `ControlsActions.test.ts`.
- Minors: `RejectingPluginDataPort.SAVE_FAILURE` static (test reuses it, literal once);
  `runGuarded` doc states the catch cannot tell a rejected save from any other throw under it;
  CLAUDE.md failure-policy sentence split in three.
- REJECTED: adding `runGuarded` to `SerialSettingsWrites` (ISP — no consumer needs it there).

## Tests added this round (all RED first — verified, 3 failures in `.tmp/red.log`)
- `ControlsActions.test.ts`: "WHEN a pin's persist rejects THEN EVERY open view is refreshed
  anyway (the pin IS in memory)".
- `settingsWritePipeline.test.ts`: "WHEN a GUARDED task rejects THEN every open view is
  refreshed anyway"; new describe "SettingsWritePipeline guarded fan-out" with
  store-changed → refreshed / store-unchanged → not refreshed.
- `failingPipelineUnderTest()` now returns `viewsRefresh`; the pre-existing settings
  fan-out-on-rejection test reuses it instead of building its own pipeline.

## Test commands / results
- `npm test > .tmp/test2.log 2>&1` → 96 files, 1294 tests passed (was 1290).
- `npm run check > .tmp/check2.log 2>&1` → exit 0.

## Gotchas for a successor
- Do NOT call the pipeline's public `apply`/`restoreDefaults`/`drain` from inside a slot —
  deadlock (documented on `SettingsWriter`). A `runGuarded` task must not either.
- The `let outcome = "store-changed"` initialiser before the `try` is load-bearing, not
  style: it is what makes a throw repaint. There is a comment saying so; keep it.
- `PluginDataStore.persist()` still moves in-memory state BEFORE `saveData`. Whether a failed
  pin should ROLL BACK instead of standing is the open owner ticket
  `nid_biwdtykvazsk3ejcqqli8o9j7_e` — now referenced from `ControlsActions`' class doc.
- The copy module is still named `SettingsWriteFailureNotice` although it also covers a
  non-settings write. Rename considered and REJECTED (churn for no behavior gain).
