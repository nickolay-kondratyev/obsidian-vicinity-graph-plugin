# Graph edges: group-collapsing, direction & routing

> **`docs-internal/specs/graph/` is where we record decisions on how the graph
> should look** — edge/arrow rendering, node/group appearance, layout & routing.
> One file per topic. Add a spec here before changing graph visuals so the intent
> outlives the diff.

## Group-collapsed arrows

When many members of a folder group link to/from the same outside node, drawing
one arrow per member is clutter. When `groupByFolder` is on we **collapse**
cross-boundary edges onto the group box.

Projection (mirrors `projectedRootEdges` in `elkMapping.ts`; render side lives in
`vicinityGraphToFlow`, `src/view/flowMapping.ts`):

```
projectId(path) = grouped member ? folderGroupIdOf(folder) : path
```

Per engine edge, with `projSource`/`projTarget`:

- **same project id** → intra-group edge, kept as the real member-to-member
  `FlowEdge` (collapsing would make a meaningless group self-loop).
- **different** → cross-boundary; collapse. Accumulate by the **unordered** pair,
  unioning direction (`A→B` and/or `B→A`) and **summing** `count`. Emit one
  `FlowEdge` per pair; `count` = links collapsed (the "×N" badge).

`FolderGroupNode` exposes hidden, non-connectable top/bottom `<Handle>`s (mirrors
`NoteNode`) so an edge can anchor to the group box.

## Bidirectional edges: one line, two arrowheads

A bidirectional edge renders as a **single straight line with an arrowhead at
both ends** (`edgeGeometry.edgePathFor` returns source- and target-side anchors;
`VicinityEdge` draws both polygons). Preferred over the older bowed curved-pair
form for all bidirectional edges. `hasOpposite` note↔note pairs still bow only in
the straight-line (non-routed) fallback.

## Obstacle-avoiding routing (always on)

After layout and before publish, `GraphViewController` → `LibavoidEdgeRouter`
routes edges around node/group boxes and attaches a `routedPoints` polyline;
`VicinityEdge` renders it via `routedGeometryFor` (rounded corners, arrowheads on
the true approach segments).

- **Always runs.** The `edgeRouting` view setting was removed — force is the only
  layout and routing is unconditional, with no per-layout exclusion.
- **Straight-line fallback** (`edgePathFor`) when the wasm/router fails (one
  `console.warn`, whole pass yields no routes), an edge is absent from the route
  map, an endpoint was dropped from the routing input, or the boundary clip hits
  its degenerate case below. A cleanly-routed edge returns a 2-point line,
  byte-identical to the straight form.
- Routed edges do **not** re-apply the paired-edge bow — libavoid's clearance
  buffer already separates opposite edges.
- **Connection pins:** folder-group boxes carry 12 directional boundary pins
  (`BOUNDARY_PIN_SPECS`, 3 per side, never at a corner); note squares keep a
  single centre pin.
- **Boundary clipping:** connector ends land on a pin, not on the border;
  `resolveRoutes` runs `clipRouteToEndpointRects` (`edgeGeometry.ts`) to move each
  terminus to where the route crosses the endpoint rect — so arrows land ON the
  boundary (a collapsed group arrow terminates at the group container border,
  never inside) and on the side the route approaches from. Degenerate cases
  (nested/overlapping rects, route wholly inside a rect) fall back to the unclipped
  2-point chord — never NaN geometry.

Tuning (named constants in `edgeRouting.ts` / `edgeGeometry.ts`): shape buffer
17px, segment penalty 50, crossing penalty 0 (disabled — too costly interactively),
corner radius 10px.

## Straight (non-routed) edge anchoring

A straight edge anchors where the **centre→centre line crosses each endpoint
box's border** (`edgeGeometry.facingSideAnchorsFor`, fed into `edgePathFor` by
`VicinityEdge`) — React Flow's "floating edge" pattern. Without it an edge starts
at the node's fixed `<Handle>` (Top/Bottom here), so a link to a node on the LEFT
still leaves from the bottom and loops back up, reading as a detour that isn't
there. This gives the straight path the same facing-side attachment the routed
path already gets from **Boundary clipping** above; arrowheads then sit just
OUTSIDE the box (the inset rules are unchanged), matching routed edges.

- Reuses the routed clipper's Liang–Barsky primitive — one segment-vs-rect-border
  implementation in `edgeGeometry.ts`, and the same `ClipRect` shape.
- Rects come from the React Flow store (`useInternalNode` → `positionAbsolute` +
  measured-or-explicit size), never from DOM measurement: `onlyRenderVisibleElements`
  unmounts culled nodes.
- **Falls back to the handle endpoints** when a node is not yet in the store, or
  the boxes are nested/overlapping (a note inside its folder-group container) —
  no side faces the other, so there is nothing to anchor to.
- The `hasOpposite` bow and the bidirectional double-arrowhead are recomputed from
  these border endpoints; the hidden `<Handle>`s stay (React Flow needs them to
  address an edge at all).

## Test coverage

- Many members → one collapsed arrow; `count` = sum of member link counts.
- `A→member` + `otherMember→A` → one bidirectional arrow.
- Intra-group edges stay member-to-member (no group self-loop).
- `groupByFolder` off → no projection, behavior unchanged.
- Group with cross-boundary links in one direction only → single arrowhead.
- Straight-edge facing-side anchors: target above/below/left/right/diagonal lands
  on the facing border, source anchor mirrors, nested/missing rects fall back to
  the handle endpoints, paired bow drawn between the border points
  (`edgeGeometry.test.ts`). **No e2e coverage** — no fixture can produce a
  non-routed edge (routing is unconditional and does not fail in e2e).

## Follow-ups

- `flowMapping` and `elkMapping` projections could share one `projectEdgeEndpoints`
  helper (DRY).
