---
closed_iso: 2026-08-07T04:37:38Z
id: nid_qy5rc7sq261z23bp79bk8wsem_e
title: 'Embed nesting P3: render nested nodes and collapse edges to outermost container'
status: closed
deps: [nid_1moqnutin09drbiyxkd3l7r5k_e]
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_r3qiyd7xx3bund6f73wf5h0vd_e, nid_1moqnutin09drbiyxkd3l7r5k_e,
  nid_jbsbfqqxyy1brm26ul7873v5h_e]
created_iso: '2026-08-07T01:53:49Z'
status_updated_iso: 2026-08-07T04:37:38Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Part 3 of the embed-nesting feature (decisions: ticket nid_e79vxubva52s9gq24idypb77x_e). Consumes the nesting forest from ticket nid_1moqnutin09drbiyxkd3l7r5k_e.

GOAL: render nested nodes INSIDE their container in React Flow, and re-target edges touching nested nodes onto the OUTERMOST container, reusing the folder-group machinery.

SCOPE:
1. src/view/flowMapping.ts — nested notes get parentId = container note id (node id = vault path, src/view/graphIdentity.ts). Nesting wins over folder groups (decision Q4): a nested node leaves its folder group and does not count toward MIN_GROUP_MEMBER_COUNT in src/view/folderGrouping.ts; a container (plus subtree) may still live inside a folder group (parent chains group -> container -> nested).
2. Edge collapsing in buildFlowEdges: an edge endpoint that is a nested node projects to its OUTERMOST container (same projection pattern as folderGroupIdOf today), keeping real pairs in FlowEdge.notePairs so the link-preview drawer (src/view/GraphViewController.ts openEdgePreview + src/view/linkPreviewModel.ts) shows the true note-to-note relationships unchanged. V1 draws NO edges within a drawn nesting tree AT ALL (decision Q5 as resolved): not ancestor/descendant, not siblings/relatives — every edge whose endpoints share an outermost container is dropped (they all collapse to a self-loop on it). Future (out of V1 scope, noted in decision ticket): edges between DIRECT siblings may come back. A losing embedder still gets a collapsed edge to the winner's outermost container (decision Q6) — but ONLY when the loser lands OUTSIDE the winner's tree; if both project to the same outermost container the intra-tree drop (Q5) wins, no special case needed (it falls out of the one projection rule). Note React Flow's constraint: a node with parentId must appear AFTER its parent in the nodes array — order the flow nodes so container chains (group → container → nested) are parent-first, same as folder groups today.
3. src/view/elkMapping.ts — containers become compound elk nodes like folder groups; children stack VERTICALLY in the forest's child order (decision Q8); container auto-sizes from elk with padding; extractElkDimensionsById covers nested containers. Structural diff (src/view/GraphStructureDiff.ts) must treat a nesting change (parent changed) as relayout.
4. src/view/NoteNode.tsx + CSS (src/view/*.css, obsidian theme vars): container renders its children region below its own title/outline; nested nodes visually distinct but consistent. v1 disables drag-resize (NodeResizeControl) on containers and nested children, and ignores size overrides while nested (decision Q8 as resolved; real resize semantics — container resize grows its DIRECT content, child resize past the edge upsizes the container chain — is its own workstream, ticket nid_1av3d7fx1072oyp5lxyhjd451_e). V1 also disables individual drag-REPOSITION of nested children (draggable=false on nested nodes): their positions are owned by the elk vertical stack, and a hand-moved child inside a container has no persistence or relayout story yet — dragging the outermost container moves the whole tree. Clicking a nested node still opens its note via NoteOpenContext; pin/unpin still works on nested nodes.

TESTS: BDD unit tests for flowMapping/elkMapping/GraphStructureDiff changes; jsdom component tests (per-file @vitest-environment jsdom pragma, harness pattern in src/view/testFixtures/) for the container node rendering. THEN npm run test:e2e (view-layer DOM/CSS change — required per CLAUDE.md before calling this done); add e2e coverage in the P4 ticket but the existing suite must be green here.

npm run check + npm test + npm run test:e2e green.

## Acceptance Criteria

Nested notes render inside containers in embed order; edges to nested nodes attach to the outermost container with link preview showing true pairs; central/pinned precedence visible in a real vault; existing e2e suite green.

## Notes

**2026-08-07T04:37:38Z**

RESOLVED — implemented and all gates green (npm run check, npm test = 1787 tests, npm run test:e2e = 159 passed / 1 skipped).

What shipped, by scope:

1. flowMapping.ts — nesting derived first (deriveNestingForest); nested paths excluded from folder grouping (folderGrouping.deriveFolderGroups gained an excludedPaths arg), so a nested node leaves its group and does not count toward MIN_GROUP_MEMBER_COUNT (Q4). parentId = container path for nested nodes else folder-group id; nodes ordered parent-first via new orderNotesParentFirst (DFS from roots) to satisfy React Flow's parent-before-child array constraint (chain group -> container -> nested). FlowNodeData gained isContainer / isNested. Nested/container dimensions use graphIdentity.nodeContentFitPx (ignores size override, Q8); hasSizeOverride is false while nested/container. withGroupDimensions now also wraps container note nodes.

2. buildFlowEdges(graph, groupFolderByMemberPath, nesting) — composite projectId = outermost-container THEN folder-group (embedNesting.outermostContainerOf). Intra-tree drop: edge skipped when source !== target && outermost(source) === outermost(target) (Q5 — every edge sharing an outermost container drops). Q6 (losing embedder outside the winner's tree still collapses to the winner's container) falls out of the one projection rule, no special case. True note pairs preserved in FlowEdge.notePairs for the link-preview drawer.

3. elkMapping.ts — containers become COMPOUND elk nodes; children stack vertically via elk.algorithm=layered / direction=DOWN plus a synthetic ordering-chain of edges (NESTING_ORDER_EDGE_PREFIX) to force child-order; container auto-sizes (elk.nodeSize.minimum = own content; elk.padding top = own-content height + gap to reserve the title band). extractElkDimensionsById / extractElkPositions cover nested containers (verified with a real headless elk run). Intra-tree edges dropped before elk; cross-boundary edges projected with the same composite rule. GraphStructureDiff treats a nesting change (any node's containerPath changed) as relayout (new sameNesting check).

4. NoteNode.tsx + graph-view.css — container renders children region below its title/outline (data-container); nested nodes visually distinct (data-nested). Drag-resize controls hidden on containers/nested; VicinityGraphFlow sets draggable=false on nested nodes (positions owned by the elk stack). Click-to-open and pin/unpin still work on nested nodes.

Tests: new flowMappingNesting.test.ts (17), elkMappingNesting.test.ts (10, incl. real ElkLayoutRunner), GraphStructureDiff nesting-relayout case, folderGrouping excludedPaths, embedNesting nestedPaths/outermostContainerOf, NoteNode.component.test.tsx container/nested markers. Adapted flowMapping.test.ts stage-2 embed tests to target MAIN (never nested) so the kind-union assertions survive the Q5 drop. Fixed e2e/linkPreview.e2e.ts: opens the embed TARGET as main (main never nests) so embed-source -> embed-target survives as a passthrough edge carrying the embed occurrence.

Follow-ups (already ticketed): e2e coverage + docs = nid_jbsbfqqxyy1brm26ul7873v5h_e (P4); real resize semantics = nid_1av3d7fx1072oyp5lxyhjd451_e / nid_rju51kn8sndg0v4dvxvwzdkap_e.
