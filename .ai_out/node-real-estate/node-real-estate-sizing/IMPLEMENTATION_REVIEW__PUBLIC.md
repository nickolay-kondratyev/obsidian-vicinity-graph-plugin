# IMPLEMENTATION_REVIEW — PUBLIC

Reviewer: IMPLEMENTATION_REVIEWER. Commit `998fdac` (base `08a2077`). WIDTH-ONLY iteration; height out of scope.

## Verdict: APPROVE
0 BLOCKING · 0 SHOULD-FIX · 2 NIT

## Gates (independently run, read-only)
- `npm test` → **PASS** (55 files / 673 tests) — `.tmp/review-test.log`
- `npm run check` (tsc strict) → **PASS** — `.tmp/review-check.log`

## Requirements verified
- **A) Width formula** — CONFIRMED. `nodeDimensionsPx` (`src/view/graphIdentity.ts:52-57`):
  `max(sizePx, min(NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx(title)))`; estimate `ceil(len*7)+20`.
  `NODE_TITLE_CHAR_WIDTH_PX` 8→7, `NODE_MAX_LABEL_WIDTH_PX=200` a named constant (`src/view/constants.ts:52,55`). No magic numbers.
  Cap/wrap safety net present in CSS: `-webkit-line-clamp:2` + `overflow-wrap:anywhere` (`src/view/graph-view.css:142-146`) — a long single word with no space still wraps character-wise.
  Edge cases sound: empty title → 20 → floors to `sizePx`; short title → floors to `sizePx`; at-cap → 200; `sizePx>200` (user-raised max) → square wins, graceful.
- **B) Breadcrumb removed cleanly** — CONFIRMED. `grep -rn breadcrumb src/` yields only an unrelated comment (`src/adapters/ObsidianLinkProvider.ts:143`). Render span, CSS rule, `FlowNodeData.breadcrumbFolder`, flow/elk threading, and `breadcrumbFolderOf` (+ tests) all gone. `VaultPathFacts` import removed from `graphIdentity.ts` (its only consumer) — no orphan import; no unused params. Removed breadcrumb tests are DELETED, not skipped, and align with the human-approved feature removal (CLARIFICATION decision 2).
- **C) Height untouched** — CONFIRMED. `git diff --stat 08a2077..HEAD -- src/engine/` is empty; `height = node.sizePx` unchanged. No NodeSizer / min-max-px / engine changes.

## Sync invariant
`flowMapping.ts:170` and `elkMapping.ts:37` both call `nodeDimensionsPx(node)` (single arg) → identical width. No drift.

## Test quality
`src/view/graphIdentity.test.ts` rewritten to 5 BDD cases covering the three width regimes (square floor / snug medium / cap-pinned) plus height-unchanged, one behavior each. `MEDIUM_TITLE` (15ch → 125px) is well-chosen strictly between floor (40) and cap (200). Robust (asserts against the constant/estimator, not brittle literals).

## Docs
`docs-internal/plan/high-level-plan.md` Sizing bullet updated (cap + wrap-to-2-lines + prefix removed). CSS design-intent comment (`graph-view.css:65-71`) and the `graphIdentity.ts`/`constants.ts` doc comments are consistent with the new model.

## Findings

### NIT-1 — stale present-tense breadcrumb spec
`docs-internal/plan/steps/step-05-rich-rendering.md` (lines 16, 24, 45) still describes the breadcrumb title in present tense as if live. The implementer deliberately left step docs as historical record and updated the authoritative `high-level-plan.md`; acceptable, but a reader landing on step-05 first would be misled. Suggested fix: add a brief `(superseded 2026-07-23 — folder prefix removed)` marker on those lines.

### NIT-2 — cap-rationale comment references a configurable value
`src/view/constants.ts` — the `NODE_MAX_LABEL_WIDTH_PX` comment says it is "roughly balanced against the 160px engine max HEIGHT", but max node px is user-configurable. Behavior stays correct (the `max(sizePx, …)` floor keeps a taller square from being under-wide), so this is comment-precision only. Optional: note "default 160px max height".

## Engine purity
No `src/engine` changes; `importGuard` unaffected. The width logic lives in `src/view` (correct layer).
