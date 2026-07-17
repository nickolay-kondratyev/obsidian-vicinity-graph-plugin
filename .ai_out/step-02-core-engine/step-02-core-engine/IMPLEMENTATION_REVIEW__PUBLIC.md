# IMPLEMENTATION_REVIEW — PUBLIC (step-02-core-engine)

Reviewed commits `680dfe9..7026ae4` (all engine code under `src/engine/`, plus `package.json` `@types/node` devDep). Reviewed the CODE, verified claims by running the suite and by empirical probes.

## Verification results (run by reviewer, not trusted from docs)

| Command | Result |
|---|---|
| `/usr/local/bin/npm test` | exit 0 — root vitest **109 passed** (9 files), sublib **69 passed** (6 files) |
| `/usr/local/bin/npm run check` (`tsc -noEmit`, strict + `noUncheckedIndexedAccess`) | exit 0 |
| `sanity_check.sh` | not present in repo |
| package-lock.json −460 lines | verified benign: npm pruned entries it had marked `"extraneous": true` (vitest's nested esbuild 0.28.1 platform binaries); only real additions are `@types/node` + `undici-types` |

Implementation report claims match reality (109/69 counts, green check, commit list).

## Compliance with BINDING clarifications — no drift found

- **Q1 identity:** engine 100% path-keyed (`VaultPath` brand); docids opaque, echoed to output; `PinnedNodeDescriptor` requires `docid`+`pinTimestamp`; the docid-before-persist adapter contract is documented in `src/engine/index.ts` and `types.ts`. Bonus verified: `NeighborhoodTraversal.assemble()` collects docids from the original (non-deduped) root list, so when MAIN is also pinned the pin's docid still reaches the output node.
- **Q2 sync provider:** `LinkProvider` fully synchronous, path-keyed, no canvas-specific shape (OCP for step-03's two providers).
- **Q3 full depth maps + no re-expand:** full per-root×per-direction `depthTags` + precomputed `minDepth`; per-BFS visited map; never re-expands (asserted via `FakeLinkProvider.outgoingQueryCount` in `NeighborhoodTraversal.test.ts:86`).
- **Q4 eligibility SRP:** `NodeEligibility` is the single engine-side interpreter of the provider's `isNodeBearing` flag; adapter owns the real `.md`/`.canvas` rule; unknown → false.
- **ONE comparator (DRY):** `NodePriorityChain.compare` is the single chain, consumed by BOTH `GraphTruncator` and `ViewSettingsResolver`. Chain order matches spec; truncation passing `pinTimestamp: undefined` is sound (pinned nodes are cap-exempt centrals, so recency can never arbitrate truncation) and documented.

## Requirements coverage — complete

BFS semantics (independent per-root per-direction limits, union+dedupe, MAIN-first root dedupe), attachment collection + first image, non-md never nodes, truncation (cap param default `DEFAULT_NODE_CAP=100`, centrals exempt, per-folder hidden counts, deterministic incl. added path tiebreaker), sizing (all 5 metrics, log1p on byte metrics, independent normalize/toggle/weight, weighted average → [minPx,maxPx], centrals incl. disconnected pinned forced to max), settings resolvers (depth: own override → global; view: MAIN → ranked pinned gap-fill → global; presence=pinned incl. `0`/`false` — both tested). Exit criteria: suite green; import guard present and non-vacuous; engine API documented in `src/engine/index.ts` well enough for steps 03/04.

Test quality: BDD GIVEN/WHEN/THEN, one assert per test, all required fixture families present (diamond, cycle, bidirectional, disconnected pinned island, attachment-heavy), every priority-chain level exercised individually plus determinism-across-input-orders, sizing edge cases (huge note vs midfield under log1p, zero-byte → neutral, single node), full cascade combination matrix. No tautological tests or silent test fallbacks found; `FakeLinkProvider` fails loudly on fixture bugs.

## Findings

| # | Severity | Location | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | SHOULD_FIX | `src/engine/NeighborhoodTraversal.ts:87-101` | **Links between two VISIBLE nodes at the depth frontier are silently dropped.** Edges are only recorded while *expanding* a node, and nodes at the depth limit are never expanded. Reviewer-verified probe: `m→a, m→b, a→b` at outgoing depth 1 yields nodes {m,a,b} but edges only `m→a, m→b` — the real `a→b` link between two rendered nodes is missing (`.tmp/review/frontier.test.ts`). Same gap for a visible pair discovered by two different roots. Step-04 will render linked notes as unconnected (POLS), and distance-to-MAIN ranking runs on this reduced edge set. Undeclared in the implementer's deviations. | Decide semantics explicitly. If induced edges are wanted: after node collection, one pass over visible nodes' outgoing links adding edges whose both endpoints are collected (cheap, still pure). If traversal-tree-only is intended: document it in `index.ts`/`GraphEdge` docs and add a test capturing the omission as intended. |
| 2 | SHOULD_FIX | `src/engine/importGuard.test.ts:16-20` | Guard misses **side-effect imports**: `import "obsidian";` matches none of the three patterns (reviewer-verified: type-only, deep `obsidian/foo`, `export * from`, multiline, and dynamic imports ARE caught). | Add a fourth pattern for bare imports, e.g. `/import\s*["']([^"']+)["']/g`. |
| 3 | NIT | `src/engine/NeighborhoodEngine.ts:70-71` | `size?.sizeScore ?? 0` / `?? viewSettings.sizing.minPx` — silent fallback on a path the sizer guarantees can't happen. If the invariant ever breaks, output is silently wrong instead of loud. | Throw on missing size (invariant violation) or hoist a documented `unreachable` helper. |
| 4 | NIT | `src/engine/NeighborhoodTraversal.ts:157-161` vs `src/engine/FakeLinkProvider.ts:124-133` | Basename/`lastIndexOf` path-parsing duplicated (`titleOf` vs `extensionOf`/`folderOf`). | Extract a tiny static path-parts helper if a third consumer appears; fine to leave for now. |
| 5 | NIT | `src/engine/NodeSizer.ts:120-122` | `Math.min(...values)` / `Math.max(...values)` spread over ALL traversed nodes (sizing runs pre-truncation, so node count is unbounded by the cap) — argument-spread stack limits (~10^5) could throw on huge vaults with deep settings. | Loop-based min/max in `MinMaxNormalizedMetric`. |

`#QUESTION_FOR_HUMAN:` (finding 1) Should the graph include ALL links among visible nodes (induced-subgraph edges — e.g. two depth-1 siblings that link each other, or a link between nodes discovered by different roots), or only edges walked by the BFS? Current behavior is BFS-walked-only; two visible, genuinely-linked notes can render unconnected in step-04.

## Deviation evaluations (implementer-declared)

| Deviation | Verdict |
|---|---|
| Final `path` tiebreaker after `docid` | **Accept** — required for a total order; ordinary nodes have no docid; strictly additive. |
| Attachments provider-owned on `FileMetadata` | **Accept** — matches step doc's metadata list; only adapters can refine embed/extension rules (OCP). |
| Single `sizing` cascade field (not per-metric) | **Accept** — KISS for V1; resolver is per-field generic so a later split is a type change. |
| Global depth defaults 1/1 | **Accept** — unspecified anywhere in plan docs; mirrors Obsidian local-graph default; named constants. |
| `@types/node` devDep | **Accept** — required by the fs-based guard test under strict tsc. |

## VERDICT: **APPROVED**

0 BLOCKER / 2 SHOULD_FIX / 3 NIT. Binding clarifications fully honored; suite and typecheck verified green; tests are honest and thorough. The SHOULD_FIXes are small and isolated; finding 1's `#QUESTION_FOR_HUMAN` should be answered (and the chosen semantics implemented or documented + tested) before step-04 renders edges.
