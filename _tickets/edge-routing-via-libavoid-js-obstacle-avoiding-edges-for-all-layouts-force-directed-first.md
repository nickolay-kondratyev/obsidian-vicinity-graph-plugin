---
id: nid_w8co2gp7cok2a2hwwsm88brfo_e
title: "Edge routing via libavoid-js (obstacle-avoiding edges for all layouts, force-directed first)"
status: open
deps: []
links: []
created_iso: 2026-07-22T15:57:36Z
status_updated_iso: 2026-07-22T15:57:36Z
type: epic
priority: 2
assignee: CC_WITH-nickolaykondratyev
---

Plan for obstacle-avoiding edge routing using libavoid-js (WASM port of adaptagrams libavoid). Full plan is in this ticket body below.

# Goal

Edges should route AROUND node/group bounding boxes instead of crossing through them. Primary target: `force` (organic force-directed) layout. Secondary: `layered` and `radial` get routing too — the design below is layout-agnostic, so all three come for free from the same pass.

Reference: React Flow's own edge-routing example (https://reactflow.dev/examples/edges/edge-routing) uses https://github.com/Aksem/libavoid-js — we lean on the same library.

# Why libavoid-js fits this codebase

- Layout here is **one-shot, not continuous** (`src/view/d3ForceRefinement.ts:75` runs the d3 simulation synchronously to convergence; no per-tick edge re-render). Routing is therefore a single post-layout pass, not a per-frame cost.
- **Every node/group already has an explicit axis-aligned bounding box** before the snapshot is published: positions from `extractElkPositions` (`src/view/elkMapping.ts:144`), sizes from `node.sizePx` squares (`src/view/graphIdentity.ts:43`) and elk-computed group dimensions (`src/view/flowMapping.ts:338`). These map 1:1 onto libavoid `Rectangle` obstacles.
- Edges are custom-drawn already (`src/view/VicinityEdge.tsx` renders `<BaseEdge>` + self-drawn `<polygon>` arrowheads from `src/view/edgeGeometry.ts`), so swapping the path source from "straight line between handles" to "routed polyline" is localized.

# libavoid-js API facts (verified against dist v0.4.x)

- npm: `libavoid-js`. Ships `dist/index.js` (browser ESM, ~76KB) + `dist/libavoid.wasm` (~474KB) + `index.d.ts`. Node variant `dist/index-node.mjs` exists (useful for tests).
- Load: `await AvoidLib.load(wasmFilePath); const Avoid = AvoidLib.getInstance();` — `load(filePath?)` feeds Emscripten `locateFile` for the `.wasm` request. Singleton; second load is a no-op.
- Core API: `new Avoid.Router(Avoid.PolyLineRouting | Avoid.OrthogonalRouting)`, `new Avoid.Rectangle(topLeft, bottomRight)`, `new Avoid.ShapeRef(router, rect)`, `new Avoid.ConnEnd(point)` or `ConnEnd(shapeRef, classId)`, `new Avoid.ConnRef(router, srcEnd, dstEnd)`, `router.processTransaction()`, then `connRef.displayRoute()` → `PolyLine { size(), get_ps(i) → {x,y} }`.
- Tuning: `router.setRoutingParameter(Avoid.RoutingParameter.shapeBufferDistance, px)` (clearance around obstacles), `segmentPenalty`, `crossingPenalty`; `setRoutingOption(...)` for orthogonal nudging.
- Memory: WebIDL-bound C++ objects — every created object must be freed via `Avoid.destroy(obj)`; destroying the `Router` frees registered shapes/conns it owns, but Points/Rectangles/ConnEnds we `new` must be destroyed explicitly. Wrap ALL of this in one class so leaks are impossible to write at call sites.

# Architecture

Routing is a **post-layout pass** producing per-edge polylines carried in the immutable `FlowSnapshot`, exactly analogous to how `refineForceRootLayout` post-processes elk output.

```
GraphLayoutRunner (elk [+ d3 force refine])
  → positions + dimensions
  → NEW: EdgeRoutingPass (libavoid): bboxes as obstacles, edges as conns
  → FlowSnapshot edges gain routedPoints?: RoutedPoint[]
  → VicinityEdge renders routed path when present, else current edgePathFor fallback
```

Key decisions:

