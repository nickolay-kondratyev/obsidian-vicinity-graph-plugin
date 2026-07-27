# IMPLEMENTATION_REVIEW — ROUND 2 (convergence check)

Branch `settings-debounce-validation`. Round-2 commits reviewed: `7207d02` (code+tests+README),
`09c8360` (records + ticket cross-links). New module `src/view/sizingRowWrite.ts`.

**Verification run by the reviewer (not taken on trust):**

- `npm test` → **1053 passed / 79 files, exit 0** (`.tmp/r2-test.log`). Was 1038/78 → **+15, none removed**.
- `npm run check` → **clean, src + e2e, exit 0** (`.tmp/r2-check.log`). No `sanity_check.sh` in repo.
- **I re-ran the implementer's sabotage checks myself**, in a scratch copy of `HEAD`
  (`git archive` → `.tmp/sabotage`, since removed). `src/` in the repo was never touched — `git status`
  confirmed clean mid-run. Results below, per finding.
- Removals audit `git diff d905a6d..HEAD -- src/ | grep '^-'`: the only deletions are code *moved*
  (`compileFailure` → `PathExclusionMatcher`, the three `toSizing` lambdas → `SizingRowWrite`) and the
  two `elapse()` tests, which were **rewritten stronger, not dropped** (same names, same assertions,
  minus the `flush()` that made them vacuous). **No test deleted or weakened. No `ap_XXX_E` anchor touched.**

---

## Verification table — round-1 findings

| # | Finding | Verdict | Evidence |
|---|---------|---------|----------|
| SF 1 | Decay-k row rejected by the min/max rule | **VERIFIED-FIXED** | `sizingRowWrite.ts:24` `CROSS_FIELD_ROWS = {minPx, maxPx}`; `rejectionOf()` returns `undefined` for `depthDecayK`. **Sabotage** (add `depthDecayK` to the set) → `sizingRowWrite.test.ts` fails. |
| SF 2 | Debounce **timer** path not pinned | **VERIFIED-FIXED** | Both `elapse()` tests dropped `flush()` and await `h.written(n)`, which only the write thunk resolves. **Sabotage** (`restartWindow()` → no-op) → exactly those 2 tests fail, in ~1.0 s each via `TIMER_TEST_TIMEOUT_MS`. Non-vacuous, and fails fast rather than hanging. |
| SF 3 | Rejected value reachable via the re-derived flush thunk | **VERIFIED-FIXED** | `SizingRowWrite.persistIfAccepted()` re-derives from fresh globals and re-takes the verdict before persisting. **Sabotage** (drop the re-check) → 2 tests fail, incl. `WHEN the globals turn the pending pair inverted THEN the flushed write persists NOTHING`. |
| SF 4 | Regex-compile rule duplicated view ↔ engine | **VERIFIED-FIXED** | `new RegExp(pattern)` now appears exactly once, in `PathExclusionMatcher.compilePattern`; both `compile()` (silent-skip) and the new public `compileFailure()` route through it; `settingsValidation.ts:47` asks the engine. 3 engine tests pin the agreement, including "a pattern reported as failing is one the matcher skips". Layering unchanged (view → engine). |
| SF 5 | Out-of-range typed value silently stored as something else | **VERIFIED-FIXED (tab scope)** | `SizingRowWrite.capNotice` emits `Stored as N — the allowed range is a–b.` as a **warning** (written, no `aria-invalid`), computed with the engine's own `clampSizingSettings` — the same clamp `planSettingsWrite` applies (`settingsWritePlan.ts:107`), so the message cannot claim a cap the write path does not perform. `SizingSection.tsx` still clamps silently — correctly scoped out and recorded on `nid_hatwq2jlkhno5t6awcz0q6t9q_e`. Fixed rather than ticketed; better than what I asked for. |
| C 6 | `void flush()` → unhandled rejection | **VERIFIED-FIXED** | `settlePendingWrites()` catches and `console.error`s; all three former `void flush()` sites now route through it. Swallow-with-log is documented with its WHY (a failed write must not abort the reset). |
| C 7 | `display()` / reset do not settle pending writes | **VERIFIED-FIXED** | `await this.settlePendingWrites()` precedes **every** `this.display()` call site (`:321→:327`, `:406→:413`, `applyReset` `:713→:719`), and `display()`'s doc now states the requirement. Ordering is safe: `flush()` chains on `draining`, so a second flush awaits an in-flight drain. The previously implicit "the click blurs the input first" dependency is gone. |
| C 8 | `role="alert"` on the per-keystroke pattern warning | **VERIFIED-FIXED** | `addFeedbackSlot(row, role)`: `status` for the exclusion textarea (`:345`), `alert` for the sizing rows (`:627`). |
| C 9 | One shared settle window | **REJECTION-ACCEPTED** | Correct. My round-1 note explicitly flagged it only to put the trade-off on record; it is documented in `settingsDebounce.ts`, bounded by the blur flush, and drops no edit. No change was the right call. |
| NIT 10 | Record over-counts the debounce tests | **VERIFIED-FIXED** | Now reads `(9 — corrected in round 1, the count below was mis-stated as 12)`. Honest correction rather than a quiet edit. |
| NIT 11 | Pre-existing ticket un-updated | **VERIFIED-FIXED** | `nid_hatwq2jlkhno5t6awcz0q6t9q_e` carries a dated note splitting tab vs. `SizingSection.tsx` per item, plus a bidirectional `links:` with `nid_9jiira82snkh7bgy8zv060c9r_e`. |
| NIT 12 | Stray untracked `_tickets/nodes-in-groups-…md` | **REJECTION-ACCEPTED** | The implementer was instructed not to touch it, and it predates this branch. It is a human call, not theirs. It remains the only untracked file — the human should commit or delete it before merge. |

