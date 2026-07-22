# edge-routing__01 — Implementation summary (PUBLIC)

Status: DONE. No `#QUESTION_FOR_HUMAN`. Working tree left with changes (not committed — TOP_LEVEL handles git).

## What was built
A layout-agnostic, post-layout obstacle-avoiding edge-routing pass, gated behind a new
`ViewSettings.edgeRouting` boolean (default OFF), with routed polylines threaded through the
immutable `FlowSnapshot` down to the RF edge `data` (unused by rendering this phase). The
throwaway phase-0 spike was deleted and the production loader kept.

## Verification
- `npm run check` (tsc): CLEAN.
- `vitest run`: 630 passed / 54 files (was 612; removed 4 spike tests, added ~22).
- `npm run build`: OK. Wasm still embedded (647KB base64 blob in main.js; `loadAvoid`/`ShapeConnectionPin` present).
- Real-wasm integration tests EXECUTED their assertions (node build loaded under vitest) — not fake-passed.
- Grep acceptance: production `Avoid.`/`AvoidLib` binding usage only in `edgeRouting.ts` + `libavoidLoader.ts`
  (the `GraphViewController.ts` / `libavoidWasm.d.ts` grep hits are the word "libavoid" in comments/strings).

## Files created
- `src/view/edgeRouting.ts` — RF-free routing module: `EdgeRouter` interface (DIP), named data types
  (`RoutingObstacle`, `RoutingEdge`, `EdgeRoutingInput`, `RoutedPoint`, `EdgeRouteMap`), the pure
  `extractEdgeRoutingInput(...)`, `EDGE_ROUTING_SHAPE_BUFFER_PX` (= `EDGE_PAIR_CURVATURE_PX/2` = 17), an internal
  `AvoidArena` (memory rules relocated verbatim from the spike), and `LibavoidEdgeRouter`.
- `src/view/edgeRouting.test.ts` — extraction unit tests (folder group + child + collapsed group edge, absolute
  coords, group attachment; missing-position skip) + `EDGE_ROUTING_SHAPE_BUFFER_PX` + real-wasm integration
  (2 nodes + blocking rect → polyline >2 points, none inside the rect).

## Files deleted (throwaway spike)
- `src/view/libavoidSpike.ts`, `src/view/libavoidSpike.test.ts`, `e2e/libavoidSpike.e2e.ts`.

## Files modified
- `src/main.ts` — removed spike imports, the `debug-spike-libavoid-routing` command, and `spikeLibavoidRouting()`.
- `src/engine/types.ts` — `ViewSettings.edgeRouting: boolean`.
- `src/engine/constants.ts` — `DEFAULT_EDGE_ROUTING = false` + wired into `EngineDefaults.viewSettings()`.
- `src/engine/ViewSettingsResolver.ts` — `edgeRouting: field("edgeRouting")`.
- `src/persistence/persistedShapes.ts` — boolean parse block for `edgeRouting`.
- `src/view/testFixtures/graphFixtures.ts` — `edgeRouting: false` in `makeViewSettings` + `withEdgeRouting()` helper.
- `src/view/settingsWritePlan.ts` — `global-edge-routing` interaction + case → `global-view`.
- `src/view/VicinityGraphSettingTab.ts` — new "Layout" section with an "Obstacle-avoiding edge routing" toggle.
- `src/view/flowMapping.ts` — `FlowEdge.routedPoints?: readonly RoutedPoint[]` (type-only import from edgeRouting).
- `src/view/VicinityGraphFlow.tsx` — thread `routedPoints` into the RF edge `data` (+ absolute-space comment).
- `src/view/VicinityEdge.tsx` — `VicinityEdgeData.routedPoints?` (typed only; rendering NOT branched — that's ticket 02).
- `src/view/GraphViewController.ts` — inject `EdgeRouter` (4th ctor param); unify reuse/relayout branches; add
  `resolveRoutes` (gate + signature cache + warn-once fallback), `routingSignature`, `withRoutedPoints`.
- `src/view/VicinityGraphView.tsx` — inject `new LibavoidEdgeRouter()`.
- Mirror tests: `GraphViewController.test.ts`, `persistedShapes.test.ts`, `settingsWritePlan.test.ts`.

## Key design decisions
- **Arena relocation**: `AvoidArena` was in the THROWAWAY spike (not the loader, as the spike note claimed). Re-implemented
  inside `edgeRouting.ts` with the ownership rules verbatim: Router OWNS ShapeRef/ConnRef/ShapeConnectionPin (freed by
  `destroy(router)` — never freed by us); only Point/Rectangle/ConnEnd are tracked and destroyed, Router last, in `finally`.
  No libavoid object escapes the class.
- **Lazy loader import (load-bearing)**: `edgeRouting.ts` does `await import("./libavoidLoader")` inside `route()` instead of a
  top-level import. A static import would transitively pull the `libavoid-wasm` VIRTUAL module (esbuild-only) and break the
  whole vitest suite. Type imports stay top-level (erased). Build still inlines/embeds the wasm (verified).
- **Cache-invalidation vs relayout on `edgeRouting` flip**: chose route-cache invalidation, NOT forcing an elk relayout —
  positions don't change when the flag flips. `decideLayout` is untouched; `resolveRoutes` drops the cache when routing is OFF
  so a later ON flip recomputes on the reuse-layout path. Route cache keys on a signature over obstacle geometry + edge
  endpoints, so a reuse-layout rebuild with unchanged inputs reuses routes (libavoid invoked once).
- **Coordinate space**: routing runs in ABSOLUTE coordinates (the `positions`/`groupDimensions` maps available pre-`withPositions`).
  RF renders edge endpoints in absolute flow-space, so `routedPoints` need NO transform to render later — documented in code
  comments at `toReactFlowEdge` and `VicinityEdgeData` (ticket decision #2).
- **Failure containment**: wasm-init/routing throw → `console.warn` ONCE (plugin prefix) + publish without `routedPoints`
  (straight edges). Single documented pass-level fallback; the router throws (rather than silently skipping) if an edge
  endpoint has no shape — no per-edge silent fallbacks.
- **Extraction is DRY**: obstacles derive from `flow.nodes` (authoritative node set) + the absolute `positions`/`groupDimensions`;
  edge endpoints are already resolved to the right obstacle id by `buildFlowEdges` (collapsed→group box, passthrough→child square),
  so no group logic is duplicated in the router.

## Acceptance criteria
- [x] `edgeRouting` setting exists, default OFF, persisted, visible in settings tab.
- [x] With setting ON: snapshot edges carry `routedPoints` (covered by controller threading tests; rendering unchanged).
- [x] All listed unit tests pass; `npm run check` clean; full vitest suite green.
- [x] No libavoid objects leak outside `LibavoidEdgeRouter` (`Avoid.` production usage only in edgeRouting.ts + loader).
- [x] Reuse-layout rebuilds do not re-run libavoid when inputs unchanged (cache test asserts callCount stays 1).

## Callouts
- Minor deviation: `EdgeRouteMap = ReadonlyMap<string, readonly RoutedPoint[]>` (ticket wrote `Map<...>`) — immutability.
- The real-wasm integration test guards with a `loaded` flag that early-returns if the node build fails to load (per ticket's
  "mark skipped, don't fake-pass"). In this environment the build loaded and assertions ran — no skip occurred.
