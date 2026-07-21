# PHASE A — IMPLEMENTATION_REVIEW (PUBLIC handoff)

Scope reviewed: step-07 hardening PHASE A — dense-vault fixtures + cap edge cases (test-only + committed generator).

## VERDICT: APPROVE-WITH-NITS
- **Blocking issues: 0.**
- Test-only discipline verified, all gates green, and the implementer's key truthfulness claim (pin/docid tiebreakers unreachable at truncator level) is **confirmed true** at the source.

## Gate status (re-run by reviewer)
| Gate | Result |
|------|--------|
| `npm run check` (tsc -noEmit) | PASS (exit 0) |
| `npm test` — main | PASS — 52 files / **548 tests** (+49 vs baseline 499) |
| `npm test` — sublib | PASS — 6 files / 69 tests |
| Test-only discipline | CONFIRMED — only `*.test.ts` + `src/engine/testFixtures/*` changed; no product/perf/UI/README source touched |

## Coverage vs A-scope checklist
| A-scope item | Covered | Where |
|--------------|---------|-------|
| Hub 200+ links | ✅ | `hubFanOut(220)`; cap-at-50 test |
| Deep chains | ✅ (self-test only) | `deepChain(60)` construct + reach-all |
| Bidirectional clusters | ✅ | `bidirectionalClusters()`; hidden-tally cap test |
| Folders 1/2/many | ✅ | `foldersWithMemberCounts` + `folderGrouping.test.ts` A4 matrix |
| Canvas-heavy | ✅ (self-test) | `canvasHeavy(30)` proves `.canvas` node-bearing at scale |
| Caps respected + determinism + timing | ✅ | `NeighborhoodEngine.denseFixtures.test.ts` (full-output `toEqual`, <150 ms loose ceiling) |
| Centrals-alone-exceed-cap + `hiddenNodeCountsByFolder` | ✅ | cap-0 describe (all centrals render, 0 non-central, `[["nc",2]]`) |
| Cap ±1 boundary | ✅ | exact keep/hide at POOL−1/POOL/POOL+1 |
| Every tiebreaker reached | ✅ | minDepth, sizeScore, distanceToMain (numeric + present-vs-absent), path fallback each isolated; pin/docid documented+asserted unreachable |
| Runtime cap change | ✅ | truncator-level subset+recount AND engine `mainViewOverride` |
| Pinned disconnected under tight cap | ✅ | `pinnedDisconnectedVault(3,3)` |

## Findings
| # | Tag | File:line | Finding & rationale |
|---|-----|-----------|---------------------|
| 1 | **[NIT]** | `GraphTruncator.denseFixtures.test.ts:284-288` | "one non-central survives" asserts `survivors.every(startsWith("connected/"))` — vacuously true if the survivor set were empty. In practice cap 1 over a 6-node pool yields exactly 1, and the cap-3 test below firmly proves connected-beats-island, so behavior is covered. Adding `toHaveLength(1)` would remove the theoretical vacuity. |
| 2 | **[NIT]** | `denseVaultFixtures.ts` (`deepChain`, `canvasHeavy`, `foldersWithMemberCounts`) | These committed fixtures are exercised only by the A1 self-tests (construct-no-throw + reach-all-nodes), not by a dedicated cap/truncation assertion. Acceptable — they are the committed V2 regression harness and the self-tests are meaningful — but if you want the dense truncation path stressed on a chain shape, wiring `deepChain` into one cap test would add value. Optional. |
| 3 | **[NIT]** | `NeighborhoodEngine.denseFixtures.test.ts` | `largeMixedVault()` is regenerated on each call inside helpers. Deterministic, so correct; trivial redundant work in test setup only. Ignore unless it ever shows up. |

## Confirmations (things I checked and found solid)
- **Reachability claim TRUE:** `GraphTruncator.ts:65` hardcodes `pinTimestamp: undefined`; candidate pool excludes centrals (`:32`); `NeighborhoodTraversal.ts:119-137` assigns docid only to roots and `isCentral = rootPaths.has(path)`, so no non-central candidate can carry a docid. The suite asserts this structurally (`:240-246`) rather than assuming it — a real regression guard, not a vacuous assertion.
- **No behavior tests weakened:** the `GraphTruncator.test.ts` refactor only hoists `build`/`visible` into the shared harness; default depths preserved (out 2 / in 2); all 10 pre-existing `it()` retained and green.
- **Assertions are real:** cap counts (`toHaveLength`), hidden tallies (`pool-cap`), determinism (full-output `toEqual` over visible+edges+hidden), and each tiebreaker (`toEqual([...])`) are concrete, non-tautological.
- **Generator quality:** deterministic mulberry32 `SeededRandom` (no unseeded `Math.random`), zero-padded paths for stable lexicographic fallback, all referenced paths declared (FakeLinkProvider throw-guard self-tested), typed and WHY-documented. Fit to be the committed V2 harness.

## #QUESTION_FOR_HUMAN
None. All A-scope items delivered honestly; no hacks, no skipped/faked assertions. NITs are optional and non-blocking — Phase A can proceed to commit and on to Phase B.
