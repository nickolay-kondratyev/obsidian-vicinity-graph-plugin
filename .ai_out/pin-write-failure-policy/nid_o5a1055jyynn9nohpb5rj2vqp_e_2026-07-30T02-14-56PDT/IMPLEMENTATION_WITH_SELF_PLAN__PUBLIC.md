# Pin writes now run under the ONE `data.json` failure policy

Ticket `nid_o5a1055jyynn9nohpb5rj2vqp_e`. Status: complete, uncommitted.
**Iteration 2** — review round 1 (`CHANGES_REQUESTED`) addressed on top of `b3a7220`.

## Problem
`ControlsActions.pinNode`/`unpinNode` wrote the pinned set through
`SettingsWritePipeline.runSerialised`, which does not catch. A rejected `data.json` write
therefore rejected the promise `NoteNode` `void`s (unhandled rejection), told the user
nothing, and left the pin live in memory — strictly less visible than a failed settings
edit on the same store and the same chain.

## Change (final shape, both iterations)
Gave the pipeline a CAUGHT seam instead of adding a second try/catch:

- `SettingsWritePipeline.guarded(failureNotice, body)` (private) is THE single `try` **and,
  as of iteration 2, THE single fan-out** — rule 3 is now applied in one place for both
  halves of the policy.
- A guarded body returns a `GuardedWriteOutcome` (`"store-changed" | "store-unchanged"`),
  which is the rebuild gate. It asks about the **store**, not the disk: a body that
  **threw** counts as `store-changed`, because `PluginDataStore.persist()` moves in-memory
  state before the save. Only a body that decided to write nothing (a refused pin) skips
  the rebuild.
- Public `runGuarded(subject: NonSettingsWriteSubject, task)` runs a non-settings
  `data.json` write on the SAME chain, through that SAME catch and that SAME fan-out rule.
- Copy stays in one file: `SettingsWriteFailureNotice.forNonSettingsWrite("pinned-set")`
  reuses the existing sentence with the subject "Pinned notes". The subject is a closed
  union, so no call site types user-visible copy.
- `ControlsActions` pins/unpins through `runGuarded`; it has no `try`, no copy of its own,
  and (iteration 2) no fan-out of its own — its `viewsRefresh` dependency and its private
  `refreshEveryView()` are gone, so the ctor is 4 args instead of 5.

## Review items

### MAJOR — WHY-NOT-fan-out conflates a REFUSED pin with a REJECTED persist, and is untested
**INCORPORATED — took the reviewer's option (a): the failure path now fans out.**

The reviewer's diagnosis was correct and the bug was real: on a rejected persist the pin is
already in `PluginDataStore.data`, so skipping the fan-out left the **screen** stale, not the
store — and some later unrelated rebuild (switching notes) would flip the node to "pinned"
long after the notice the user could have connected it to. Option (b) would have documented
a user-visible surprise; option (a) removes it and makes the two halves of the one policy
obey one rule. Chosen deliberately.

Implementation is the DRY version of (a): rather than duplicating a fan-out decision in
`ControlsActions`, the outcome type moved into the pipeline and `guarded()` owns both the
catch and the repaint. Consequences:

- Settings behavior is byte-identical (`write()`'s body returns `"store-changed"`
  unconditionally, which is what its unconditional `refreshAllViews()` already meant).
- A refused pin (no file at the path, or no stable id) still rebuilds nothing — the two
  cases the old comment conflated are now two distinct, separately tested branches, and
  the doc on `ControlsActions` spells out both, referencing the open in-memory-rollback
  ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e` for the part that is still an owner decision.
- New tests (RED before the fix — 3 failures recorded in `.tmp/red.log`):
  - `WHEN a pin's persist rejects THEN EVERY open view is refreshed anyway (the pin IS in memory)`
  - `WHEN a GUARDED task rejects THEN every open view is refreshed anyway (it must show what IS stored)`
  - `WHEN a GUARDED task reports it changed the store THEN every open view is refreshed`
  - `WHEN a GUARDED task reports it changed nothing THEN no view is refreshed`

