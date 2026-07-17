# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (Step 03)

Status: PLANNING COMPLETE, implementation starting. Rehydrate here.

## Goal
Step 03: ObsidianLinkProvider (sync queries, async construction), canvas capability
detection + fallback parser (ACTIVE on target install per CLARIFICATION Q2),
obsidian-id-lib integration, versioned persistence (data.json + per-doc files),
delete/rename handling, delayed chunked orphan sweep, main.ts wiring + debug command,
step-doc devtools note. Code in src/adapters/ + src/persistence/ (engine is import-guarded).

## Binding decisions absorbed
- Q1: getBacklinksForFile via ONE narrow typed cast in one adapter file + runtime
  presence check; fallback = invert public resolvedLinks (index built at construction).
- Q2: target install has NO .canvas keys in resolvedLinks → fallback parser is the
  ACTIVE path; record finding in step doc planning notes. mtime-cached parses.
- Q3: unsafe docid → REFUSE per-doc persistence AND pinning; typed non-persistable
  result with reason ("no-docid" | "unsafe-docid") for future UI emblem. No popups.
- Planning defaults: getFileCache links/embeds(+frontmatterLinks) for true reference
  order; resolvedLinks only for resolution/canvas-core; path→docid map warmed by sweep
  + lazily filled; centralDepths cleanup left to sweep; no root obsidian vitest mock —
  use structural PORTS instead (methods are bivariant so real obsidian objects satisfy
  them; tests use plain fakes; zero runtime obsidian import in tested files).

## Architecture (key insight)
getFileCache / resolvedLinks / getBacklinksForFile / getFileByPath are all SYNC at
runtime → provider answers queries lazily-sync against live cache. Async construction
only does what MUST be async/upfront: (a) fallback canvas file reads+parse (mtime
cache), (b) resolvedLinks inversion when backlinks API absent. Honors step-02 Q2.

## File plan

### src/shared/ (pure, importable by engine — import guard only bans obsidian/react/id-lib)
- `vaultPathFacts.ts` — static class `VaultPathFacts`: extensionOf, folderOf, titleOf.
  DRYs step-02 ITERATION finding 4 (FakeLinkProvider extensionOf/folderOf +
  NeighborhoodTraversal titleOf + step-03 = 3rd consumer). Refactor those two engine
  files to use it.
- `fileKinds.ts` — static class `FileKinds`: isNodeBearing(ext) [md,canvas],
  isImage(ext) [png,jpg,jpeg,gif,svg,webp]. FakeLinkProvider + ObsidianLinkProvider
  both consume → single source of the knowledge.

### src/adapters/
- `obsidianPorts.ts` — structural ports: VaultFilePort {path, extension, stat{mtime,size},
  parent: {path}|null}, VaultPort {getFileByPath, getFiles, cachedRead},
  MetadataCachePort {resolvedLinks, getFileCache, getFirstLinkpathDest},
  CachedMetadataPort {links?, embeds?, frontmatterLinks?}, ReferencePort {link,
  position.start.offset}, FrontmatterLinkPort {link}. Real obsidian objects satisfy
  structurally (method bivariance). DocIdPort {getDocId, ensureDocId, isEligible}
  (DocIdService satisfies).
- `ReferenceOrder.ts` — pure static: ordered link strings from cache ports
  (frontmatterLinks first, then links+embeds merged by position.start.offset).
- `BacklinksAdapter.ts` — THE single cast file (Q1). Runtime presence check for
  getBacklinksForFile; pure `extractBacklinkSourcePaths(result: unknown)` handling
  Map-shaped `.data` (has .keys()) and Record-shaped `.data`; absent → null.
- `CanvasFallbackParser.ts` — pure static: parseFilePaths(raw): string[] — file-type
  nodes only in node-array order, text nodes skipped (V1), malformed JSON →
  console.error + [] (never throws), non-object/missing nodes tolerated.
- `CanvasParseCache.ts` — mtime-keyed cache: getFilePaths(file, readText) reparses only
  on mtime change. Long-lived (plugin-owned), survives across provider builds.
- `CanvasCapability.ts` — pure static: detect(resolvedLinkKeys): "core-indexed" |
  "fallback-required" (any key ends with ".canvas"). Caveat: empty-canvas-vault reads
  as fallback-required → harmless (nothing to parse).
