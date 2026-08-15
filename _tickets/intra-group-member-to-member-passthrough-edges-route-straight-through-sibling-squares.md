---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_6qk78tgfvwzhgb5xru63hu7n3_e
title: "Intra-group member-to-member passthrough edges route straight through sibling squares"
status: in_progress
deps: []
links: []
created_iso: 2026-08-15T01:04:50Z
status_updated_iso: 2026-08-15T02:01:50Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [routing, grouping]
---

Confirmed while implementing hierarchical piercing routing (ticket nid_dwoixmdm1h59cw3bc2f6noejv_e). An intra-group edge whose BOTH endpoints are direct members of the SAME folder-group box (e.g. db/sql/s1 -> db/sql/s2 in e2e/nestedGrouping.e2e.ts) is NOT classified as "piercing" by src/view/hierarchicalEdgeRouting.ts (piercedContainersOf returns empty when the two endpoints share every ancestor container), so it is routed by the single OUTER libavoid pass. Per measured spike fact 1 (plan nid_6fkhyw97hjs84xb62z6tommhi_e), libavoid runs STRAIGHT once both endpoints are inside a group-box obstacle: it excludes shapes containing an endpoint, so such an edge cuts across sibling note squares and the group title band inside the shared box.

This was left as-is DELIBERATELY: treating these as piercing would change N=0 rendering, and the current ticket required N=0 byte-identical. The per-container inner-pass machinery already built in src/view/hierarchicalEdgeRouting.ts is the natural fix - route an intra-group edge through its shared container an inner pass (obstacles = the container direct children + title strip), attaching to the two member notes centre pins.

Scope: extend HierarchicalEdgeRouter/planHierarchicalRouting to also emit an inner pass for an edge whose two endpoints share their innermost container (both direct members), and stitch the member->member inner route. Only revisit if it looks visibly bad; low priority.

Acceptance: an intra-group member-to-member edge does not cross sibling note squares or the group title band; existing tests stay green.

