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

## Obstacle-avoiding routing (default ON)

After layout and before publish, `GraphViewController` → `LibavoidEdgeRouter`
routes edges around node/group boxes and attaches a `routedPoints` polyline;
`VicinityEdge` renders it via `routedGeometryFor` (rounded corners, arrowheads on
the true approach segments).

- **Runs whenever `edgeRouting` is ON.** Force is the only layout, so the pass
  is gated solely on the `edgeRouting` view setting — no per-layout exclusion.
- **Straight-line fallback** (`edgePathFor`) when routing is OFF, the wasm/router
  fails (one `console.warn`, whole pass yields no routes), or an edge is absent
  from the route map. A cleanly-routed edge returns a 2-point line, byte-identical
  to the straight form.
- Routed edges do **not** re-apply the paired-edge bow — libavoid's clearance
  buffer already separates opposite edges.
- **Boundary clipping:** libavoid pins connector ends to the box centre;
  `resolveRoutes` runs `clipRouteToEndpointRects` (`edgeGeometry.ts`) to move each
  terminus to where the route crosses the endpoint rect — so arrows land ON the
  boundary (a collapsed group arrow terminates at the group container border,
  never inside) and on the side the route approaches from. Degenerate cases
  (nested/overlapping rects, route wholly inside a rect) fall back to the unclipped
  2-point chord — never NaN geometry.

Tuning (named constants in `edgeRouting.ts` / `edgeGeometry.ts`): shape buffer
17px, segment penalty 50, crossing penalty 0 (disabled — too costly interactively),
corner radius 10px.

## Test coverage

- Many members → one collapsed arrow; `count` = sum of member link counts.
- `A→member` + `otherMember→A` → one bidirectional arrow.
- Intra-group edges stay member-to-member (no group self-loop).
- `groupByFolder` off → no projection, behavior unchanged.
- Group with cross-boundary links in one direction only → single arrowhead.

## Follow-ups

- `flowMapping` and `elkMapping` projections could share one `projectEdgeEndpoints`
  helper (DRY).
