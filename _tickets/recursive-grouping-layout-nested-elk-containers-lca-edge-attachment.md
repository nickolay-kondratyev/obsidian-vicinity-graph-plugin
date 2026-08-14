---
id: nid_d44vbnq9o6rhuelfwclx2e34n_e
title: "Recursive grouping layout: nested elk containers + LCA edge attachment"
status: open
deps: [nid_unqqausmhnujjixitr6kieflq_e]
links: []
created_iso: 2026-08-14T00:18:08Z
status_updated_iso: 2026-08-14T00:18:08Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part of recursive folder grouping. Full design: plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e (closed). Depends on the grouping-tree core ticket.

src/view/elkMapping.ts (vicinityGraphToElk): build NESTED ElkNode containers from the grouping tree (today: one flat container per folder). Each container keeps elkGroupMemberOptions (rectpacking) - a nested group packs inside its parent like one big member (signed-off decision D5: rectpacking interiors in phase 1). Root stays elkForceRootOptions (force) + d3 refinement over TOP-LEVEL boxes only - unchanged.

Edges: elk contract requires each edge attached to the CLOSEST COMMON ANCESTOR container. Generalize intraGroupContainerOf/projectedRootEdges (elkMapping.ts ~60-115) to use the grouping-tree LCA seam (never re-derive LCA here). Verify extractElkPositions/extractElkDimensionsById (already recursive walks) against multi-level fixtures.

Tests: src/view/elkMapping.test.ts nested-container structure + LCA edge attachment; src/view/groupPacking.test.ts density fixtures extended with nested containers; ElkLayout/D3ForceLayout suites still green (root refinement untouched).

