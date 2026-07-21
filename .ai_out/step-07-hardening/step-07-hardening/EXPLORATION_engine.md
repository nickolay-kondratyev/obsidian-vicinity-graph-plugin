# EXPLORATION: Engine + Cap/Truncation/Sizing Subsystem

Repo root: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph`

## 1. Engine pipeline overview

`src/engine/NeighborhoodEngine.ts` is the facade (`NeighborhoodEngine.build(request)`, line 47-91). Pipeline, in order:

1. `ViewSettingsResolver.resolve(...)` → resolves `ViewSettings` (nodeCap, groupByFolder, edgeVisibility, sizing) via cascade (main override → pinned overrides ranked → global).
2. `NeighborhoodTraversal(provider).traverse(roots)` → multi-root BFS → `TraversalResult { nodes, edges }` (count-free edges).
3. `NodeSizer(provider).computeSizes(traversal.nodes, viewSettings.sizing)` → per-node `NodeSize { sizeScore, sizePx }`.
4. `GraphTruncator.truncate({ nodes, sizes, edges, mainPath, nodeCap })` → `TruncationResult { visiblePaths, visibleEdges, hiddenNodeCountsByFolder }`.
5. Assemble final `GraphNode[]` (only visible paths; throws `Engine invariant violated: no size computed for path=[...]` if sizer/truncator disagree — line 71).
6. `EdgeVisibility.edgesFor(...)` → final `GraphEdge[]` with `count`.

Result type: `NeighborhoodGraph { nodes, edges, hiddenNodeCountsByFolder, viewSettings }` (`src/engine/types.ts:198-205`).

### NeighborhoodTraversal (`src/engine/NeighborhoodTraversal.ts`)

- `TraversalRoot { descriptor: CentralNodeDescriptor; depths: DepthSettings }` (line 18-21).
- `TraversedNode` (line 24-36): `path, docid?, title, folder, sizeBytes, isCentral, depthTags, minDepth, attachments, firstImagePath?`.
- Roots deduped by path, MAIN-first (`dedupeRootsByPath`, line 149-159).
- Per root, independent BFS per direction (`DIRECTIONS = ["outgoing", "incoming"]`) with its own depth limit.
- BFS: visited map keyed by path→depth; expanded at most once per BFS (first visit shallowest); depth budget check `currentDepth >= depthLimit`; non-node-bearing neighbors recorded as edges but never enqueued (surfaced as attachments).
- Same node across roots gains multiple `DepthTag`s; `minDepth = Math.min(...depthTags.map(t => t.depth))`.
- `isCentral` = node path is one of the root paths.
- Edges accumulate via `EdgeAccumulator` (dedup), direction "incoming" flips source/target so edges are always linker → linked.
- Roots unknown/non-node-bearing skipped gracefully (`NodeEligibility.isNodeBearing`).

### GraphTruncator (`src/engine/GraphTruncator.ts`)

```ts
export interface TruncationInput {
  readonly nodes: ReadonlyMap<VaultPath, TraversedNode>;
  readonly sizes: ReadonlyMap<VaultPath, NodeSize>;
  readonly edges: readonly DirectedLink[];
  readonly mainPath: VaultPath;
  readonly nodeCap: number; // Hard cap on the number of NON-central nodes kept.
}
export interface TruncationResult {
  readonly visiblePaths: ReadonlySet<VaultPath>;
  readonly visibleEdges: readonly DirectedLink[];
  readonly hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>;
}
```

Algorithm (lines 30-54):
1. Undirected BFS distances from `mainPath` over `input.edges` (tiebreaker only; `undefined` if disconnected).
2. `candidates` = nodes where `!node.isCentral` (centrals never enter sortable/cappable pool).
3. Sort candidates via `NodePriorityChain.compare` over `toRankable(node)`.
4. All centrals unconditionally added to `visiblePaths` (the "centrals exempt from cap" mechanism).
5. `candidates.slice(0, nodeCap)` kept; `candidates.slice(nodeCap)` hidden, tallied into `hiddenNodeCountsByFolder` by `hidden.folder`.
6. `visibleEdges` = edges with both endpoints visible.

Determinism: class doc + dedicated test ("GraphTruncator determinism", lines 154-163) builds twice, asserts identical output.

### NodePriorityChain — tiebreaker ordering (`src/engine/NodePriorityChain.ts`)

Shared chain used by BOTH `GraphTruncator` (cap) AND `ViewSettingsResolver` (multi-pin conflict). Order:

```
1. minDepth            ascending  (lower wins)
2. sizeScore           descending (higher wins)
3. distanceToMain      ascending, present-beats-absent (connected beats disconnected)
4. pinTimestamp        descending, present-beats-absent (most recent pin wins)
5. docid               lexicographic, present-beats-absent
6. path                lexicographic (final total-order fallback — pure determinism)
```

`PriorityRankable` fields: `path, minDepth, sizeScore, distanceToMain?, pinTimestamp?, docid?`.
`presentFirst` helper: undefined ranks lower; else delegate. Negative compare = a ranks first / kept.
`NodePriorityChain.test.ts` has one describe per level + cross-order determinism test.

### NodeSizer (`src/engine/NodeSizer.ts`)

- `NodeSize { sizeScore, sizePx }`. Central → `CENTRAL_SIZE_SCORE = 1`; else weighted average of enabled metrics (`NEUTRAL_NORMALIZED_VALUE = 0.5` when no metric enabled).
- `sizePx = minPx + score * (maxPx - minPx)`.
- Metrics registry: `own-file-size` (log1p bytes), `total-linker-size` (log1p sum incoming linker bytes), `backlink-count`, `outlink-count` (node-bearing only), `depth-decay` (`1/(1+k*minDepth)`).
- `MinMaxNormalizedMetric`: all-tie → 0.5; uses manual min/max loop (NOT spread) because "sizing runs pre-truncation, node count unbounded by cap, spread could hit arg limits" — RELEVANT for dense fixtures.
- Sizing runs on FULL pre-truncation node set; sizes feed truncation tiebreaker level 2.

### EdgeVisibility / NodeEligibility
- `EdgeVisibilityMode` = `"walked-from-center"` (default) vs `"all-edges"`. Both attach `count` via `getLinkCount`, floored at `MIN_EMITTED_EDGE_LINK_COUNT = 1`.
- `NodeEligibility.isNodeBearing(path)` = `provider.getFileMetadata(path)?.isNodeBearing ?? false`.

## 2. LinkProvider interface (`src/engine/LinkProvider.ts`)

```ts
export interface FileMetadata {
  readonly folder: FolderPath;
  readonly sizeBytes: number;
  readonly frontmatterTitle?: string;
  readonly isNodeBearing: boolean;    // .md + .canvas
  readonly attachments: readonly AttachmentRef[];
}
export interface LinkProvider {
  getOutgoingLinks(path: VaultPath): readonly VaultPath[];
  getIncomingLinks(path: VaultPath): readonly VaultPath[];
  getFileMetadata(path: VaultPath): FileMetadata | undefined;
  getLinkCount(source: VaultPath, target: VaultPath): number;
}
```
Synchronous by design. Implemented by `src/adapters/ObsidianLinkProvider.ts` + canvas fallback.

## 3. FakeLinkProvider — engine test double (`src/engine/FakeLinkProvider.ts`)

```ts
export interface FakeFileSpec { path: string; sizeBytes?: number; nodeBearing?: boolean; image?: boolean; frontmatterTitle?: string; }
export interface FakeVaultSpec { files: readonly FakeFileSpec[]; links?: Record<string, readonly string[]>; }
export class FakeLinkProvider implements LinkProvider {
  constructor(spec: FakeVaultSpec);
  // ...LinkProvider methods...
  outgoingQueryCount(path): number; // TEST INSTRUMENTATION: counts getOutgoingLinks() calls per path
}
```
GOTCHA: declaring a link to an undeclared path THROWS at construction — dense fixtures must declare every referenced file first. Links deduped for get*Links; raw duplicates preserved for getLinkCount. Attachments auto-derived from non-node-bearing outgoing refs.

### Representative usage (GraphTruncator.test.ts lines 14-38)
```ts
function build(spec, rootPaths, nodeCap, depths = {}): TruncationResult {
  const provider = new FakeLinkProvider(spec);
  const roots = rootPaths.map((path) => ({ descriptor: { path: asVaultPath(path) },
    depths: { outgoingDepth: depths.outgoingDepth ?? 2, incomingDepth: depths.incomingDepth ?? 2 } }));
  const traversal = new NeighborhoodTraversal(provider).traverse(roots);
  const sizes = new NodeSizer(provider).computeSizes(traversal.nodes, EngineDefaults.sizingSettings());
  return GraphTruncator.truncate({ nodes: traversal.nodes, sizes, edges: traversal.edges,
    mainPath: asVaultPath(rootPaths[0]), nodeCap });
}
```
Existing cap-edge assertions in `GraphTruncator.test.ts`: cap < neighbors (alpha survives), cap 0 (only centrals), cap > pool (no hidden), centrals exceed cap (all kept), hidden counts across folders, edges dropped when endpoint hidden, per-tiebreaker scenarios (size beats depth-tie; distance-to-MAIN; disconnected loses).

## 4. Sizing metrics UI (`src/view/sizingMetrics.ts`)
`SIZING_METRICS` array of `{id,label}` for 5 metrics; consumed by `SizingSection.tsx` + `NeighborhoodGraphSettingTab.ts`. Sizing runs BEFORE truncation.

## 5. Cap configuration (settings)
- Default `DEFAULT_NODE_CAP = 100` (`src/engine/constants.ts:4`).
- `ViewSettings.nodeCap: number` — hard cap on NON-central count.
- Runtime configurable per-field cascade via `ViewSettingsResolver.resolve` (main override → ranked pinned → global).
- UI: `NeighborhoodGraphSettingTab.renderPerformance()` numeric input; `MIN_NODE_CAP = 1` only bound; NO upper bound anywhere (grep confirms no MAX_NODE_CAP).
- Interaction `{ kind: "global-cap"; value }` → `settingsWritePlan.ts` → `SettingsCommand { kind: "global-view", view: {...globalView, nodeCap} }` → `saveGlobalView`.
- Cascade tested in `src/engine/settingsResolvers.test.ts`; end-to-end cap in `NeighborhoodEngine.test.ts` "settings integration" (incl determinism `build toEqual build`).

## 6. Folder-grouping (1/2/many) — `src/view/folderGrouping.ts`
```ts
export const MIN_GROUP_MEMBER_COUNT = 2;
export function deriveFolderGroups(nodes, groupByFolder): FolderGroupingResult; // {groups, groupFolderByMemberPath}
```
Rules: vault root (`folder===""`) never groups; folder groups only at 2+ visible members; 1-member stays ungrouped; `groupByFolder=false` short-circuits. Pure deterministic — called independently by `elkMapping` (layout) and `flowMapping` (parentIds); non-determinism desyncs them. `folderGrouping.test.ts` already covers 1/2/many matrix. `truncationBadges.ts` turns `hiddenNodeCountsByFolder` into per-group "+N" badges vs aggregate orphan badge.

## Where new tests should live
- Engine dense-fixture + cap edge cases: new describe in `src/engine/GraphTruncator.test.ts` (reuse `build()` helper) OR new `src/engine/GraphTruncator.denseFixtures.test.ts`. Use `EngineDefaults.sizingSettings()`/`viewSettings()`.
- End-to-end dense scenarios (pins+overrides+cap+folders): `src/engine/NeighborhoodEngine.test.ts` (`fixtureProvider()`/`buildRequest()`/`node()` helpers).
- Tiebreaker matrix: `src/engine/NodePriorityChain.test.ts`.
- Folder dense fixtures: `src/view/folderGrouping.test.ts` (`makeNode()` from `src/view/testFixtures/graphFixtures.ts`).
- Badge dense scenarios: `src/view/truncationBadges.test.ts`.
- All run under root `vitest.config.ts` via `npm test`. FakeLinkProvider throws on undeclared link → generator must declare every path.
