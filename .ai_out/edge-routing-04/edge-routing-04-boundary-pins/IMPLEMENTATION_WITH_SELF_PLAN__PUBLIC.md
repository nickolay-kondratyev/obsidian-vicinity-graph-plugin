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

## Iteration 2 — reviewer SHOULD-FIX addressed (facing-side regression guard)
- **`src/view/edgeRouting.test.ts`** (test-only): added 2 BDD tests inside the existing
  `describe("LibavoidEdgeRouter with real wasm", ...)` block via a `routePair(source, target)`
  helper that routes one edge between two 100x100 boxes with a clear gap:
  - horizontal: asserts source endpoint on box L's RIGHT border (x≈100) and target on box R's
    LEFT border (x≈300), both near mid-height (y≈50).
  - vertical: source on box T's BOTTOM border (y≈100), target on box B's TOP border (y≈300),
    both near mid-width (x≈50).
  - Tolerances: facing border within 3px, mid-span within 10px — FAIL if `visDirs` were inverted
    (forces detour off the facing side) or reverted to a single centre pin (endpoints at 50/350),
    PASS for the correct outward mapping. This locks in the ticket's central fix.
  - Reuses the real-wasm harness + `if (!loaded) return;` graceful-degradation guard (no fake-pass).
    Both tests EXECUTED their assertions in this env (wasm loaded — sibling bends-around test 6ms).
- Test results: `npm test` **664 passed / 664, 54 files** (was 662, +2 new). `npm run check`: GREEN.
- No production code touched.

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

---

# Iteration 3 — Phase A fallback (group-only pins) + telemetry defect fix

VERIFICATION (see `VERIFICATION__PUBLIC.md`) STOPped iteration 2: 8-pins-on-ALL-shapes
blew the dense-fixture routing budget (~8838ms vs ~1450ms layout — dense is ~100 UNGROUPED
spokes, so every one got 8 pins) AND the telemetry move made the perf e2e gate false-pass.
This iteration applies the ticket's authorized fallback and fixes the telemetry.

## CHANGE 1 — boundary pins on FOLDER-GROUP shapes ONLY (`src/view/edgeRouting.ts`)
- `RoutingObstacle` gained `readonly kind: "note" | "folder-group"` (interface ~30).
- `extractEdgeRoutingInput` now populates `kind` (`"folder-group"` / `"note"`) from
  `FlowNode.kind` on each pushed obstacle.
- New `CENTRE_PIN_SPEC = {0.5, 0.5, "all"}` (the pre-fix single centre pin) alongside the
  KEPT `BOUNDARY_PIN_SPECS` (8 pins).
- New `registerPinsForShape(avoid, shape, kind)` helper: folder-group → 8 BOUNDARY_PIN_SPECS;
  note → single CENTRE_PIN_SPEC. All pins share `PIN_CLASS`, so every `ConnEnd(shape, PIN_CLASS)`
  still resolves (every shape has ≥1 pin of that class). ConnEnd wiring UNCHANGED.
- `route()` obstacle loop replaced its inline 8-pin loop with `registerPinsForShape(...)`.
- Docs updated on `RoutingObstacle.kind`, `BOUNDARY_PIN_SPECS` (WHY-NOT note squares),
  `CENTRE_PIN_SPEC`, `registerPinsForShape`, and the `LibavoidEdgeRouter` class doc.
- `routingSignature` (GraphViewController) NOT changed: it hashes id/x/y/w/h + edge ids; `kind`
  is derived from stable node identity, so cache correctness is unaffected. tsc GREEN confirms.

## CHANGE 2 — telemetry reorder (`src/view/GraphViewController.ts` `resolveRoutes`)
- Moved `clipRoutesToObstacles` + `detourStats` + the ONE `console.debug` line to BEFORE the
  `if (this.isStale(token)) return EMPTY_ROUTES;` early-return. The pass that actually ran is now
  always logged (obstacleCount/edgeCount/durationMs/max+meanDetourRatio) — a superseded (stale)
  heavy dense pass is no longer discarded unlogged, so the e2e PERF gate reads the real heaviest
  pass instead of a trivial intermediate. Same clipped map is cached/returned (no double-clip).
  Cache/EMPTY_ROUTES/error paths otherwise unchanged. Added a WHY comment explaining the ordering.

## Test changes (`src/view/edgeRouting.test.ts` — test-only)
- `extractEdgeRoutingInput` obstacle assertions now include `kind` (`"note"` for a note square,
  `"folder-group"` for the group box) — asserts kind is populated for both.
- Real-wasm facing-side tests: the two 100x100 boxes are now `kind: "folder-group"` (so they keep
  boundary pins and STILL assert facing-side attachment). Added a NOTE in the test that note squares
  intentionally keep a single centre pin (a NOTE→NOTE edge would attach at centres, not facing sides).
  The bends-around tests' obstacles are `kind: "note"` (they only assert obstacle avoidance).

## Test results (exact)
- `npm run check` (tsc strict): GREEN.
- `npm test`: **664 passed / 664, 54 files, 0 failed.**
- Real-wasm block EXECUTED (not skipped): bends-around 5ms, facing-side horizontal 2ms / vertical 1ms —
  facing-side tests assert boundary/facing-side attachment on FOLDER-GROUP boxes with real wasm.

## CALLOUT — dense-fixture perf MUST be re-verified by TOP_LEVEL via the eval
The wasm router still cannot be timed under vitest. TOP_LEVEL must re-run the edge-routing eval on the
dense fixture and confirm: (1) routing `durationMs` is now well under layout (the ~100 ungrouped spokes
now use 1 centre pin each, only the group boxes carry 8 pins), and (2) the telemetry fix means the PERF
BUDGET e2e test now reads the real 101-obstacle pass (obstacleCount≈101), not a stale 3-obstacle pass.
