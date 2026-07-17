# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (step-02-core-engine)

## Status
- Phase: PLANNING done → EXECUTING
- Branch: step-02-core-engine

## Plan

**Goal**: Pure engine under `src/engine/` (no obsidian/obsidian-id-lib/react), fully tested per step doc + CLARIFICATION decisions.

**Module map (all under src/engine/):**
1. `types.ts` — branded `VaultPath` (traversal key; honest name — attachments are files too), `DocId` (opaque), `FolderPath`, `Direction`, `DepthTag`, `AttachmentRef`, `GraphNode`, `GraphEdge`, `CentralNodeDescriptor {path, docid?, pinTimestamp?}`, `PinnedNodeDescriptor` (docid+pinTimestamp required — clarification Q1), settings types (`DepthSettings`, `DepthOverride`, `SizingMetricSetting`, `SizingSettings`, `ViewSettings`, `ViewSettingsOverride`), `NeighborhoodGraph` output.
2. `constants.ts` — DEFAULT_NODE_CAP=100, DEFAULT_OUTGOING_DEPTH=1, DEFAULT_INCOMING_DEPTH=1, DEFAULT_MIN_NODE_PX=40, DEFAULT_MAX_NODE_PX=160, DEFAULT_DEPTH_DECAY_K=1, NEUTRAL_NORMALIZED_VALUE=0.5, CENTRAL_SIZE_SCORE=1. Factories for default settings.
3. `LinkProvider.ts` — SYNC interface: `getOutgoingLinks(path)`, `getIncomingLinks(path)`, `getFileMetadata(path): FileMetadata|undefined`. `FileMetadata {folder, sizeBytes, isNodeBearing, attachments: AttachmentRef[]}` (attachments provider-owned: adapter knows embeds; DRY note). Sole Obsidian seam; OCP for canvas fallback.
4. `NodeEligibility.ts` — SRP class owning "is this path a node during traversal" (consumes provider flag; unknown → false). Human requirement Q4.
5. `FakeLinkProvider.ts` — fixture-driven; spec {files:[{path,sizeBytes?,nodeBearing?,image?}], links:{from:[to]}}; derives incoming by inversion, attachments from outgoing→non-node-bearing, folder=dirname, defaults nodeBearing by .md/.canvas ext, image by ext. Throws on undeclared link target (loud fixture bugs). Tracks query counts (for no-re-expansion test).
6. `NeighborhoodTraversal.ts` — multi-root × direction BFS; per-BFS visited map path→depth, never re-expand (clarification Q3); depth tags full maps + minDepth; edges deduped src→tgt; attachments+firstImage from metadata; roots w/o metadata or non-node-bearing skipped gracefully; docid echoed from descriptors.
7. `NodePriorityChain.ts` — ONE comparator (static class): minDepth asc → sizeScore desc → distanceToMain (finite beats undefined, asc) → pinTimestamp (recent wins, present beats absent) → docid lex asc (present beats absent) → path lex asc (determinism fallback beyond spec — non-pinned nodes lack docids; DOCUMENT deviation).
8. `NodeSizer.ts` — composable metrics: SizeMetric interface (id, normalizedValues(ctx)); OwnFileSize (log1p+minmax), TotalLinkerSize (log1p+minmax), BacklinkCount, OutlinkCount (minmax), DepthDecay (1/(1+k*minDepth), inherently normalized). Weighted avg of enabled → score→px range. max==min → NEUTRAL 0.5. Centrals: score=1→maxPx even when disconnected.
9. `GraphTruncator.ts` — cap on NON-central count; centrals exempt; distance-to-MAIN via undirected BFS over union edges; hiddenCountsByFolder; edges filtered to visible endpoints.
10. `TraversalSettingsResolver.ts` — per-root: own override field → global. Per-field absence=inherit.
11. `ViewSettingsResolver.ts` — per-field: MAIN → pinned gaps (conflict via NodePriorityChain on rankables built from descriptors: minDepth 0, sizeScore CENTRAL, distance undefined → collapses to recency→docid) → global. Fields: cap, groupByFolder, sizing (sizing = one field in V1; documented).
12. `NeighborhoodEngine.ts` — facade: build(request) = resolve settings → traverse → size → truncate → NeighborhoodGraph output (+resolved view settings echoed).
13. `index.ts` — public barrel, succinct API docs incl. step-03 adapter contract (ensureDocId awaited before persisting pin/override; docid-keyed persisted inputs translated to paths before engine).
14. `importGuard.test.ts` — recursive scan of src/engine for obsidian|obsidian-id-lib|react(-dom)? import/require/dynamic-import.

