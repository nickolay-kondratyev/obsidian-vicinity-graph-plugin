---
id: nid_wku3029kwmnei7e86rbb1dk7w_e
title: "Collapsed group arrows must terminate at the group boundary (clip routed edges to endpoint rects)"
status: open
deps: []
links: [nid_var2o7krxq7ribq3iofni3aw1_e]
created_iso: 2026-07-22T20:37:35Z
status_updated_iso: 2026-07-22T20:37:35Z
type: bug
priority: 0
assignee: CC_WITH-nickolaykondratyev
---

## Problem

Edges collapsed onto a folder group (per `docs-internal/vicinity-graph-specs/arrows.md`)
should visually terminate **at the group container's boundary**. With edge routing ON
(the default: `DEFAULT_EDGE_ROUTING = true`, `DEFAULT_LAYOUT_MODE = "force"` in
`src/engine/constants.ts`), the arrow instead plunges INSIDE the group box and its
arrowhead lands on/near an individual member node — reading as a node→node link, not a
node→group link.

Evidence screenshot (arrow ends next to the "Clear Goals" member inside the group box):
`.tmp/Screenshot From 2026-07-22 14-26-52.png` (not source-controlled; reproducible on
any vicinity with a collapsed cross-boundary edge + routing ON).

## Root cause (confirmed by code reading)

The routed path terminates at the endpoint box's geometric **CENTRE**, not its boundary:

1. `LibavoidEdgeRouter.route` (`src/view/edgeRouting.ts:230-284`) registers every
   obstacle with a proportional centre pin — `PIN_CENTRE_FRACTION = 0.5`
   (`src/view/edgeRouting.ts:147`), applied via `new avoid.ShapeConnectionPin(shape,
   CENTRE_PIN_CLASS, 0.5, 0.5, true, 0, avoid.ConnDirAll)`
   (`src/view/edgeRouting.ts:249-257`). Connector endpoints are shape-attached to that
   pin, so `readRoute` (`src/view/edgeRouting.ts:213-221`) returns a polyline whose
   first/last point is the box **centre**.
2. `routedGeometryFor` (`src/view/edgeGeometry.ts:243-268`) then insets the arrowhead
   only 14–48px back from that centre (`arrowFromApproach`,
   `src/view/edgeGeometry.ts:322-346`). For small note squares, centre − inset ≈
   boundary, so notes look fine. For a large group box the centre is deep inside →
   the arrowhead sits on top of member nodes. Nothing anywhere clips the route to the
   endpoint rectangle.

The non-routed path (routing OFF / radial / wasm-failure fallback) is NOT this bug:
fixed `Top`/`Bottom` handles on `src/view/FolderGroupNode.tsx:26-50` do anchor on the
boundary. Its side-choice quality is the linked ticket
`nid_var2o7krxq7ribq3iofni3aw1_e`.

## Plan (no engine changes; pure view-layer geometry)

### 1. Clip routed polylines to the endpoint rects (the fix)

Add a pure function in `src/view/edgeGeometry.ts` (RF-free, vitest-testable):

```
clipRouteToEndpointRects(points, sourceRect, targetRect): RoutedPoint[]
```

- Walk from the END of the polyline: drop points strictly inside `targetRect`; replace
  the last kept segment's endpoint with its intersection point on the rect border.
  Mirror from the START for `sourceRect`.
- Degenerate guards: if clipping would consume the whole polyline (overlapping source
  and target rects / tiny edge), fall back to the unclipped 2-point chord — never emit
  an empty/NaN geometry (same spirit as the existing `distinctSegmentFrom` guards,
  `src/view/edgeGeometry.ts:298-315`).

Apply it where routes are attached: `GraphViewController.resolveRoutes` /
`withRoutedPoints` (`src/view/GraphViewController.ts:238-283, 374-385`).
`extractEdgeRoutingInput` (`src/view/edgeRouting.ts:109-141`) already builds the
obstacle rects (group rects from `groupDimensions`, `edgeRouting.ts:122-127`); clip
each route against its source/target obstacle rect before storing
`FlowEdge.routedPoints`.

