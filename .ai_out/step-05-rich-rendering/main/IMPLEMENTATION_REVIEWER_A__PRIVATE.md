# IMPLEMENTATION_REVIEWER_A — PRIVATE memory (step-05 Phase A review)

Reviewed 2026-07-18 by IMPLEMENTATION_REVIEWER_A (fresh start; no prior private file existed).

## What I reviewed
- Diff range `684a90c..HEAD` (Phase A commits `a4ab397`, `680ebd3`, `ef6cec1`, `6a4667a`, `3c3bdac`), src/ only.
- Full diffs dumped to `.tmp/review-diff-engine.txt` (engine/adapters/shared, 734 lines) and `.tmp/review-diff-view.txt` (view, 1432 lines) — read both in full.
- Read in full: CLARIFICATION__PUBLIC.md, step-05 spec, EXPLORATION_PUBLIC.md, IMPLEMENTATION_A__PUBLIC.md, current `ObsidianLinkProvider.ts`, `EdgeVisibility.ts`, `view/constants.ts`.
- Did NOT read IMPLEMENTATION_A__PRIVATE.md (other role's private — protocol).

## Gates (ran independently)
- `npm test` → 422 passed / 39 files (main) + 69 passed / 6 files (sublib). Exit 0.
- `npm run check` → exit 0. `npm run build` → exit 0. Logs: `.tmp/review-npm-{test,check,build}.log`.
- No `sanity_check.sh` in repo.

## Checks performed and conclusions (chronological reasoning, keep for rehydration)
1. **Edge counts real, both modes**: `EdgeVisibility.edgesFor` attaches `count` from `provider.getLinkCount` for BOTH `walked-from-center` (walked pairs) and `all-edges` (induced sweep pairs). Verified `ObsidianLinkProvider.getLinkCount` = `resolvedLinks[source]?.[target] ?? 0` (Obsidian's own multiplicity map) with canvas-fallback branch counting raw parsed occurrences from `canvasOutgoingByPath` (raw, not deduped — test asserts 2). `Math.max(1, …)` floor only fires for a walked pair the provider momentarily answers 0 for — documented, tested, not fabrication. Engine-level tests assert counts through `NeighborhoodEngine.build` in both modes. NOT fabricated 1s. Fixture `FakeLinkProvider` now dedups link lists (real-adapter parity) and answers counts from raw lists — parity tests present.
2. **Consistency trap I hunted and cleared**: markdown outgoing lists come from cache orderedLinkTexts while counts come from resolvedLinks — both are Obsidian truth for the same links; canvas-fallback branch of getLinkCount matches the canvas branch of resolvedOutgoingPaths (same `canvasOutgoingByPath` source). No mode mixes sources per file.
3. **Frontmatter title**: precedence title>name, markdown-only, non-string/blank skipped, adapter-side (`frontmatterTitleOf`), engine consumes `metadata.frontmatterTitle ?? basename` — engine stays pure (importGuard.test.ts covers engine+shared, still green). One MINOR: returns untrimmed value though blank-check trims.
4. **View plumbing**: FlowSnapshot widened (groupByFolder + orphanTruncation), tier discriminant correct (main / pinned-central=isCentral&&!isMain / regular, tested all three), truncation badges incl. orphan aggregate w/ sorted breakdown + exactly-once conservation test. groupByFolder=false → all hidden counts flow to orphan overlay (consistent with "nothing disappears").
5. **Pure transforms**: 2+ rule + root-never-groups tested; elk compound verified against REAL elk (container wraps members, absolute positions, no overlap) + JSON shape tests (intra-group edges on container, cross-boundary on root — closest-common-ancestor rule); `INCLUDE_CHILDREN` pre-set in constants since step-04. withPositions converts children to parent-relative; group nodes stay absolute — tested. withGroupDimensions only touches folder-group nodes — tested.
6. **Reuse-layout safety reasoning**: grouping is a pure function of (visible node set, groupByFolder). reuse-layout requires identical node-id set AND no groupByFolder flip (new forced-relayout branch, tested) ⇒ identical groups ⇒ stored positions/groupDimensions contain all group ids. Folder can't change without path change in Obsidian. Sound.
7. **No scope creep**: zero color/palette/hash code (grepped), no CSS diff, no Playwright, CHANGELOG.md untouched, RebuildDecision/viewPorts/NeighborhoodGraphView/main.ts untouched. Non-src changes = .ai_out + spec doc only.
8. **Step-04 preservation**: only 2 existing assertions updated (EdgeVisibility dedup test gains count:2; flowMapping data-shape gains tier payload) — shape widening, no behavior removed. Live view wiring: group → RF `type:"group"`, parent-first ordering guaranteed by construction, controller tests cover snapshot extras + openNode ignoring group ids.

## Verdict
READY. 0 blockers, 0 majors. Findings all MINOR/NIT (see PUBLIC): untrimmed title, dual deriveFolderGroups derivation (implicit elk/flow consistency contract), dev-vault lacks step-05 fixtures for the eventual human smoke run, "" extension icon group label is a Phase B rendering duty.

## Open threads for a future clone
- If Phase B iterates on Phase A code, re-verify the reuse-layout invariant (point 6) still holds — it silently depends on grouping being derivable from node ids alone.
- Phase B must: resolve firstImagePath via new port, render count/hasOpposite on edges (currently dropped at toReactFlowEdge — correct for Phase A), handle breakdown folder "" formatting (root), add elk.padding for group labels (implementer decision #7), handle "" extension group.
- No #QUESTION_FOR_HUMAN raised.
