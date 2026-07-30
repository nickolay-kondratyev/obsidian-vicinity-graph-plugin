# Round 2 review — iteration commit `0e4a39f`

Scope per instructions: NOT a full re-review (round 1 already said READY). Confirms only the five
things asked for, on top of round 1's `IMPLEMENTATION_REVIEW__PUBLIC.md`.

## Per-finding confirmation

| # | Round-1 finding | Disposition claimed | Verified |
|---|---|---|---|
| 1 | Docs claim a snap-back that cannot happen | INCORPORATED (4 places reworded) | **CONFIRMED.** Repo-wide grep for "snap back / snap-back / old value comes back / value the user actually still has" finds zero surviving false claims. `settingsWritePipeline.ts:150` now says explicitly "this is NOT a snap-back" and states the in-memory-before-disk ordering; `settingsWriteFailureNotice.ts` module doc, `settingsWritePipeline.test.ts` suite doc, and `docs-internal/architecture-map.md:70-77` all say the store keeps the value that never reached disk and point at the open `nid_biwdtykvazsk3ejcqqli8o9j7_e` decision instead of asserting an answer. `CLAUDE.md`'s settings-writes bullet was already accurate (round 1 said so) and is untouched. |
| 2 | 3 call-site catches now unreachable | REJECTED (kept, comments fixed) — hold only if wrong | **ACCEPTED.** The tests cited genuinely exist and pin the claimed behavior: `settingsResetSequence.test.ts:80,87,100` — three tests with `target.writeDefaults`/`flushTypedEdits` forced to `Promise.reject`, asserting the redisplay/drain still happens — pin `tolerating`'s seam-level tolerance regardless of whether the pipeline itself can still reject. `optimisticValue.test.ts:94` (`abandoned()` → stored value shown again) pins the `PendingEdits.abandoned()` transition `useOptimisticValue`'s catch drives. The argument that `commit`/`SerialSettingsWrites`/`SettingsResetTarget` are *interface* seams, not the concrete pipeline, is correct — a future non-pipeline implementation could still reject there. Removing the catches would delete behavior-capturing tests without alignment, which CLAUDE.md forbids; keeping them with corrected comments (now stating plainly they raise no notice and the pipeline owns that) is the right call. No deadlock — reviewer's own offered alternative was "or fix the comment," and that's what happened. |
| 3 | No tripwire pinning DECLARED label vs. fallback | INCORPORATED | **CONFIRMED it discriminates.** `settingsWriteFailureNotice.test.ts`'s new "over every declared row" walk drives all 9 row-control kinds (`depth`, `sizing-metric` ×2 interactions, `sizing-number`, `node-preview`, `outline-depth`, `force-layout`, `exclusion-enabled`, `exclusion-patterns`, `node-cap` — matches `settingsRows.ts`'s full kind set exactly) through the accessors, and asserts `notice.includes(\`"${row.label}"\`)` — quoted, so a substring label can't pass on another's. If the fallback (`?? control.kind`) fired for any row, the notice would contain the raw kind string instead of the quoted label and the assertion would fail. A second assertion (`length > EVERY_SETTINGS_ROW.length`) keeps the walk non-vacuous. The implementer's own before/after break test (`.tmp/notice_broken.log`, 7 failures naming the exact leaked-kind copy) is consistent with this reasoning. |
| 4 | DRY: `controlKey` duplicates `specLeafIdFor` | REJECTED | **ACCEPTED, one paragraph.** The two switches key on genuinely different axes — `controlKey` produces a lookup key for "which control kinds must be field-unique" (`depth:linkDepthIn`), `specLeafIdFor` produces a dotted path into `SETTINGS_SPEC` (`globalDepths.linkDepthIn`) — and unifying them would require threading spec paths into the notice-copy module just to save a switch, which is a worse coupling than the duplication itself. The actual risk flagged (silent collision in `ROW_LABELS`) is now covered, and more strongly than the suggested `size` assertion: finding 3's row walk fails by name if two rows key alike (the Map keeps the last writer, so the earlier row's interaction would resolve to the wrong label and the walk's exact-quote check catches it). Rejection is sound; no hold. |
| 5 | `npm test` / `npm run check` | — | **CONFIRMED, run myself.** `npm test` → 94 files / 1243 tests, all passed, exit 0 (`.tmp/r2_test.log`). `npm run check` → `tsc -noEmit` (src) + `check:e2e` (e2e/tsconfig.json), exit 0 (`.tmp/r2_check.log`). No `sanity_check.sh` in this repo (confirmed again). Matches the implementer's claimed 1243/1243 and both green. |

## Scope discipline

No new lines of critique opened. This iteration's diff is doc/comment/test-only against `de425b6`
(`useOptimisticValue.ts`, `VicinityGraphSettingTab.ts`, `settingsResetSequence.ts` changes are comment-only;
`settingsWritePipeline.ts`/`settingsWriteFailureNotice.ts` changes are doc-only; the only executable diff
is the new `describe("SettingsWriteFailureNotice over every declared row", …)` block) — consistent with the
implementer's own "no production behavior changed" claim, confirmed by reading, not assumed.

## Verdict

**READY.**
