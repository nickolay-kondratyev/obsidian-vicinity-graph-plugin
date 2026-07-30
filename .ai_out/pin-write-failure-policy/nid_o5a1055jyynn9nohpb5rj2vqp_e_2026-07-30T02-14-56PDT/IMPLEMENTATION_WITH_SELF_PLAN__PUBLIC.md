# Pin writes now run under the ONE `data.json` failure policy

Ticket `nid_o5a1055jyynn9nohpb5rj2vqp_e`. Status: complete, uncommitted.

## Problem
`ControlsActions.pinNode`/`unpinNode` wrote the pinned set through
`SettingsWritePipeline.runSerialised`, which does not catch. A rejected `data.json` write
therefore rejected the promise `NoteNode` `void`s (unhandled rejection), told the user
nothing, and left the pin live in memory — strictly less visible than a failed settings
edit on the same store and the same chain.

## Change
Gave the pipeline a CAUGHT seam instead of adding a second try/catch:

- `SettingsWritePipeline.guarded(failureNotice, body)` (private) is now THE single `try`.
  `write()` = `guarded(...)` then fan-out — unchanged behavior for settings.
- New public `runGuarded(subject: NonSettingsWriteSubject, task)` runs a non-settings
  `data.json` write on the SAME chain through that SAME catch. It deliberately does not
  fan out: the task owns its fan-out, because a refused pin must rebuild nothing.
- Copy stays in one file: `SettingsWriteFailureNotice.forNonSettingsWrite("pinned-set")`
  reuses the existing sentence with the subject "Pinned notes". The subject is a closed
  union, not a caller-supplied string, so no call site types user-visible copy.
- `ControlsActions` pins/unpins through `runGuarded`; it gained no `try` and no new copy.

## Seams introduced
- `NonSettingsWriteSubject` (type) + `SettingsWriteFailureNotice.forNonSettingsWrite`
- `SettingsWritePipeline.runGuarded`
- `RejectingPluginDataPort` — shared failure-path test double (was a private class in one suite)

## Files (repo-relative)
- `src/view/settingsWritePipeline.ts` — `guarded()` extraction + `runGuarded()`; rule-5 doc extended
- `src/view/settingsWriteFailureNotice.ts` — non-settings subject + label + `forNonSettingsWrite`
- `src/view/ControlsActions.ts` — pin/unpin via `runGuarded`; `PIN_WRITE_SUBJECT` const
- `src/persistence/RejectingPluginDataPort.ts` — NEW
- `src/view/ControlsActions.test.ts` — parameterised harness + 3 failure-path tests
- `src/view/settingsWritePipeline.test.ts` — 4 `runGuarded` tests; uses the shared rejecting port
- `CLAUDE.md` — "Settings writes" bullet now names `guarded()` / `runGuarded`

## Tests
- Red first: reverting only the `runGuarded` call sites made the 3 new `ControlsActions`
  tests fail; restoring made them pass.
- `npm test` → 96 files / 1290 tests passed. `npm run check` → clean.
- No existing test weakened or removed.

## Acceptance criteria
- Rejected pinned-set persist → exactly one `FakeUserNotices` message, caller promise resolves. ✅
- No second failure policy (one `try` in the whole pipeline; none in `ControlsActions`). ✅
- `npm test` + `npm run check` pass. ✅

## Notes / rejections
- Kept the module name `settingsWriteFailureNotice.ts` although it now also covers the
  pinned set: renaming would churn CLAUDE.md and several suites for no behavior gain.
- Unchanged and still open elsewhere: after a failed write the store keeps the value in
  memory (ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e`) — the notice remains the only signal.
- No ticket/change-log edits made (per instructions); the ticket is ready to close.
