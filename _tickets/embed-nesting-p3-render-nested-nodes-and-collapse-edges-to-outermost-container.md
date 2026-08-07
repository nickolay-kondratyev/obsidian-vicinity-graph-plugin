---
id: nid_qy5rc7sq261z23bp79bk8wsem_e
title: "Embed nesting P3: render nested nodes and collapse edges to outermost container"
status: open
deps: [nid_1moqnutin09drbiyxkd3l7r5k_e]
links: [nid_e79vxubva52s9gq24idypb77x_e, nid_r3qiyd7xx3bund6f73wf5h0vd_e, nid_1moqnutin09drbiyxkd3l7r5k_e, nid_jbsbfqqxyy1brm26ul7873v5h_e]
created_iso: 2026-08-07T01:53:49Z
status_updated_iso: 2026-08-07T01:53:49Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [embed-nesting]
---

Part 3 of the embed-nesting feature (decisions: ticket nid_e79vxubva52s9gq24idypb77x_e). Consumes the nesting forest from ticket nid_1moqnutin09drbiyxkd3l7r5k_e.

GOAL: render nested nodes INSIDE their container in React Flow, and re-target edges touching nested nodes onto the OUTERMOST container, reusing the folder-group machinery.

SCOPE:
1. src/view/flowMapping.ts — nested notes get parentId = container note id (node id = vault path, src/view/graphIdentity.ts). Nesting wins over folder groups (decision Q4): a nested node leaves its folder group and does not count toward MIN_GROUP_MEMBER_COUNT in src/view/folderGrouping.ts; a container (plus subtree) may still live inside a folder group (parent chains group -> container -> nested).
2. Edge collapsing in buildFlowEdges: an edge endpoint that is a nested node projects to its OUTERMOST container (same projection pattern as folderGroupIdOf today), keeping real pairs in FlowEdge.notePairs so the link-preview drawer (src/view/GraphViewController.ts openEdgePreview + src/view/linkPreviewModel.ts) shows the true note-to-note relationships unchanged. Never draw an edge between a node and its nesting ancestor/descendant; edges collapsing to a self-loop on the outermost container are dropped (decision Q5). A losing embedder still gets a collapsed edge to the winner's outermost container (decision Q6).
3. src/view/elkMapping.ts — containers become compound elk nodes like folder groups; children stack VERTICALLY in the forest's child order (decision Q8); container auto-sizes from elk with padding; extractElkDimensionsById covers nested containers. Structural diff (src/view/GraphStructureDiff.ts) must treat a nesting change (parent changed) as relayout.
4. src/view/NoteNode.tsx + CSS (src/view/*.css, obsidian theme vars): container renders its children region below its own title/outline; nested nodes visually distinct but consistent. v1 disables drag-resize (NodeResizeControl) on containers and nested children, and ignores size overrides while nested (decision Q8). Clicking a nested node still opens its note via NoteOpenContext; pin/unpin still works on nested nodes.

TESTS: BDD unit tests for flowMapping/elkMapping/GraphStructureDiff changes; jsdom component tests (per-file @vitest-environment jsdom pragma, harness pattern in src/view/testFixtures/) for the container node rendering. THEN npm run test:e2e (view-layer DOM/CSS change — required per CLAUDE.md before calling this done); add e2e coverage in the P4 ticket but the existing suite must be green here.

npm run check + npm test + npm run test:e2e green.

## Acceptance Criteria

Nested notes render inside containers in embed order; edges to nested nodes attach to the outermost container with link preview showing true pairs; central/pinned precedence visible in a real vault; existing e2e suite green.

