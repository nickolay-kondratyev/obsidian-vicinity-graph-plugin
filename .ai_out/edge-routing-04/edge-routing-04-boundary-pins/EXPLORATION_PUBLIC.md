# EXPLORATION_PUBLIC — edge-routing__04 (boundary pins + detour telemetry)

Two detailed exploration docs (read both before implementing/reviewing):
- [`EXPLORATION_edgeRouting__PUBLIC.md`](./EXPLORATION_edgeRouting__PUBLIC.md) — edgeRouting.ts,
  GraphViewController wiring, edgeGeometry.ts, test conventions, perf budget.
- [`EXPLORATION_libavoid__PUBLIC.md`](./EXPLORATION_libavoid__PUBLIC.md) — libavoid-wasm bundling,
  ShapeConnectionPin/ConnEnd/ConnDir* API, Avoid interface.

## Scope: Phase A + Phase B only (Phase C out of scope)

## Phase A — boundary pins (primary fix)
- `src/view/edgeRouting.ts` `LibavoidEdgeRouter.route()` obstacle loop (~249-257): replace single
  centre pin with 8 same-class proportional pins per shape:
  - side-midpoints `(0.5,0)`↑ `(1,0.5)`→ `(0.5,1)`↓ `(0,0.5)`← each with facing `visDirs`
  - corners `(0,0)/(1,0)/(0,1)/(1,1)` with `ConnDirAll`
- Connector-creation code (`arena.connEnd(shape, PIN_CLASS)`) needs NO change — ConnEnd binds by
  class id, libavoid picks best pin.
- `src/view/libavoidLoader.ts`: add typed `ConnDirUp/Down/Left/Right: number` to `Avoid` interface.
- KEEP `clipRouteToEndpointRects` / `clipRoutesToObstacles` unchanged.
- Perf gate: dense fixture routing pass must stay well under layout (~140ms vs ~1460ms). Fallback if
  blown: boundary pins on folder-group shapes only (thread `kind` onto `RoutingObstacle`).

## Phase B — detour-ratio telemetry
- Pure `detourRatio(points, ...)` in `src/view/edgeGeometry.ts` = clipped arc length ÷ boundary
  chord length; BDD unit tests in `edgeGeometry.test.ts`.
- Log max/mean detour ratio into existing `console.debug("vicinity-graph: edge routing pass", ...)`
  in `GraphViewController.ts` (~266-270).

## STOP condition (from task)
After Phase A, if repro edges still visibly roundabout OR routing pass exceeds perf budget even with
group-only pins → STOP and report findings. Do NOT improvise alternative routing strategies.