**10 verified fixed, 2 rejections accepted, 0 disputed, 0 not-fixed.**

## New findings (round 2)

None at SHOULD-FIX or above. `sizingRowWrite.ts` is a justified extraction, not ceremony: it exists
because the verdict is genuinely taken **twice** (keystroke + flush) and those two had drifted — that
was SF 3. It gave the tab three call sites collapsing to `addSizingNumber(section, name, field)`, and
it is the reason SF 1/3/5 are unit-testable at all (the obsidian tab has no harness). Its WHY comments
say exactly this. It imports only `../engine` + `./settingsValidation` — layering intact.

One observation, **no action requested**: `judge()` takes the cross-field verdict on the *raw typed*
value before the cap notice, so `minPx = 500` against a stored `maxPx = 400` is **refused** even though
clamping would have made it valid (`500 → 400 == 400`). Refusing is the conservative and honest branch
(nothing is stored, the message is factual), so this is a defensible ordering, not a defect.

## Acceptance criteria — round 2

| # | Criterion | R1 | R2 | Note |
|---|-----------|----|----|------|
| 1 | Typed settings debounce before persisting + rebuilding | PARTIAL | **MET** | The timer path is now pinned by tests that provably fail against a dead window. Tab wiring remains untested glue — legitimately ticketed as an e2e follow-up. |
| 2 | `maxPx < minPx` rejected with visible feedback | PARTIAL | **MET** | Cross-field rule now scoped to the rows it is about, re-checked where the write happens, message + `aria-invalid` pinned by 12 tests. |
| 3 | Upper bounds pinned for sizing px and decay-k | MET | **MET** | Unchanged, plus the UX gap I flagged (SF 5) is now closed for the tab. |
| 4 | Invalid regex lines surfaced | MET | **MET** | Duplicate compile rule eliminated; agreement with the matcher is now tested, not assumed. |
| 5 | BDD tests cover each | PARTIAL | **MET** | +15 tests, 0 removed, 0 weakened; the previously vacuous pair is the strongest evidence — I reproduced its failure under sabotage. |

## Readiness

**READY TO MERGE.** All three must-fixes are genuinely fixed and I confirmed each one by breaking the
implementation myself and watching the intended test fail — none of the new coverage is vacuous. Both
rejections are reasonable. No regression, no removed behavior, no removed test, layering and anchor
points intact, `npm test` 1053/1053 and `npm run check` green.

Two items for the **human**, neither blocking this branch:
- the untracked `_tickets/nodes-in-groups-folder-to-be-tighther-together.md` (commit or delete);
- the two `[decide]` tickets this branch correctly deferred — `nid_9jiira82snkh7bgy8zv060c9r_e`
  (engine-level cross-field guard) and `nid_hatwq2jlkhno5t6awcz0q6t9q_e` (`SizingSection.tsx` still
  clamps silently and snaps mid-keystroke — the in-view mirror of what this branch fixed in the tab).

## Documentation updates needed

None. `CLAUDE.md` needs no entry — the debounce/verdict seams are documented in place, and no new
repo-wide convention was introduced. README changes remain accurate. `change_log` is TOP_LEVEL's.
