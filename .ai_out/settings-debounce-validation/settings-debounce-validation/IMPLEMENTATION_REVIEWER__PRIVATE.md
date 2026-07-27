# IMPLEMENTATION_REVIEWER — PRIVATE (round 1)

Reviewed commits `489b281..8fd9647` on `settings-debounce-validation`. Public output:
`IMPLEMENTATION_REVIEW__PUBLIC.md` (same dir).

## Verification actually performed
- `npm test` → 1038 passed / 78 files, exit 0 (`.tmp/review-test.log`).
- `npm run check` → clean src + e2e, exit 0 (`.tmp/review-check.log`).
- Read in full: `settingsDebounce.ts`, `settingsValidation.ts`, `VicinityGraphSettingTab.ts`,
  both new test files, the `settingsWritePlan.test.ts` delta, `constants.ts`/`settings-tab.css`/
  `README.md` deltas, `PathExclusionMatcher.ts`, `sizingInput.ts`, `PluginDataStore.ts`,
  the two `[decide]` tickets.
- Checked for removed tests / anchor points via `git diff main...HEAD -- src/ | grep '^-'`: only the
  code moved into `settingsValidation.ts`. Clean.
- No `sanity_check.sh` in repo (confirmed).

## Reasoning behind the severity calls (for round 2)
- **Decay-k cross-contamination (SF1)**: verified by reading `addSizingNumber` — the cross-field
  check runs for all three rows. Not BLOCKING because the user can still repair the pair via the
  min/max rows, and it needs an already-inverted store (only reachable via hand-edit /
  `SizingSection.tsx`). Still the sharpest real bug on the branch.
- **Test vacuity (SF2)**: the two `elapse()` tests `await flush()` right after, so a no-op scheduler
  would keep them green. This is the one I would push hardest on — AC #1 is otherwise unpinned.
- **Flush-time re-validation (SF3)**: narrow in practice (blur-flush + synchronous in-memory
  `PluginDataStore.persist`), but one line and the code already claims the invariant.
- **Silent clamp (SF5)**: pre-existing, and it is item 2 of `nid_hatwq2jlkhno5t6awcz0q6t9q_e`.
  Deliberately NOT called a regression; ticket is an acceptable resolution.
- Considered and rejected as findings: shared-window design (documented trade-off), keying by visible
  row name (unique, documented), `drop()` not cancelling the window (harmless), `Number(raw)` for
  node cap (`""`→0 correctly rejected by the `>= MIN_NODE_CAP` guard).

## If asked for round 2
Re-check: (a) decay-k row no longer carries the min/max verdict; (b) a test that proves the timer
alone writes; (c) thunk-side re-validation. Everything else can ride as tickets.

## Working tree
Wrote only the two artifact files here plus `.tmp/review-*.log`. Did not touch `src/`.
Pre-existing untracked `_tickets/nodes-in-groups-folder-to-be-tighther-together.md` was already
there before this review — left alone, flagged as NIT 12.
