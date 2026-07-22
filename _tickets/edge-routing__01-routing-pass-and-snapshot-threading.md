---
closed_iso: 2026-07-22T17:24:51Z
id: nid_pc87xabr7xi67c4qmht938r2o_e
title: "edge-routing__01-routing-pass-and-snapshot-threading"
status: closed
deps: [nid_pgsj1vjjnmtflf55a4sd9txos_e]
links: []
created_iso: 2026-07-22T16:04:58Z
status_updated_iso: 2026-07-22T17:24:51Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
parent: nid_w8co2gp7cok2a2hwwsm88brfo_e
---

# Phase 1 — EdgeRouter pass + FlowSnapshot threading (behind setting, force layout first)

Parent epic (full plan): `_tickets/edge-routing-via-libavoid-js-obstacle-avoiding-edges-for-all-layouts-force-directed-first.md` (id `nid_w8co2gp7cok2a2hwwsm88brfo_e`).
DEPENDS ON: `edge-routing__00-wasm-spike-libavoid-in-obsidian` (`nid_pgsj1vjjnmtflf55a4sd9txos_e`) — read its `add-note` findings (which wasm load path won, nested-shape behavior) before starting.

## Goal

A layout-agnostic post-layout routing pass that computes obstacle-avoiding polylines for all edges and threads them through the immutable `FlowSnapshot`, gated by a new `ViewSettings` boolean `edgeRouting` (DEFAULT OFF in this ticket; flipped ON in `edge-routing__03`). No rendering changes in this ticket — routed points ride along unused until `edge-routing__02`.

## Architecture (from the epic — follow it)

```
GraphLayoutRunner (elk [+ d3 force refine])       src/view/GraphLayoutRunner.ts:14
  → positions + dimensions                        src/view/elkMapping.ts:144 extractElkPositions, :164 extractElkDimensionsById
  → NEW EdgeRoutingPass (libavoid)                src/view/edgeRouting.ts (new)
  → FlowSnapshot edges gain routedPoints?         src/view/flowMapping.ts
  → published via GraphViewController.publish     src/view/GraphViewController.ts:201
```

## Design decisions (already made in the epic — do not re-litigate without human alignment)

1. **New module `src/view/edgeRouting.ts`** — RF-free (no `@xyflow/react` import; only `.tsx` files may import RF), node-testable like `elkMapping.ts`/`flowMapping.ts`.
   - `interface EdgeRouter { route(input: EdgeRoutingInput): Promise<EdgeRouteMap> }` (DIP — tests use a fake; libavoid impl is `LibavoidEdgeRouter`).
   - `EdgeRoutingInput`: obstacles `Array<{ id: string; x: number; y: number; widthPx: number; heightPx: number }>` in ABSOLUTE coordinates + edges `Array<{ id: string; sourceId: string; targetId: string }>`. Use named data types, no tuples/Pairs.
   - `EdgeRouteMap = Map<edgeId, RoutedPoint[]>` where `RoutedPoint = { x: number; y: number }` (absolute coords).
2. **Coordinates**: run routing on ABSOLUTE positions (available from `extractElkPositions` before `withPositions` converts subflow children to parent-relative at `src/view/flowMapping.ts:315`). Convert routed points to whatever space `VicinityEdge` needs later (RF edge rendering works in flow/absolute space — confirm; note the answer in code comment).
3. **libavoid usage** (verified API, see spike ticket for details): `Avoid.Router(Avoid.PolyLineRouting)`; each obstacle = `Avoid.Rectangle(topLeft, bottomRight)` + `Avoid.ShapeRef`; endpoints SHAPE-ATTACHED via `ConnEnd(shapeRef, classId)` centre pin — NOT raw points — so src/tgt shapes don't block their own edge; one `router.processTransaction()`; read `connRef.displayRoute()`. Set `shapeBufferDistance` routing parameter to a NAMED CONSTANT (initial value: relate to existing `EDGE_PAIR_CURVATURE_PX = 34` in `src/view/edgeGeometry.ts:54`; e.g. `EDGE_ROUTING_SHAPE_BUFFER_PX`).
4. **Obstacles registered**: all root-level note squares (side = `nodeSideLengthPx`, `src/view/graphIdentity.ts:43`), folder-group container rects (elk dims, applied in `withGroupDimensions` `src/view/flowMapping.ts:338`), and subflow child squares. Collapsed folder-group edges (`buildFlowEdges` `src/view/flowMapping.ts:218`, `accumulateCollapsedEdge` `:259`) attach to the GROUP shape; child-level edges attach to child shapes. If the spike found nested-shape attachment broken, apply the documented fallback: attach child edges to the enclosing group shape.
5. **Memory**: `LibavoidEdgeRouter` owns ALL create/destroy. Router-per-pass; `Avoid.destroy(...)` sweep in `finally`. No libavoid object may escape the class.
6. **Wiring**: `GraphViewController.runRebuild` (`src/view/GraphViewController.ts:164`) — after layout, before `publish` (`:201`). The pass is async; pipeline is already async.
   - **Reuse-layout path**: `decideLayout` can skip elk and reuse positions (`:183`). Routes are a pure function of (positions, dimensions, edges) → cache the `EdgeRouteMap` alongside the reused layout and skip re-routing when inputs are unchanged; re-route when edges changed but positions reused.
