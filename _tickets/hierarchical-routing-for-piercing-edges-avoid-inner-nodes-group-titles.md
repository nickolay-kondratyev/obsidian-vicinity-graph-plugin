---
id: nid_dwoixmdm1h59cw3bc2f6noejv_e
title: "Hierarchical routing for piercing edges (avoid inner nodes + group titles)"
status: open
deps: [nid_39fjevyqyfv0ge849rc77stn5_e]
links: []
created_iso: 2026-08-14T23:39:17Z
status_updated_iso: 2026-08-14T23:39:17Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Implements phase 2 of plan ticket nid_6fkhyw97hjs84xb62z6tommhi_e (read it first). Depends on ticket nid_39fjevyqyfv0ge849rc77stn5_e (the "Edge depth into groups" slider + projection).

Goal (human decision D3): when an edge pierces a group box (slider N>0), it must NOT cross note squares and must NOT cross group TITLE bands. Measured libavoid behavior (spikes in plan ticket): a single routing pass cannot do this - once an endpoint is inside a group-box obstacle the connector goes straight through inner shapes. Design: hierarchical composition reusing src/view/edgeRouting.ts LibavoidEdgeRouter per level, validated by spike .tmp/libavoid-composition-spike.mjs (point ConnEnd works; multiple pin classes per shape work).

Design (details + measured facts in the plan ticket):
1. PIERCE ENTRY PIN CLASS: register a second pin class on folder-group obstacles whose pins exclude the TOP side (the title band occupies the top GROUP_TOP_PADDING_PX of the box, src/view/constants.ts GROUP_BOX_PADDING_PX). Piercing edges' outer ConnEnd uses this class; collapsed edges keep PIN_CLASS 1 unchanged.
2. OUTER pass unchanged: today's all-obstacle pass; a piercing edge's outer segment ends at the pierced group's border (entry point).
3. INNER passes: per pierced container, a small router pass with obstacles = the container's direct children + a title-strip rect (top band, height GROUP_TOP_PADDING_PX); edges = entry border point (point ConnEnd) -> inner endpoint (note centre pin, or child group's pierce pins when recursing deeper, N<=6).
4. STITCH the polylines at border points into the rendered route (both-endpoints-deep edges stitch on both sides). Clipping: clipRouteToEndpointRects in src/view/edgeGeometry.ts clips to ENDPOINT rects only - verify it clips the true inner endpoints, not the pierced boxes.
5. Keep the composition PURE and router-agnostic behind the EdgeRouter seam (DIP): a HierarchicalEdgeRouter (or a composer over EdgeRouter) whose per-level inputs are built by a pure extraction function, unit-tested with a Fake router; wasm only in the libavoid leaf as today.

Testing:
- Unit: pure extraction/stitching (per-container obstacle sets incl. title strip; entry-point handoff; recursion; both-endpoints-deep).
- e2e: piercing edge screenshot avoids an inner square and the title band; e2e/edgeRoutingEval.e2e.ts for route-quality/perf regression (budget: passes are small; see plan perf note).
- npm run test:e2e mandatory (view-layer + routing).

Known accepted limitation (80/20, from plan): outer pass picks the cheapest pierce pin without knowing the inner target position; a wide group can get a longer inner leg. Only revisit if visibly bad.

BONUS check while in here (file follow-up ticket if confirmed, do not fix inline): today's intra-group member-to-member passthrough edges may already route straight through sibling squares (both endpoints inside the group box - spike fact 1). The per-container pass machinery is the natural fix.

## Acceptance Criteria

- With N>0, routed piercing edges do not intersect note squares or group title bands (unit-level geometry assertions + e2e screenshot).
- Piercing edges never enter a group through its top/title side.
- N=0 routing byte-identical to today.
- Routing perf on the dense fixture stays within the existing eval budget (e2e/edgeRoutingEval.e2e.ts).
- npm run check, npm test, npm run test:e2e green.

