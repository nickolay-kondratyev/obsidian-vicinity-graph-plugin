---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_as3hdgn25pbxttimy643f46v7_e
title: "Per-container layout plumbing: recursive GraphLayoutRunner seam"
status: in_progress
deps: [nid_d44vbnq9o6rhuelfwclx2e34n_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T02:24:44Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Follow-up enabler from recursive-grouping plan nid_xko67wo2z4awg5gdrm1xx1chz_e (signed-off D5). Pure seam, NO default behavior change.

Today src/view/GraphLayoutRunner.ts runs elk then, iff the ROOT uses ELK_FORCE_ALGORITHM, applies refineForceRootLayout (src/view/d3ForceRefinement.ts) to root.children only - group interiors are never refined. refineForceRootLayout is already generic over any ElkNode, and after layout each container ElkNode carries its children AND its intra-group edges (attached per elk contract in src/view/elkMapping.ts).

Build the seam: recurse into laidOut.children in GraphLayoutRunner; per container, decide (via the container algorithm marker, mirroring the root check) whether to run refinement. With every container still on rectpacking, output is byte-identical to today - assert that in tests. This unblocks the edge-aware interior evaluation ticket without touching visuals.

