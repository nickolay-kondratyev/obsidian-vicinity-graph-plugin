# IMPLEMENTATION_REVIEWER — private working memory

Review completed 2026-07-29. Verdict: **IMPLEMENTATION_APPROVED**.
Public output: `IMPLEMENTATION_REVIEW__PUBLIC.md` (same dir).

## State on exit

- Main worktree **clean** (`git status --porcelain` empty). Read-only for `src/`
  and `e2e/` was honoured — I never edited them in the main tree.
- Probe worktree `.worktree/rev-probe` was created, used, and **removed**
  (`git worktree remove --force` + `prune`). Verify with `git worktree list` if
  rehydrating.
- Artifacts left behind: `.tmp/rev-test.txt`, `.tmp/rev-check.txt`, `.tmp/wt.txt`.

## What I actually verified (so a rehydrated me does not redo it)

All 9 verification items from the brief PASSED. Nothing in
`IMPLEMENTATION__PUBLIC.md` was found false. Details:

1. **RED real.** Worktree at `17a162c` → `engineDefaultsSingleSource.test.ts`
   fails with `expected [ 'ForceLayoutSection.tsx' ] to deeply equal []` at
   line 61. At `784f8b1` → 3 passed. Genuine.
2. **All 5 guards fire + name the field.** Re-ran every probe with real
   `tsconfig.json`. Table of exact `tsc` output is in the public review §2. Also
   found a 6th (depth parse TS2345). No guard was silently vacuous.
3. **Inherit invariant.** Wrote a 13-assertion runtime probe (differential +
   invariants + aliasing). All passed. Key finding worth remembering:
   `exactOptionalPropertyTypes` is **NOT** on in `tsconfig.json`, so the
   absent-key property is only guaranteed at runtime — my
   `Object.getOwnPropertyNames` check was the right instrument.
4. **Zero blast radius.** `git diff f4b4a7f..HEAD -- src/view/settingsResetPlan.test.ts`
   empty. All test diffs `+219/−0`. No `.skip`/`.todo`/loosened matchers added.
5. **`ViewSettingsResolver`** not in diff at all.
6. **Scope clean** vs D1/D2/copy/CSS/persisted shape.
7. **Numbers confirmed**: 86 files, 1144 + 1 expected fail; `check` exit 0.
   Expected fail = `it.fails` at `src/view/d3ForceStranding.test.ts:230`, file
   untouched by branch, last commit `0fb796f` (pre-branch). Genuinely pre-existing.
8. **Differential probe (my addition, beyond the brief).** Transcribed the six
   pre-branch hand-written plan closures from `f4b4a7f` and asserted `toEqual`
   against the new derived plans over a tuned ctx — all six identical. Also
   confirmed no shared-reference aliasing (`EngineDefaults.viewSettings()` calls
   the leaf factories fresh) and no ctx mutation.
9. **Non-vacuity.** Removed `nodeCap` from its section → **4 tests fail**, two of
   them in the *untouched* `settingsResetPlan.test.ts`. Strongest evidence the
   refactor is genuinely covered.

## Findings recorded (all MINOR; nothing blocking)

- **V1** (visibility, not code): ticket's literal "ONE declaration" acceptance
  clause NOT met — 5 edit sites remain, 4 compile-forced. Plan declined it
  explicitly, grounded in owner CLARIFICATION constraint 5 (don't weaken
  `resolve()`'s return type). Durably documented in
  `docs-internal/notes/settings.md`. I **agree** with the decline. Needs an
  explicit human ack at ticket close because an agent, not the owner, approved
  the amendment.
- **M1**: `e2e/settingsDependentRows.e2e.ts:44-50` — comment now false
  (`noUncheckedIndexedAccess makes [0] optional` is untrue once `SIZING_METRICS`
  became a const tuple) and the `undefined` throw is dead. Self-reported by
  implementer but **not ticketed** → recommend filing one, deps → ticket 5.
- **M2**: scanner failure message should carry the "a match inside a COMMENT also
  counts" hint. Judged the comment-matching trade-off **correct** (false negative
  strictly worse than false positive for a safety guard).
- **M3**: `ALLOWED_MODULES` basenames vs recursive relative paths — future ENOENT
  instead of clean assertion if a view module moves into a subdir.
- **M4**: scan covers only `src/view`, not `src/adapters`.
- **M5**: `_assertEveryResetScopePlaced` now tautological; honestly annotated as
  such; I'd delete it but plan ruled it stays — taste call, harmless.

## Both declared deviations judged SOUND

1. Test 11 in a new file: sound (SRP + preserves the byte-identical proof + the
   untouched test still catches a broken derivation, proven by injection).
2. Comment reword over comment-stripping: sound (loud failure beats silent hole).

## Over-engineering assessment: NOT over-engineered

~40 lines of new machinery. Eight previously-drift-prone lists became
compile-checked; the `!== undefined` inherit rule went from 7 sites to 1.
The one place complexity *moved* is the deliberate `SETTINGS_SECTIONS` /
`SECTION_RESET_SCOPES` double-name — transparently taken and ticketed
(`nid_llfhrqo1ecg8tuxigo7bcrrrf_e`).

## If asked to re-review

Everything above is reproducible. The two highest-value probes to re-run are the
**differential** (old vs new plans) and the **injection non-vacuity** check —
they are what turn "tests are green" into "behaviour is unchanged and the tests
would notice if it weren't". Recipe: `git worktree add .worktree/rev-probe HEAD`,
symlink `node_modules` from the main repo, probe, then `git checkout -- .` and
`git worktree remove --force`.
