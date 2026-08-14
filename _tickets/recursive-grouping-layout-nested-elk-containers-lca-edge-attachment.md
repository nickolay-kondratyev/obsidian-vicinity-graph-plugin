---
session_ids: [{"a": "claude", "type": "execution", "id": "932f53db-5065-4d1e-b970-6b20586a99b6"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_d44vbnq9o6rhuelfwclx2e34n_e
title: "Recursive grouping layout: nested elk containers + LCA edge attachment"
status: in_progress
deps: [nid_unqqausmhnujjixitr6kieflq_e]
links: []
created_iso: 2026-08-14T00:18:08Z
status_updated_iso: 2026-08-14T01:11:47Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Depends on the grouping-tree core ticket.

src/view/elkMapping.ts (vicinityGraphToElk): build NESTED ElkNode containers from the grouping tree (today: one flat container per folder). Each container keeps elkGroupMemberOptions (rectpacking) - a nested group packs inside its parent like one big member (signed-off decision D5: rectpacking interiors in phase 1). Root stays elkForceRootOptions (force) + d3 refinement over TOP-LEVEL boxes only - unchanged.

Edges: elk contract requires each edge attached to the CLOSEST COMMON ANCESTOR container. Generalize intraGroupContainerOf/projectedRootEdges (elkMapping.ts ~60-115) to use the grouping-tree LCA seam (never re-derive LCA here). Verify extractElkPositions/extractElkDimensionsById (already recursive walks) against multi-level fixtures.

Tests: src/view/elkMapping.test.ts nested-container structure + LCA edge attachment; src/view/groupPacking.test.ts density fixtures extended with nested containers; ElkLayout/D3ForceLayout suites still green (root refinement untouched).


## Notes

**2026-08-14T01:08:59Z**

REGRESSION WINDOW surfaced by review of nid_unqqausmhnujjixitr6kieflq_e (recursive grouping CORE).

After that ticket, src/view/folderGrouping.ts deriveFolderGroups emits a "pure nesting-parent" group with EMPTY memberPaths: a qualifying folder whose visible notes all live in >=2 qualifying SUBFOLDERS and has no direct notes of its own (not collapsed, because it has >=2 child groups). Repro: notes sql/joins/a.md, sql/joins/b.md, sql/windows/c.md, sql/windows/d.md -> groups = [sql (memberPaths []), sql/joins, sql/windows].

Because the consumers are still FLAT until this ticket lands, this ships a phantom EMPTY group box for such vaults:
- src/view/flowMapping.ts (~L245 vicinityGraphToFlow) emits a GroupFlowNode for `sql` with NO note children referencing it (parentId only set on note nodes) -> empty labeled box rendered as a top-level sibling of the two real group boxes.
- src/view/elkMapping.ts (~L43) emits an elk container with children: [].
Before the core branch, `sql` was never a group, so no such box existed.

The nesting rewrite in THIS ticket resolves it by construction (the parent group contains its child group nodes/containers, so it is no longer empty). ACTION: ensure the nested-flow/elk rewrite covers the zero-direct-member nesting parent and add a flowMapping.test.ts case asserting a pure nesting-parent renders as a non-empty container (its child groups nested), NOT an empty box. If any release is cut before this lands, an interim guard is trivial: skip groups whose memberPaths is empty in the flat consumer.
