# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC (step-02-core-engine)

Status: **COMPLETE**. Full suite green, typecheck green, all work committed on `step-02-core-engine`.

## What was built — module map (`src/engine/`)

| Module | Responsibility |
|---|---|
| `types.ts` | Domain vocabulary: branded `VaultPath` (traversal key), opaque `DocId`, `FolderPath`, `DepthTag` (full per-root × per-direction), `AttachmentRef`, `GraphNode`, `GraphEdge`, `CentralNodeDescriptor {path, docid?, pinTimestamp?}`, `PinnedNodeDescriptor` (docid + pinTimestamp REQUIRED), settings shapes, `NeighborhoodGraph` output |
| `constants.ts` | `DEFAULT_NODE_CAP=100`, depth defaults (1/1), px range (40/160), `DEFAULT_DEPTH_DECAY_K=1`, `NEUTRAL_NORMALIZED_VALUE=0.5`, `CENTRAL_SIZE_SCORE=1`, `EngineDefaults` factory |
| `LinkProvider.ts` | THE sole Obsidian seam — SYNC, path-keyed: `getOutgoingLinks`, `getIncomingLinks`, `getFileMetadata` (folder, sizeBytes, isNodeBearing flag, attachments). Shaped so step-03's `ObsidianLinkProvider` AND canvas-fallback provider satisfy it unchanged (OCP) |
| `NodeEligibility.ts` | SRP owner of node-bearing resolution inside the engine (consumes provider flag; unknown → false) — human requirement Q4 |
| `FakeLinkProvider.ts` | Fixture-driven provider (files + ordered links; incoming derived by inversion; attachments derived; extension defaults). Throws on undeclared link targets. Query counters for no-re-expansion assertions |
| `NeighborhoodTraversal.ts` | Multi-root directional BFS, independent per-root per-direction depth limits, per-BFS visited map (never re-expands — Q3), union + dedupe, full depth tags + `minDepth`, attachments + first image collected, degenerate roots skipped gracefully, docids echoed |
| `NodePriorityChain.ts` | THE one deterministic comparator (DRY): minDepth ↑ → sizeScore ↓ → distanceToMain (connected beats disconnected) → pin recency → docid → path. Used by truncation AND settings cascade |
| `NodeSizer.ts` | Composable metric system (registry — add a metric in one place, OCP): own-file-size (log1p), total-linker-size (log1p), backlink-count, outlink-count (node-bearing targets only), depth-decay `1/(1+k*minDepth)`. Each independently normalized/toggled/weighted; weighted-average score → [minPx, maxPx]. Centrals (incl. disconnected pinned) forced to score 1 → maxPx |
| `GraphTruncator.ts` | Hard cap on NON-central count (centrals exempt), undirected BFS distance-to-MAIN, hidden-node counts per folder, edges filtered to visible endpoints |
| `TraversalSettingsResolver.ts` | Depth cascade per root: own doc override → global. Per-field |
| `ViewSettingsResolver.ts` | View cascade per field (nodeCap, groupByFolder, sizing): MAIN → pinned gaps (multi-pin conflicts via `NodePriorityChain`) → global |
| `NeighborhoodEngine.ts` | Facade: `build(GraphBuildRequest)` = resolve settings → traverse → size → truncate → `NeighborhoodGraph` (echoes resolved `viewSettings`) |
| `index.ts` | Documented public barrel — steps 03/04 consume from here without reading implementations. Carries the **step-03 adapter contract**: a doc being pinned / receiving a per-doc override MUST get a docid via `await ensureDocId(...)` BEFORE the override is persisted |

## Engine public API (summary)

```ts
const engine = new NeighborhoodEngine(provider /* LinkProvider */);
const graph: NeighborhoodGraph = engine.build({
    main: { path, docid? },                       // active doc
    pinned: [{ path, docid, pinTimestamp }],      // docid REQUIRED on pins
    globalDepths, depthOverridesByRoot?,          // path-keyed (adapter pre-translates docids)
    globalView, mainViewOverride?, pinnedViewOverrides?,
});
// graph.nodes: path, docid?, title, folder, sizeBytes, isCentral, isMain,
//              depthTags[], minDepth, attachments[], firstImagePath?, sizeScore, sizePx
// graph.edges: directed linker -> linked, deduped, visible-endpoints only
// graph.hiddenNodeCountsByFolder, graph.viewSettings (post-cascade)
```

`sizePx` is the diff-stable field for step-04's `SIZE_RELAYOUT_THRESHOLD` checks.

## Key decisions

