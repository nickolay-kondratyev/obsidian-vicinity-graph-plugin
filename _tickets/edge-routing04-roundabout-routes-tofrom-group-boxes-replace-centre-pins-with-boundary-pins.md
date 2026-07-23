---
id: nid_54ura771jb1b82dah6macdqvj_e
title: "edge-routing__04: roundabout routes to/from group boxes - replace centre pins with boundary pins"
status: closed
deps: []
links: [nid_o1f05i1pu3lgkmaxpbaj13x3x_e, nid_w8co2gp7cok2a2hwwsm88brfo_e]
created_iso: 2026-07-23T18:09:12Z
status_updated_iso: 2026-07-23T20:45:00Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [edge-routing, view]
---

## Problem

Routed edges take visibly roundabout paths when a direct route exists, inflating
visual complexity. Real-life repro (2026-07-23):

- Vault: `.out/vaults/public`, active note `wealth-buys-external-freedom.md`,
  graph controls outgoing: 2, incoming: 1, edge routing ON, force layout.
- Screenshot: `.out/vaults/.tmp/Screenshot From 2026-07-23 12-01-33.png`
  (NOT source-controlled — re-capture if gone; setup above reproduces it).
- Symptom 1: edge `freedom` group → `th/Discipline Leads to Freedom` loops far
  DOWN and around instead of the short, unobstructed horizontal hop between the
  two (they are near-adjacent at the top of the layout).
- Symptom 2: edge `th/wealth-buys-external-freedom` → `rel` group dives to the
  bottom-right and enters `rel` from below, though `rel` sits directly to the
  node's right with clear space between them.

## Root cause (analysis 2026-07-23)

Not a tuning problem (segment/crossing penalties are fine). It is a structural
endpoint-attachment problem in `src/view/edgeRouting.ts` — two interacting facts:

1. **Connector endpoints pin to shape CENTRES.** `LibavoidEdgeRouter.route()`
   registers exactly one `ShapeConnectionPin` per obstacle at proportional
   (0.5, 0.5) (`PIN_CENTRE_FRACTION`, `CENTRE_PIN_CLASS` —
   `src/view/edgeRouting.ts:143-147, 249-257`). libavoid therefore optimises the
   **centre→centre** path, while the UI displays only the border→border clip
   (`clipRouteToEndpointRects` applied post-hoc in
   `src/view/GraphViewController.ts:383-403`). The cheapest centre→centre route
   can lawfully exit/enter a box on a side far from the direct border→border
   chord — and for a large group box the interior leg (which we clip away)
   dominates the cost, so the router's optimum and the *visible* optimum diverge.

2. **A group's own member squares are blocking obstacles for the group's own
   connectors.** `extractEdgeRoutingInput` (`src/view/edgeRouting.ts:109-141`)
   emits EVERY flow node as an obstacle — including note squares nested inside
   folder groups (they carry absolute positions). libavoid only exempts the
   endpoint's *own ShapeRef* from blocking its connector; the endpoint group's
   CHILDREN remain obstacles, each inflated by
   `EDGE_ROUTING_SHAPE_BUFFER_PX = 17`. So a connector pinned at a group's centre
   must thread from deep inside the group past its own children to escape.

**Smoking gun** (measured off the repro screenshot): the `freedom` group box is
≈(418,48)–(838,328) ⇒ centre ≈(628,188), which lies **inside the
"External Freedom" child square** ≈(602,95)–(816,308). The connector endpoint
sits inside a blocking obstacle (+17px buffer), so libavoid escapes through
whatever channel remains — here downward — and the clipped, visible route
becomes the big loop to `Discipline Leads to Freedom`. Same mechanism for
`rel`: its centre falls in the buffered pocket between the `buys`/`Helps`/`gives`
tiles, so the route is forced to enter through the bottom gap, producing the
`wealth-buys-external-freedom → rel` detour. Any group whose centre is covered
by a child tile (common — groups pack children) degrades this way.

## Plan

### Phase A — boundary pins (primary fix)

- In `LibavoidEdgeRouter.route()`, replace the single centre pin with **multiple
  same-class proportional boundary pins** per shape: 4 side-midpoints
  (0.5,0)/(1,0.5)/(0.5,1)/(0,0.5) + 4 corners. libavoid picks the best pin per
  connector end among same-class pins, so each edge attaches on the side facing
  its counterpart, routes never need to traverse the endpoint box's interior,
  and the endpoint group's children stop distorting the route.