1. **`EdgeRouter` interface + `LibavoidEdgeRouter` impl** (DIP). New module `src/view/edgeRouting.ts` (RF-free, node-testable like the other mapping modules):
   - Input: `{ obstacles: Array<{id, x, y, width, height}>, edges: Array<{id, sourceId, targetId}> }` in ABSOLUTE coordinates (available pre-snapshot, before the parent-relative conversion in `withPositions`, `src/view/flowMapping.ts:315`).
   - Output: `Map<edgeId, RoutedPoint[]>` (`RoutedPoint = {x, y}` data class — no Pair-style tuples).
   - `PolyLineRouting` for all modes initially (organic look, fits force/radial; layered can move to `OrthogonalRouting` later as a follow-up if wanted — same interface).
2. **Endpoint attachment: `ConnEnd(shapeRef, classId)`** (shape-attached, centre pin), NOT raw centre points. Shape-attached ends make libavoid treat src/tgt shapes as connectable rather than obstacles-blocking-their-own-edge. Arrowhead inset logic (`arrowFromApproach`, `src/view/edgeGeometry.ts:142`) already handles "line aims at node centre, arrow pulled back".
3. **Obstacles**: all root-level note squares + folder-group container rects + subflow child squares. Collapsed folder-group edges (`buildFlowEdges`/`accumulateCollapsedEdge`, `src/view/flowMapping.ts:218,:259`) attach to the GROUP shape. Child-node edges attach to the child shape; libavoid handles a conn whose endpoint shape sits inside another shape (group) — verify in the spike (Phase 0 exit criterion).
4. **Rendering** (`src/view/VicinityEdge.tsx` + `edgeGeometry.ts`):
   - Thread `routedPoints` through `FlowEdge` → `VicinityEdgeData`.
   - New `edgeGeometry` function: polyline → SVG path with rounded corners (quadratic smoothing at bend points — organic look, cheap). Straight-line fallback when `routedPoints` absent or degenerate (≤2 points ⇒ identical to today).
   - Target arrowhead from the LAST segment tangent; source arrowhead (bidirectional) from the FIRST segment tangent — generalizes existing `arrowFromApproach`/`sourceArrowOf`.
   - Count badge anchored at routed-path midpoint (walk polyline half-length) instead of segment midpoint.
   - `hasOpposite` curved-pair bow (`EDGE_PAIR_CURVATURE_PX`): when routing is ON, opposite pairs are rendered as routed lines and rely on `shapeBufferDistance`/distinct routes for separation. If pairs overlap badly in practice, prefer the already-documented direction from `docs-internal/vicinity-graph-specs/arrows.md:88-94`: collapse ALL bidirectional pairs to one line + two arrowheads (separate follow-up ticket, good synergy).
5. **WASM bundling** (`esbuild.config.mjs`): plugin ships as single `main.js` — no file sidecars, no network fetch at runtime (Obsidian plugins must work offline; generated URLs are forbidden anyway). Embed the wasm:
   - esbuild loader: `".wasm": "base64"` (new loader entry; none exist today).
   - At runtime build `data:application/octet-stream;base64,<b64>` and pass it to `AvoidLib.load(dataUrl)` — Emscripten's `locateFile` receives it and Chromium `fetch()` accepts data: URLs (Obsidian is Electron). Verify in Phase 0 spike; fallback plan: `WebAssembly.instantiate` bytes ourselves via the module's `wasmBinary` option (the Emscripten build honors `Module.wasmBinary`; would need a tiny load-shim instead of `AvoidLib.load`).
   - Cost: ~630KB base64 added to `main.js`. Acceptable for a desktop plugin; note it in the release notes when bumping.
   - Lazy-load: initialize `AvoidLib` on first routing request (async, matches the already-async layout pipeline), NOT at plugin startup.
