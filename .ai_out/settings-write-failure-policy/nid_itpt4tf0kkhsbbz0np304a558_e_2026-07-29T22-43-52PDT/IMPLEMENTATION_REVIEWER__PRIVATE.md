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

## Round 2 (fresh instance, iteration commit `0e4a39f`)

Tight scope per instructions — confirm 5 things only, no new critique. Read `.tmp/iter.diff`
(`git show 0e4a39f`) in full rather than the whole change (round 1 already said READY).

1. **F1 (snap-back lie) — CONFIRMED fixed everywhere.** Repo-wide grep for "snap back / snap-back /
   old value comes back / value the user actually still has" turns up zero surviving false claims.
   `settingsWritePipeline.ts:150` states outright "this is NOT a snap-back" and names the
   in-memory-before-disk ordering; same correction in the module doc, the pipeline test suite doc, and
   `docs-internal/architecture-map.md:70-77`. All point at `nid_biwdtykvazsk3ejcqqli8o9j7_e` instead of
   asserting an answer to the open rollback question. `CLAUDE.md` bullet untouched (was already accurate).

2. **F2 rejection — ACCEPTED, not a hold.** Verified the cited tests actually exist and pin the claimed
   behavior, not taken on trust:
   - `settingsResetSequence.test.ts:80,87,100` — three tests force `writeDefaults`/`flushTypedEdits` to
     `Promise.reject` and assert the drain/redisplay still happens. These pin `tolerating`'s seam-level
     tolerance independent of whether the concrete pipeline can still reject.
   - `optimisticValue.test.ts:94` — pins `PendingEdits.abandoned()` (stored value shown again after
     abandon), the transition `useOptimisticValue`'s catch drives.
   The "injected seam, not concrete pipeline" argument is structurally sound (interface implementations
   aren't guaranteed to route through the pipeline). Removing the catches would delete behavior-capturing
   tests without alignment — CLAUDE.md forbids that. Comments now correctly say "raises no notice, pipeline
   owns that." No deadlock: the implementer took the reviewer's own offered alternative (fix the comment).

3. **F3 (declared-label tripwire) — CONFIRMED it discriminates.** The new walk in
   `settingsWriteFailureNotice.test.ts` drives all 9 row-control kinds (checked against every `kind:`
   literal in `settingsRows.ts` — exact match: depth, sizing-metric ×2, sizing-number, node-preview,
   outline-depth, force-layout, exclusion-enabled, exclusion-patterns, node-cap) through the accessors and
   asserts the notice contains `"<row.label>"` quoted. A fallback-to-`control.kind` leak would produce the
   raw kind string instead of the quoted label and fail the assertion — this is the exact scenario round 1
   worried about (`couldn't save "force-layout"` was the implementer's own reproduction when they broke
   `controlFor` to verify). Non-vacuous via a second `length >` assertion. Exhaustive switch closed by
   `unhandledRowControl` so a 10th kind can't silently skip the walk.

4. **F4 rejection — ACCEPTED.** `controlKey` (lookup key, e.g. `depth:linkDepthIn`) and `specLeafIdFor`
   (dotted `SETTINGS_SPEC` path, e.g. `globalDepths.linkDepthIn`) answer different questions; unifying them
   means threading spec paths into the copy module to save a switch — worse coupling than the duplication.
   The real risk (silent `ROW_LABELS` collision) is covered more strongly than the suggested size-assertion:
   F3's walk fails by name on a collision (Map keeps last writer, earlier row's interaction resolves to the
   wrong label, exact-quote match catches it).

5. **Tests — ran myself.** `npm test` → 94 files / 1243 tests, all passed, exit 0 (`.tmp/r2_test.log`).
   `npm run check` → `tsc -noEmit` + `check:e2e`, exit 0 (`.tmp/r2_check.log`). No `sanity_check.sh`.

No new lines of critique opened — the iteration's diff is comment/doc-only against `de425b6` except for
one new test `describe` block, matching the implementer's own "no production behavior changed" claim.

**Round 2 verdict: READY.** Wrote `IMPLEMENTATION_REVIEW_ROUND2__PUBLIC.md`.
