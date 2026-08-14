---
closed_iso: 2026-08-14T01:21:37Z
session_ids: [{"a": "claude", "type": "execution", "id": "932f53db-5065-4d1e-b970-6b20586a99b6"}, {"a": "claude", "type": "review", "id": "563c6acd-7587-462f-b0a2-122d46709001"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_d44vbnq9o6rhuelfwclx2e34n_e
title: "Recursive grouping layout: nested elk containers + LCA edge attachment"
status: closed
deps: [nid_unqqausmhnujjixitr6kieflq_e]
links: []
created_iso: 2026-08-14T00:18:08Z
status_updated_iso: 2026-08-14T01:21:37Z
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

## Resolution (2026-08-14)

Implemented. All gates green: `npm run check` (0 errors), `npm test` (2009 pass), `npm run test:e2e -- vicinityGraph.e2e.ts` (27 pass).

### New grouping-tree seam
`src/view/folderGrouping.ts` gained `FolderGroupingResult.projectOntoContainerChildOf(notePath, container)`: projects a note onto the DIRECT CHILD of `container` (null = canvas pane) that renders it — the group strictly inside `container` on the note's chain, or `null` when the note is a direct leaf member of `container`. Built on the existing private `renderedGroupChainOf` (finds the chain group whose `parentFolder === container.folder`), so LCA and projection both live ONCE in `folderGrouping` — consumers never re-derive the tree (DRY). This is the ONE projection seam BOTH edge consumers use; it satisfies elk's `SEPARATE_CHILDREN` contract (an edge may only name its host container's direct children, never a deeper descendant).

### elkMapping.ts (`vicinityGraphToElk`)
- Containers now NEST: build every container (with its direct note-member leaves) in pass 1, then pass 2 pushes each into its `parentFolder` container (top-level ones become root children). Each container keeps `elkGroupMemberOptions` (rectpacking) + `ELK_GROUP_PADDING`; root stays `elkForceRootOptions` (force) — unchanged, so d3 refinement over top-level boxes is untouched.
- `intraGroupContainerOf` + `projectedRootEdges` were REPLACED by one `attachEdgesToContainers`: for each edge it asks `lowestCommonAncestorContainerOf` for the host container (null = root), projects both endpoints onto that container's direct children via the new seam, and attaches the edge there. Root-bound edges (LCA null) keep the old dedup + centre-outward reorientation (force seed hint); interior edges keep their `edgeIdOf` id (rectpacking ignores them — they exist only to satisfy the contract).

### flowMapping.ts (`vicinityGraphToFlow`)
- Group nodes now carry a `parentId` (nested group → parent group's id; top-level → none), mirroring the elk nesting so RF subflows and the layout tree agree. This is what fixes the phantom empty `sql` box — the pure nesting-parent renders as a non-empty container holding its child group boxes.
- Group nodes are ordered ancestor-first (sorted by folder DEPTH via `folderDepthOf`) because `grouping.groups` is nearest-ancestor-first and can otherwise place a nesting parent AFTER its child, violating React Flow's parent-before-child rule. Note nodes are still appended after all group nodes.
- `buildFlowEdges` now takes the whole `grouping` and uses the SAME LCA + `projectOntoContainerChildOf` projection as elk (was: nearest-group projection, which mis-rendered a parent's direct member linking into a subgroup as a group→child self-ish edge). Passthrough is now simply "neither endpoint projected" (both direct leaf members of their LCA); collapsed is "at least one endpoint projects onto a child group".

### Tests
- `src/view/elkMapping.test.ts`: new "nested folder-group containers" describe — nesting-parent-with-no-direct-notes holds child containers (not empty), members nest two levels, only the top-level box is a root child, intra-subgroup edge stays member-to-member on the child, cross-sibling edge attaches to the LCA projected onto its children, root carries no edges, and a parent direct-member→subgroup edge projects leaf + child group.
- `src/view/flowMapping.test.ts`: new "nested folder groups" describe — parentId nesting, non-empty pure-nesting-parent box, parent-before-child ordering, cross-sibling collapse onto group boxes.
- `src/view/groupPacking.test.ts`: new "nested folder-group containers" describe runs REAL elkjs over a 2-level nested graph and asserts each child container sits inside its parent's box and each member inside its own child container (plus the parent-with-only-subgroups is still a laid-out box).

The interim empty-group guard mentioned above was never needed / not added — nesting resolves it by construction.

**2026-08-14T01:25:16Z**

__READY_AS_IS__: Reviewed nested-elk/LCA-projection logic end-to-end; nesting wiring, edge attachment, depth-sort parent ordering, and passthrough simplification all verified sound; check + 2009 unit tests + 27 e2e green; no fixes needed.
