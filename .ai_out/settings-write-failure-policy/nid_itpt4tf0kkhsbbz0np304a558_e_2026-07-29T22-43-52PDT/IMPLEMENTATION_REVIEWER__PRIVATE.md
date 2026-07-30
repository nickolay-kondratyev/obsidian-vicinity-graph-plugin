# IMPLEMENTATION_REVIEWER — private memory

Reviewed commit `de425b6` ("feat(settings): one user-visible failure policy for rejected settings writes").
Read-only pass; no source touched.

## What I ran (actual results)

- `npm test` → **94 files / 1241 tests passed**, exit 0 (`.tmp/rev_test.log`).
- `npm run check` → `tsc -noEmit` + `check:e2e` both clean, exit 0 (`.tmp/rev_check.log`).
- No `sanity_check.sh` in this repo.
- I did NOT mutate the catch body to reproduce the implementer's "6 failed" claim (read-only for code); I
  verified the discrimination by reading each new test instead — see below.

## What I read

- Diff: `.tmp/rev_diff.txt` (`git show HEAD -- src/ CLAUDE.md docs-internal/`).
- Ticket `_tickets/settings-writes-user-visible-failure-policy-for-void-ed-write-promises.md`.
- Implementer handoff `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`.
- `src/view/settingsWritePipeline.ts` (full), `settingsWriteFailureNotice.ts`, `viewPorts.ts` delta,
  `FakeUserNotices.ts`, `settingsDebounce.ts`, `ControlsActions.ts`, `settingsResetSequence.ts`,
  `useOptimisticValue.ts`, `VicinityGraphSettingTab.ts` (280–340 + all call sites via grep),
  `src/persistence/PluginDataStore.ts`, `src/view/settingsRowSpecCoverage.test.ts`,
  `settingsRowAccessors.test.ts` (probesFor), `settingsRows.ts` (EVERY_SETTINGS_ROW, unhandledRowControl).
- Both new follow-up tickets (`nid_biwdtykvazsk3ejcqqli8o9j7_e`, `nid_t25rc8sd9nmlbmrn69k4zsaes_e`).

## Path coverage check (ONE place)

grep for `settingsWrites.`/`writes.`/`runSerialised`/`writer.apply` across `src/**` (non-test):
- settings tab: `VicinityGraphSettingTab.ts:444,520,630,687` → `pipeline.apply` → `chain.run(writer.apply)` → `write()`.
- tab typed fields: `:480,538,652,590` → `debounced.schedule(thunk)` → `runSerialised` → `writer.apply` → `write()`.
- tab reset: `:98 writeDefaults` → `pipeline.restoreDefaults` → `write()`.
- panel: `ControlsActions.applySettings/restoreDefaults` → same; `GraphToolbar.tsx:143` void-s it.
- **Bypass found**: `ControlsActions.pinNode/unpinNode` use `runSerialised` with a NON-writer body
  (`persistenceServices.pinDoc/unpinDoc`). A rejection there escapes the pipeline (no `write()`), lands on
  `void` at the React handler → unhandled rejection, no notice. Pre-existing; not covered by either new ticket.

## Test discrimination (verified by reading, not by mutation)

Remove the `catch` body ⇒ `write()` rejects ⇒
- "told exactly once" / "told ONCE for the scope": `notices.messages` stays `[]` → fail.
- "does not reject its caller": `resolves.toBeUndefined()` → fail.
- "queued behind it is still attempted" / "next field in the same window": chain tail is
  `running.catch(()=>undefined)` so the chain survives, but the debounce drain loop `await thunk(writer)`
  aborts ⇒ `saveAttempts` 1 not 2 → fail (the second is the honest one; the first would still be 2).
- "views refreshed anyway": fan-out is after the try, so a throw skips it → fail.
So the suite is genuinely load-bearing. `expect(...).toEqual([msg])` (exact array) is what pins "exactly once".

## Dead-code trail I confirmed

`write()` never rejects ⇒ these pre-existing call-site catches are unreachable in production:
- `useOptimisticValue.ts:43-46` (`commit` is always `actions.applySettings` → `pipeline.apply`; callers
  `SettingsRowView.tsx:92,109`, `DepthStepper.tsx:46`) ⇒ `PendingEdits.abandoned()` (`optimisticValue.ts:117`)
  is now exercised only by its own unit test.
- `VicinityGraphSettingTab.ts:308-314` (`settlePendingWrites`).
- `settingsResetSequence.ts:69-75` (`tolerating`) — also `drainWrites` can't reject (`SerialPromiseChain`
  line 29 swallows the tail).

## Doc-honesty trail

`PluginDataStore.persist()` (line 71-74) sets `this.data = updated` BEFORE `saveData`. So after a rejected
persist the fan-out repaints the NEW value and `PendingEdits.reconciled(stored)` releases the override onto
that new value. Therefore the pipeline docstrings' "snap back to the value the user actually still has" /
"the old value comes back" cannot happen. The implementer's own ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e`
describes exactly this — so the tickets are honest but the in-code comments and architecture-map are not.

## DRY note

`SettingsWriteFailureNotice.controlKey` is a 2nd exhaustive control-identity switch; `specLeafIdFor` in
`settingsRowSpecCoverage.test.ts:38` is the 1st (and that file has the "no two rows edit the same field"
duplicate guard the new `ROW_LABELS` Map lacks).

## Verdict filed

READY WITH FOLLOW-UPS (4 SHOULD_FIX, 3 NIT, 0 BLOCKING). Acceptance criterion met.