6. **Failure containment**: if WASM init or routing throws, log once and publish the snapshot WITHOUT `routedPoints` — the graph must always render (straight edges = today's behavior). No silent per-edge fallbacks beyond this single documented pass-level fallback.
7. **Settings**: `ViewSettings` boolean `edgeRouting` (default ON once stable; ship Phase 1 behind default OFF until Phase 3 sign-off). Surface in the settings tab alongside layout mode.

# Phases — child tickets (dependency chain 00 → 01 → 02 → 03)

| Phase | Ticket file (`_tickets/`) | Id |
|---|---|---|
| 0 | `edge-routing__00-wasm-spike-libavoid-in-obsidian.md` | `nid_pgsj1vjjnmtflf55a4sd9txos_e` |
| 1 | `edge-routing__01-routing-pass-and-snapshot-threading.md` | `nid_pc87xabr7xi67c4qmht938r2o_e` |
| 2 | `edge-routing__02-render-routed-edges.md` | `nid_82xnrearif6y7fcd80y5gprkc_e` |
| 3 | `edge-routing__03-all-layouts-tuning-default-on.md` | `nid_o1f05i1pu3lgkmaxpbaj13x3x_e` |

Phase summaries below are kept for overview; the child tickets are the source of truth for scope/acceptance.

**Phase 0 — Spike: libavoid in Obsidian (small, throwaway allowed)**
- Add `libavoid-js` dep, esbuild base64 wasm loader, load module inside the dev-vault plugin, route 1 conn around 1 rect, log polyline.
- Exit criteria: wasm loads offline from bundled base64 in Obsidian; conn endpoint attached to a shape nested inside another shape routes sanely; memory cleanup pattern proven (`Avoid.destroy` sweep, no crash on repeated view open/close).

**Phase 1 — Routing pass + snapshot threading (force layout, behind setting)**
- `src/view/edgeRouting.ts`: `EdgeRouter` interface, `LibavoidEdgeRouter`, `RoutedPoint`.
- Wire into `GraphViewController.runRebuild` after layout, before `publish` (`src/view/GraphViewController.ts:164,:201`). Reuse-layout path (`decideLayout` skip) must reuse cached routes too — routes are a pure function of (positions, dimensions, edges), cache alongside the layout result.
- Unit tests (vitest, no WASM): obstacle/edge extraction from snapshot inputs; route-map threading; fallback-on-error. Integration test with real WASM via `dist/index-node.mjs` if it loads under vitest node env — if not, mark as e2e-only and say so in the ticket.

**Phase 2 — Rendering routed edges**
- `edgeGeometry.ts`: `routedPathFor(points)` (rounded-corner SVG path), arrowheads from first/last segment tangents, badge at polyline midpoint. Unit-test the geometry (pure functions).
- `VicinityEdge.tsx`: consume `routedPoints`, fallback to `edgePathFor`.
- e2e Playwright visual smoke: force-layout vault fixture where a straight edge would cross a node — assert routed path has >2 points / screenshot compare.

**Phase 3 — All layouts + tuning + enable by default**
- Confirm pass runs for `layered`/`radial` (should be free — same pipeline); fix subflow/group edge-attachment issues that surface.
- Tune `shapeBufferDistance` (relate to `EDGE_PAIR_CURVATURE_PX`/arrow inset constants — named constants, no magic numbers), `segmentPenalty`, `crossingPenalty`.
- Flip `edgeRouting` default ON; update `docs-internal/vicinity-graph-specs/arrows.md` with routing behavior; release-notes note about bundle size.

**Deferred / follow-ups (explicitly OUT of scope)**
- `OrthogonalRouting` mode for `layered` layout.
- Collapse all bidirectional pairs to single line + 2 arrowheads (arrows.md:88-94 recommendation).
- Live re-routing during node drag (nodes are non-draggable today — `docs-internal/tickets/ticket-node-drag-reposition.md`).
- Web-worker routing (only if pass time on large vicinities proves noticeable; measure first).

# Risks

| Risk | Mitigation |
|---|---|
| data:-URL wasm load path fails in Electron | Phase 0 spike first; fallback = `wasmBinary` load-shim |
| Conn endpoints inside group containers route weirdly | Phase 0 exit criterion; fallback = treat group as the endpoint for child edges (coarser but sane) |
| WebIDL memory leaks on repeated rebuilds | Single `LibavoidEdgeRouter` class owns create/destroy; router-per-pass, destroy sweep in `finally` |
| +630KB main.js | Accepted consciously; noted in release notes |
| Polyline routes look angular, not organic | Rounded-corner smoothing in Phase 2; curvature constant tunable |

# Key files

- `src/view/GraphLayoutRunner.ts:14`, `src/view/GraphViewController.ts:164` — where the pass hooks in
- `src/view/flowMapping.ts:218,:315` — edge building + absolute→relative positions
- `src/view/elkMapping.ts:144,:164` — position/dimension extraction (obstacle source)
- `src/view/edgeGeometry.ts`, `src/view/VicinityEdge.tsx` — rendering
- `esbuild.config.mjs` — wasm base64 loader + bundling
- `docs-internal/vicinity-graph-specs/arrows.md` — edge spec to keep updated