- `ObsidianLinkProvider.ts` — implements engine LinkProvider. static async
  `create(vault: VaultPort, metadataCache: MetadataCachePort, canvasCache)`:
  detect capability; if fallback → parse all .canvas files → canvasOutgoing map +
  inverted canvasIncoming; presence-check backlinks → else build inverted
  resolvedLinks index. Sync queries:
  - outgoing(md): ReferenceOrder → getFirstLinkpathDest resolve → drop unresolved →
    dedupe first-occurrence.
  - outgoing(canvas): core → Object.keys(resolvedLinks[path]); fallback → parsed paths
    filtered to existing files, dedupe.
  - incoming: backlinks wrapper (sync per visited node — bounded by cap) OR inverted
    index; PLUS canvasIncoming merge when fallback active (dedupe).
  - metadata: getFileByPath → undefined if null; folder: parent "/"→"" mapping;
    sizeBytes stat.size; isNodeBearing via FileKinds; attachments = outgoing refs
    resolving to non-node-bearing files, in order, isImage via FileKinds.
- `GraphRequestAssembler.ts` — PURE static: docid-keyed persisted data → path-keyed
  GraphBuildRequest. Inputs: mainPath, mainDocId|null, mainDocData|null,
  pins+resolvePath fn (or prebuilt docid→path map), docDataByDocid, globals.
  Rules: unresolvable pin skipped (sweep cleans); pin whose path === mainPath skipped
  (already central); depthOverridesByRoot per root = own DocData.depths, with main's
  centralDepths[pinDocid] winning PER-FIELD for pinned roots; mainViewOverride /
  pinnedViewOverrides from DocData.view.
- `NeighborhoodGraphBuilder.ts` — thin async orchestration for the debug command &
  step-04: create provider → resolve main docid (getDocId, read-only) → load doc data
  → assemble → engine.build.

### src/persistence/
- `persistedShapes.ts` — types + PERSISTED_SHAPE_VERSION=1. PluginData {version,
  globalDepths: DepthSettings, globalView: ViewSettings, pins: PinnedDocEntry[]
  {docid, pinTimestamp}}. DocData {version, depths?: DepthOverride, view?:
  ViewSettingsOverride, centralDepths?: Record<docid, DepthOverride>}. Static class
  `PersistedShapes`: parsePluginData(unknown)→PluginData (malformed/unknown version →
  fresh defaults from EngineDefaults), parseDocData(unknown)→DocData|null (never
  throws), defaults factory.
- `DocPersistEligibility.ts` — Q3. Type `PersistableIdentity = {kind:"persistable",
  docid} | {kind:"not-persistable", reason:"no-docid"|"unsafe-docid"}`. Static:
  isFilenameSafeDocId = /^[A-Za-z0-9_-]{1,200}$/ (no dots → no "..", no separators,
  generated docid_..._e passes), classify(docid: string|null).
- `PluginDataStore.ts` — port {loadData(), saveData()} (Plugin satisfies). init()
  loads+parses; typed getters; saveGlobalSettings/-Depths, addPin(docid, ts),
  removePin, hasPin; serialized writes.
- `DocDataMutations.ts` — pure static per-field merges: setDepthField(doc, field,
  value|undefined), setViewField(doc, key, value|undefined), setCentralDepth(doc,
  centralDocid, override|undefined), isEmpty(doc). Pin-on-toggle: presence=pinned even
  when equal to default; undefined removes field (revert to inherit).
- `DocDataStore.ts` — port over DataAdapter {exists, read, write, remove, mkdir, list}.
  Dir passed in (main computes `${manifest.dir}/doc-data`). load(docid), update(docid,
  mutate fn) with per-docid promise queue (RMW race guard), remove(docid),
  listDocIds() (*.json in dir). Only accepts filename-safe docids (guarded by callers
  via DocPersistEligibility; store re-asserts → throws on programmer error).
- `PathDocIdMap.ts` — bidirectional in-memory path↔docid; set/getDocId(path)/
  getPath(docid)/handleRename(old,new)/handleDelete(path).
- `ChunkedWork.ts` — static forEachChunked(items, batchSize, fn, yieldFn=sleep0).
  SWEEP_BATCH_SIZE=20, SWEEP_DELAY_MS=15_000 live in OrphanSweeper.
- `SweepPlanner.ts` — pure static computeSweepPlan(knownDocids: Set, docDataDocids,
  pinnedDocids, centralDepthsByOwner) → {docDataToDelete, pinsToRemove,
  centralDepthOwnersToClean: Map<owner, staleCentralDocids[]>}.
- `OrphanSweeper.ts` — warm phase: iterate vault.getFiles() filtered by
  docIdPort.isEligible, chunked, getDocId (READ-ONLY) each → fill PathDocIdMap +
  known-docid set. Then plan (pure) + apply (chunked): delete orphan doc-data files,
  remove stale pins, strip dangling centralDepths entries. yieldFn injectable for
  tests.
