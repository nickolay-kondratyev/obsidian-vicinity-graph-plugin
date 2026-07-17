# IMPLEMENTATION_ITERATION — PUBLIC (step-02-core-engine)

Iteration over IMPLEMENTATION_REVIEW findings (2 SHOULD_FIX, 3 NIT) + the new binding CLARIFICATION Q5. Branch `step-02-core-engine`.

## Per-finding dispositions

| # | Finding (severity) | Disposition | Rationale | Commit |
|---|---|---|---|---|
| 1 | Frontier links between visible nodes silently dropped (SHOULD_FIX) | **INCORPORATED** as the Q5 toggle | Human resolved it as a two-mode toggle: `"walked-from-center"` (BFS-walked edges only — previous behavior, now explicit and selectable) and `"all-edges"` (induced subgraph: post-truncation sweep of the visible node set via `LinkProvider`). Implemented as `ViewSettings.edgeVisibility` — a view-class field cascading like sizing/grouping/cap (MAIN → pinned per-field → global). New SRP class `EdgeVisibility` owns both modes; `EdgeAccumulator` extracted so edge dedupe knowledge stays in ONE place (DRY with traversal). Both modes fully BDD-tested incl. the reviewer's proven sibling scenario and cross-root links, unit + end-to-end + cascade. | `7aa885b` |
| 2 | Import guard misses side-effect imports (SHOULD_FIX) | **INCORPORATED** | Added a fourth matcher pattern for bare `import "x"` forms and proved the matcher against every representative form: named, default, type-only, side-effect, deep path (`obsidian/foo`), re-export, multiline, dynamic import, require — plus negatives (relative specifiers, prefix-only names like `obsidianite`). Fixture snippets interpolate their specifiers because the guard scans its own file (a literal fixture correctly trips it — observed live during development, which itself proves the guard). | `89c211f` |
| 3 | Silent `?? 0` size fallback in engine (NIT) | **INCORPORATED** | Silent fallbacks on impossible paths hide pipeline bugs (and violate the no-silent-fallback rule). The engine now throws `Engine invariant violated: no size computed for path=[...]` — fail loud over silently-wrong output. | `44c2d44` |
| 4 | Path-parsing duplication `titleOf` vs `extensionOf`/`folderOf` (NIT) | **REJECTED (for now)** | The reviewer's own suggested trigger was "extract if a third consumer appears; fine to leave for now" — no third consumer appeared in this iteration (the edge sweep does no path parsing). The two call sites parse for different reasons (display title vs. fixture extension defaults); extracting now adds indirection without eliminating knowledge duplication of a business rule. Revisit when step-03 adds real path handling. | — |
| 5 | `Math.min(...spread)` stack-limit risk in sizer (NIT) | **INCORPORATED** | Real crash risk: sizing runs pre-truncation so node count is unbounded by the cap; argument spread has engine stack limits (~1e5). Replaced with a loop; WHY comment added. | `44c2d44` |

## Q5 implementation notes

- New public API: `EdgeVisibilityMode = "walked-from-center" | "all-edges"` (naming per human's wording), `ViewSettings.edgeVisibility`, `DEFAULT_EDGE_VISIBILITY`, `EdgeVisibility` (+ `EdgeVisibilityInput`) — all documented in the `src/engine/index.ts` barrel (steps 03/04/06 contract kept in sync).
- Sweep semantics: POST-truncation over the visible set, outgoing links only (every link is its source's outgoing link; attachments/truncated targets are never visible so no eligibility re-check is needed). Deterministic ordering via first-insertion dedupe.
- Documented WHY-NOT in `EdgeVisibility.ts`: truncation's distance-to-MAIN ranking intentionally stays on the walked edge set in both modes — Q5 specifies the sweep happens after truncation.
- `#QUESTION_FOR_HUMAN:` The **default** edge mode is `all-edges` (TOP_LEVEL_AGENT decision — POLS: two visibly linked notes should show their edge; Q5 left the default unspecified). Confirm or flip `DEFAULT_EDGE_VISIBILITY` in `src/engine/constants.ts` (one-line change, fully cascade-overridable either way).

## Verification (run this iteration)

| Command | Result |
|---|---|
| `/usr/local/bin/npm test` | exit 0 — root **136 passed** (10 files; was 109), sublib **69 passed** (6 files) |
| `/usr/local/bin/npm run check` (strict tsc) | exit 0 |

All pre-existing behavior-capturing tests untouched and green (the existing edge-completeness e2e test passes unchanged under the new default because its fixture has no frontier links — mode differences are covered by dedicated new fixtures).

## Other changes

- `docs-internal/CHANGELOG.md`: step-02 entry added (step-01 precedent: lands in ITERATION phase).

## Convergence signal: **READY**

All SHOULD_FIXes resolved (one via the binding Q5 decision), NITs dispositioned (2 incorporated, 1 rejected with rationale), suite + typecheck green, engine API docs in sync. Remaining open item is the human confirmation of the `all-edges` default (tagged above); it does not block step-04 consumption.