### MINOR — `runGuarded` reports ANY throw in the body as a save failure
**INCORPORATED (documented, no second policy).** `runGuarded`'s doc now ends with: keep the
guarded body to the write and its outcome, because the catch cannot tell a rejected
`saveData` from a bug thrown anywhere under it, so anything else a caller grows in there is
reported to the user as a `data.json` save failure. Not worth a narrower catch: the honest
alternative (re-throwing non-save errors) reintroduces the unhandled rejection this ticket
removed.

### MINOR — the failure-message literal lives in two places
**INCORPORATED.** `RejectingPluginDataPort.SAVE_FAILURE` is now a static, the port's ctor
defaults to it, and `settingsWritePipeline.test.ts`'s `SAVE_FAILURE` aliases it — one
literal, and the test now rejects with the *same* object the port does.

### NIT — `SerialSettingsWrites` does not carry `runGuarded`
**REJECTED.** That interface exists for ONE consumer (`DebouncedSettingsWrites`, which
drains through `runSerialised`); its `settingsDebounce.test.ts` fake implements exactly it.
Adding a method no consumer of the interface calls widens the contract and forces the fake
to stub it — ISP loss for no DIP gain. `ControlsActions`' dependency on the concrete
pipeline is pre-existing; if it ever needs an interface, the right move is a narrow
`GuardedWrites` seam for its own use, not a wider grab-bag.

### NIT — the `CLAUDE.md:41` sentence is hard to parse
**INCORPORATED.** The failure-policy clause is now three sentences: (1) caught once,
reported once, never re-thrown; (2) `runGuarded` lends the same `guarded()` — catch AND
fan-out — to unplanned `data.json` writes, gated by `GuardedWriteOutcome`; (3) a REJECTED
save never skips the rebuild, and why.

## Seams
- `NonSettingsWriteSubject` + `SettingsWriteFailureNotice.forNonSettingsWrite`
- `SettingsWritePipeline.runGuarded` + `GuardedWriteOutcome` (exported)
- `RejectingPluginDataPort` (+ its `SAVE_FAILURE`) — shared failure-path test double

## Files (repo-relative)
- `src/view/settingsWritePipeline.ts` — `guarded()` owns catch + fan-out; `GuardedWriteOutcome`; `runGuarded` signature + docs; rules 3 and 5 updated
- `src/view/settingsWriteFailureNotice.ts` — non-settings subject + label (iteration 1, unchanged)
- `src/view/ControlsActions.ts` — pin bodies return an outcome; `viewsRefresh` / `refreshEveryView` / local `WriteOutcome` removed; class doc splits refused vs rejected
- `src/view/VicinityGraphView.tsx` — `ControlsActions` ctor arity
- `src/persistence/RejectingPluginDataPort.ts` — `SAVE_FAILURE` static
- `src/view/ControlsActions.test.ts` — failure-path fan-out test; harness updated
- `src/view/settingsWritePipeline.test.ts` — 3 fan-out tests; `failingPipelineUnderTest` exposes `viewsRefresh`; shared `SAVE_FAILURE`
- `CLAUDE.md` — "Settings writes" bullet rewritten as above

## Tests
- `npm test` → 96 files / **1294 passed** (was 1290; +4, none removed or weakened).
- `npm run check` → exit 0. Logs: `.tmp/test2.log`, `.tmp/check2.log`, RED run in `.tmp/red.log`.

## Acceptance criteria
- Rejected pinned-set persist → exactly one `FakeUserNotices` message, caller promise resolves. ✅
- No second failure policy (one `try` in the whole pipeline; none in `ControlsActions`). ✅
- Failure-path fan-out is a deliberate, documented, tested choice. ✅
- `npm test` + `npm run check` pass. ✅

## Notes
- Kept the module name `settingsWriteFailureNotice.ts` although it also covers the pinned
  set: renaming would churn CLAUDE.md and several suites for no behavior gain.
- Still open elsewhere: after a failed write the store keeps the value in memory (ticket
  `nid_biwdtykvazsk3ejcqqli8o9j7_e`). This change makes the SCREEN agree with that memory
  and leaves the rollback question to that ticket.
- No ticket/change-log edits, no commit, no branch switch (per instructions).
