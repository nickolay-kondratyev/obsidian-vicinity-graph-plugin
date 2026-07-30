# PRIVATE memory — pin writes under the settings failure policy (nid_o5a1055jyynn9nohpb5rj2vqp_e)

## Status: DONE (not committed — orchestrator owns git)

## Goal
Pin/unpin `data.json` writes must go through the ONE caught failure policy in
`src/view/settingsWritePipeline.ts` — one notice via `UserNoticePort`, caller promise resolves.

## What was built (final shape)
1. `src/persistence/RejectingPluginDataPort.ts` (NEW) — shared test double, lifted from the
   local class in `settingsWritePipeline.test.ts`. Counts `saveAttempts`, ctor takes the Error.
2. `src/view/settingsWriteFailureNotice.ts` — `export type NonSettingsWriteSubject = "pinned-set"`,
   module-private `NON_SETTINGS_WRITE_LABELS` (`pinned-set` → `"Pinned notes"`), and
   `static forNonSettingsWrite(subject)` reusing the SAME `notice(subject)` sentence.
   Closed union, not a caller string, so no call site types user-visible copy.
3. `src/view/settingsWritePipeline.ts` — extracted private `guarded(failureNotice, body)`
   (THE one `try`); `write()` now = `guarded(...)` + fan-out; new public
   `runGuarded(subject, task)` = `chain.run(() => guarded(notice(subject), task))`.
   WHY-NOT fan out inside `runGuarded`: the task owns fan-out (a REFUSED pin must rebuild
   nothing) — that decision is documented on the method.
4. `src/view/ControlsActions.ts` — `pinNode`/`unpinNode` moved from `runSerialised(...)` to
   `runGuarded(PIN_WRITE_SUBJECT, ...)`; module const `PIN_WRITE_SUBJECT: NonSettingsWriteSubject`.
   No `try` added anywhere in this class.
5. `CLAUDE.md` "Settings writes" bullet: `write()` → `guarded()`, and names `runGuarded`.

## Tests added
- `src/view/ControlsActions.test.ts`: `actionsUnderTest(dataPort = new FakePluginDataPort())`
  now parameterised; new describe "ControlsActions pinning when data.json cannot be written"
  with 3 tests (pin → one notice; pin → promise resolves; unpin → one notice), asserted
  against `SettingsWriteFailureNotice.forNonSettingsWrite("pinned-set")`.
- `src/view/settingsWritePipeline.test.ts`: 4 tests for `runGuarded` (one notice, resolves,
  a queued write still attempted, success → no notice). Local `RejectingPluginDataPort`
  class removed in favour of the shared one; `SAVE_FAILURE` const kept.

## Verified RED first
Temporarily reverted `runGuarded(PIN_WRITE_SUBJECT,` back to `runSerialised(` →
the 3 new `ControlsActions` tests failed; restored → green. (Backup used: `.tmp/ControlsActions.bak`.)

## Test commands / results
- `npm test > .tmp/test.log 2>&1` → 96 files, 1290 tests passed.
- `npm run check > .tmp/check.log 2>&1` → clean (src + e2e tsc).

## Gotchas for a successor
- Do NOT call the pipeline's public `apply`/`restoreDefaults`/`drain` from inside a slot —
  deadlock (documented on `SettingsWriter`). `runGuarded`'s task must not either.
- `PluginDataStore.persist()` moves in-memory state BEFORE `saveData`, so after a failed pin
  the node still renders as pinned; the notice is the only signal. Whether to roll back is
  the open owner ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e`.
- The copy module is still named `SettingsWriteFailureNotice` although it now also covers a
  non-settings write. Rename considered and REJECTED (churn across CLAUDE.md + tests for no
  behavior gain); its doc says it owns `data.json` write-failure copy.