- Give each pin a side-appropriate `visDirs` (`ConnDirLeft/Right/Up/Down` — add
  the typed constants to the `Avoid` interface in `src/view/libavoidLoader.ts`;
  the binding already exposes them via the index signature) so departures leave
  perpendicular to the box instead of skimming along it. Corner pins keep
  `ConnDirAll`.
- KEEP `clipRouteToEndpointRects` unchanged: it becomes a near no-op for
  boundary-pinned routes but still guarantees the arrowhead-on-boundary contract
  and covers degenerate overlaps.
- Perf gate (edge-routing__03 budget): dense fixture routing pass must stay well
  under layout time (~140ms baseline vs ~1460ms layout — the existing
  `console.debug("vicinity-graph: edge routing pass", ...)` line measures it).
  If 8 pins/shape on ~100 obstacles blows the budget, fall back to boundary pins
  on **folder-group shapes only** (note squares keep the centre pin — they are
  small, so centre≈boundary after clipping and they exhibit the pathology far
  less).

### Phase B — detour-ratio telemetry (verification aid)

- Add a pure, node-testable metric in `src/view/edgeGeometry.ts`: detour ratio =
  routed polyline arc length ÷ endpoint-rect boundary chord length. Unit-test it
  (BDD, colocated).
- Log max/mean detour ratio in the existing routing-pass `console.debug` line so
  before/after comparisons on the repro vault are numeric, not just visual.
  (The real wasm router cannot run under vitest — the `libavoid-wasm` virtual
  module only resolves under esbuild — so route QUALITY is verified via this
  metric in the dev vault + screenshots, while the geometry math is unit-tested.)

### Phase C — line-of-sight shortcutting (fallback, only if A insufficient)

- Post-clip pure pass: iteratively drop interior waypoints whenever the straight
  segment between their neighbours clears all obstacles (inflated by the 17px
  buffer). Node-testable against fixture obstacle sets. NOT default scope — do
  it only if boundary pins still leave visible detours on the repro.

### Alternative considered and rejected

- *Drop group children from the obstacle set*: fixes the escape problem but
  intra-group passthrough edges would then overlap sibling squares, and it
  leaves root cause 1 (centre-cost distortion on large boxes) in place. Boundary
  pins fix both without losing child avoidance.

## Verification

1. `npm test` + `npm run check` green; new edgeGeometry metric tests pass.
2. Repro: `.out/vaults/public`, note `wealth-buys-external-freedom.md`,
   outgoing 2 / incoming 1 — `freedom → Discipline Leads to Freedom` and
   `wealth-buys-external-freedom → rel` render near-direct; screenshot to
   `.out/` and compare against the repro screenshot.
3. Detour-ratio debug log improves (max ratio drops materially) on the repro
   vault AND on the sparse/medium/dense dev-vault fixtures (no regressions).
4. Routing pass duration on the dense fixture stays well under layout time.

## Acceptance

- Edges to/from folder-group boxes attach on the side facing the counterpart
  node and take near-direct routes when unobstructed; no route is forced
  roundabout by the endpoint group's own children.
- Obstacle avoidance for third-party boxes still works (routes still detour
  around genuinely intervening obstacles).
- Perf budget held; `clipRouteToEndpointRects` contract and arrowhead behaviour
  unchanged; radial layout remains routing-skipped.

## Resolution (2026-07-23, CLOSED)

Shipped Phase A + B. **Group-only boundary pins**: 8 proportional pins (4
side-midpoints with outward `visDirs` + 4 corners) on folder-group shapes; note
squares keep the single centre pin (8-pins-on-all blew the dense budget ~8.8s vs
~1.45s layout). Added typed `ConnDirUp/Down/Left/Right` to the `Avoid` interface;
threaded `kind` onto `RoutingObstacle`. Grouped-fixture max detour ratio 1.000 —
repro loops gone. **Detour-ratio telemetry** added to `edgeGeometry.ts` (unit-tested,
logged in the routing-pass debug line); fixed a telemetry-ordering bug so the pass is
logged before the `isStale` early-return (PERF BUDGET e2e was false-passing).
**Phase C (line-of-sight shortcutting) NOT needed** — boundary pins sufficed. Perf
held: dense/force routing ~137ms vs layout ~1464ms. 664/664 tests, tsc clean.
