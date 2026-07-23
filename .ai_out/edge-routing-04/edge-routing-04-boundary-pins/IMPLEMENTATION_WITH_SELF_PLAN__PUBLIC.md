# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC (edge-routing__04, Phase A + B)

Boundary-pin routing fix (Phase A) + detour-ratio telemetry (Phase B). Phase C not touched.

## What changed (file:line)

### Phase A — boundary pins
- **`src/view/libavoidLoader.ts`** (`Avoid` interface, ~21): added typed
  `readonly ConnDirUp/ConnDirDown/ConnDirLeft/ConnDirRight: number` next to the existing
  `ConnDirAll` (upstream ships `ConnDirFlags` as an EMPTY enum — values exist only at runtime),
  so pin directions are used without `as number` casts.
- **`src/view/edgeRouting.ts`**:
  - Replaced `CENTRE_PIN_CLASS`/`PIN_CENTRE_FRACTION` with `PIN_CLASS`, named fractions
    `PIN_EDGE_MIN=0 / PIN_EDGE_MID=0.5 / PIN_EDGE_MAX=1`, and `PIN_INSIDE_OFFSET=0`.
  - Added immutable `BOUNDARY_PIN_SPECS` (8 entries: 4 side-midpoints with facing `dir`
    up/right/down/left + 4 corners `all`) and a private `visDirsFor(avoid, dir)` resolver
    (switch over the closed `PinDir` union → `avoid.ConnDir*`).
  - `route()` obstacle loop now registers all 8 pins per shape (proportional, insideOffset 0),
    all sharing `PIN_CLASS`. Connector loop unchanged except `connEnd(shape, PIN_CLASS)` rename —
    ConnEnd still binds by class id only; libavoid picks the cheapest facing pin per end.
  - Updated the `LibavoidEdgeRouter` class doc.
  - `clipRouteToEndpointRects` / `clipRoutesToObstacles` UNCHANGED (per ticket).
  - `RoutingObstacle` NOT changed — no `kind` threading (see callout (a)).

### Phase B — detour telemetry
- **`src/view/edgeGeometry.ts`**: added pure `detourRatio(points)` = arc length ÷ endpoint
  chord (`hypot(last-first)`), reusing the `polylineMidpoint` arc-length walk; exported
  `DETOUR_RATIO_DEGENERATE = 1` returned on a zero chord (never NaN/Infinity). File stays RF/obsidian-free.
- **`src/view/edgeGeometry.test.ts`**: `describe("detourRatio")` — 4 BDD tests: straight 2-point = 1,
  L-detour > 1 (exact ratio), collinear straight-through waypoint = 1, zero-chord guard = degenerate.
- **`src/view/GraphViewController.ts`** `resolveRoutes()`: the routing-pass `console.debug` now
  logs `maxDetourRatio` + `meanDetourRatio` computed by a new private `detourStats(clippedRoutes)`
  (+ `EMPTY_DETOUR_STATS`). The debug log MOVED to after clipping + the `isStale` check, since the
  metrics must be computed on the CLIPPED routes.

## Design decisions affecting others
- **8 pins/shape, one shared class id** — libavoid auto-selects; no per-edge pin logic. ConnEnd
  wiring and the AvoidArena ownership contract (pins router-owned, never tracked/freed) unchanged.
- **`detourStats` skips nothing extra**: an `EdgeRouteMap` only contains edges that routed, so every
  entry counts; empty map → neutral `{max:1, mean:1}` (documented, avoids NaN).
- **Behavior nuance**: the routing-pass debug line previously logged even on a stale pass; it now
  logs only after the `isStale` early-return (because clipped routes are needed for the metrics).
  A discarded stale pass no longer emits a duration line. Judged acceptable (discarded work).

## Test results (exact)
- `npm run check` (tsc strict): GREEN.
- `npm test` (vitest): **662 passed / 662, 54 files, 0 failed.**
- Real-wasm integration block (`LibavoidEdgeRouter with real wasm`) EXECUTED its assertions
  (6ms / 2ms, not the graceful skip) against the new 8-pin router: route still bends around the
  blocker (>2 pts) and no waypoint falls strictly inside it. New 4 `detourRatio` tests pass.

## CALLOUTS
- **(a) Shipped: 8-pins on ALL shapes** (ticket primary path) — note squares AND folder-group boxes.
  Did NOT implement the group-only fallback and did NOT thread `FlowNode.kind` onto `RoutingObstacle`.
  No perf evidence justified downgrading, and per task instructions I did not pre-emptively downgrade.
- **(b) PERF GATE — MUST be verified in the dev vault (cannot be measured in-agent).** The wasm router
  does not run under vitest (the `libavoid-wasm` virtual module resolves only under esbuild), so 8 pins
  × ~100 obstacles could not be timed here. TOP_LEVEL_AGENT must run the dense-fixture repro and confirm
  the `vicinity-graph: edge routing pass` `durationMs` stays well under layout time (baseline ~140ms
  routing vs ~1460ms layout). If blown, the ticket fallback is group-only pins (would then require
  threading `kind`). Also confirm the repro edges (`freedom → Discipline Leads to Freedom`,
  `wealth-buys-external-freedom → rel`) now render near-direct and `maxDetourRatio` drops materially.
- **(c) No `#QUESTION_FOR_HUMAN` items** — ticket fully specified; no blockers.
