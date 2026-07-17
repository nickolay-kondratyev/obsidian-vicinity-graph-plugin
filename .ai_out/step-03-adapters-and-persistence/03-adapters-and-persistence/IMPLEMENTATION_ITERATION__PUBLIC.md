# IMPLEMENTATION ITERATION — Step 03 (PUBLIC)

Role: IMPLEMENTATION_WITH_SELF_PLAN (instance 3, ITERATION phase), 2026-07-17.
Input: `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict NEEDS_CHANGES, findings F1–F8).
Result commit: `1f4d6ca` on `03-adapters-and-persistence` (git clean).

## Disposition table — 8 incorporated / 0 rejected

| ID | Disposition | What was done |
|---|---|---|
| F1 (MAJOR, sweep snapshot race) | INCORPORATED | Verified real: `liveDocids` is a warm-up-start snapshot while pins/doc-data are read after warm-up. Fix: `OrphanSweeper.apply` re-verifies each candidate at drop time via `isConfirmedOrphan` (`pathDocIdMap.getPath(docid) === undefined`) — applied to doc-data deletions, pin removals AND stale `centralDepths` strips (the reviewer's fix, extended to the third drop kind for symmetry; per-item because apply itself yields). Failing-first regression tests: new `midSweepWriteFixture` simulates a create+pin write intent on the first warm-up yield; 3 tests assert pin, doc-data file and centralDepths entry all survive. |
| F2 (MAJOR, foreign json aborts sweep) | INCORPORATED | Verified real: unsafe stem from `listDocIds` → `filePathOf` throw → whole `run()` rejected. Fix: `DocDataStore.listDocIds` filters stems through `DocPersistEligibility.isFilenameSafeDocId` (a non-safe stem cannot be a file this store wrote), with a WHY doc. Failing-first tests: foreign `docid_note0_e.sync-conflict copy.json` added to the shared sweep fixture (before the fix it made ALL 8 existing sweeper tests fail — exactly the reported abort) + explicit "neither throws nor touches it" test + store-level `listDocIds` omission test. |
| F3 (MAJOR, guard misses src/shared) | INCORPORATED | Guard now scans `GUARDED_DIRS = [src/engine, src/shared]` (flatMap in the offenders test), plus a non-vacuous check for src/shared and an updated header comment (engine import closure). |
| F4 (MINOR, evict never wired) | INCORPORATED | `canvasParseCache.evict(oldPath)` in the rename handler, `evict(path)` first thing in `handleVaultDelete` — unconditional, non-canvas paths are no-ops (comment says so). No unit test: main.ts is untested wiring by the established ports pattern; `evict` behavior itself was already covered in CanvasParseCache tests. |
| F5 (MINOR, Windows reserved names) | INCORPORATED | `WINDOWS_RESERVED_BASENAME_PATTERN` (`CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]`, case-insensitive) rejected in `isFilenameSafeDocId` → foreign id `CON` now gets the honest `unsafe-docid` emblem. Tests: `CON` rejected, `com3` rejected (case-insensitivity), `CONSOLE` still persistable (no over-blocking). |
| F6 (MINOR, inversion mode flip on missing file) | INCORPORATED | `backlinkSources` restructured: inversion-mode short-circuit first; `file === null` → `[]` (with WHY comment); inversion is built only for API-absent (constructor) or unrecognized-shape cases. Behavioral test: ghost-path query first, then real query must still return the API answer (resolvedLinks deliberately empty so inversion would answer `[]`). |
| F7 (NIT, unconditional removePins write) | INCORPORATED | `handleVaultDelete` now guards with `pluginDataStore.hasPin(docid)` — no needless data.json write, and `hasPin` gains its production caller. |
| F8 (NIT, destructive forward-version handling) | INCORPORATED (doc-only, as the reviewer suggested) | WHY-NOT comment at `PERSISTED_SHAPE_VERSION`: downgrade-then-write rewrites future-version files as v1 — accepted while only v1 exists; a v2 parser must handle the downgrade path explicitly. |

No rejections: every finding was re-verified against the source and found factually
correct; all fixes stayed within the reviewer's "< ~10 lines, no redesign" envelope
(F1's extension to centralDepths is the only scope-up, chosen so all three drop kinds
share one rule instead of two).

## Test counts
- Root: **297 tests / 30 files** (was 287 — **+10**: 3 race, 2 foreign-json, 3 reserved-name, 1 inversion-flip, 1 shared-dir non-vacuous).
- Sublib obsidian-id-lib: 69 / 6 (unchanged).
- `/usr/local/bin/npm run check`, `npm test`, `npm run build` — all exit 0.

## Readiness: READY
All MAJOR findings fixed with failing-first regression tests; MINOR/NIT all
incorporated; suite green; committed (`1f4d6ca`); git clean.

## #QUESTION_FOR_HUMAN
None. (The pre-existing note stands: a human smoke run of the debug command in real
Obsidian is still pending — environment limitation, not a finding.)
