# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (Step 03)

Status: COMPLETE + ITERATION DONE (READY). All 7 milestones + review-fix commit
`1f4d6ca` on `03-adapters-and-persistence`; git clean.
(Instance 2 — rehydrated after predecessor died mid-milestone-4; adopted its plan wholesale.
Instance 3 — ITERATION phase after reviewer NEEDS_CHANGES.)

## ITERATION (instance 3) — review findings F1–F8: 8 incorporated / 0 rejected
See IMPLEMENTATION_ITERATION__PUBLIC.md for the disposition table. Key facts for a clone:
- All 8 findings re-verified against source; all factually correct. Failing tests
  written FIRST for F1/F2/F5/F6 (confirmed failing, then fixed).
- F1: `OrphanSweeper.apply` per-item `isConfirmedOrphan(docid)` = map-miss check
  (`pathDocIdMap.getPath === undefined`). Extended beyond reviewer's suggestion to
  ALSO cover stale centralDepths strips (symmetry — one rule for all three drop kinds).
  Test fixture `midSweepWriteFixture`: yield callback simulates a write intent
  (map.set + addPin + docDataStore.update) on FIRST warm-up yield; new doc absent
  from vault fake = created after snapshot.
- F2: `listDocIds` filters via `DocPersistEligibility.isFilenameSafeDocId`. The
  foreign file `docid_note0_e.sync-conflict copy.json` is now PERMANENTLY part of
  `sweptFixture` (before fix it made all 8 existing sweeper tests fail — great
  demonstration; keep it there).
- F3: importGuard `GUARDED_DIRS = [ENGINE_DIR, SHARED_DIR]` + shared non-vacuous test.
- F5: reserved-basename regex is case-insensitive, exact-match only (CONSOLE passes).
- F6: `backlinkSources` order now: inversion-mode short-circuit → file null → [] →
  API → shape-fallback builds inversion. Test relies on empty resolvedLinks so
  inversion would answer [] — proving API still serves.
- F7/F4: main.ts only (untested wiring by ports-pattern design — deliberate, noted
  in ITERATION PUBLIC).
- F8: doc-only WHY-NOT at PERSISTED_SHAPE_VERSION.

## Goal (done)
Step 03: ObsidianLinkProvider, canvas fallback (ACTIVE on target install, Q2),
obsidian-id-lib integration, versioned persistence (data.json + per-doc files),
delete/rename handling, delayed chunked orphan sweep, main.ts wiring + debug command,
step-doc devtools note.

## Binding decisions absorbed (unchanged from predecessor)
- Q1: getBacklinksForFile via ONE cast in BacklinksAdapter + runtime presence check;
  fallback = invert resolvedLinks at provider construction.
- Q2: fallback canvas parser is ACTIVE path on target install; finding recorded in
  step doc "Step-planning notes" section (open items 1-4 all resolved there).
- Q3: unsafe/no docid → typed `PersistableIdentity` refusal; nothing persisted; no popups.
- Ports pattern (no obsidian vitest mock): structural ports + bivariant methods; real
  Vault/MetadataCache/DataAdapter/Plugin/DocIdService satisfy unchanged.

## What I (instance 2) did beyond adopting the plan
- Reviewed predecessor's untracked milestone-4 WIP: kept nearly all of it. Fixed:
  - `parseViewOverride` had a LYING cast of raw record → SizingSettings. Real bug:
    sizing replaces defaults WHOLESALE in ViewSettingsResolver cascade, so a partial
    persisted sizing would crash NodeSizer. Replaced with `parseSizing` that repairs
    per-field onto EngineDefaults sizing (complete shape out, non-object → inherit).
    +3 tests.
  - `toSorted()` (not in tsc lib) → `[...].sort()` in DocDataStore.test.
- Extracted FakePluginDataPort (was inline in PluginDataStore.test) — reused by
  OrphanSweeper/PersistenceServices/NeighborhoodGraphBuilder tests.
- Added FakeDocIdPort (src/adapters/) with `ensureCalls` counter + `markUnidentifiable`
  — lets tests assert read-paths never mint ids.

## Final architecture / files (all committed)
- Milestones 1-3 (predecessor commits c736105, f4d9363, bf05093): src/shared/
  {VaultPathFacts,FileKinds}, src/adapters/{obsidianPorts, ReferenceOrder,
  BacklinksAdapter, CanvasFallbackParser, CanvasParseCache, CanvasCapability,
  ObsidianLinkProvider, FakeObsidianPorts} + fixtures.
- Milestone 4 (0ca7a68): src/persistence/{persistedShapes, DocPersistEligibility,
  DocDataMutations, storagePorts, PluginDataStore, DocDataStore, FakeFileStorage} + tests.
- Milestone 5: src/persistence/{PathDocIdMap, ChunkedWork, SweepPlanner, OrphanSweeper,
  FakePluginDataPort} + src/adapters/FakeDocIdPort + tests. SWEEP_DELAY_MS=15_000
  (exported, used by main), SWEEP_BATCH_SIZE=20 (private to sweeper). Yield only at
  batch boundaries, never after last item. OrphanSweeper reads centralDepths only for
  LIVE owners (orphan files deleted whole).
- Milestone 6: src/adapters/{GraphRequestAssembler (pure), NeighborhoodGraphBuilder},
  src/persistence/PersistenceServices + tests. PersistenceServices is the ONLY
  ensureDocId call site; every doc-scoped write returns PersistableIdentity; global
  settings go straight through PluginDataStore (no passthrough duplication).
  Assembler: unresolvable pin skipped; main-as-pin skipped; pinned root depths =
  {...ownDepths, ...mainDocData.centralDepths[pinDocid]} per-field.
- Milestone 6b: main.ts wiring (rename/delete handlers, sweep timer cleared in
  onunload, doc-data dir = `${manifest.dir ?? configDir/plugins/id}/doc-data`,
  debug command `debug-log-neighborhood-graph` with console.table output);
  step-doc planning notes; .dev-vault fixtures (note1..3, pic.png, test.canvas) —
  NOTE: .dev-vault/ is gitignored, fixtures live only on this machine.

## Gotchas (carry forward)
- TFile.parent.path "/" at root vs engine FolderPath "" — mapped in provider.
- isolatedModules → `export type`; noUncheckedIndexedAccess everywhere.
- `/usr/local/bin/npm` and `/usr/local/bin/npx` (bare npm/npx broken in this env).
- DocDataStore THROWS on unsafe docid (programmer-error re-assertion); every caller
  gates via DocPersistEligibility first (builder, main delete handler do).
- Delete of a doc never visited before sweep warm-up → map miss → sweep is backstop.
- Pins are invisible in graphs until the map knows their path (sweep at 15s or any
  write intent). Documented in GraphRequestAssembler WHY.
- .dev-vault gitignored — debug fixtures are untracked by design.

## Test counts (final, all green)
- Root: 297 tests / 30 files (287 at review + 10 iteration regression tests).
- Sublib obsidian-id-lib: 69 tests / 6 files.
- Commands: `/usr/local/bin/npm run check`, `/usr/local/bin/npm test`,
  `/usr/local/bin/npm run build` (green; copies to .dev-vault plugin dir).

## Follow-ups (not tickets yet, listed in PUBLIC)
- Human should run the debug command + observe sweep in real Obsidian (exit criteria
  "real vault" halves — everything automated here runs over structural fakes).
- Step 04 consumes: plugin.graphBuilder, plugin.persistenceServices,
  plugin.pluginDataStore (public fields on NeighborhoodGraphPlugin).
