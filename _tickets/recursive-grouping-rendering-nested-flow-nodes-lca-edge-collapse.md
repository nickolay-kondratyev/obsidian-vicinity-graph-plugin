---
id: nid_9uh2twn8whoqtplbxk0ywzpx7_e
title: "Recursive grouping rendering: nested flow nodes + LCA edge collapse"
status: open
deps: [nid_d44vbnq9o6rhuelfwclx2e34n_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T00:18:09Z
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

