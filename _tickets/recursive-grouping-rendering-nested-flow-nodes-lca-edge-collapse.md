---
session_ids: [{"a": "claude", "type": "execution", "id": "3750bfb8-774a-471e-847f-fa3cca292528"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_9uh2twn8whoqtplbxk0ywzpx7_e
title: "Recursive grouping rendering: nested flow nodes + LCA edge collapse"
status: in_progress
deps: [nid_d44vbnq9o6rhuelfwclx2e34n_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T01:27:41Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Depends on the nested-elk-layout ticket.

src/view/flowMapping.ts:
- Emit nested group nodes with multi-level parentId chains. Ordering invariant generalizes to: ancestor groups before descendant groups before member notes (React Flow requires parents precede children in the nodes array).
- withPositions: absolute -> parent-relative conversion must hold across multi-level parent chains.
- buildFlowEdges: replace one-level projection with LCA projection (signed-off D3): for edge X->Y find the lowest common ancestor CONTAINER (a group or the root canvas) via the grouping-tree seam; each endpoint projects to its outermost group strictly inside that container (or itself). Same-container edges stay passthrough; differing projections collapse with count badge exactly as today. Cross links (showCrossLinks / CrossLinkSweep) flow through identically - no extra branch.
- Group label (signed-off A1): src/view/FolderGroupNode.tsx shows folder NAME by default; a collapsed chain can show its full chain path when the Grouping label setting says so (setting wired in a separate ticket - here just render from the group model fields and keep full folder path in the title tooltip). Label is pure text - box size stays computed from packed children + constant paddings, no label measurement.
- Edge routing: src/view/edgeRouting.ts extractEdgeRoutingInput already makes every note and folder-group an obstacle; ensure obstacle coordinates are ABSOLUTE across multi-level parentId chains (today only one level of parent offset exists). Nested boxes become folder-group obstacles automatically.

Tests: flowMapping.test.ts (nesting order, parentId chains, LCA collapse incl. cross-link parity), edgeRouting.test.ts (absolute coords under nesting). Run e2e specs covering the graph surface (npm run test:e2e -- vicinityGraph.e2e.ts at minimum) before calling rendering done.


## Notes

**2026-08-14T01:08:59Z**

REGRESSION WINDOW surfaced by review of nid_unqqausmhnujjixitr6kieflq_e (recursive grouping CORE).

After that ticket, src/view/folderGrouping.ts deriveFolderGroups emits a "pure nesting-parent" group with EMPTY memberPaths: a qualifying folder whose visible notes all live in >=2 qualifying SUBFOLDERS and has no direct notes of its own (not collapsed, because it has >=2 child groups). Repro: notes sql/joins/a.md, sql/joins/b.md, sql/windows/c.md, sql/windows/d.md -> groups = [sql (memberPaths []), sql/joins, sql/windows].

Because the consumers are still FLAT until this ticket lands, this ships a phantom EMPTY group box for such vaults:
- src/view/flowMapping.ts (~L245 vicinityGraphToFlow) emits a GroupFlowNode for `sql` with NO note children referencing it (parentId only set on note nodes) -> empty labeled box rendered as a top-level sibling of the two real group boxes.
- src/view/elkMapping.ts (~L43) emits an elk container with children: [].
Before the core branch, `sql` was never a group, so no such box existed.

The nesting rewrite in THIS ticket resolves it by construction (the parent group contains its child group nodes/containers, so it is no longer empty). ACTION: ensure the nested-flow/elk rewrite covers the zero-direct-member nesting parent and add a flowMapping.test.ts case asserting a pure nesting-parent renders as a non-empty container (its child groups nested), NOT an empty box. If any release is cut before this lands, an interim guard is trivial: skip groups whose memberPaths is empty in the flat consumer.
