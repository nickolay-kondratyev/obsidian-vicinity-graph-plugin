# PHASE A — IMPLEMENTATION_WITH_SELF_PLAN (PUBLIC handoff)

Scope: step-07 hardening PHASE A — dense-vault fixture suite + cap edge cases. Test-only + one
committed generator. No perf/README/UI/product code touched.

## Gate status
- `npm test`: PASS — 548 main tests (was 499 → **+49**) + 69 sublib tests.
- `npm run check` (tsc -noEmit): PASS.

## Files added
| File | Purpose |
|------|---------|
| `src/engine/testFixtures/denseVaultFixtures.ts` | **Committed** deterministic generator (regression tooling for V2). `SeededRandom` (mulberry32, no unseeded Math.random) + named builders. |
| `src/engine/testFixtures/truncationHarness.ts` | Shared traverse→size→truncate harness (`traverseAndSize` / `truncateAt` / `build` / `visible`). DRY across truncator tests; lets runtime-cap tests reuse ONE traversal across caps. |
| `src/engine/testFixtures/denseVaultFixtures.test.ts` | A1 self-tests (18). |
| `src/engine/GraphTruncator.denseFixtures.test.ts` | A2 (truncator-level) + A3 cap edge cases + tiebreaker matrix (22). |
| `src/engine/NeighborhoodEngine.denseFixtures.test.ts` | A2 engine-level caps/determinism/timing (5). |

## Files edited
- `src/view/folderGrouping.test.ts` — +4 A4 dense 1/2/many tests.
- `src/engine/GraphTruncator.test.ts` — build()/visible() now imported from the shared harness (DRY; all pre-existing tests still green).

## Generator builders (A1) — all deterministic, all paths declared (FakeLinkProvider throw-guard self-tested)
- `hubFanOut(220)` — hub with 200+ spokes (fan-out).
- `deepChain(60)` — long linear depth.
- `bidirectionalClusters(5,8)` — fully bidirectional cliques.
- `foldersWithMemberCounts(30)` — folders of size 1 / 2 / many + vault-root files.
- `canvasHeavy(30)` — node-bearing `.canvas` set.
- `largeMixedVault()` — ~507 node-bearing files across 10 folders + second hops (the cap/timing fixture).
- `pinnedDisconnectedVault(3,3)` — pinned central disconnected from MAIN (uniform-sized neighbors so the distance tiebreaker, not size, arbitrates).

## A-scope coverage map
- **A1** committed generator + construct-no-throw + reach-node-count self-tests. ✅
- **A2** caps respected (non-central visible == min(cap,pool); centrals always present), determinism (build twice → identical visible/edges/hidden), engine timing < 150 ms. ✅
- **A3** centrals-exceed-cap (all centrals render, nothing non-central, `hiddenNodeCountsByFolder` populated); cap boundary N-1/N/N+1 exact keep+hide; per-tiebreaker isolation; runtime cap change monotonic subset + recount (truncator level AND engine `mainViewOverride`); pinned-disconnected under tight cap. ✅
- **A4** dense 1/2/many folder matrix + root files + determinism. ✅

## Measured engine build time (truthful)
`NeighborhoodEngine.build` over `largeMixedVault` (507 node-bearing files) at cap=100, 20 warm iterations:
**median 0.76 ms, min 0.59 ms, max 2.19 ms** — roughly 200x under the 150 ms ceiling. The 150 ms assertion is a loose machine-independent regression guard (per CLARIFICATION #1), not a micro-benchmark.

## Tiebreaker reachability (IMPORTANT — truthful finding, no fake assertions)
At the `GraphTruncator` level, only these levels can be the deciding comparator, and each is isolated in a dedicated test: **minDepth, sizeScore, distanceToMain (numeric AND present-vs-absent), path fallback**.

The **pinTimestamp** and **docid** levels are **structurally unreachable in truncation**:
- `GraphTruncator.toRankable` hardcodes `pinTimestamp: undefined`, and `TraversedNode` has no pin field at all.
- `docid` is assigned only to roots, and roots are centrals; centrals are cap-exempt and never enter the ranked candidate pool. So every truncation candidate has `docid === undefined`.

These two levels are covered at `NodePriorityChain.test.ts` (levels 4 & 5, pre-existing). The dense suite adds an explicit assertion that no non-central candidate carries a docid, so the reachability claim is enforced rather than assumed. This goes beyond what the task brief anticipated (brief expected docid to be reachable at the truncator level; it is not).

## #QUESTION_FOR_HUMAN
None. All A-scope items delivered honestly. No hacks, no skipped/faked assertions.
