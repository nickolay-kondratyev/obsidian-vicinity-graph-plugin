# IMPLEMENTATION_REVIEWER — PRIVATE memory (step 03)

## Iteration 1 (2026-07-17) — verdict NEEDS_CHANGES

### What I verified and how
- Ran `/usr/local/bin/npm run check` (exit 0), `npm test` (root 30/287 pass; sublib 6/69 pass — matches claims), `npm run build` (exit 0). Logs in `.tmp/review-check.log`, `.tmp/review-test.log`, `.tmp/review-build.log`. No `sanity_check.sh` in repo.
- `git diff --diff-filter=D 8e04df6..HEAD` → empty: no removed tests/files, no lost functionality, no anchor-point removals.
- Read IN FULL: ObsidianLinkProvider, BacklinksAdapter, obsidianPorts, CanvasFallbackParser, CanvasParseCache, CanvasCapability, ReferenceOrder, persistedShapes, storagePorts, DocDataStore, PluginDataStore, DocDataMutations, DocPersistEligibility, PathDocIdMap, ChunkedWork, SweepPlanner, OrphanSweeper, PersistenceServices, GraphRequestAssembler, NeighborhoodGraphBuilder, main.ts, importGuard.test.ts, FakeDocIdPort, FakeFileStorage, OrphanSweeper.test; skimmed (test names only) ObsidianLinkProvider/PersistenceServices/DocDataStore/GraphRequestAssembler/DocPersistEligibility/ChunkedWork tests; full diff of engine+shared changes.
- Greps: `ensureDocId` call sites (confirmed single production call site = PersistenceServices.withPersistableIdentity); `evict` (only self-test calls it → F4); `hasPin` (production-dead → F7).

### Findings filed (see PUBLIC for full text)
- F1 MAJOR: sweep pin/doc-data loss race for docs created+pinned during warm-up (liveDocids snapshot vs. pins read after warm-up). Fix: apply-time re-check via pathDocIdMap.
- F2 MAJOR: foreign non-safe-stem `*.json` in doc-data → listDocIds → remove → filePathOf throws → whole sweep aborts every load (before pin cleanup). Fix: filter listDocIds by isFilenameSafeDocId. Note: live-delete path in main.ts:100 HAS the guard — asymmetry was the tell.
- F3 MAJOR: importGuard scans only src/engine; engine now imports src/shared (unguarded purity claim in VaultPathFacts docstring).
- F4 MINOR: CanvasParseCache.evict unwired in main.ts rename/delete.
- F5 MINOR: Windows reserved device names (CON/NUL/COM1...) pass the filename-safety regex.
- F6 MINOR: backlinkSources flips provider permanently to inversion mode on a null-file query even when API works.
- F7 NIT: handleVaultDelete unconditional removePins write; hasPin unused.
- F8 NIT: future-version data.json/doc-data gets overwritten as v1 on next write (downgrade wipe); ok for v1, wants a WHY comment.

### Things I checked and found CLEAN (do not re-litigate)
- Q1/Q2/Q3 compliance all genuine (single cast in BacklinksAdapter.rawApiOf; step doc planning notes added; typed PersistableIdentity, no popups).
- Pin-on-toggle per-field semantics + absence=inherit round-trip: correct incl. empty→file-delete and equal-to-default-still-written test.
- GraphRequestAssembler per-field centralDepths precedence (`{...ownDepths, ...mainAdjusted}`) correct; main-pin skip; unresolvable-pin skip.
- ChunkedWork: real macrotask yield, no trailing yield, yields counted in sweep test (25 > batch 20).
- DocDataStore per-docid queue with `.catch` un-wedging; PluginDataStore serialized write chain.
- PathDocIdMap stale-pair handling on set/rename/delete.
- parseSizing wholesale-replacement repair (their "key fix 1") — verified correct against ViewSettingsResolver rationale.
- Engine changes are pure DRY extraction (FileKinds/VaultPathFacts), behavior-identical.
- Obsidian root-folder "/" → engine "" mapping handled + tested.

### If NEEDS_CHANGES fixes come back, re-check
1. F1: new test proves a pin added AFTER warm-up snapshot survives; ensure the guard consults pathDocIdMap (or re-resolves) at APPLY time, not plan time.
2. F2: listDocIds filter + test that a foreign file is left untouched AND the sweep still removes stale pins afterward (ordering: doc-data deletion precedes pin removal in apply()).
3. F3: guard scans src/shared, non-vacuous assertion for the new dir.
4. F4: evict wired for BOTH rename (old path) and delete; confirm no evict on unrelated extensions breaks nothing (it's a no-op map delete).
5. Re-run check/test/build and re-verify counts (were 287+69 at baseline; expect growth).
6. Confirm no scope creep beyond the requested fixes.

## Iteration 2 — verification pass (2026-07-17, fresh instance) — verdict READY

### Method (worth repeating next time)
- Empirical pre-fix check without touching the repo: `git archive e9e7d92 | tar -x` into
  scratchpad, symlink node_modules, overlay ONLY the new test files from `1f4d6ca`,
  run vitest on them. Result: 14 fail pre-fix / all pass post-fix. This proved:
  - F2 abort mode: all 8 pre-existing sweeper tests fail with the foreign file seeded.
  - F1 race: 3 failures INDEPENDENT of F2 (midSweepWriteFixture seeds no foreign file — verified via grep).
  - F6 flip test fails pre-fix.
- Re-ran check/test/build (`.tmp/verify-*.log`): all exit 0; root 297/30 (+10 as claimed), sublib 69/6.
- `git diff --diff-filter=D e9e7d92..1f4d6ca` empty; only removed `it(` is the importGuard
  engine-only test broadened to engine+shared.

### Key correctness reasoning recorded
- F1: isConfirmedOrphan placement is apply-time per-item; pin filter runs AFTER doc-data
  phase yields; no yield between filter and removePins (single-threaded, safe). Post-plan
  creations can't appear in plan drop lists → no residual window. Stale docids can't be
  wrongly kept (never warm-mapped; live delete unmaps).
- F6: constructor untouched (API-absent eager inversion pre-existing); short-circuit
  preserves both permanent-inversion modes; `[]` for null file is what the inversion
  would have answered anyway (resolved targets must exist) → no behavior change beyond fix.
- F5/F2 interplay: reserved-stem json in doc-data now unlisted — intended.
- F4 untested main.ts wiring: consistent with established pattern, accepted.

### Outcome
Appended "Verification pass (round 2)" to IMPLEMENTATION_REVIEW__PUBLIC.md: 8/8 RESOLVED,
0 new findings, READY. Open item for humans: real-Obsidian smoke run of debug command.
