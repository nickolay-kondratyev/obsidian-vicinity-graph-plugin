# IMPLEMENTATION_REVIEWER — PRIVATE state (step-02-core-engine)

Status: CONVERGENCE CHECK (iteration 1) COMPLETE — **CONVERGED**. Verdict remains APPROVED. See "Convergence check" section appended to PUBLIC.md.

## Convergence-check evidence (2026-07-17, fresh reviewer instance, commits 0ac1419..4325a46)

- Re-ran myself: `/usr/local/bin/npm test` exit 0 (root **136** passed / 10 files, sublib **69** passed / 6 files; log `.tmp/conv-test.log`); `/usr/local/bin/npm run check` exit 0 (log `.tmp/conv-check.log`). Counts match iteration doc claims.
- No test removals/weakening: `git diff 0ac1419..HEAD -- 'src/engine/*.test.ts'` shows deletions ONLY in importGuard.test.ts and only refactor lines (a comment + `forbiddenImportsIn` restructure into `moduleSpecifiersIn`/`forbiddenSpecifiersAmong`); NeighborhoodEngine.test.ts and settingsResolvers.test.ts are pure additions.
- SF-1/Q5 verified in code: `EdgeVisibility.edgesFor` (mode switch), post-truncation sweep over `truncation.visiblePaths` (field pre-existed in GraphTruncator — no truncator change needed), outgoing-only sweep is COMPLETE for the visible set (every link is its source's outgoing link; attachments never visible). Walked ⊆ induced holds given a consistent provider (incoming derived from outgoing), so not merging walked into the sweep is clean semantics, and the superset property is itself tested. Cascade: `ViewSettingsResolver.field("edgeVisibility")` — compile-time covered via `Partial<ViewSettings>`. My sibling probe scenario is now a unit fixture (EdgeVisibility.test.ts) AND an e2e fixture (NeighborhoodEngine.test.ts "edge visibility" block); cross-root, truncated-target, attachment-target, dedupe, determinism, superset all covered. WHY-NOT doc: distance-to-MAIN ranking stays on walked set in both modes (matches Q5 post-truncation spec). Barrel `index.ts` has an "Edge semantics" section + exports; types.ts/constants.ts documented.
- SF-2 verified: 4th pattern `/import\s*["']([^"']+)["']/g`; matcher proven by 9 positive forms (named/default/type-only/side-effect/deep/re-export/multiline/dynamic/require) + 2 negatives (relative, prefix-only names). Named-import single-extraction assertions prove no cross-pattern double-match; `q()` interpolation keeps the guard from tripping on its own fixtures — clever and honest.
- NIT-3 verified: loud `throw` on missing size (message uses `path=[...]` convention). NIT-5 verified: loop min/max with WHY comment. NIT-4 rejection ACCEPTED — matches my own stated trigger ("extract when a third consumer appears"; the edge sweep does no path parsing).
- Default `all-edges` (TOP_LEVEL call) already flagged to human in CLARIFICATION Q5 + iteration doc — per orchestrator instruction I did NOT re-raise it.

## What I verified myself (do not trust docs — I re-ran)

- `/usr/local/bin/npm test` → exit 0; root vitest 109 passed (9 files), sublib 69 passed (6 files). Log: `.tmp/review-test.log`.
- `/usr/local/bin/npm run check` → exit 0. Log: `.tmp/review-check.log`.
- No `sanity_check.sh` in repo root.
- Reviewed ALL engine source + test files in `src/engine/` (21 files, commits 680dfe9..7026ae4). Read step doc, CLARIFICATION__PUBLIC (binding), EXPLORATION_PUBLIC, 1_IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.
- package.json: only `@types/node` added. package-lock diff: adds @types/node + undici-types; the ~460 removed lines are entries npm marked `"extraneous": true` (vitest's nested esbuild 0.28.1 platform binaries) — benign npm prune, no dependency loss.

## Empirical probes I ran (evidence for findings)

1. Import-guard regex probe (`scratchpad/guard-regex.mjs`, run with `/usr/local/bin/node`):
   - CAUGHT: type-only import, deep import `obsidian/foo`, `export * from`, multiline import, dynamic `import("obsidian")`.
   - MISSED: side-effect import `import "obsidian";` → SHOULD_FIX-2.
2. Frontier-edge probe (`.tmp/review/frontier.test.ts` + `.tmp/review/vitest.config.ts`, run via `npx vitest run --config .tmp/review/vitest.config.ts`):
   - Fixture m→a, m→b, a→b, outgoing depth 1: nodes {m,a,b} all visible, edges only `m->a, m->b`. The a→b link between two VISIBLE nodes is dropped → SHOULD_FIX-1. Root cause: `NeighborhoodTraversal.bfs` records edges only while EXPANDING a node, and nodes at `currentDepth >= depthLimit` are never expanded (line ~87-89 of NeighborhoodTraversal.ts). Same class of gap for cross-root visible pairs.

## Findings (full detail in PUBLIC.md)

- SHOULD_FIX-1: induced/frontier edges omitted (undeclared behavior; POLS risk in step-04 rendering; also feeds distance-to-MAIN ranking). Tagged `#QUESTION_FOR_HUMAN` — induced-subgraph edges vs. traversal-tree-only is a product decision.
- SHOULD_FIX-2: importGuard.test.ts misses side-effect imports; add regex `/import\s*["']([^"']+)["']/g`.
- NIT-1: `NeighborhoodEngine.build` silent fallbacks `size?.sizeScore ?? 0` / `?? minPx` on "unreachable" paths — throw or document loudly.
- NIT-2: basename-parsing duplication: `titleOf` (NeighborhoodTraversal.ts) vs `extensionOf`/`folderOf` (FakeLinkProvider.ts).
- NIT-3: `MinMaxNormalizedMetric` uses `Math.min(...values)` spread — stack overflow risk on very large pre-truncation traversals; loop-based min/max.

## Deviations evaluated — ALL ACCEPTED

path tiebreaker (needed for total order/determinism), provider-owned attachments (OCP, matches step doc metadata list), single `sizing` cascade field (KISS, per-field generic resolver makes later split cheap), depth defaults 1/1 (unspecified in plan; mirrors Obsidian local graph; named constants), @types/node devDep (needed by fs-based guard test).

## Compliance checklist (all verified in code, not just docs)

- Q1 path-keyed identity + docid echo + PinnedNodeDescriptor requires docid: YES (types.ts, index.ts docs carry the ensureDocId-before-persist contract).
- Q2 sync LinkProvider: YES.
- Q3 full depth maps + minDepth + never-re-expand (query-counter test at NeighborhoodTraversal.test.ts:86): YES.
- Q4 NodeEligibility SRP class consuming provider flag: YES.
- ONE comparator (NodePriorityChain) used by GraphTruncator AND ViewSettingsResolver: YES (DRY honored). Truncation passes pinTimestamp:undefined deliberately (pins are cap-exempt centrals) — sound, documented.
- Centrals exempt from cap, hidden counts per folder, cap default 100 named const: YES.
- Sizing metrics all 5, log1p, neutral 0.5, central score 1 incl. disconnected pinned: YES.
- Settings cascades per-field, zero/false pinnable (tested): YES.
- Tests: BDD, one-assert, all fixture families present (diamond/cycle/bidirectional/disconnected-pinned/attachment-heavy), every chain level exercised, determinism tests, no tautological tests found.
- Subtle good thing checked: `assemble()` collects docids from ORIGINAL (non-deduped) roots, so when MAIN==pinned the pin's docid still lands on the node despite MAIN-first dedupe.

## If a successor iterates

- Watch that fixing SHOULD_FIX-1 (if human wants induced edges) updates: edge recording in bfs, GraphTruncator distance computation stays consistent, and the traversal tests for edge sets (`NeighborhoodTraversal.test.ts` edge expectations, `NeighborhoodEngine.test.ts:97` "edges complete" test).
- SHOULD_FIX-2 fix must keep the guard's own test file from self-triggering (patterns live in string literals there — they don't match themselves since they're regex literals, fine).
