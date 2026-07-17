# IMPLEMENTATION REVIEW — Step 03: Obsidian Adapters + Persistence (PUBLIC)

Reviewer: IMPLEMENTATION_REVIEWER, 2026-07-17. Scope: `git diff 8e04df6..HEAD` excluding `.ai_out/`.

## Verdict: NEEDS_CHANGES

Overall quality is high — architecture, id-lib discipline, Q1/Q2/Q3 compliance and test
coverage are all genuinely strong. The verdict is driven by two MAJOR robustness findings
in the orphan sweep (the one component whose job is to be self-healing against messy
disk/vault state), plus one guard gap. All fixes are small and targeted (each < ~10 lines);
no redesign is needed.

## Findings

| ID | Severity | File:line | Issue | Suggested fix |
|---|---|---|---|---|
| F1 | MAJOR | `src/persistence/OrphanSweeper.ts:34-44` (`run`/`apply`) | **Sweep can delete a pin/doc-data created mid-sweep (silent data loss).** `liveDocids` is a snapshot from `vault.getFiles()` at warm-up start. A doc created AND pinned (or given per-doc settings) while the chunked warm-up is still yielding is read later (`pluginDataStore.pins()` / `listDocIds()` run AFTER warm-up), is absent from `liveDocids`, and is judged an orphan → its pin and doc-data file are dropped. Narrow window (the warm-up duration, ~15s after load), but it destroys an explicit user action with no trace. | Cheap re-verification at apply time: before dropping a docid, skip it when `pathDocIdMap.getPath(docid) !== undefined` (every write intent fills the map via `PersistenceServices.withPersistableIdentity`, so a just-pinned doc is always mapped) — or re-resolve via `vault.getFileByPath`. |
| F2 | MAJOR | `src/persistence/DocDataStore.ts:61-75` (`listDocIds`/`filePathOf`) + `OrphanSweeper.apply` | **A single foreign file in `doc-data/` permanently disables the sweep.** `listDocIds` returns ANY `*.json` stem as a "docid". A file we never wrote — e.g. a sync conflict artifact like `docid_x_e.sync-conflict-2026.json` or a hand-made file with spaces/dots — yields an unsafe stem; the sweep then calls `docDataStore.remove(stem)` → `filePathOf` throws "DocDataStore misuse" → `run()` rejects → caught in main.ts, logged, and the ENTIRE sweep (incl. stale-pin cleanup, which runs after doc-data deletion) is skipped on every load until the user manually deletes the file. This violates the codebase's own "malformed disk content never throws" philosophy, and note the live-delete path (`main.ts:100`) DOES guard with `isFilenameSafeDocId` — the sweep path forgot the same guard. | Filter in `listDocIds`: `.filter((stem) => DocPersistEligibility.isFilenameSafeDocId(stem))` (a non-safe stem cannot be a file this store wrote, so it is by definition not ours to manage). This also makes the method's name honest — it currently can return non-docids. |
| F3 | MAJOR | `src/engine/importGuard.test.ts:12` | **Engine purity guard no longer covers the whole engine import closure.** Step 03 made engine files import `../shared/*` (`FakeLinkProvider.ts`, `NeighborhoodTraversal.ts`), but the guard scans only `src/engine/`. An `obsidian` import added to `src/shared/` later would breach engine purity transitively and pass the guard silently — while `VaultPathFacts.ts` claims "PURE by contract" in prose only. The step-02 exit criterion (import-guarded engine) is thereby weakened without alignment. | Scan `src/shared/` with the same guard (add `SHARED_DIR` to `tsFilesUnder` inputs, plus a non-vacuous check), so the documented contract is enforced, not asserted. |
| F4 | MINOR | `src/adapters/CanvasParseCache.ts:29` + `src/main.ts:85-103` | **`evict()` is never wired** — the rename/delete vault handlers in main.ts don't call it, so the doc comment "Keep the cache honest across canvas deletes/renames (old path never revives)" is unfulfilled in production. Consequences: unbounded growth across a long session with canvas churn, and a stale-revival edge (path recreated with identical mtime — sync restores preserve mtimes). Today `evict` is effectively test-only dead code. | Call `canvasParseCache.evict(oldPath)` in the rename handler and `evict(path)` in `handleVaultDelete` (cheap, unconditional — non-canvas paths are no-ops). Alternatively remove the method and the comment's promise — but wiring is 2 lines. |
| F5 | MINOR | `src/persistence/DocPersistEligibility.ts:23` | `FILENAME_SAFE_DOCID_PATTERN` admits **Windows reserved device names** (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`, case-insensitive) — `CON.json` is unwritable/hangs on Windows. The comment claims "no Windows-reserved characters", which is true of characters but not names. Only reachable via a foreign docid exactly matching a device name (unlikely, but the whole Q3 mechanism exists for hostile foreign ids). | Add a reserved-basename rejection (case-insensitive set check) to `isFilenameSafeDocId`; a foreign id `CON` then gets the honest `unsafe-docid` emblem instead of a write error. |
| F6 | MINOR | `src/adapters/ObsidianLinkProvider.ts:132-144` (`backlinkSources`) | Querying incoming links for a path with no vault file (`file === null`) builds and **memoizes the resolvedLinks inversion, permanently flipping the provider into inversion mode** even when the backlinks API works — the "unrecognized shape" escape hatch also triggers on mere file-not-found. Impact is small (providers are per-build), but the mode flip is accidental, not designed. | Return `[]` for `file === null` (a nonexistent file has no cache-known backlinks); build/memoize the inversion only for API-absent or unrecognized-shape cases. |
| F7 | NIT | `src/main.ts:94-103` + `src/persistence/PluginDataStore.ts:35` | `handleVaultDelete` calls `removePins` unconditionally → every delete of a mapped doc triggers a `data.json` write even when the doc was never pinned. `hasPin` exists and is production-unused. | Guard: `if (this.pluginDataStore.hasPin(docid)) await this.pluginDataStore.removePins([docid]);` — removes a needless write AND gives `hasPin` its caller. |
| F8 | NIT | `src/persistence/persistedShapes.ts:73,86` + `DocDataStore.update:44` | Forward-version handling is destructive-on-write: a `version: 2` data.json parses to defaults, and the next global-setting save overwrites the v2 file (pins included); likewise `update` on an unparseable/future-version doc-data file rewrites it as v1. Fine while only v1 exists — but worth an explicit WHY/WHY-NOT note (or a preserve-unknown-version read-only stance) before v2 ever ships, so a downgraded install doesn't wipe newer data. | Document the accepted tradeoff at the parser (1-line WHY comment) or carry raw-unknown data through; no code change required for this step. |

## Requirements coverage checklist

| Item | Status | Evidence |
|---|---|---|
| `ObsidianLinkProvider`: outgoing via resolvedLinks/getFileCache, incoming via getBacklinksForFile per visited node | MET | `src/adapters/ObsidianLinkProvider.ts`; ordering from `getFileCache` (`ReferenceOrder`), resolution via `getFirstLinkpathDest`, resolvedLinks-keys fallback for cache-less files; per-node backlink queries (bounded by cap). Tests: `ObsidianLinkProvider.test.ts` (17 cases). |
| Canvas capability detection + fallback parser (file-nodes only, text-node wikilinks skipped, malformed no-throw) | MET | `CanvasCapability.ts` (build-time detection), `CanvasFallbackParser.ts` (V1 scope honored, `console.error` + `[]` on malformed), dormant-when-core-indexed incl. a no-double-report test. Fixtures `board.canvas` + `malformed.canvas`. |
| Q1 backlinks wrapper: single isolated cast, runtime presence check, inversion fallback | MET | `BacklinksAdapter.ts` — one `rawApiOf` cast, `isAvailable` presence check, Map/Record shape tolerance, `null` → inversion (`invertResolvedLinks`, built once). But see F6 for an accidental extra inversion trigger. |
| Q2 devtools result recorded in step doc | MET | `docs-internal/plan/steps/step-03-adapters-and-persistence.md` "Step-planning notes" item 1 (result 0, caveat included). |
| id-lib: `createDefault`, getDocId on read/bulk only, ensureDocId only on write intent, null graceful | MET | `main.ts:36` `DocIdServices.createDefault(this.app.vault)`; grep confirms the ONLY `ensureDocId` call site is `PersistenceServices.withPersistableIdentity`; builder+sweeper use `getDocId`; tests assert `ensureCalls === 0` on read paths (`FakeDocIdPort`). Null → `no-docid` verdict, nothing persisted, graph still builds. |
| Q3 unsafe-docid: refuse with typed reason, no popups | MET | `DocPersistEligibility.ts` (`PersistableIdentity`, reasons `no-docid`/`unsafe-docid`); refusals persist nothing (`PersistenceServices.test.ts`); no Notice/popup anywhere in the diff. F5 is a small hole in the safety pattern itself. |
| Versioned shapes from day one; defensive parsing | MET | `persistedShapes.ts` (`PERSISTED_SHAPE_VERSION = 1` on every shape; per-field survival; sizing repaired to a COMPLETE shape — a real correctness catch vs. the WIP). Tests: `persistedShapes.test.ts` (foreign version, mangled fields, sizing repair). F8 notes the future-version write-back tradeoff. |
| data.json: globals + pins with timestamps | MET | `PluginDataStore.ts`; re-pin refreshes timestamp; serialized write chain. |
| Per-doc files via `vault.adapter.write`, one file per doc | MET | `DocDataStore.ts` (per-docid serialized RMW, doc A never rewrites doc B — asserted in test; empty → file deleted). `main.ts` passes `this.app.vault.adapter`. |
| Pin-on-toggle per-field semantics, absence = inherit | MET | `DocDataMutations.ts` + test "field equal to global default is still written"; `undefined` removes field; empty file deleted (absence = inherit round-trip). |
| Delete handling: `vault.on('delete')` + path→docid map | MET | `main.ts:90-103` + `PathDocIdMap.ts` (bidirectional, stale-pair-safe, rename moves entry). Sweep is the backstop for unmapped paths. F7 nit on redundant writes. |
| Orphan sweep: delayed ~15s, chunked with yields, drops exactly orphans | PARTIAL | Mechanism correct and well-tested (25-file fixture, yield counter, exact-orphan asserts, read-only warm-up). F1 (mid-sweep write race) and F2 (foreign file aborts the sweep) are the two MAJOR robustness gaps. |
| Debug harness (exit criterion) | MET | `main.ts` command "Debug: log neighborhood graph for active file" (summary + node/edge tables). Real-Obsidian human smoke run still pending per IMPLEMENTATION notes — flagged there, acceptable. |
| Out of scope respected (no rebuild pipeline, no settings UI) | MET | No debouncing/rebuild events; no settings UI; typed load/save APIs + public plugin fields only. |
| Adapters thin, branching in pure tested functions | MET | Parsers/planner/assembler/mutations/eligibility are pure classes with dedicated tests; adapters and main.ts are wiring. Engine guard still green — but see F3 for its now-incomplete coverage. |
| No lost functionality / removed tests | MET | `git diff --diff-filter=D` → zero deleted files; engine changes are pure DRY extraction to `src/shared/` (behavior-identical, still covered). |

## Test verification results

Commands run from repo root (outputs in `.tmp/review-*.log`):

- `/usr/local/bin/npm run check` → exit 0 (tsc clean).
- `/usr/local/bin/npm test` → exit 0. Root: **30 files / 287 tests passed**; sublib obsidian-id-lib: **6 files / 69 tests passed**. Matches IMPLEMENTATION's claimed counts exactly.
- `/usr/local/bin/npm run build` → exit 0 (bundle + artifacts copied to .dev-vault).
- No `sanity_check.sh` present in the repo.

Test quality: consistent BDD `WHEN/THEN`, ~one assert per test, structural fakes only (zero `obsidian` runtime mocks), shared fixture builders — meets CLAUDE.md standards.

## #QUESTION_FOR_HUMAN

None. (F1/F2 fixes are within already-approved scope; no requirement deviations proposed.)

## Requested changes (summary for IMPLEMENTATION)

1. F1 — apply-time orphan re-verification via `PathDocIdMap` (with a test: pin added after warm-up snapshot survives the sweep).
2. F2 — `listDocIds` filters non-filename-safe stems (with a test: foreign `weird name.json` in doc-data neither throws nor is touched, sweep still completes pin cleanup).
3. F3 — extend the import guard to `src/shared/`.
4. F4 — wire `canvasParseCache.evict` into rename/delete handlers (or remove the promise).
5. F5–F8 — at implementer's discretion this step; if deferred, note them (F8 needs only a WHY comment).

---

# Verification pass (round 2)

Fresh IMPLEMENTATION_REVIEWER instance, 2026-07-17. Scope: verify F1–F8 fixes in
`1f4d6ca` (+docs `82667e8`). Method: full diff inspection, full re-read of
`OrphanSweeper.ts` and `ObsidianLinkProvider.ts`, re-run of check/test/build, and an
**empirical pre-fix regression run**: extracted the pre-fix tree (`e9e7d92`) via
`git archive` into the scratchpad, overlaid ONLY the new test files, ran them.

## Empirical regression evidence (strongest signal)

Against pre-fix production code: **14 tests fail** exactly along the reported
failure modes; against fixed code all pass.

- All 8 pre-existing sweeper tests fail under the seeded foreign json — precisely the
  F2 "whole sweep aborts" mode.
- All 3 F1 race tests fail — and the `midSweepWriteFixture` does NOT seed the foreign
  file, so these failures are purely the snapshot race, independent of F2.
- F2's two dedicated tests (store-level omission + sweep-survives) fail.
- F6's inversion-flip test fails.

## Per-finding verdicts

| ID | Verdict | Evidence |
|---|---|---|
| F1 (MAJOR, sweep snapshot race) | **RESOLVED** | `OrphanSweeper.isConfirmedOrphan` consults `pathDocIdMap.getPath` at APPLY time (per-item inside the chunked callbacks; pin filter runs after the doc-data phase's yields) — exactly the requested placement. Extension to `centralDepths` strips is sound symmetry, disclosed, minimal. 3 regression tests empirically fail pre-fix. Post-plan creations can't be in the plan's drop lists, so plan/apply windows are both covered. |
| F2 (MAJOR, foreign json aborts sweep) | **RESOLVED** | `listDocIds` filters stems via `isFilenameSafeDocId` with a WHY doc; foreign file seeded into the SHARED sweeper fixture, so every pre-existing test co-asserts "sweep completes despite it" — pin cleanup ordering concern (doc-data deletion precedes pin removal) is thereby covered. Empirically fails pre-fix (all 8 + 2 tests). |
| F3 (MAJOR, guard misses src/shared) | **RESOLVED** | `GUARDED_DIRS = [engine, shared]`, dedicated non-vacuous test for src/shared, header comment updated. The removed `it(` is the old engine-only assertion broadened to both dirs — strengthening, not loss. |
| F4 (MINOR, evict unwired) | **RESOLVED** | `evict(oldPath)` on rename, `evict(path)` first in `handleVaultDelete` — both handlers, unconditional no-op for non-canvas (commented). No unit test is consistent with the untested-wiring pattern for main.ts; acceptable. |
| F5 (MINOR, Windows reserved names) | **RESOLVED** | `WINDOWS_RESERVED_BASENAME_PATTERN` (`CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]`, `/i`) rejected in `isFilenameSafeDocId`; tests cover rejection, case-insensitivity, and no over-blocking (`CONSOLE`). Interplay with F2: a reserved-stem json in doc-data is now also unlisted — correct (never ours). |
| F6 (MINOR, permanent inversion flip) | **RESOLVED** | Restructured `backlinkSources`: inversion short-circuit first (preserves constructor-time API-absent mode and shape-trouble memoization), `file === null` → `[]` with WHY comment. `[]` is semantically right: a nonexistent file cannot be a resolved-link target, so the old inversion answer was `[]` anyway — no behavior lost. Test empirically fails pre-fix. |
| F7 (NIT, unconditional removePins write) | **RESOLVED** | `hasPin` guard in `handleVaultDelete`; sync in-memory check immediately before the awaited write — no interleaving window. `hasPin` gains its production caller. |
| F8 (NIT, forward-version downgrade wipe) | **RESOLVED** | WHY-NOT comment at `PERSISTED_SHAPE_VERSION` naming the accepted downgrade-then-write behavior and the v2 obligation — doc-only, as requested. |

## New findings introduced by fixes

None. Specifically checked: F1's per-item re-check cannot resurrect genuinely stale
docids (never warm-mapped, removed from map on live delete); F6's unconditional
`invertedIncoming = ...` assignment is single-shot behind the early return; F2/F5
filter composition; no deleted files, no removed behavior tests, no scope creep
beyond the disclosed centralDepths symmetry in F1.

## Commands re-run (outputs in `.tmp/verify-*.log`)

- `/usr/local/bin/npm run check` → exit 0.
- `/usr/local/bin/npm test` → exit 0. Root **30 files / 297 tests** (+10, matches
  claim); sublib **6 / 69** (unchanged).
- `/usr/local/bin/npm run build` → exit 0.
- Pre-fix overlay run (scratchpad): 14 failed / 26 passed — expected pre-fix shape.

## Readiness signal

**READY.** 8/8 findings genuinely resolved; regression tests empirically capture the
original failure modes; no new issues. The pre-existing note stands: human smoke run
of the debug command in real Obsidian remains pending (environment limitation).
