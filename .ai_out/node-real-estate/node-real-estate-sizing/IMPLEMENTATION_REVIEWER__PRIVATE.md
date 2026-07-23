# IMPLEMENTATION_REVIEWER — PRIVATE (rehydration memory)

Task: review commit `998fdac` — WIDTH-ONLY node real-estate iteration. Height out of scope.
Base `08a2077`.

## Verdict: APPROVE (no blocking, no should-fix; 2 nits)

## Gates (independently run, read-only)
- `npm test` = 0 → 55 files / 673 tests PASS (.tmp/review-test.log)
- `npm run check` (tsc strict) = 0 PASS (.tmp/review-check.log)

## Requirement verification
A) Width formula — CONFIRMED. `nodeDimensionsPx` (graphIdentity.ts:52-57):
   `width = max(sizePx, min(NODE_MAX_LABEL_WIDTH_PX=200, estimateNodeLabelWidthPx(title)))`,
   `estimate = ceil(title.length*7)+20`. NODE_TITLE_CHAR_WIDTH_PX 8→7. NODE_MAX_LABEL_WIDTH_PX=200 named const. No magic numbers.
   CSS title has `-webkit-line-clamp:2` + `overflow-wrap:anywhere` (graph-view.css:142-146) → long single word wraps char-wise. Edge cases all fine (empty→20→floors to sizePx; short→floors; cap boundary→200; sizePx>200 user-config→square wins, graceful).
B) Breadcrumb removed end-to-end — CONFIRMED. `grep breadcrumb src/` only hits an unrelated comment in ObsidianLinkProvider.ts:143. Removed: NoteNode span, CSS `.vicinity-graph-node__breadcrumb`, FlowNodeData.breadcrumbFolder, threading in flow/elkMapping, breadcrumbFolderOf + tests. VaultPathFacts import dropped from graphIdentity.ts (was only used by breadcrumbFolderOf) — no orphan import. No unused params. flowMapping.test.ts still uses asFolderPath(10)/groupedGraph(14) — not orphaned. tsconfig has NO noUnusedLocals, but manual grep confirms clean.
C) Height untouched — CONFIRMED. `git diff --stat src/engine/` empty. height=node.sizePx unchanged.

## Sync invariant
flow + elk both call `nodeDimensionsPx(node)` single-arg → identical width. No drift.

## Test quality
graphIdentity.test.ts rewritten, 5 BDD cases covering 3 width regimes (floor square / snug medium / cap) + height-unchanged. MEDIUM_TITLE=15ch→125px (between 40 & 200). Removed breadcrumb tests are DELETED, not skipped. flowMapping.test.ts breadcrumb describe + width test deleted. Removal aligned w/ human-approved feature removal (CLARIFICATION decision 2).

## Docs
high-level-plan.md:59 Sizing bullet updated correctly (cap + wrap-to-2-lines + prefix removed). CSS design-intent comment (graph-view.css:65-71) updated. graphIdentity.ts + constants.ts doc comments rewritten.

## Nits (non-blocking)
1. step-05-rich-rendering.md still describes breadcrumb in PRESENT tense (lines 16,24,45) as if live. Impl deliberately left it as historical record; authoritative doc is updated. Minor staleness. Could add a "(superseded)" marker.
2. NODE_MAX_LABEL_WIDTH_PX=200 comment cites "balanced vs 160px engine max HEIGHT" which is user-configurable; floor `max(sizePx,…)` keeps it graceful if raised. Purely a comment-precision nit.
