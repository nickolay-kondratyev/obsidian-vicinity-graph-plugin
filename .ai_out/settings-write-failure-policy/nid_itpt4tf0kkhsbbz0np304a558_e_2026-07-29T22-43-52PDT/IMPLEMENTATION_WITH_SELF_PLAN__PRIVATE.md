# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory

Ticket: `nid_itpt4tf0kkhsbbz0np304a558_e` — "Settings writes: user-visible failure policy for void-ed write promises".
Branch: `nid_itpt4tf0kkhsbbz0np304a558_e_2026-07-29T22-43-52PDT`.

**Status after the review iteration: COMPLETE. Implementation committed at `de425b6`; the review-response
changes are UNCOMMITTED working-tree changes (top-level agent commits / closes the ticket / writes the
change_log).** `npm test` 94 files / 1243 tests green, `npm run check` exit 0 (re-verified after the last edit).

## Plan (as originally executed) — unchanged, see `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`

1. New pure copy module `src/view/settingsWriteFailureNotice.ts` (interaction/scope → notice text, label READ
   from the declared row model).
2. New port `UserNoticePort` in `src/view/viewPorts.ts` + `src/view/FakeUserNotices.ts`; real `Notice` only in
   `src/main.ts`.
3. ONE catch, in `SettingsWritePipeline.write()`, never re-thrown; fan-out outside the `try`.
4. Failing tests first, then the catch. Docs in `CLAUDE.md` + `docs-internal/architecture-map.md`.

## Design decisions (the original WHY, still standing)

- **Catch at the innermost write, never re-throw.** Every call site `void`s the promise; `DebouncedSettingsWrites.drain()`
  awaits its thunks in a loop, so a throw would strand the rest of the settle window (the user's LAST keystroke).
- **Fan-out still runs on failure** — views must repaint from the store. (Its *justification* was reworded, see below.)
- **`failureNotice` is a `write()` parameter**, computed by the two callers, because only the caller knows WHAT
  was written (one row vs one reset scope). A partly-landed multi-command reset therefore still yields ONE notice.
- **Subject is the DECLARED label**: `ROW_LABELS` keyed by `controlKey` (exhaustive switch closed by
  `unhandledRowControl`); interaction → control is a SECOND switch so the key FORMAT is spelled once.
- Fallback when no row declares a control: `control.kind`. Not a throw — it runs inside a failure handler.

## Review-response iteration (this instance) — what changed

Reviewer verdict was READY (0 BLOCKING / 4 SHOULD_FIX / 3 NIT). Per-finding disposition is in
`IMPLEMENTATION_ITERATION__PUBLIC.md`. Substance:

- **F1 INCORPORATED (the important one).** Four places claimed a "snap back" the code cannot do
  (`PluginDataStore.persist()` sets `this.data = updated` BEFORE `saveData`, so the store keeps the rejected
  value and the fan-out repaints IT; `PendingEdits.reconciled` then releases the override onto that same value).
  Reworded in `settingsWritePipeline.ts` (rule 5 + the `write()` docstring, which now states the in-memory
  ordering explicitly and points at ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e`), `settingsWriteFailureNotice.ts`
  (module doc), `settingsWritePipeline.test.ts` (suite doc — it carried the same false claim; the reviewer
  missed it), and `docs-internal/architecture-map.md`. **No behavior changed** — the rollback question stays
  the owner's, on that `decide` ticket.
- **F2 PART-INCORPORATED, removal REJECTED.** All three "unreachable" catches guard an INJECTED seam, not a
  concrete class: `useOptimisticValue`'s `commit` is a `(value) => Promise<void>` prop; the tab's
  `flush()` runs caller-supplied thunks through the `SerialSettingsWrites` INTERFACE; `SettingsResetSequence`
  drives the `SettingsResetTarget` INTERFACE — and `settingsResetSequence.test.ts` has THREE behavior-capturing
  tests with rejecting targets, so removing `tolerating` would delete tested behavior. Removing
  `PendingEdits.abandoned()` would likewise drop a tested transition and leave a stuck override if any future
  `commit` ever rejects. So: kept the code, fixed the DISHONESTY — each comment now says it is seam-level, that
  the data.json policy lives in the pipeline, and that it raises NO notice (one failure, one message). The
  `useOptimisticValue` log message was changed so it can no longer be mistaken for the pipeline's.
- **F3 INCORPORATED.** New tripwire in `settingsWriteFailureNotice.test.ts`: walks EVERY declared row, builds
  every interaction its controls can emit VIA THE ACCESSORS (verified: `settingsRowAccessors.ts` is the only
  producer of a `SettingsInteraction` in the codebase, so the walk covers every emittable interaction), and
  asserts the notice contains `“<row.label>”` — quoted, so a label that is a substring of another cannot pass
  on it. **Verified it discriminates**: forcing `controlFor`'s force-layout arm to a fixed field made it fail
  with 7 lines showing exactly the feared user copy `couldn't save “force-layout”` (log `.tmp/notice_broken.log`,
  source restored from `.tmp/notice.bak`).
- **F4 REJECTED (with the DRY concern covered another way).** `controlKey` and the coverage test's
  `specLeafIdFor` answer different questions (lookup key vs. dotted `SETTINGS_SPEC` path) and neither is
  derivable from the other; merging them would put spec PATHS in the copy path. The real risk — two rows
  keying alike, one wearing the other's label — is now caught by the F3 walk (the Map keeps the LAST row, so
  the earlier row's interaction resolves to the wrong label and fails). WHY-NOT recorded at `controlKey`.
- **NIT5 → new ticket `nid_o5a1055jyynn9nohpb5rj2vqp_e`** (pin persist bypasses the policy: unhandled
  rejection, no notice, no log; deps on `nid_t25rc8sd9nmlbmrn69k4zsaes_e`, linked to this ticket).
- **NIT6 REJECTED** (eager `failureNotice`: one Map get + one template per settings write; a thunk buys nothing).
- **NIT7 INCORPORATED as an owner note** in rule 5: "exactly once" is PER FAILED WRITE, deliberately not
  deduped, with the WHY-NOT so a later ticket cannot "fix" it into swallowing a second notice.
- `CLAUDE.md`'s bullet now says what "no call-site try/catch" means given those three seam catches.

## Files touched in this iteration

`src/view/settingsWritePipeline.ts`, `src/view/settingsWritePipeline.test.ts`,
`src/view/settingsWriteFailureNotice.ts`, `src/view/settingsWriteFailureNotice.test.ts`,
`src/view/useOptimisticValue.ts`, `src/view/VicinityGraphSettingTab.ts`, `src/view/settingsResetSequence.ts`,
`CLAUDE.md`, `docs-internal/architecture-map.md`, `_tickets/` (new ticket + link).
Everything except the two test files is comment/doc-only. No production behavior changed in this iteration.

## Open questions / not done

- In-memory value on a rejected persist: owner decision, ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e` (`decide`).
  Every doc now points at it instead of pretending a snap-back.
- `ControlsActions` still constructs `Notice` directly (`nid_t25rc8sd9nmlbmrn69k4zsaes_e`); pin persist failure
  policy `nid_o5a1055jyynn9nohpb5rj2vqp_e`.
- No e2e coverage of the notice (no clean seam to make real `saveData` reject); the pipeline seam is unit-covered.
- `npm run test:e2e` NOT run (real-Obsidian release gate).
