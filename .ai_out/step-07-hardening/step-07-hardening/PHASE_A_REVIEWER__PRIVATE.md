# IMPLEMENTATION_REVIEWER — PRIVATE notes (PHASE A, step-07 hardening)

Date: 2026-07-20. Reviewer sub-agent, read-only for product code.

## Gate results (re-run myself)
- `npm run check` (tsc -noEmit): exit 0.
- `npm test`: exit 0 — main 52 files / **548 tests**; sublib 6 files / 69 tests. Matches implementer claim (499 → 548 = +49; +5 of those in sublib not counted but main delta is +49 vs claimed baseline 499).
- Logs: `.tmp/reviewA-check.log`, `.tmp/reviewA-test.log`.

## Test-only discipline — CONFIRMED
`git status --short` (non-doc) shows ONLY:
- M `src/engine/GraphTruncator.test.ts` (harness extraction, no behavior test removed)
- M `src/view/folderGrouping.test.ts` (+4 A4 tests)
- ?? `src/engine/GraphTruncator.denseFixtures.test.ts`
- ?? `src/engine/NeighborhoodEngine.denseFixtures.test.ts`
- ?? `src/engine/testFixtures/{denseVaultFixtures.ts,denseVaultFixtures.test.ts,truncationHarness.ts}`
No product / perf / UI / README source modified. Clean.

## Reachability claim (pinTimestamp + docid unreachable at truncator level) — CONFIRMED TRUE
- `GraphTruncator.ts:65` hardcodes `pinTimestamp: undefined` in `toRankable`.
- `GraphTruncator.ts:32` candidate pool = `filter(node => !node.isCentral)`.
- `NeighborhoodTraversal.ts:119-120` sets docid ONLY for roots; `:132` `docid: docidByPath.get(path)` → undefined for non-roots; `:137` `isCentral: rootPaths.has(path)`. So every docid-bearing node is central and excluded from the pool. docid can never decide a truncation. Claim holds.
- The dense suite asserts this structurally (`GraphTruncator.denseFixtures.test.ts:240-246`) — a real guard, fails if traversal ever propagates docid to non-centrals. NOT vacuous.

## Harness refactor — no behavior weakened
Diff on `GraphTruncator.test.ts` only removed the local `build`/`visible` helpers and imports them from `truncationHarness`. Old default depths were (out 2, in 2); harness `DEFAULT_TEST_DEPTH=2` for both → identical. All 10 `it()` retained, suite green.

## Truthfulness of assertions — reviewed each
- Cap tests: exact `toHaveLength(50/100)`, `totalHidden == pool-cap` — real.
- Determinism: full-output `toEqual` (visible + edges + hidden entries), not counts — real.
- Centrals-exceed-cap: cap 0, asserts every central visible, zero non-central, `hiddenNodeCountsByFolder == [["nc",2]]` — real.
- Boundary ±1: keptAndHidden at POOL-1/POOL/POOL+1 exact — real, exercises exactly N/N±1.
- Tiebreakers: each isolates one deciding level with exact `toEqual([...])` — real (minDepth, sizeScore, distanceToMain numeric, distanceToMain present-vs-absent, path fallback).
- Runtime cap change: subset invariant + recount, truncator-level AND engine `mainViewOverride` — real.

## Minor weaknesses (NIT)
1. `GraphTruncator.denseFixtures.test.ts:284-288` "one non-central survives" uses `survivors.every(startsWith("connected/"))` — vacuously true if survivors were empty. In practice cap 1 over pool 6 → exactly 1 survivor, and the cap-3 test right below firmly proves connected-beats-island. Adding `toHaveLength(1)` would harden. Low priority; behavior is covered.
2. Committed fixtures `deepChain`, `canvasHeavy`, `foldersWithMemberCounts` are exercised only by the self-tests (construct-no-throw + reach-all-nodes), not wired into a dedicated cap/truncation assertion. Acceptable — they exist as the committed V2 regression harness and the self-tests are meaningful (canvasHeavy self-test proves `.canvas` counts as node-bearing at scale; deepChain reaches all 60 at depth 59). Worth noting, not a defect.
3. A4 folder tests hand-build view-layer nodes rather than reusing `foldersWithMemberCounts` — but that generator emits `FakeVaultSpec` (engine layer) while `deriveFolderGroups` consumes view nodes; cross-layer reuse isn't clean. Not a real DRY violation.

## Generator quality — good
Deterministic (mulberry32 `SeededRandom`, no unseeded Math.random), zero-padded paths for stable lexicographic fallback, all paths declared before wiring (self-test enforces via FakeLinkProvider throw-guard), typed, WHY-documented. Fit to be the committed V2 harness.

## Verdict: APPROVE-WITH-NITS. 0 blocking.
