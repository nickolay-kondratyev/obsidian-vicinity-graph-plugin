# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (Step 03)

Status: COMPLETE. All 7 milestones committed on `03-adapters-and-persistence`; git clean.
(Instance 2 — rehydrated after predecessor died mid-milestone-4; adopted its plan wholesale.)

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
- Root: 287 tests / 30 files (was 136/10 at step-02 exit → step 03 added 151).
- Sublib obsidian-id-lib: 69 tests / 6 files.
- Commands: `/usr/local/bin/npm run check`, `/usr/local/bin/npm test`,
  `/usr/local/bin/npm run build` (green; copies to .dev-vault plugin dir).

## Follow-ups (not tickets yet, listed in PUBLIC)
- Human should run the debug command + observe sweep in real Obsidian (exit criteria
  "real vault" halves — everything automated here runs over structural fakes).
- Step 04 consumes: plugin.graphBuilder, plugin.persistenceServices,
  plugin.pluginDataStore (public fields on NeighborhoodGraphPlugin).