1. **Identity (binding Q1):** engine is 100% path-keyed; docids opaque, echoed through. `PinnedNodeDescriptor` types the "pinned ⇒ has docid" contract.
2. **Sync `LinkProvider` (binding Q2)** — adapters index up-front, query sync.
3. **Full depth maps + precomputed `minDepth` (binding Q3)**; per-BFS visited map, never re-expands within a root×direction (asserted via provider query counters).
4. **Node-bearing flag consumed from provider metadata; `NodeEligibility` is the SRP owner engine-side (binding Q4).** Adapter owns the real `.md`/`.canvas` rule.
5. **Attachments live on `FileMetadata` (provider-owned)** per the step doc's metadata list; traversal collects them onto linking nodes and finds the first image. WHY: only adapters can refine the rule (embeds vs. links, extension sets) without an engine change.
6. **Branded type is `VaultPath`, not "NodeId"** — attachments/images also carry it; naming must not lie.
7. **Truncation ranking passes `pinTimestamp: undefined`** — pinned nodes are centrals and cap-exempt, so recency can never arbitrate truncation; that chain level serves the settings cascade (chain still shared, single implementation).

## Deviations (transparent, small)

- **Added a final `path` tiebreaker after `docid` in the priority chain.** Ordinary (non-pinned) nodes carry no docid; without a total order "same input → same output" is not guaranteed. Strictly additive to the spec chain.
- **`sizing` is ONE pinnable field in the view cascade (V1)**, not per-metric. The resolver is per-field generic, so splitting later is a type change, not a redesign. (KISS; V1 has little to arbitrate per the step doc.)
- **Global depth defaults chosen as 1/1** (named constants; not specified anywhere in plan docs — mirrors Obsidian's local-graph default). Trivial to change in `constants.ts`.
- **Added `@types/node` devDependency** — required for the fs-based import-guard test under strict tsc.

## Tests (the point of this step)

8 engine test files, **107 engine tests**, BDD GIVEN/WHEN/THEN, one assert per test (mirroring `src/manifest.test.ts`):

- `FakeLinkProvider.test.ts` (15) — inversion, attachment derivation, extension defaults, loud fixture failures, `NodeEligibility`.
- `NeighborhoodTraversal.test.ts` (27) — chains/depth limits per direction, diamond dedupe + no-re-expansion (query-count assert), cycles terminate, bidirectional edges, multi-root union + per-root depth tags, disconnected pinned island, attachment-heavy notes + first image, degenerate roots, docid echo.
- `NodePriorityChain.test.ts` (9) — every tiebreaker level exercised + determinism across input orders.
- `NodeSizer.test.ts` (16) — log1p vs. huge-note outlier, zero-byte → neutral, single-node graph, link metrics, depth-decay k, weighted composition, toggling, px range, central sizing incl. disconnected pinned.
- `GraphTruncator.test.ts` (10) — cap, cap 0, centrals exempt, hidden counts per folder, edge filtering, size/distance/disconnected ordering, determinism.
- `settingsResolvers.test.ts` (15) — every depth-cascade combination incl. pinned-zero; every view layer, per-field pin/inherit, multi-pin recency + docid tiebreak, three-layer independence.
- `NeighborhoodEngine.test.ts` (13) — end-to-end fixture (MAIN + disconnected pinned island + attachments + cap), settings integration, whole-graph determinism.
- `importGuard.test.ts` (2) — recursive scan of `src/engine/` for `obsidian`/`obsidian-id-lib`/`react(-dom)` in static/dynamic imports and `require`; non-vacuous guard.

**Verification (final):** `/usr/local/bin/npm test` → exit 0 — root vitest **109 passed** (9 files: 107 engine + 2 manifest), sublib **69 passed** (6 files). `/usr/local/bin/npm run check` → exit 0.

## Commits (branch `step-02-core-engine`)

`29fe897` types/seam/fake → `b6c83e9` traversal → `96dc8f8` chain+sizing → `e3a59b2` truncation → `133a154` settings resolvers → `2003976` facade+barrel+guard (+`@types/node`).

## Follow-ups / notes for next phases

- **CHANGELOG entry** (`docs-internal/CHANGELOG.md`) intentionally NOT added yet — per repo convention it lands when the step completes its review flow (step-01 precedent: added in ITERATION phase).
- When ESLint lands (existing `ticket-eslint-adoption`), the import-guard test can optionally become a lint rule; the test remains valid either way.
- Step-03 reminder embedded in `src/engine/index.ts` docs: `ensureDocId` awaited before persisting pins/overrides; translate docid-keyed persisted data to paths before calling the engine.
