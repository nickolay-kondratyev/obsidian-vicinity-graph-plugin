---
closed_iso: 2026-08-15T02:07:13Z
session_ids: [{"a": "claude", "type": "execution", "id": "87d0fa99-7bdd-4908-b28c-bd4d209cd78c"}, {"a": "claude", "type": "review", "id": "5e9cf308-489f-45e3-9316-305a4648ce7c"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_6qk78tgfvwzhgb5xru63hu7n3_e
title: "Intra-group member-to-member passthrough edges route straight through sibling squares"
status: closed
deps: []
links: []
created_iso: 2026-08-15T01:04:50Z
status_updated_iso: 2026-08-15T02:07:13Z
type: feature
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [routing, grouping]
---

Confirmed while implementing hierarchical piercing routing (ticket nid_dwoixmdm1h59cw3bc2f6noejv_e). An intra-group edge whose BOTH endpoints are direct members of the SAME folder-group box (e.g. db/sql/s1 -> db/sql/s2 in e2e/nestedGrouping.e2e.ts) is NOT classified as "piercing" by src/view/hierarchicalEdgeRouting.ts (piercedContainersOf returns empty when the two endpoints share every ancestor container), so it is routed by the single OUTER libavoid pass. Per measured spike fact 1 (plan nid_6fkhyw97hjs84xb62z6tommhi_e), libavoid runs STRAIGHT once both endpoints are inside a group-box obstacle: it excludes shapes containing an endpoint, so such an edge cuts across sibling note squares and the group title band inside the shared box.

This was left as-is DELIBERATELY: treating these as piercing would change N=0 rendering, and the current ticket required N=0 byte-identical. The per-container inner-pass machinery already built in src/view/hierarchicalEdgeRouting.ts is the natural fix - route an intra-group edge through its shared container an inner pass (obstacles = the container direct children + title strip), attaching to the two member notes centre pins.

Scope: extend HierarchicalEdgeRouter/planHierarchicalRouting to also emit an inner pass for an edge whose two endpoints share their innermost container (both direct members), and stitch the member->member inner route. Only revisit if it looks visibly bad; low priority.

Acceptance: an intra-group member-to-member edge does not cross sibling note squares or the group title band; existing tests stay green.

## Resolution (2026-08-14, commit d16a977)

Implemented in `src/view/hierarchicalEdgeRouting.ts`:

- `planHierarchicalRouting` now classifies an edge whose two endpoints share their IMMEDIATE parent box (`sharedImmediateParentOf`) as **intra-group**: it is kept OUT of the outer pass (where libavoid would run it straight through siblings) and recorded on the new `HierarchicalPlan.intraGroupEdges` (`IntraGroupEdge`: id + containerId + endpoint ids). Piercing classification is untouched — shared parent ⇒ identical ancestor chains ⇒ pierced chains empty, so the two classes are mutually exclusive. Self-edges and member→own-box edges are NOT intra-group (unchanged behavior).
- `HierarchicalEdgeRouter.routeIntraGroupEdges` runs ONE interior pass per container owning intra edges (batched, concurrent with the descent passes — disjoint obstacle sets). Obstacles come from the new shared helper `interiorObstaclesOf` (container direct children + title strip — same set the descent passes use, now defined once); both ends attach to the member notes' normal `PIN_CLASS` pins. No stitching: the interior route IS the edge, merged into the result map under the edge's own id. A failed/empty interior pass degrades to a straight centre-to-centre leg (same policy as a failed descent pass).
- Sibling group boxes sharing a parent get the same treatment as sibling notes (same code path — an endpoint that is a folder-group just uses its boundary pins).

Deliberate behavior change vs. the previous ticket's constraint: N=0 rendering of intra-group passthrough edges is no longer byte-identical — that constraint belonged to ticket nid_dwoixmdm1h59cw3bc2f6noejv_e and this ticket explicitly authorizes changing it. With neither piercing nor intra-group edges, the router still collapses to exactly one leaf pass (byte-identical).

Tests: `src/view/hierarchicalEdgeRouting.test.ts` — classification (sibling notes / top-level / different boxes / member-to-own-box), fake-leaf composition (pass count, interior obstacles, normal-pin endpoints, batching, failure degradation), and two real-wasm assertions (no waypoint inside a straddling sibling; no waypoint inside the title band when the shortest detour is over it). Gates run green: `npm run check`, `npm test` (2107 passed), `npm run test:e2e -- edgeRouting.e2e.ts nestedGrouping.e2e.ts` (11 passed, including the pierced-edge routing spec).


## Notes

**2026-08-15T02:10:20Z**

__READY_AS_IS__: Review found no defects; classification, interior-pass composition, failure degradation and per-pass wasm router statelessness all verified; check + 2107 unit tests + 11 targeted e2e (edgeRouting, nestedGrouping) pass with zero changes.