**Pipeline order**: settings → traverse → size (needed by truncation comparator) → truncate.

**Key decisions + rationale:**
- Brand named `VaultPath` not `NodePath`: attachments/images also carry it; naming must not lie (POLS).
- Attachments in FileMetadata (provider-owned): only the adapter can distinguish embeds vs links + owns extension rules; engine echoes. Spec text lists attachments under metadata.
- Deterministic final tiebreaker `path` added after docid: non-pinned nodes have no docid; spec demands "same input → same output". Deviation documented in PUBLIC.
- Centrals included in normalization pools, then overridden to CENTRAL_SIZE_SCORE=1 (KISS).
- Sizing = single pinnable field in view cascade V1 (per-metric pinning would be over-engineering now; resolver is per-field generic so it can split later).
- Backlink/outlink metrics measured via provider (global truth), outlink counts node-bearing targets only.
- No CHANGELOG entry from me — step not complete until review flow ends; flagged in PUBLIC.

**Commit plan** (prefix `step-02-core-engine:`):
1. types/constants/LinkProvider/NodeEligibility/FakeLinkProvider + tests
2. traversal + tests
3. priority chain + sizing + tests
4. truncation + tests
5. settings resolvers + tests
6. engine facade + index + import guard + integration tests
7. docs (PRIVATE/PUBLIC updates)

**Verification**: `/usr/local/bin/npm test` and `/usr/local/bin/npm run check`, output → .tmp/.

## Progress
- [x] Plan recorded
- [x] Commit 1 (types/provider/fake) — 29fe897
- [x] Commit 2 (traversal) — b6c83e9
- [x] Commit 3 (chain+sizing) — 96dc8f8
- [x] Commit 4 (truncation) — e3a59b2
- [x] Commit 5 (settings) — 133a154
- [x] Commit 6 (facade+guard+index, +@types/node) — 2003976
- [x] Full test + check green (npm test: 109 root + 69 sublib, exit 0; npm run check: exit 0)
- [x] PUBLIC written (1_IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md)

## Final state (for a clone)
- COMPLETE. All modules implemented as planned; deviations documented in PUBLIC
  (path tiebreaker after docid; provider-owned attachments; sizing = one cascade
  field in V1; depth defaults 1/1; @types/node devDep added).
- Gotchas hit during implementation (avoid repeats):
  - Tool JSON encoding turned a literal `backslash-u0000 (NUL escape)` into a raw NUL byte in
    NeighborhoodTraversal.ts (file became "binary"); fixed via python edit. The
    edge-dedupe key uses the escaped `backslash-u0000 (NUL escape)` separator (paths may contain spaces).
  - `ViewSettingsOverride` MUST stay `Partial<ViewSettings>` (type alias) — the
    generic per-field resolver in ViewSettingsResolver relies on it type-checking.
  - Use /usr/local/bin/npm AND /usr/local/bin/npx (bare wrappers hit a broken nvm hook).
  - importGuard.test.ts uses import.meta.url (not __dirname) + readdirSync
    recursive/parentPath (Node 26 here); needs @types/node for tsc.
- Nothing pending. Step ready for IMPLEMENTATION_REVIEW. CHANGELOG entry
  deliberately left for step-completion flow (see PUBLIC follow-ups).