**WHY clip rather than move the libavoid pin to an edge/border pin:** the centre pin +
`ConnDirAll` lets libavoid pick the approach side freely (good routes); clipping keeps
that freedom and fixes only the visual terminus. Border pins would hard-code sides and
reintroduce the side-choice problem. **WHY-NOT rely on libavoid stopping at the
boundary:** shape-attached endpoints deliberately don't treat their own box as a
blocker (`src/view/edgeRouting.ts:223-229` doc comment), so the router will never stop
there for us.

Bonus: the clipped terminus is the point where the route crosses the box border, so the
arrowhead automatically lands on the **logical side** the route approaches from — this
delivers priority #2 (side-aware anchoring) for ALL routed edges for free. Only the
non-routed straight-edge path remains, tracked in
`nid_var2o7krxq7ribq3iofni3aw1_e`.

### 2. Arrowhead inset review

After clipping, `routedGeometryFor`'s inset (`EDGE_ARROWHEAD_INSET_MIN/MAX_PX`,
`EDGE_ARROWHEAD_INSET_FRACTION` in `src/view/edgeGeometry.ts`) measures from the
boundary, not the centre. Verify visually that the tip does not float too far outside
the box; likely no constant change needed, but check groups AND notes (notes previously
benefited from the centre≈boundary coincidence — confirm no regression).

### 3. Spec entry (required)

Update `docs-internal/vicinity-graph-specs/arrows.md` section 5 with an explicit
normative statement:

> A routed edge's polyline is clipped to the source/target node rectangles: the arrow
> originates and terminates ON the endpoint's boundary, at the point where the route
> crosses it. In particular a collapsed group arrow terminates at the GROUP container
> boundary, never inside it.

### 4. Tests (start with the failing test)

- **Unit — primary guarantee (`src/view/edgeGeometry.test.ts`)**, BDD GIVEN/WHEN/THEN,
  one assert per test:
  - GIVEN a polyline ending at a rect centre WHEN clipped THEN the last point lies on
    the rect border (and interior points are dropped).
  - Multi-point route with several trailing points inside the rect; source-side
    mirror; corner-adjacent entry segment; overlap/degenerate fallback.
  - GIVEN a clipped route THEN the `routedGeometryFor` arrow tip lies outside the rect
    interior.
- **Unit (`src/view/edgeRouting.test.ts` / controller-level)**: attached
  `FlowEdge.routedPoints` are clipped against the correct obstacle rects (group rect
  for `folder-group:*` endpoints, note rect otherwise).
- **E2E — best-effort (`e2e/edgeRouting.e2e.ts`, harness `e2e/obsidianHarness.ts`)**:
  fixture with a collapsed group edge + routing ON; parse the rendered `VicinityEdge`
  SVG path `d` endpoint and assert it lies within ε of the group container's DOM rect
  border AND outside every member node rect. Existing e2e only asserts path
  presence/bends (`e2e/edgeRoutingEval.e2e.ts`) — this would be the first geometry
  assertion. If it proves flaky, keep unit tests as the gate, downgrade e2e to
  screenshot capture, and CALL OUT the downgrade explicitly.

## Out of scope

- Side-aware anchoring for NON-routed straight edges (fixed Top/Bottom handles in
  `src/view/NoteNode.tsx:68,91` and `src/view/FolderGroupNode.tsx:26-50`) → linked
  ticket `nid_var2o7krxq7ribq3iofni3aw1_e`.
- Radial-layout routing (gated off; see
  `_tickets/edge-routing-re-enable-radial-routing-via-web-worker-offload.md`).

## Acceptance criteria

- With routing ON, a collapsed group arrow's line and arrowhead terminate at the group
  container boundary (never overlapping member nodes); source side equally clipped.
- Note↔note routed arrows remain boundary-anchored with no visual regression.
- Spec entry added to `docs-internal/vicinity-graph-specs/arrows.md`.
- Unit tests for the clip function + attachment pass; e2e geometry assertion attempted
  (or its downgrade explicitly documented).
- Full `npm test` + e2e suites pass.
