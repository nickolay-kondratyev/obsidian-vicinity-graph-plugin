# EXPLORATION_PUBLIC — Edge Routing Anchor Points (12-point change)

## Summary
Edge-routing anchor points ("pins") are defined entirely in `src/view/edgeRouting.ts`.
The 8-point set lives in `BOUNDARY_PIN_SPECS` (lines 211-220) as `{xFrac, yFrac, dir}`
proportional specs: 4 outward-facing side-midpoints + 4 `"all"`-direction corners.
They are registered via `registerPinsForShape` (line 254); libavoid (WASM) picks the
cheapest pin per connector end automatically since all pins share `PIN_CLASS`.
The desired 12-point change is essentially editing that array (add 0.25/0.75 fractions,
drop the 4 corners). No routing-algorithm change needed.

## 1. Where pins are computed — `src/view/edgeRouting.ts`
- `PIN_CLASS = 1` (`:173`) — all pins share one class; `ConnEnd(shape, PIN_CLASS)` resolves to cheapest pin.
- Offset constants (`:180-185`): `PIN_EDGE_MIN=0`, `PIN_EDGE_MID=0.5`, `PIN_EDGE_MAX=1`, `PIN_INSIDE_OFFSET=0` (pins on the border).
- `PinDir` type + `BoundaryPinSpec` interface (`:188-194`).
- `BOUNDARY_PIN_SPECS` — the 8 points (`:211-220`).
- `CENTRE_PIN_SPEC` — single centre pin (`:228`).
- `visDirsFor()` maps `PinDir` → libavoid `ConnDirFlag` bitmask (`:231-244`).
- `registerPinsForShape()` chooses spec list per obstacle kind + instantiates `avoid.ShapeConnectionPin(...)` (`:254-267`).

## 2. The 8 points today (`:211-220`)
```ts
interface BoundaryPinSpec { readonly xFrac: number; readonly yFrac: number; readonly dir: PinDir; }

const BOUNDARY_PIN_SPECS: readonly BoundaryPinSpec[] = [
  { xFrac: PIN_EDGE_MID, yFrac: PIN_EDGE_MIN, dir: "up" },    // top side-midpoint
  { xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_MID, dir: "right" }, // right side-midpoint
  { xFrac: PIN_EDGE_MID, yFrac: PIN_EDGE_MAX, dir: "down" },  // bottom side-midpoint
  { xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_MID, dir: "left" },  // left side-midpoint
  { xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_MIN, dir: "all" },   // top-left corner
  { xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_MIN, dir: "all" },   // top-right corner
  { xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_MAX, dir: "all" },   // bottom-left corner
  { xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_MAX, dir: "all" },   // bottom-right corner
];
```
- Side-midpoints: one MID + one extreme; `dir` = outward perpendicular (square-on attach).
- Corners: both extremes; `dir: "all"` (accepts any approach). **These are what the user wants removed.**
- `registerPinsForShape` (`:254-267`): `specs = kind === "folder-group" ? BOUNDARY_PIN_SPECS : [CENTRE_PIN_SPEC]`. `proportional=true` (arg) → fractional offsets like 0.25/0.75 work directly.

## 3. Routing / point selection
- `LibavoidEdgeRouter.route()` (`:352-398`): builds PolyLine `Router`, registers obstacle rects (`:367`), pins (`:371`), makes `ConnEnd`/`ConnRef` per edge (`:383-386`), one `processTransaction()` (`:388`), reads polylines via `displayRoute()` (`:333-341`).
- **Selection is delegated to libavoid** — no custom selection algorithm. App only defines candidate pins + allowed directions; libavoid cost model chooses.
- Tuning knobs: `EDGE_ROUTING_SHAPE_BUFFER_PX=17` (`:71`), `EDGE_ROUTING_SEGMENT_PENALTY_PX=50` (`:82`), `EDGE_ROUTING_CROSSING_PENALTY_PX=0` (`:96`, disabled for perf). Applied `:362-364`.
- Input extraction `extractEdgeRoutingInput()` (`:119-165`): sets `kind:"folder-group"` (`:143`) vs `kind:"note"` (`:152`).

## 4. Telemetry (detour-ratio) + clipping
- `GraphViewController.ts:260-294`: routing pass, `clipRoutesToObstacles` (`:271`), `detourStats` (`:282`), `console.debug("vicinity-graph: edge routing pass", {...})` (`:283-289`).
- `clipRoutesToObstacles` (`:397-417`), `DetourStats`/`detourStats` (`:419-447`).
- Geometry primitives `src/view/edgeGeometry.ts`: `clipRouteToEndpointRects` (`:171-194`, makes arrow terminate ON boundary via Liang–Barsky), `detourRatio` (`:389-410`), `DETOUR_RATIO_DEGENERATE=1` (`:375`).

## 5. Tests
- **`src/view/edgeRouting.test.ts`** (primary):
  - `extractEdgeRoutingInput` block (`:25-106`).
  - Buffer/penalty blocks (`:108-135`).
  - `LibavoidEdgeRouter with real wasm` (`:137-261`): bend around obstacle (`:183`), no waypoint inside obstacle (`:192`), and **Facing-side attachment guard** (`:200-260`) using `FACING_BORDER_TOL_PX=3` (`:209`) + `MID_SPAN_TOL_PX=10` (`:210`) — asserts endpoints land near the SIDE MIDPOINT "not a corner". Tests use `kind:"folder-group"` because pins only exist on group boxes.
- `src/view/edgeGeometry.test.ts` — clip + detour geometry (pin-layout independent).
- `src/view/GraphViewController.test.ts` — controller wiring/telemetry.

## 6. CRITICAL: group boxes vs note squares
- **Boundary pins are registered on `folder-group` boxes ONLY.** Regular note squares get a **single centre pin** (`:255`), then clipped to boundary by `clipRouteToEndpointRects`.
- Rationale (commit `c060122` "group-only boundary pins", edge-routing__04 Phase A): 8 pins × ~100 note-square spokes in a dense hub blew the routing perf budget (~64× over). Notes deliberately kept single centre pin.
- **Implication:** applying 12 points to note squares too revives that perf concern → biggest scope question.

## 7. Docs
- `docs-internal/architecture-map.md:49-60` — libavoid-js note only, no pin detail.
- `docs-internal/plan/high-level-plan.md` — no routing-anchor content ("pin" there = user-pinned central nodes, unrelated).
- `docs-internal/CHANGELOG.md` — edge-routing__04 / boundary-pin entries.
- No open edge-routing ticket (closed).

## Key Questions for Clarification
1. **Scope:** group boxes only (today's behavior) or note squares too (revives perf concern)?
2. **Direction of the new quarter (0.25/0.75) pins:** outward-perpendicular (like midpoints) or `"all"`?
3. **Confirm** 12 = 4 sides × {0.25, 0.5, 0.75}, corners removed (midpoint retained).
4. **Test tolerances:** `MID_SPAN_TOL_PX=10` facing-side assertions may need reframing since router may now pick a 1/4 or 3/4 pin.
5. **Constant reuse:** add `PIN_EDGE_Q1=0.25`, `PIN_EDGE_Q3=0.75` beside `:180-182`; no cost-model change intended.
