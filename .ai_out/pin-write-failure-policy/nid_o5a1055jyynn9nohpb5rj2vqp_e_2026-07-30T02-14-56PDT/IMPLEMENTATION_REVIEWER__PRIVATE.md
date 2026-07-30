# Reviewer notes (private) — `b3a7220`

## What I actually ran

- `npm test > .tmp/review-test.log` → 96 files / 1290 tests passed, exit 0.
- `npm run check > .tmp/review-check.log` → exit 0 (src + e2e tsc).
- No `sanity_check.sh` in repo root.

## Verification trail

- Diff read in full (`git show b3a7220 -- CLAUDE.md src/`), plus the full current
  `ControlsActions.ts`, `settingsWritePipeline.ts`, `PluginDataStore.ts`,
  `settingsWriteFailureNotice.ts`, and `ControlsActions.test.ts` lines 60-171.
- Deletions audit: only the local `RejectingPluginDataPort` class in
  `settingsWritePipeline.test.ts` (moved to `src/persistence/`, not weakened). No
  behaviour test removed, no anchor point touched.
- Success-path fan-out regression check: `refreshEveryView()` is still inside the pin task;
  `ControlsActions.test.ts:107` and `:113` (refresh EVERY view on pin / unpin) untouched and
  green. Conclusion: NOT a regression — the "runGuarded does not fan out" choice is right for
  the success path because the task already fans out itself.
- One-catch check: `grep 'try {' src/view/*.ts` (non-test) → `edgeRouting.ts`,
  `GraphViewController.ts` x2, `settingsResetSequence.ts`, `VicinityGraphSettingTab.ts`,
  `settingsWritePipeline.ts:217`. All the pre-existing, CLAUDE.md-sanctioned ones; no new
  call-site catch. `runSerialised` still used (only by `settingsDebounce.ts`), so no dead seam.
- Copy check: no call site types user-visible text; `NON_SETTINGS_WRITE_LABELS` is the only
  new hand-written label and it lives in the copy-owning module.
- Double-notice check on `pinNode`: `not-persistable` returns WITHOUT throwing, so the
  refusal notice and the failure notice cannot both fire.

## The one substantive finding

Failure-path fan-out asymmetry. Settings `write()` fans out even after `guarded()` catches
(tested at `settingsWritePipeline.test.ts:278`), because `PluginDataStore.persist()` moves
memory before the disk write. The pin path skips the fan-out on rejection for exactly the
same in-memory situation, and the WHY-NOT comment justifies it with the `not-persistable`
case, which is a DIFFERENT case. Not a regression (pre-commit behaviour was identical), but
the commit's whole claim is "one policy", and this is where the two halves visibly differ,
undocumented and untested.

Judged MAJOR not BLOCKING: no data loss beyond what the open ticket
`nid_biwdtykvazsk3ejcqqli8o9j7_e` already tracks, user still gets the notice. Verdict
CHANGES_REQUESTED anyway because the fix is cheap (a corrected comment + one test) and
because leaving the failure-path fan-out untested lets it flip silently later.

## Deliberately NOT raised

- `runGuarded` taking a string-union subject rather than the writer callback shape of
  `runSerialised` — asymmetric API surface, but the union is what keeps copy out of call
  sites; net positive.
- `RejectingPluginDataPort` shipping in `src/persistence/` (non-test) — same pattern as
  `FakePluginDataPort`; tree-shaken out of the bundle.
- Test assertions referencing `SettingsWriteFailureNotice.forNonSettingsWrite(...)` rather
  than a literal — not assertion-tuning; it is the repo's copy-lives-once convention, and
  the exactly-once + array-equality shape is what carries the behaviour.
