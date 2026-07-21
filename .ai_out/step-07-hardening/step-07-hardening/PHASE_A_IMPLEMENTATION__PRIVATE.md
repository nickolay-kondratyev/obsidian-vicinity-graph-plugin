# PHASE A — IMPLEMENTATION_WITH_SELF_PLAN (private working memory)

## Goal
Deliver dense-vault fixture suite + cap edge-case tests (test-only + committed generator).
Baseline before work: 499 tests green, `npm run check` clean.

## Key code facts (verified by reading source)
- `GraphTruncator.toRankable` HARDCODES `pinTimestamp: undefined`. So pin-recency level NEVER
  decides at truncator level.
- docid is populated ONLY from `root.descriptor.docid` (in NeighborhoodTraversal.assemble), and roots
  ⇒ centrals. Candidates = non-central. So among truncation candidates docid is ALWAYS undefined.
  => BOTH pinTimestamp AND docid tiebreaker levels are structurally UNREACHABLE at truncator level.
  Reachable deciding levels at truncator: minDepth, sizeScore, distanceToMain(numeric + present/absent),
  path fallback. pin/docid covered at NodePriorityChain.test.ts (already have level4/level5 tests).
- FakeLinkProvider throws on undeclared link target → generator must declare every path.
- own-file-size all-zero → all nodes 0.5 (neutral) → sizeScore ties → deterministic path fallback.
- build() helper pattern lives in GraphTruncator.test.ts.

## Plan / files
1. `src/engine/testFixtures/denseVaultFixtures.ts` — committed generator: SeededRandom (mulberry32) +
   named builders (hubFanOut, deepChain, bidirectionalClusters, foldersWithMemberCounts, canvasHeavy,
   largeMixedVault ~500 nodes, pinnedDisconnectedVault). Returns DenseFixture{spec,mainPath,pinnedPaths?,
   nodeBearingCount,depthToCoverAll}.
2. `src/engine/testFixtures/truncationHarness.ts` — DRY harness: traverseAndSize / truncateAt / build /
   visible. Runtime-cap test reuses ONE stages object across caps.
3. `src/engine/testFixtures/denseVaultFixtures.test.ts` — A1 self-test (each fixture constructs + traverses
   to nodeBearingCount, no throw).
4. `src/engine/GraphTruncator.denseFixtures.test.ts` — A2 caps-respected+determinism (truncator level) +
   A3 cap edge cases + tiebreaker matrix (truncator-reachable levels) + runtime cap monotonicity +
   pinned-disconnected.
5. `src/engine/NeighborhoodEngine.denseFixtures.test.ts` — A2 engine build() timing <150ms + engine
   determinism over ~500-node dense fixture; centrals-exceed-cap end to end.
6. `src/view/folderGrouping.test.ts` — A4 dense 1/2/many + root files + determinism (append describe).
7. Refactor GraphTruncator.test.ts build()/visible to import harness (DRY) — keep tests green.

## Tiebreaker reachability finding (IMPORTANT, truthful)
pinTimestamp + docid unreachable at truncator; asserted/covered at chain level. Documented in test comments.

## Status: DONE (PHASE A complete)

### Delivered files
- `src/engine/testFixtures/denseVaultFixtures.ts` (COMMITTED generator: SeededRandom mulberry32 +
  builders hubFanOut/deepChain/bidirectionalClusters/foldersWithMemberCounts/canvasHeavy/
  largeMixedVault(~507 nodes)/pinnedDisconnectedVault + allDefaultDenseFixtures()).
- `src/engine/testFixtures/truncationHarness.ts` (DRY: traverseAndSize/truncateAt/build/visible +
  TruncationStages).
- `src/engine/testFixtures/denseVaultFixtures.test.ts` (18 self-tests: construct-no-throw, reach node
  count, scale, determinism, SeededRandom determinism).
- `src/engine/GraphTruncator.denseFixtures.test.ts` (22 tests: caps respected, determinism, centrals
  exceed cap, boundary ±1, tiebreaker matrix, pin/docid unreachable assertion, runtime cap monotonic,
  pinned disconnected).
- `src/engine/NeighborhoodEngine.denseFixtures.test.ts` (5 tests: caps end-to-end, determinism, runtime
  cap subset, timing <150ms).
- `src/view/folderGrouping.test.ts` (+4 tests: dense 1/2/many matrix, determinism).
- Refactored `src/engine/GraphTruncator.test.ts` build()/visible() → import from truncationHarness (DRY).

### Gotchas hit
- deepChain mainPath must be computed with the same zero-pad width (was hardcoded "c000" vs actual "c00").
- pinnedDisconnectedVault neighbors MUST be uniform-sized (not seeded) so distanceToMain (level 3)
  arbitrates instead of sizeScore (level 2). Constant UNIFORM_NEIGHBOR_BYTES.
- Branded types: Set<VaultPath>.has(string) and Array<FolderPath>.includes(string) fail tsc — let
  centralPaths infer VaultPath[]; cast folder to string for includes.
- vitest suppresses console.log; measured timing via fs.writeFileSync throwaway probe.

### Measured (truthful)
largeMixedVault = 507 node-bearing files. NeighborhoodEngine.build at cap=100, 20 warm iters:
median 0.76 ms, min 0.59 ms, max 2.19 ms. Ceiling 150 ms is ~200x headroom (loose guard as intended).

### Tiebreaker reachability finding
At GraphTruncator level ONLY minDepth, sizeScore, distanceToMain (numeric + present/absent) and the path
fallback can decide. pinTimestamp is hardcoded undefined in toRankable AND TraversedNode has no such
field; docid is only ever on centrals (roots) which are cap-exempt/excluded from candidates. Both levels
are structurally unreachable in truncation; covered at NodePriorityChain.test.ts (levels 4 & 5). Added an
explicit assertion that no non-central candidate carries a docid.

### Result: npm test PASS (548 main + 69 sublib), npm run check PASS. No product code touched.
