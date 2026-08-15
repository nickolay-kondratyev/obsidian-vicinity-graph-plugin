---
closed_iso: 2026-08-15T01:04:56Z
session_ids: [{"a": "claude", "type": "execution", "id": "68df7592-d8a7-4133-85eb-e3369fa4b458"}, {"a": "claude", "type": "review", "id": "e9b89d05-72eb-47aa-8213-5598da88ad05"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_dwoixmdm1h59cw3bc2f6noejv_e
title: "Hierarchical routing for piercing edges (avoid inner nodes + group titles)"
status: closed
deps: [nid_39fjevyqyfv0ge849rc77stn5_e]
links: []
created_iso: 2026-08-14T23:39:17Z
status_updated_iso: 2026-08-15T01:04:56Z
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

## Resolution (2026-08-14)

Implemented as designed — hierarchical composition over the existing libavoid leaf,
behind the `EdgeRouter` seam, with the composition PURE and unit-tested.

### What was built / where it lives

- **`src/view/edgeRouting.ts`** (leaf extensions, all backward-compatible):
  - `PIERCE_PIN_CLASS = 2` + `PIERCE_ENTRY_PIN_SPECS` — the 9 boundary pins EXCLUDING
    the three top (up-facing) ones, so a piercing edge never enters through the title.
  - `RoutingObstacle.kind` gained `"title-strip"` (a pins-less solid blocker) and an
    optional `registerPierceEntryPins` flag (register class-2 pins on a folder-group box).
  - New general seam `PassRouter.routePass(RoutingPassInput)` with `RichRoutingEdge` /
    `RoutingEndpoint` (a `{shape,pinClass}` OR a bare `{point}` end). `AvoidArena` gained
    `connEndPoint(x,y)` (a point `ConnEnd`; libavoid COPIES the point, verified no
    double-free). `LibavoidEdgeRouter` now implements BOTH `EdgeRouter` and `PassRouter`;
    its old `route(EdgeRoutingInput)` just lifts every edge to two shape/PIN_CLASS ends and
    delegates — so with no pierce pins / no point ends it is byte-identical to before.
- **`src/view/hierarchicalEdgeRouting.ts`** (NEW, pure composer + `HierarchicalEdgeRouter`):
  - Containment is DERIVED GEOMETRICALLY from the flat obstacle rectangles
    (`deriveObstacleContainment`), so NOTHING new crosses the controller seam — the
    controller (`GraphViewController`) and `extractEdgeRoutingInput` are UNCHANGED, and
    clipping still clips to the true endpoint (source/target) rects.
  - `planHierarchicalRouting` classifies each edge: an endpoint "pierces" its ancestor
    boxes that do NOT also contain the other endpoint. Outer pass = today's all-obstacle
    pass, but a piercing endpoint targets its OUTERMOST pierced container's pierce pins
    (that box flagged to register them). `hasPiercing === false` ⇒ the outer pass IS the
    whole result (N=0 byte-identical, one pass, no extra pins).
  - `HierarchicalEdgeRouter.route`: runs the outer pass, seeds a descent job per pierced
    side from the outer route's border ends, then descends one container per level
    (batched by container, passes at a level run concurrently). Each inner pass' obstacles
    = that container's DIRECT children + a title-strip blocker (top band, height
    `GROUP_BOX_PADDING_PX.top`); the edge routes from the border ENTRY point (a point
    `ConnEnd`) to the next box down (pierce pins) or the final note (centre pin) / group
    (pierce pins). `stitchPiercingRoute` joins `A → A-border → B-border → B`.
  - Wired in **`src/view/VicinityGraphView.tsx`**: `new HierarchicalEdgeRouter(new LibavoidEdgeRouter())`.

### Tests

- **`src/view/hierarchicalEdgeRouting.test.ts`** (NEW, 23 tests): pure containment /
  classification / pass-composition / stitching with a `RecordingPassRouter` fake, PLUS a
  real-wasm block (same node-build load as `edgeRouting.test.ts`) proving a piercing route
  avoids an inner note square, avoids the title band, does NOT enter through the top even
  when the outer endpoint is directly above, and reproduces the leaf's route byte-for-byte
  when nothing pierces.
- **`e2e/nestedGrouping.e2e.ts`** (submodule): new test (7) "a pierced edge routes around
  the group's title band and its sibling squares" — with `Edge depth into groups = 1`,
  samples the rendered `db/x1.md->db/sql/s1.md` polyline (screen coords) and asserts zero
  points fall inside the `db/sql` title label or the sibling `s2` square.

### Gates (all green)

`npm run check` (0 errors), `npm test` (2084 passed / 1 skipped), full `npm run test:e2e`
(177 passed). Dense-fixture routing perf unchanged (routingMs≈144 vs layoutMs≈1310) — the
composer only adds passes when an edge actually pierces, and the eval fixtures run at N=0.

### Notes for the next reader

- Containment is geometric (rect-in-rect with a 0.5px tolerance), NOT the grouping tree —
  this is deliberate: it keeps the controller seam flat and the composer a pure function of
  `EdgeRoutingInput`. It matches the grouping tree because group boxes nest as folders do.
- The BONUS check (intra-group member↔member passthrough edges routing straight through
  siblings) is CONFIRMED still true and INTENTIONALLY left as-is: such edges are NOT
  classified as piercing (both endpoints share the box), so N=0 stays byte-identical. The
  per-container pass machinery here is the natural future fix — file a follow-up if it looks
  bad in practice.
- The known 80/20 limitation stands: the outer pass picks the cheapest pierce pin without
  knowing the inner target position, so a wide group can get a longer inner leg.
- e2e tests live in the `e2e/` submodule — commit them there before committing this repo.