- `PersistenceServices.ts` — facade wiring for main + step-04/06 typed API:
  pinDoc(file) [ensureDocId → classify → typed refusal or persist pin+timestamp],
  unpinDoc(docid) [pin removed; centralDepths left to sweep], setDocDepthField /
  setDocViewField / setCentralDepth (all ensureDocId-on-write-intent + classify),
  loadDocData(docid), global settings passthrough. Registers nothing itself.

### src/main.ts wiring
- onload: PluginDataStore.init (await loadData); CanvasParseCache; DocDataStore with
  `${this.manifest.dir}/doc-data` (fallback `${vault.configDir}/plugins/<id>/doc-data`);
  PathDocIdMap; PersistenceServices; registerEvent vault.on("delete") → live cleanup
  (map lookup → remove pin + doc-data + map entry; unmapped path → sweep backstop) and
  vault.on("rename") → map path update; sweep timer window.setTimeout(SWEEP_DELAY_MS),
  cleared in onunload; debug command "debug-log-neighborhood-graph" → builds graph for
  active file via NeighborhoodGraphBuilder, console.log summary (exit criterion
  harness).
- Dev vault: enrich note1/note2 + note3 + attachment + test.canvas so the human's
  debug command run shows a real graph.

### Step doc update
docs-internal/plan/steps/step-03-adapters-and-persistence.md — record Q2 devtools
finding under open item 1 (0 .canvas keys on target install → fallback parser ACTIVE;
zero-canvas-vault caveat noted; adaptive detection unchanged).

## Tests (vitest, BDD WHEN/THEN, mostly one assert, ports/fakes, no obsidian mock)
- shared: vaultPathFacts.test.ts, fileKinds.test.ts (small).
- adapters: ReferenceOrder.test, BacklinksAdapter.test (Map-shape, Record-shape,
  absent→null), CanvasFallbackParser.test against REAL fixture .canvas files in
  src/adapters/testFixtures/ (valid mixed nodes, text-with-wikilinks skipped,
  malformed → [] no-throw, empty), CanvasParseCache.test (mtime hit/miss),
  CanvasCapability.test (keys present/absent — "provider variants with canvas entries
  deliberately absent"), ObsidianLinkProvider.test (order, unresolved dropped, dedupe,
  attachments+firstImage order, incoming via fake backlinks / via inversion, canvas
  core vs fallback incl. incoming merge, metadata root-folder mapping, unknown path →
  undefined), GraphRequestAssembler.test (pin resolution, skip unresolvable, skip
  main-as-pin, per-field centralDepths precedence, view overrides).
- persistence: persistedShapes.test (round-trip, bad version → defaults/null,
  malformed → no throw), DocPersistEligibility.test, DocDataMutations.test
  (pin-on-toggle equal-to-default written; undefined unsets), DocDataStore.test
  (fake adapter: round-trip, per-doc isolation, queue), PluginDataStore.test,
  SweepPlanner.test (exactly the orphans dropped), OrphanSweeper.test (fixture with
  orphaned doc-data + stale pins + dangling centralDepths; yield counting via injected
  yieldFn; delay NOT tested here — timer lives in main).

## Milestone commits
1. shared extraction + engine refactor (FakeLinkProvider, NeighborhoodTraversal) — tests green.
2. canvas parser + cache + capability + fixtures + tests.
3. ports + ReferenceOrder + BacklinksAdapter + ObsidianLinkProvider + tests.
4. persistence shapes + eligibility + mutations + stores + tests.
5. PathDocIdMap + ChunkedWork + SweepPlanner + OrphanSweeper + tests.
6. GraphRequestAssembler + NeighborhoodGraphBuilder + PersistenceServices + main.ts
   wiring + dev vault fixtures + step-doc note.
7. exit docs (PUBLIC/PRIVATE) + final check/test/build.

## Commands
- /usr/local/bin/npm run check   (bare npm flaky in this env)
- /usr/local/bin/npm test        (root vitest + sublib)
- /usr/local/bin/npm run build   (tsc + esbuild → copies to .dev-vault)
- redirect verbose output to .tmp/

## Gotchas
- TFile.parent.path === "/" at vault root; engine FolderPath root is "" → map.
- resolvedLinks values are Records keyed by TARGET path (already resolved).
- isolatedModules → `export type` for type-only re-exports.
- noUncheckedIndexedAccess → index access yields T|undefined.
- Import guard scans src/engine only; src/shared must stay pure anyway (engine imports it).
- Engine baseline: 136 root tests / 10 files + 69 sublib — must stay green.
