---
closed_iso: 2026-08-14T23:39:48Z
id: nid_6fkhyw97hjs84xb62z6tommhi_e
title: "PLAN: Edge depth into groups (piercing edges)"
status: closed
deps: []
links: [nid_g1iavmz653xxsnpdj6wzf5h98_e]
created_iso: 2026-08-14T23:37:53Z
status_updated_iso: 2026-08-14T23:39:48Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

HIGH-LEVEL PLAN for ticket nid_g1iavmz653xxsnpdj6wzf5h98_e ("Allow edge to go through boxes"). This ticket is the design record; it is CLOSED on creation. Implementation happens in the two focused tickets that depend on it.

# Feature
A "Edge depth into groups" slider (Grouping settings section) lets rendered edges reach INTO folder-group boxes instead of always collapsing onto the outermost group box. Slider value N = PER-ENDPOINT DEPTH ALLOWANCE: each edge endpoint may stay up to N group-boundary levels below the pair's lowest-common-ancestor container instead of being projected onto the LCA's direct child. N=0 (default) = exactly today's behavior.

# Human-signed decisions (2026-08-14, .out/current_decision.md of the feasibility session)
- D1: per-endpoint depth allowance semantics (NOT a per-edge crossing budget).
- D2: RENDER-ONLY. elk/d3 layout keeps consuming today's depth-0 collapsed projection (no elk INCLUDE_CHILDREN complexity). REQUIRED doc note: state in docs-internal/plan/high-level-plan.md that we may later want layout to see deep edges so linked inner nodes get pulled together (future consideration).
- D3: piercing edges MUST NOT cross note squares and MUST NOT cross group TITLE bands. The naive single-router behavior (measured: libavoid goes straight once an endpoint is inside a group-box obstacle, ignoring inner shapes) is NOT acceptable -> hierarchical routing (below).
- D4: slider label "Edge depth into groups", desc "How many levels of nested groups an edge may reach into before collapsing onto the group box. 0 keeps every group edge collapsed.", bounds min 0 / max 6 / step 1 / DEFAULT 0, plain global BoundedNumberSpec in src/engine/SettingsSpec.ts under the grouping block, slider row in BOTH presenters via standard machinery.

# Where the change lands (current architecture facts)
- Collapse is ONE pure projection: src/view/folderGrouping.ts (projectOntoContainerChildOf, lowestCommonAncestorContainerOf), consumed by src/view/flowMapping.ts buildFlowEdges (rendered edges) and src/view/elkMapping.ts attachEdgesToContainers (layout edges). Deep edges = a depth parameter on the projection, applied ONLY on the flowMapping side (D2).
- Aggregation (count badge, bidirectional merge, flyout notePairs) keys off the projected pair and works unchanged at the deeper level.
- React Flow already renders edges to subflow children (intra-group passthrough edges exist) - no RF blocker; verify z-order/legibility in e2e.
- Routing: src/view/edgeRouting.ts LibavoidEdgeRouter. All flow nodes (incl. group children) are obstacles today; group boxes carry 12 boundary pins (PIN_CLASS 1), notes a centre pin.

# Measured libavoid facts (spikes .tmp/libavoid-through-box-spike.mjs, .tmp/libavoid-composition-spike.mjs, real wasm, node)
1. Endpoint inside a group-box obstacle: connector still detours around obstacles OUTSIDE the box, but runs STRAIGHT once inside (ignores inner shapes incl. anything that would be a title strip). Root behavior: shapes containing/touching an endpoint are excluded from that connector's avoidance.
2. Point ConnEnd (new avoid.ConnEnd(new avoid.Point(x,y))) + flat obstacle set (container NOT registered as a shape): full normal avoidance. This validates per-container routing passes.
3. Multiple pin CLASSES per shape work: ConnEnd(shape, 2) attaches only to class-2 pins. Validates a separate "pierce entry" pin class.

# Routing design for D3: hierarchical composition (reuses LibavoidEdgeRouter per level, no router changes)
- OUTER pass: unchanged today's pass (all top-level obstacles incl. solid group boxes). For a piercing edge, the outer segment terminates at the pierced group's border pin - exactly where today's collapsed edge ends.
- PIERCE ENTRY PINS: piercing edges' outer ConnEnd targets a SECOND pin class on group boxes whose pins exclude the TOP side (title band lives at the top: group top edge down to GROUP_TOP_PADDING_PX, see src/view/constants.ts GROUP_BOX_PADDING_PX). So an edge never enters through the title.
- INNER passes: one small router per pierced container per rebuild: obstacles = that container's direct children (note squares + child group boxes) + a TITLE-STRIP obstacle (rect: container top band of height GROUP_TOP_PADDING_PX); edges = segments from the entry border point (point ConnEnd, spike fact 2) to the inner endpoint (shape ConnEnd: note centre pin, or child group's pierce pins when going deeper). Recurse per allowance level (N <= 6).
- STITCH: rendered polyline = outer segment + inner segment(s) joined at border points. Both-endpoints-deep edges get inner segments on both sides of the outer segment.
- Perf: one extra small pass per pierced container that actually has piercing edges; obstacle counts per pass are tiny. Existing eval harness: e2e/edgeRoutingEval.e2e.ts.
- Known accepted limitation (80/20): the outer pass picks the cheapest pierce pin without knowing the inner target's position, so a wide group can get a longer-than-ideal inner leg. Revisit only if it looks bad.
- BONUS observation, out of scope: today's intra-group member-to-member passthrough edges likely already suffer spike fact 1 (both endpoints inside the group box -> straight legs). The per-container pass machinery could later route those too; file/see follow-up if confirmed ugly.

# Implementation split (each fits a context window)
1. Ticket "Edge depth into groups: projection + settings slider (render-only)" - engine spec leaf + settings row/accessor/defaults + depth-parametrized projection in folderGrouping/flowMapping + tests. Default 0 keeps shipped behavior identical; with N>0 routing is temporarily the degraded straight-interior behavior (acceptable interim ONLY because default is 0 and plugin is unpublished).
2. Ticket "Hierarchical routing for piercing edges" (deps: ticket 1) - pierce pin class, per-container passes, title-strip obstacles, stitching; e2e verification. D3 is only satisfied once this lands: do NOT advertise/enable the slider in release notes before it.

Future consideration recorded as its own low-priority ticket: layout awareness of deep edges (pull linked inner nodes together).

## Acceptance Criteria

Plan reviewed against the four human-signed decisions; implementation tickets reference this ticket.