7. **Failure containment**: if wasm init or routing throws → log ONCE (console.warn with plugin prefix), publish snapshot WITHOUT `routedPoints`. Straight edges = today's behavior. This is the single, documented pass-level fallback — no per-edge silent fallbacks.
8. **Setting**: `edgeRouting: boolean` in `ViewSettings`, default OFF. Follow the existing pattern used by `layoutMode` (see `src/engine/ViewSettingsResolver.ts`, `src/persistence/persistedShapes.ts`). Surface a toggle in the settings tab (`src/view/VicinityGraphSettingTab.ts`). When OFF: pass never runs, wasm never loads.
9. **Snapshot threading**: `FlowEdge` (see `src/view/flowMapping.ts:102-123` for the existing `hasOpposite`/`bidirectional` fields) gains optional `routedPoints?: RoutedPoint[]`; propagate into the RF edge `data` in `toReactFlowEdge` (`src/view/VicinityGraphFlow.tsx:174`) → `VicinityEdgeData` (`src/view/VicinityEdge.tsx:25`). Rendering ignores it until phase 02.

## Tests (start failing-first per repo convention)

- Vitest unit (no WASM, fake `EdgeRouter`):
  - obstacle/edge extraction: given snapshot inputs (positions, dims, edges incl. a folder group with child + a collapsed group edge) → correct `EdgeRoutingInput` (absolute coords, group attachment rules).
  - threading: route map entries land on the right `FlowEdge.routedPoints`; edges missing from the map stay undefined.
  - failure fallback: router that throws → snapshot published without routedPoints, single warn.
  - setting OFF → router never invoked.
  - reuse-layout path: unchanged inputs → cached routes reused (router invoked once).
- Integration with REAL wasm via `libavoid-js/dist/index-node.mjs` under vitest node env: route 2 nodes + 1 blocking obstacle, assert polyline has >2 points and avoids the rect. If `index-node.mjs` won't load under vitest, mark the test skipped with a WHY comment and note it here — do NOT fake-pass.

## Acceptance criteria

- [ ] `edgeRouting` setting exists, default OFF, persisted, visible in settings tab.
- [ ] With setting ON in dev-vault force layout: snapshot edges carry `routedPoints` (verify via logging/devtools; rendering unchanged).
- [ ] All listed unit tests pass; `npm run check` clean; full vitest suite green.
- [ ] No libavoid objects leak outside `LibavoidEdgeRouter` (grep-verifiable: `Avoid.` only appears in `edgeRouting.ts` + loader shim).
- [ ] Reuse-layout rebuilds do not re-run libavoid when inputs unchanged.

## Out of scope

- Rendering routed paths (ticket `edge-routing__02-render-routed-edges`).
- Orthogonal routing, parameter tuning beyond initial constants, default-ON (ticket `edge-routing__03`).


## Notes

**2026-07-22T17:24:51Z**

Phase 1 COMPLETE — all acceptance criteria met, 0 blocking.

DELIVERED: RF-free src/view/edgeRouting.ts (EdgeRouter DIP + LibavoidEdgeRouter with internal AvoidArena), pure extractEdgeRoutingInput(); routedPoints threaded FlowEdge -> RF data -> VicinityEdgeData (rendering unchanged, Phase-2 boundary); wired into GraphViewController.runRebuild after layout/before publish with signature-keyed route cache + warn-once pass-level failure fallback; new edgeRouting ViewSetting (default OFF) mirroring groupByFolder + visible settings-tab toggle. Spike throwaway deleted; main.ts cleaned.

DECISIONS: shapeBufferDistance = EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX/2 (17). EdgeRouteMap typed ReadonlyMap for immutability. edgeRouting flip invalidates route cache WITHOUT forcing elk relayout (positions unchanged). loadAvoid reached via lazy await import() so OFF never loads wasm and vitest never pulls the esbuild-only virtual module. AvoidArena relocated from throwaway spike (the spike ticket note had it in the wrong file).

VERIFIED: npm run check 0 errors; vitest run 630 passed/54 files (zero regressions); npm run build green with wasm embedded; real-wasm integration test genuinely routes around obstacle (>2 pts, avoids rect), not fake-passed. Avoid. usage grep-confined to edgeRouting.ts + libavoidLoader.ts. Independently reproduced by IMPLEMENTATION_REVIEW: READY.

Commits: c924e66 (exploration), 1c2c282 (impl). Artifacts: .ai_out/edge-routing__01/edge-routing/*.md.
