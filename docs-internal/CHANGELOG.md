# Changelog

## 2026-07-23 — edge-routing: obstacle avoidance is always on (setting removed)

Obstacle-avoiding edge routing (libavoid) is no longer a user toggle — it always runs.
The `edgeRouting` view setting is removed end to end: the `ViewSettings` field and
`DEFAULT_EDGE_ROUTING`, its cascade resolution, the settings-tab "Layout" toggle, the
`global-edge-routing` write command, and its persistence parsing. The routing pass in
`GraphViewController` now runs unconditionally (the libavoid wasm still lazy-loads on the
first `route`, and the pass-level failure fallback to straight edges is unchanged).

- **Persistence** bumps to **v2**; stale persisted `edgeRouting` values are dropped
  (mismatched-version data resets to defaults, then rewrites at v2).
- **Tests.** The fixture baseline (`edgeRouting:false` + `withEdgeRouting`) is removed —
  routing is on for every view-layer fixture. The "router not invoked when off" case is a
  human-approved behavior removal. Unit tests stay fast on `FakeEdgeRouter`; real libavoid
  wasm remains e2e-covered (`e2e/edgeRouting.e2e.ts`).

## 2026-07-23 — edge-routing: 12 boundary pins per group box (corner pins removed)

Folder-group boxes now expose **12 boundary connection pins** — 3 per side at 1/4, 1/2,
3/4, all outward-perpendicular — instead of the earlier 8 (4 side-midpoints + 4 corners).
The corner pins are removed so an edge never appears to continue **past** a node it
terminated at; every attachment now lands square-on a face. Note squares are unchanged
(single centre pin, the group-only perf decision from edge-routing__04). No cost-model
change — libavoid still selects the cheapest pin per connector end. View-layer only
(`src/view/edgeRouting.ts`).

## 2026-07-23 — global-node-exclusion: exclude notes from every graph by path regex

Adds a **global** exclusion list that keeps matching notes (index/MOC hubs,
templates, a `rel/` folder) out of every vicinity graph. Applied at the **data
layer** — excluded neighbors are rejected at BFS discovery, before layout — so
they never read metadata, record an edge, or expand further (the perf win). New
pure engine seam; adapters stay thin.

- **Regex-lite matching** (`src/engine/PathExclusionMatcher.ts`, new pure class):
  each list entry is a `new RegExp(pattern)` tested **unanchored** and
  **case-sensitively** against the full vault-relative path incl. extension, so
  `rel/` matches `rel/x.md` anywhere in the path and `^rel/` anchors to the vault
  root. Invalid patterns are silently skipped (never break the graph); excluded
  iff ANY enabled + valid pattern matches; empty/disabled ⇒ no-op.
- **Roots exempt.** Exclusion applies only to discovered neighbors —
  `VicinityTraversal` computes the root-path set once and never excludes the
  central or a pinned central even when it matches. A note reachable only through
  an excluded note is consequently not discovered (documented semantic).
- **Count.** `VicinityGraph.excludedNodeCount` = distinct vault paths rejected
  during that traversal; surfaced next to the toolbar pill only when exclusion is
  enabled AND the count > 0.
- **Surfaces.** Settings tab: enable toggle + patterns textarea (source of
  truth). Toolbar pill (`NodeExclusionSection`): global enable/disable + count
  badge. Both write the one `node-exclusion` command through the existing
  `planSettingsWrite` contract.
- **Persistence.** New global-only `PluginData.nodeExclusion { enabled, patterns[] }`
  (defensively parsed, default `{ enabled: false, patterns: [] }`); reaches the
  engine as a top-level `GraphBuildRequest.nodeExclusion`. **Version stays v1**
  (additive).
- **Out of scope this iteration:** per-doc override, settings-tab regex
  validation UI (invalid patterns silently skipped).

Verified: `npm run check` (tsc) clean; `npm test` **713** green. Pure view/CSS
mirrors the existing global-toggle precedents; `main.js`/`styles.css` regenerated
by the build.

## 2026-07-23 — node width floored to fit the full name (no more title `...`)

Note nodes no longer truncate their title with an ellipsis. Previously every node was a
score-sized square (40–160px), so any name too long for the square clipped to `...`.

- **Nodes are now rectangles**: the composed size score drives the node **height** (and a
  minimum width); the **width** is floored so the full label renders on one line without
  truncation. A long name grows the node **wider, not taller**, and may exceed the 160px
  max. Ungrouped singletons additionally reserve width for their muted `folder/`
  breadcrumb.
- The width floor is a pure char-count estimate (`estimateNodeLabelWidthPx` in
  `view/constants.ts`) applied in the shared `nodeDimensionsPx` (`view/graphIdentity.ts`),
  so the elk layout box and the React Flow render box stay in lockstep — no DOM measuring,
  consistent with the node's existing "no JS measuring" density model. Breadcrumb
  derivation moved into the shared `breadcrumbFolderOf` so both mappers agree on it.
- Height-keyed CSS density (title-only / +attachments / +thumbnail) is unchanged.

## 2026-07-23 — edge-routing__04: boundary pins on group boxes kill roundabout routes; detour-ratio telemetry

Fixes routed edges to/from folder-group boxes taking visibly roundabout paths when a
direct route existed. Root cause: connector endpoints pinned to shape CENTRES, so
libavoid optimised a centre→centre path (the interior leg of a large group box dominated
its cost) while the UI shows only the clipped border→border chord — and a group's own
member squares block the group's own connectors, forcing escape through whatever channel
remained. Ticket `nid_54ura771jb1b82dah6macdqvj_e`. Pure view-layer change — no engine
changes.

- **Group-box endpoints now use 8 proportional boundary pins** (4 side-midpoints with
  outward `visDirs` + 4 corners `ConnDirAll`) instead of one centre pin, so libavoid
  picks the pin facing the counterpart and routes never traverse the box interior or its
  children. **Note squares keep the single centre pin** — group-only by deliberate
  perf choice: 8 pins on ALL shapes blew the dense-fixture budget (~8.8s vs ~1.45s
  layout), and small squares have centre≈boundary after clipping so they barely exhibit
  the pathology. Added typed `ConnDirUp/Down/Left/Right` to the `Avoid` interface
  (`libavoidLoader.ts`); threaded `kind` onto `RoutingObstacle`. `clipRouteToEndpointRects`
  unchanged. Result: grouped-fixture max detour ratio 1.000 (repro loops gone).
- **Detour-ratio telemetry** (`edgeGeometry.ts`, unit-tested): pure metric = clipped arc
  length ÷ endpoint chord; max/mean logged in the routing-pass `console.debug` so
  before/after is numeric, not just visual. Also fixed a telemetry-ordering bug — the
  routing pass is now logged before the `isStale` early-return (the PERF BUDGET e2e was
  false-passing on a trivial intermediate pass).
- **Perf held:** dense/force routing **~137ms** vs layout **~1464ms** (real 101-obstacle
  pass). Phase C (line-of-sight shortcutting) NOT needed — boundary pins sufficed.

Verified: `npm run check` (tsc) clean; `npm test` **664/664** green.

## 2026-07-23 — note preview scoped to node content: attachment tiles are a hover dead zone

Fixes hovering an attachment tile (e.g. the PDF chip) triggering the native note
preview popover over the very affordance the human is reaching for. Root cause: the
`hover-link` preview was armed by React Flow's node-level `onNodeMouseEnter`, so the
whole node — tiles included — was the preview target.

- **`NoteNode` now owns the trigger**, bound to a new `.vicinity-graph-node__preview-zone`
  wrapper around the title + thumbnail; that element (not the node) is the `hover-link`
  `targetEl`. The attachment strip and pin button are SIBLINGS of the zone, so the
  pointer leaves the preview target when it reaches a tile — Obsidian never opens/keeps
  the popover there. `onNodeMouseEnter` removed from `VicinityGraphFlow`.
- **CSS:** the preview-zone flex-grows to fill the node, so the strip still lands on the
  bottom edge (replacing its old `margin-top: auto`); container-query density thresholds
  are unaffected (they match descendants at any depth).
- **e2e:** new selector-contract test asserts the chips render outside the preview-zone.
  Pure view-layer change — no engine changes.

## 2026-07-22 — routed edges clipped to endpoint rects: collapsed group arrows terminate at the group boundary

Fixes a bug where, with edge routing ON, a collapsed group arrow plunged INSIDE the
group box and its arrowhead landed on a member node — reading as a node→node link
rather than node→group. Root cause: libavoid's centre pin (`PIN_CENTRE_FRACTION = 0.5`)
makes routed polylines start/end at the endpoint box **centre**; nothing clipped them
to the box boundary. Ticket `nid_wku3029kwmnei7e86rbb1dk7w_e`. Pure view-layer geometry —
no engine changes.

- **New pure function `clipRouteToEndpointRects(points, sourceRect, targetRect)`**
  (`src/view/edgeGeometry.ts`): walks in from each end dropping points strictly inside
  the endpoint rect and replacing the terminus with the true segment↔border crossing
  (Liang–Barsky). Degenerate/overlap (route wholly inside a rect, tiny edge, source rect
  == target rect) falls back to the unclipped 2-point chord — never empty/NaN, mirroring
  the existing `distinctSegmentFrom` guard spirit.
- **Applied in `GraphViewController.resolveRoutes`** before the route cache write, so
  cached (reuse-layout) routes are already clipped; `withRoutedPoints` is untouched.
  Each route is clipped against its source/target obstacle rect from the existing
  `extractEdgeRoutingInput` pipeline — folder-group endpoints resolve to their
  `groupDimensions` GROUP rect, notes to their note rect; a missing obstacle leaves the
  route unclipped rather than crashing.
- **Side-aware anchoring for free:** the clipped terminus is where the route crosses the
  border, so the arrowhead now lands on the logical approach side for ALL routed edges.
  The non-routed straight-edge path is unchanged (linked follow-up
  `nid_var2o7krxq7ribq3iofni3aw1_e`).
- **Arrowhead inset unchanged:** after clipping, `routedGeometryFor`'s inset measures
  from the boundary; the head now sits just OUTSIDE the box on the approach line
  (previously note heads coincidentally sat just inside via centre≈boundary) — a
  consistency improvement, not a regression.
- **Spec:** `docs-internal/vicinity-graph-specs/arrows.md` §5 gains a normative
  boundary-clipping statement.
- **Tests:** 7 new (6 BDD unit for the clip math incl. corner-entry, source mirror, and
  degenerate-fallback; 1 controller test asserting a note→note terminus clips to the
  note border) plus a folder-group controller test asserting a `c.md→folder-group:notes`
  route clips to the GROUP container border (x=150), not the interior centre — routed
  through the real folder-group obstacle-extraction branch. `npm test` 658 pass, `tsc`
  clean. E2E: existing routing regression stays green (4/4); the new group
  geometry-assertion e2e was **downgraded to screenshot capture** (deterministic
  controller test is the gate) per the ticket's explicit allowance.

## 2026-07-22 — edge-routing Phase 3: routed edges ON by default, verified across all layout modes, parameters tuned

Graduates obstacle-avoiding edge routing to **ON by default for the `force` and
`layered` layouts**. `DEFAULT_EDGE_ROUTING` flips `false → true`; users can still
disable it from the settings tab (OFF ⇒ the routing pass never runs and the libavoid
wasm never loads). Ticket `edge-routing__03-all-layouts-tuning-default-on`. Builds on
Phases 0–2.

- **Routing works in `force` + `layered`; `radial` is gated off.** The routing pass
  is layout-agnostic (runs in `GraphViewController` after layout, before publish, on
  absolute positions only). Verified end-to-end on real headless Obsidian across a
  sparse / medium (folder-group) / dense (~100-node) dev-vault fixture — collapsed
  group-box edges and child-square edges attach correctly, no NaN/degenerate paths.
  **`radial` is deliberately excluded** (`ROUTING_SKIPPED_LAYOUT_MODE`, human
  decision): its ring placement makes spokes near-straight, so routing there only
  added ~490ms of visibility-graph cost (vs a ~45ms radial layout on the dense
  `all-edges` fixture) for no visual gain — radial renders straight spokes, gated
  pending a web-worker offload. `e2e/edgeRouting.e2e.ts` extended with a
  `setLayoutMode` helper, a `layered` case (genuinely detours a hub-crossing chord),
  and a `radial` case asserting ZERO bends (proving the gate); the existing "routing
  OFF" test now pins `edgeRouting=false` explicitly since the default is ON.
- **Parameters tuned as named constants** (`src/view/edgeRouting.ts`, evaluated on
  three dev-vault fixtures with screenshots read back for route quality):
  `EDGE_ROUTING_SHAPE_BUFFER_PX = 17` (kept; > the 14px arrowhead min inset so routes
  clear boxes past the head, small vs node spacing), `EDGE_ROUTING_SEGMENT_PENALTY_PX
  = 50` (NEW — ~50px virtual cost per extra bend → calmer, fewer spurious zig-zags),
  `EDGE_ROUTING_CROSSING_PENALTY_PX = 0` (NEW knob, **disabled**: any positive value
  pays libavoid's ~O(connectors²) crossing check and blew the dense-fixture budget —
  crossing reduction is not "cheap" on hub-shaped vicinities), `ROUTED_CORNER_RADIUS_PX
  = 10` (kept). The three "tuning deferred to __03" WHY comments are updated to the
  final rationale.
- **Performance (routing pass vs elk+d3 layout, real headless Obsidian, ~100-node /
  ~292-edge dense fixture, `all-edges`):** DEFAULT force layout — routing **~140ms**
  vs layout **~1460ms** (well under, ~9%). `layered` — routing **~185ms** vs
  **~300ms** (under). `radial` — routing would have been **~490ms** vs a ~45ms layout,
  so it is **gated off** (above) and pays nothing. A committed perf-budget e2e guards
  the default force case; sparse/medium routing is a few ms.
- **`main.js` size:** production build **2,610,310 B** (vs the pre-routing Phase-00
  baseline 1,877,709 B ⇒ **+732,601 B / ~+715 KiB**, essentially all the base64
  embedded libavoid wasm; the Phase-3 source delta over Phase 2 is ~3 KB).
- **Mobile: NOT verified.** `manifest.isDesktopOnly:false` but no iOS/Android runtime
  or simulator is available in this environment — unchanged from Phases 0–2, recorded
  here again explicitly (not silently skipped).
- **Version unchanged (0.1.1).** Following the established per-phase pattern (Phases
  0–2 added CHANGELOG entries without bumping); the three-file version bump happens
  at the actual release cut per `RELEASE_CHECKLIST.md`.

Verified: `npm run check` (tsc) 0 errors; `vitest run` all green (3 new tuning-constant
tests); `npm run test:e2e` green on headless Obsidian 1.12.7 (extended routing smoke
across all layouts + a routing-eval spec that reads the pass timings and captures
per-mode screenshots to `/.out`).

## 2026-07-22 — edge-routing Phase 2: `VicinityEdge` renders the routed polyline (smoothed corners, tangent arrowheads, midpoint badge) — straight-line fallback unchanged (behind `edgeRouting`, default OFF)

`VicinityEdge` now consumes the `routedPoints` threaded through in Phase 1 and draws the obstacle-avoiding polyline with rounded corners, arrowheads along the true approach segments, and the count badge on the routed path. When `routedPoints` is absent or degenerate the render is byte-for-byte the previous straight/bowed edge. Ticket `edge-routing__02-render-routed-edges` (closed). Depends on Phase 1. Enabling by default + parameter tuning + layered/radial verification remain Phase 3 ([[_tickets/edge-routing__03-all-layouts-tuning-default-on]]).

- **New pure geometry in `src/view/edgeGeometry.ts` (still RF-free, unit-tested)**: `routedPathFor(points)` builds the SVG path with a quadratic arc at each interior bend, shrinking each corner by `ROUTED_CORNER_RADIUS_PX = 10` clamped to half of each adjacent segment (short segments can't invert); `polylineMidpoint(points)` walks to half the total arc length for badge anchoring; `routedGeometryFor(points)` returns the SAME `EdgePathGeometry` shape as `edgePathFor`, so `VicinityEdge` renders routed and straight edges through ONE code path.
- **Arrowheads generalized, not duplicated (DRY)**: target head from the LAST-segment tangent, source head from the FIRST-segment tangent, reusing `arrowFromApproach`/`sourceArrowOf` — the inset constants (`0.12`/`14`/`48`) still live once. Routed arrow inset uses the tangent SEGMENT's own length (head sits on its approach segment); the ≤2-point case delegates to `edgePathFor(...,false)` so it equals today's straight edge exactly.
- **`VicinityEdge.tsx` branch**: `data.routedPoints` (length ≥ 2) → `routedGeometryFor`; else EXACTLY the prior `edgePathFor` call. Arrowhead/badge JSX untouched → the OFF path is a no-op change (all pre-existing edge tests pass unmodified). `hasOpposite` bowing intentionally NOT applied when routed — separation comes from libavoid buffers; genuine bidirectional overlap is deferred to the arrows.md:88-94 collapse follow-up, no third mechanism invented.
- **Degenerate-segment hardening**: duplicate consecutive routed points no longer NaN the arrow transform — `distinctSegmentFrom(points, fromIndex, step)` walks past coincident waypoints to the nearest DISTINCT neighbour for the tangent, and `arrowFromApproach` guards `approachLength === 0` by anchoring flat on the endpoint (mirrors the existing degenerate `edgePathFor` case). Reproduced failing-first, then fixed.
- **Coordinates (ticket item 3) — no transform needed, confirmed**: `routedPoints` are ABSOLUTE flow coords and RF hands custom edges absolute `sourceX/Y`/`targetX/Y` (even subflow children), so the geometry layer applies no offset. A pure pass-through unit test proves the routed path starts/ends exactly at the polyline endpoints; the subflow claim rests on that plus the e2e screenshot (WHY comments at both seams). Nothing to fix at the mapping layer.
- **e2e visual smoke (`e2e/edgeRouting.e2e.ts` + new `setEdgeRouting` harness helper)**: a seeded force-layout fixture with `edgeVisibility: "all-edges"` renders sibling diameter-chords through the hub so a straight edge would cross a node. Routing OFF asserts 0 bends WITH crossing chords present; ON asserts ≥1 bent edge (detector = path with ≥2 `L` commands — precise, not coordinate-overfit). Screenshot saved to gitignored `/.out/edge-routing-force.png`.

Verified: `npm run check` (tsc) 0 errors; `vitest run` **646 passed / 54 files** (16 new geometry tests incl. 5 NaN-tolerance cases; zero pre-existing tests modified or removed); `npm run test:e2e -- edgeRouting.e2e.ts` **2/2 passed** against real headless Obsidian 1.12.7 (not fake-passed). Independently reproduced by IMPLEMENTATION_REVIEW — final verdict **APPROVE, 0 blocking**; all 4 non-blocking review notes incorporated.

## 2026-07-22 — edge-routing Phase 1: obstacle-avoiding EdgeRouter pass + `routedPoints` threaded through the snapshot (behind `edgeRouting` setting, default OFF)

Adds a layout-agnostic, post-layout routing pass that computes obstacle-avoiding polylines for every edge and threads them through the immutable `FlowSnapshot`, gated by the new `edgeRouting` ViewSetting. No rendering change yet — routed points ride along unused until Phase 2 ([[_tickets/edge-routing__02-render-routed-edges]]). Ticket `edge-routing__01-routing-pass-and-snapshot-threading` (closed). Builds on the Phase 0 loader/esbuild wiring.

- **New RF-free module `src/view/edgeRouting.ts`**: `EdgeRouter` interface (DIP — tests use a `FakeEdgeRouter`; libavoid impl is `LibavoidEdgeRouter`) with named data types (`RoutingObstacle`/`RoutingEdge`/`EdgeRoutingInput`, `RoutedPoint`, `EdgeRouteMap = ReadonlyMap<edgeId, readonly RoutedPoint[]>`). Pure `extractEdgeRoutingInput(...)` turns snapshot inputs (absolute positions, group/child dimensions, edges) into the router input — node-testable without WASM, like `elkMapping`/`flowMapping`.
- **libavoid usage**: `Avoid.Router(PolyLineRouting)`; obstacles = `Rectangle` + `ShapeRef`; endpoints SHAPE-ATTACHED via a centre-pin `ConnEnd(shapeRef, classId)` (not raw points) so src/tgt shapes don't block their own edge; one `processTransaction()`; `connRef.displayRoute()`. `shapeBufferDistance` set to `EDGE_ROUTING_SHAPE_BUFFER_PX` (= `EDGE_PAIR_CURVATURE_PX / 2 = 17`).
- **Memory safety owned in one place**: the `AvoidArena` ownership wrapper (relocated verbatim from the throwaway spike into `LibavoidEdgeRouter`) tracks only leaf allocations (Point/Rectangle/ConnEnd), destroys the Router last in `finally`, and never frees router-owned ShapeRef/ConnRef/Pin — no libavoid object escapes the class; `Avoid.` usage is grep-confined to `edgeRouting.ts` + `libavoidLoader.ts`.
- **Coordinates**: routing runs in ABSOLUTE space (the space `extractElkPositions` yields, before `withPositions` makes subflow children parent-relative). RF renders edges in the same absolute flow-space, so `routedPoints` need no transform when Phase 2 consumes them — documented at both threading seams.
- **Wired into `GraphViewController.runRebuild`** after layout, before `publish`; async (pipeline already is). A signature-keyed route cache (obstacle geometry + edge endpoints) means reuse-layout rebuilds don't re-run libavoid when inputs are unchanged, re-route when edges change but positions are reused, and flipping the setting invalidates the cache WITHOUT forcing an elk relayout (positions don't change). Latest-wins via the existing `isStale(token)` guard.
- **Failure containment (single, documented, pass-level)**: wasm init or routing throws → one `console.warn` with the plugin prefix, snapshot published WITHOUT `routedPoints` (straight edges = today's behavior). No per-edge silent fallbacks.
- **Setting**: `edgeRouting: boolean` (default OFF) mirrors the `groupByFolder` boolean wiring end-to-end (type → default → resolver → persist-parse → write-plan → fixtures) plus a visible settings-tab toggle. When OFF the pass never runs and the wasm never loads (`loadAvoid` is a lazy `await import` reached only inside `route()`).
- **Threading stops at data**: `FlowEdge.routedPoints` → RF edge `data` → `VicinityEdgeData.routedPoints`; `VicinityEdge` does NOT branch on it (Phase 2 boundary).
- **Spike cleanup**: `libavoidSpike.ts`, its test, and `e2e/libavoidSpike.e2e.ts` deleted; the throwaway `debug-spike-libavoid-routing` command + imports removed from `src/main.ts`. Production-shaped loader/esbuild wiring stays.

Verified: `npm run check` (tsc) 0 errors; `vitest run` **630 passed / 54 files** (612 pre-existing − 4 removed spike tests + new edgeRouting/controller/settings tests, zero regressions); `npm run build` (production) green with the wasm still embedded; real-wasm integration test genuinely routes 2 nodes around a blocking obstacle (>2 points, avoids the rect — not fake-passed). Independently reproduced by IMPLEMENTATION_REVIEW — **READY, 0 blocking, 0 should-fix**.

## 2026-07-22 — edge-routing Phase 0 spike: libavoid-js (WASM) proven to load OFFLINE inside Obsidian

De-risks the whole edge-routing epic ([[_tickets/edge-routing-via-libavoid-js-obstacle-avoiding-edges-for-all-layouts-force-directed-first]]) by proving, with automated verification, that the `libavoid-js` WASM router bundles into the single-file `main.js` and loads/routes offline in the real Obsidian/Electron runtime. Ticket `edge-routing__00-wasm-spike-libavoid-in-obsidian` (closed). Spike harness is throwaway; the esbuild wiring + loader shim are production-shaped and stay for Phase 1.

- **WASM bundling (production-shaped, stays)**: `libavoid-js@0.4.5` pinned; new esbuild `loader: { ".wasm": "base64" }` (the config's first loader entry) embeds `dist/libavoid.wasm` as base64; `src/types/libavoidWasm.d.ts` is the repo's first ambient `declare module "*.wasm"`. `src/view/libavoidLoader.ts` is the lazy, success-cached `loadAvoid(): Promise<Avoid>` shim that Phase 1's `LibavoidEdgeRouter` will build on.
- **Load path — data-URL works in Electron; `wasmBinary` fallback unreachable & unneeded**: `AvoidLib.load("data:application/octet-stream;base64,<b64>")` → Emscripten `locateFile` → Chromium `fetch()` accepts the data: URL. The ticket's proposed `wasmBinary` fallback is **not reachable** through libavoid-js's browser build (the Emscripten factory isn't exported) — but the primary path works, so it isn't required (recorded on the epic risk table).
- **Offline proof is real, not asserted**: `e2e/libavoidSpike.e2e.ts` drives a real pinned Obsidian 1.12.7 Electron binary over CDP with the renderer's http/ws **network blackholed** — the embedded wasm still loads and routes (`1 passed`).
- **Routing verified**: (a) 1 conn around 1 rect obstacle → bent polyline, no vertex inside the obstacle; (b) a child rect **nested inside** a folder-group rect routes sanely to a shape outside the group — **no "attach-to-group" fallback needed** (epic risk mitigated for the common case); (c) **100/100** create/route/destroy loop, no crash.
- **Memory safety encoded once**: the load-bearing rule — never `Avoid.destroy()` router-owned `ShapeRef`/`ConnRef`/connector pins (double-free → wasm abort) — is enforced by the `AvoidArena` wrapper so leaks/double-frees are impossible to write at call sites. Reviewer feedback I2 applied: `loadAvoid` no longer memoizes a *rejected* promise (a failed init resets the slot so a later call can retry, instead of locking the session into straight edges).
- **Cost**: `main.js` **1,877,709 → 2,607,082 B (+729,373 B, ~+712 KiB)** from the 474 KB embedded wasm. Accepted; flagged for Phase 3 release notes.
- **Mobile (isDesktopOnly:false)**: iOS/Android WebView **not verified** — no mobile runtime in this environment (best-effort per ticket; deferred). Desktop verified.

Verified: `npm run check` (tsc) 0 errors; `vitest run` **616 passed** (612 pre-existing + 4 spike, zero regressions); `npm run build` (production) green with the wasm embedded; offline-load e2e `1 passed` on headless Obsidian 1.12.7. Independently reproduced by IMPLEMENTATION_REVIEW — **READY TO CLOSE, 0 blocking**.

## 2026-07-21 — viewport fit owned explicitly + the MAIN central is now pinnable

Fixes the 3 failing e2e specs (human-reported) and closes the UX gap that the current central note could not be pinned before navigating away.

- **Root cause of the e2e failures — mount-time `fitView` race**: RF's `fitView` prop fires exactly once at mount, racing Obsidian's pane layout; in a fresh sidebar it deterministically produced an off-graph viewport (`translate(542px,-11.5px) scale(0.5)` centered where no nodes exist), and `onlyRenderVisibleElements` then unmounted EVERY node (empty graph in the DOM). It also never refit after rebuilds, so nodes added by a pin/depth change could land off-viewport and stay culled.
- **Fix — the view owns fitting**: `FlowSnapshot.layoutVersion` (monotonic, bumped only when a publish carries FRESH elk positions; unchanged on reuse-layout data refreshes) + `FitViewOnLayoutChange` inside `<ReactFlow>` — fits one animation frame after each new layout, gated on the RF store's measured pane size so a pre-measurement fit can never garbage the viewport. The `fitView` prop is gone. RF nodes now carry explicit `width`/`height` (not just `style`) so culling/fitView math never waits on DOM measurement.
- **`minZoom` lowered 0.5 → 0.1 (`GRAPH_MIN_ZOOM`)**: RF's default zoom floor clamped `fitView` on dense graphs in the narrow sidebar pane — part of the vicinity was structurally unreachable off-pane, and with culling the boundary nodes flickered in/out of the DOM (the observed 10-of-11 note1 flake). An unclamped fit always shows the whole graph.
- **Pin the MAIN central (UX)**: the pin toggle now keys on the node's pinned-doc FACT, not its styling tier — `FlowNodeData.isPinned` (non-MAIN central ⇒ pinned by definition; MAIN's pinned-ness = new `ControlsModel.mainPinned`, computed from the same assembled inputs as the graph), `planNodePinAction(isPinned)` (the `none` kind is gone — every note node toggles). Pinning MAIN keeps it in the graph as a pinned central after navigating away; a pinned MAIN still styles as `main` but offers "Unpin from graph".
- **e2e harness fixes (restart spec)**: `close()` now WAITS for the Obsidian process to exit (kill + `exit` event, SIGKILL backstop) — a dying Obsidian wrote sandbox files late, clobbering state and racing the next spec's config wipe (`ENOTEMPTY`); `relaunch()` re-seeds the vault's window-state json, because Obsidian saved the tiny headless (~300×200) size at shutdown and the relaunched 116px-tall pane legitimately couldn't fit the graph (nodes culled ⇒ the persisted-depth assertion failed while persistence itself was fine).
- **Tests**: +4 controller `layoutVersion` tests, +4 flowMapping `isPinned` tests, +3 `ControlsModelBuilder.mainPinned` tests, `nodePinAction` rewritten for the toggle; new e2e "the MAIN central itself can be pinned, survives switching MAIN, and can be unpinned"; e2e attachment-chip expectation updated `png`→`jpg` (vault fixture moved to `pic.jpg` in an earlier commit — stale expectation, first surfaced once the empty-graph bug was fixed).

Verified: `npm run check` 0 errors; `npm test` **574 root / 69 sublib** green; `npm run build` green; **full e2e suite 21/21 green** (twice, incl. the real-restart round-trip) on headless Obsidian 1.12.7.

## 2026-07-21 — edge arrowheads inset from the target so fan-in heads stop stacking

Fixes the human-reported "you cannot see the arrows" on a note with many incoming edges (screenshot: all heads pile into one smudge at the shared top boundary). Root cause: React Flow's `marker-end` can only anchor at the path's terminal point, so every edge converging on one node stamped its arrowhead on the *same* pixel.

- **Self-drawn arrowhead, inset from the target**: replaced RF's `marker-end` (`MarkerType.ArrowClosed`) with a per-edge `<polygon>` rendered by `VicinityEdge`. `edgeGeometry.edgePathFor` now also returns the arrow tip + angle, placing the tip back from the target by `clamp(length × 12%, 14px, 48px)` along the incoming tangent (the quadratic's real end-tangent `P1−control` for paired edges, not the chord). Because each edge arrives at its own angle, insetting each tip along its own direction fans the heads apart instead of stacking them — measured min separation on the reported fan-in ≈7px (near-parallel) up to 20–40px (wider angles), vs 0 before.
- **Theming simplified**: the arrowhead now themes with a plain `.vicinity-graph-edge__arrowhead { fill: var(--text-faint); }` — no more `!important` fight with RF's inline marker color. The `EDGE_ARROWHEAD_SIZE` constant + its `markerUnits` explainer are gone.
- **Contracts updated**: `edgeGeometry.test.ts` +5 tests (inset floor/fraction/cap, curved end-tangent, degenerate); e2e now asserts one `.vicinity-graph-edge__arrowhead` per edge and its `fill` follows the theme's `--text-faint` (was `marker-end url()` + polyline stroke).

Verified: `npm run check` (tsc) 0 errors; `npm test` **564 root** green; `e2e/tsconfig.json` tsc 0 errors; `npm run build` (esbuild production) green. Live-render taste confirmation (inset magnitude / head size, both themes) is a human step — no browser/Obsidian binary in this env (see [[ticket-edge-arrowhead-and-badge-visual-polish]]).

## 2026-07-21 — vicinity-rename: `neighborhood` → `vicinity` vocabulary + Obsidian-standard plugin naming

Repo moved from `obsidian-neighborhood-graph` to `obsidian-vicinity-graph-plugin` (`neighborhood` is hard to spell); this change makes the code match. A **script-driven** rename (one throwaway Python migration, `.tmp/vicinity-rename/rename.py`, not committed) swept **534** `neighborhood`-family occurrences across ~72 files plus **12** file renames via `git mv` — deterministic and re-runnable, no manual per-file editing. Supersedes the step-07 "keep the `obsidian-` id for V1, rename deferred" decision.

- **Vocabulary**: `neighborhood`/`Neighborhood`/`NEIGHBORHOOD` → `vicinity`/`Vicinity`/`VICINITY` (and plural `neighborhoods` → `vicinities`) in all contents — symbols, imports, CSS classes (`.vicinity-graph-*`), command ids, view-type literal. The graph-adjacency term `neighbor`/`neighbors`/`neighboring` was **deliberately preserved** (standard graph-theory vocabulary; "vicinity" has no clean singular equivalent) — the rename rules key on the `hood` substring so bare `neighbor` is never touched.
- **File renames (12)**: `NeighborhoodEngine.*` → `VicinityEngine.*`, `NeighborhoodTraversal.*` → `VicinityTraversal.*`, `NeighborhoodGraphBuilder.*` → `VicinityGraphBuilder.*`, `NeighborhoodEdge/GraphFlow/GraphSettingTab/GraphView` → `Vicinity*`, `e2e/neighborhoodGraph.e2e.ts` → `vicinityGraph.e2e.ts`.
- **Obsidian-standard identity**: manifest `id` `obsidian-neighborhood-graph` → **`vicinity-graph`** (no `obsidian-` prefix / `-plugin` suffix per convention), `name` "Neighborhood Graph" → **"Vicinity Graph"**, `package.json` name → **`vicinity-graph`**, view-type string → **`vicinity-graph-view`**. Version **unchanged at 0.1.0** (pre-release; already semver-conformant). Hardcoded-id tests (`manifest.test.ts`, `DocDataStore.test.ts`, `OrphanSweeper.test.ts`, `e2e/obsidianHarness.ts`) updated accordingly.
- **Descriptions** (manifest + package, kept in sync) reworded for discoverability to include "**local graph**" and "**nearby notes**", dropping "neighboring".

Verified: `npm run check` (tsc) 0 errors; `npm test` **559 root** / **69 sublib** green (root count identical to pre-rename baseline — zero regressions); e2e `tsc` 0 errors. Acceptance greps: 0 `neighborhood`-family hits in tracked files (excluding the task prompt/agent scratch), 0 `neighborhood` basenames, graph-term `neighbor(s)` intact. Independently reviewed — IMPLEMENTATION_REVIEW **APPROVED**, 0 blocking; PARETO **PROCEED** (near-ideal 80/20, throwaway script correct).

## 2026-07-20 — step-07-hardening: confidence at the edges + public README

Ship-readiness pass over dense vaults, cap boundaries, real-usage performance, and the public README — executes [[plan/steps/step-07-hardening]], Phase 7 of [[plan/high-level-plan]]. Not a feature step; a hardening + documentation step. Binding decisions in step-07 CLARIFICATION: structural perf assertions + one loose 150ms engine-build ceiling; a **committed** dense-fixture generator as the V2 regression harness; keep the dense suite in the default `npm test`; fix only the hover-pin bug now (ticket the rest); state the KSAL-2.3 license plainly; keep the `obsidian-` plugin id for V1 (rename + repo move deferred); store submission out of scope.

- **Phase A — dense-vault fixtures + cap edge cases (test-only + committed generator)**: `src/engine/testFixtures/denseVaultFixtures.ts` — a deterministic (seeded mulberry32, zero unseeded randomness) generator with builders for hub fan-out (200+ links), deep chains, bidirectional clusters, folders with 1/2/many members, canvas-heavy sets, and a ~507-node mixed vault; `truncationHarness.ts` shares the traverse→size→truncate pipeline (DRY). +49 tests (`GraphTruncator.denseFixtures`, `VicinityEngine.denseFixtures`, `denseVaultFixtures`, dense `folderGrouping`) asserting caps respected, full-output determinism, cap ±1 boundaries, runtime cap change (larger cap ⊇ smaller visible set), and pinned-disconnected-under-tight-cap. Honest reachability finding: at the truncator level only `minDepth`/`sizeScore`/`distanceToMain`/`path` decide — `pinTimestamp` and `docid` are structurally unreachable there (candidates exclude cap-exempt centrals), asserted as a real guard and covered instead at `NodePriorityChain.test.ts`. Measured: engine `build` at cap=100 over 507 nodes = **0.76ms median** (~200× under the 150ms loose ceiling).
- **Phase B — performance pass**: **hover-pin fix** ([[hover-pin-button-blankets-tiny-nodes-and-eats-the-open-click]], now resolved) — `pointer-events:none` while the pin button is hidden + `display:none` below a 72px container-query threshold in the source `src/view/graph-view.css`, so clicking a tiny node opens the note instead of hitting the invisible button (right-click pin path untouched). **Viewport culling** — `onlyRenderVisibleElements` on `<ReactFlow>` (group parents force-render, off-screen children culled) bounds work on image-heavy vaults, guarded by 3 pure `flowMapping` tests for the `firstImagePath` stable-key "no thumbnail refetch storm on rebuild" contract. **Rebuild debounce** (previously untested "needs window" gap) — 5 tests with fake timers + a window stub prove a typing burst coalesces to exactly one rebuild and that active-file/settings changes rebuild immediately, cancelling any pending debounce. **Elk-skip invariant** — unchanged structure across 5 rebuilds keeps `layout.callCount == 1`. **Orphan sweep at scale** — a 500-file test asserts the chunked sweep yields to the main thread (≥24 yields at batch=20), no jank. +11 tests. Every perf item was cheap enough to fix; none deferred.
- **Phase C — README + release readiness + ticket triage**: `README.md` rewritten into a public doc — what it is (the two native-graph weaknesses it fixes: *every node looks the same*, *there is no grouping*), manual/BRAT install, the settings model users will ask about (global defaults; per-note depth pin-on-touch, per-field; pinning = an extra central rendered alongside the active note, global + restart-surviving; the nuance that a pinned central's adjusted depth is stored in the *viewing* note's doc data), V1 scope/limits and the V2 roadmap (verbatim from the plan), the fresh-clone → dev-build flow, and a short KSAL-2.3 license note (LICENSE.md authoritative). `docs-internal/RELEASE_CHECKLIST.md` covers manifest/versions.json correctness, the manual GitHub-Release asset step, 3-file version agreement, and the deferred `obsidian-` id-prefix decision. Filed [[tickets/ticket-viewport-culling-visual-smoke]] for a one-time visual/e2e confirmation of culling + reverting the e2e ALPHA-click workaround.

Verified: `npm run check` (tsc) + `npm test` (**559 root** / +60 over step-06, 69 sublib) green; `npm run build` (esbuild production) green. Each phase independently reviewed — all three IMPLEMENTATION_REVIEW verdicts APPROVE-WITH-NITS, **0 blocking** across the flow. Exit criteria met: dense-fixture suite green + fast in default `npm test`; no perf item left unfixed without a ticket; README accurate to shipped behavior with a fresh-clone → running-dev-build path. Open pre-ship gate unchanged: the step-06 human smoke run ([[tickets/ticket-step-06-controls-human-smoke-run]]).

## 2026-07-20 — step-06-controls: the machinery in the user's hands

Puts the depth/pin/sizing/cap engine (built + tested in steps 02–03) behind an in-view toolbar, node pin/unpin, and a global settings tab — executes [[plan/steps/step-06-controls]], goals 3 & 4 of [[plan/high-level-plan]]. Binding decisions in step-06 CLARIFICATION Q1–Q5 + Q-A/B/C: single collapsible top-left `<Panel>` toolbar (depth steppers front, pinned-centrals + sizing behind disclosures), `MAX_STEPPER_DEPTH=5` (min 0 = central only), pin/unpin on BOTH a hover button and the right-click menu, node cap + sizing **global-only in V1**, depth steppers the only per-doc/per-central write surface, reset-to-global = field delete, and the pinned-central stepper edits only the MAIN view's `centralDepths[X]` layer.

- **Pure contract core (unit-tested, no obsidian/react)**: `planSettingsWrite` (the single "which write lands where" mapping — every mutation on every surface routes through it, so the field-merge rule exists exactly once); `ControlsModelBuilder` (central-selector list + per-direction resolved depth + **presence-based** inherited-vs-pinned flag — value derived through the engine's own `TraversalSettingsResolver` so "value shown == value graphed" is structural, not a parallel `??` chain); shared `PinnedRootResolver` (DRY skip-rule with `GraphRequestAssembler`); `planNodePinAction`; `clampStepperDepth`; `SIZING_METRICS` (invariant-tested vs engine `SizeMetricId`). `DIRECTION_DEPTH_FIELD` lives once in `engine/types.ts`.
- **Wiring**: `VicinityGraphBuilder.build` returns `{graph, controls}` from ONE assembled-inputs read (no extra disk IO, no race); `GraphViewController` publishes `controls` in `FlowSnapshot` and gains `handleSettingsChanged()` (immediate rebuild, latest-wins token absorbs stepper spam) + `currentMainPath()`, staying obsidian-free; `ControlsActions` adapter executes commands against `PersistenceServices`/`PluginDataStore`, resolves the MAIN `TFile`, and shows a `Notice` when a doc can't be pinned (`not-persistable`); `FlowNodeData` carries `docid` for unpin.
- **UI**: `GraphToolbar` (`<Panel top-left>`, collapsible), `CentralDepthControls` → `DepthStepper` (−/value/+, clamp, reset, inherited-vs-pinned styling), `SizingSection` (in-view global mirror); `NoteNode` hover pin button (`nodrag nopan`, stopPropagation) + `onContextMenu` → native `Menu` via `ObsidianGraphUi.showNodeMenu`; all new `graph-view.css` keyed to Obsidian theme vars (zero plugin colors), compact + vertically-scrolling at ~300px.
- **Settings tab**: `VicinityGraphSettingTab` (global depth defaults, sizing, node cap) routes writes through the SAME `planSettingsWrite` contract, then `main.ts refreshOpenViews()` fans out `getLeavesOfType → view.refresh()` so open graphs update without reopening.
- **Scenario proven at two levels**: `CentralDepthRoundTrip.test.ts` (persistence — pin X at depth 3 while MAIN Y at 1, switch Y→Z→Y, X's own DocData byte-identical throughout) + a `VicinityEngine.test.ts` block (BFS actually re-explores X at the adjusted depth).

Verified: `npm test` (49 files / 499 tests) + `npm run check` (tsc) + `node esbuild.config.mjs production` green across all four implementation phases. Each phase independently reviewed; IMPLEMENTATION_REVIEW verdict APPROVE-WITH-FOLLOWUPS (0 Critical/Important, 2 minor DRY cleanups applied), PARETO verdict JUSTIFIED — ship. Two follow-ups filed: manual restart-round-trip QA ([[tickets/ticket-step-06-controls-human-smoke-run]]) and optimistic-input latency on rapid edits ([[tickets/ticket-controls-optimistic-input-latency]]). Per-view sizing, per-doc cap, and folder colors remain V2.

## 2026-07-20 — edge-polish: arrowhead clarity + cleaner ×N badge

Resolves the two human-judged visual issues from the step-05 smoke run (QA_CHECKLIST §4/§7, [[tickets/ticket-edge-arrowhead-and-badge-visual-polish]]) that automation can't catch — arrowheads reading unclear and the collapsed-count badge looking cluttered:

- **Arrowheads**: `EDGE_ARROWHEAD_SIZE` 18→24 (`VicinityGraphFlow.tsx`) for legible direction; `EDGE_PAIR_CURVATURE_PX` 24→34 (`edgeGeometry.ts`) so the mirrored A↔B pair fans apart and each arrowhead is individually visible near the shared node (was reading as one clipped smudge). Color stays `--text-faint` — locked by the e2e both-theme contract, so the levers were size + geometry, not color.
- **"×N" badge**: split out of the shared folder-badge CSS rule (folder `+N` chip unchanged) and restyled to a borderless theme-var pill (`--radius-l` + `--shadow-s`, tight padding) for a cleaner, less-cluttered midpoint.
- CSS-first, all theme-variable-driven (zero plugin colors). Contract preserved: polyline arrowhead + `--text-faint` override, `marker-end url()` on every edge, `×N` text + `data-count`; `edgeGeometry.test.ts` needed no edit (asserts interpolate the curvature symbol).

Verified: `npm run check` + `npm test` (451 root + 69 sublib) green; implementer + independent reviewer CONVERGED-READY on round 1 (0 blockers). Pending human confirmation on a real render (tuned on a faithful chromium proxy, not live Obsidian) and an e2e run in a display-capable env — see ticket.

## 2026-07-18 — step-05-rich-rendering: nodes that carry information

Plain rectangles become rich, themed, information-dense nodes — the plugin's reason to exist (executes [[plan/steps/step-05-rich-rendering]], Phase 5 of [[plan/high-level-plan]]; binding decisions in step-05 CLARIFICATION Q1–Q5 + palette deferral — engine edge counts approved, ctrl/cmd = new tab, native `Menu`, corner overlay for orphaned truncation counts, Playwright e2e in scope, **NO folder colors** (human decision: deliberate design pass later, [[tickets/ticket-folder-color-ux-design-pass]])):

- **Engine/data (Phase A)**: `GraphEdge.count` carries real link multiplicity (from `resolvedLinks`/canvas parse — not fabricated) through both edge-visibility modes; display titles honor frontmatter `title`/`name` (trimmed, fallback basename); `FlowNodeData`/`FlowEdge`/`FlowSnapshot` widened (folder, attachments, firstImagePath, explicit tier discriminant, edge pairing, per-group + orphan-aggregate truncation counts); pure modules for folder-group derivation (2+ rule; contract-commented dual elk/flow derivation), elk compound nesting, attachment→icon-strip grouping, breadcrumb derivation; dev-vault fixtures extended (folders, singleton, duplicate + bidirectional links, attachment types, frontmatter-title note).
- **Rendering (Phase B)**: rich `NoteNode` (breadcrumb `<folder>/<title>` on ungrouped nodes with muted folder part, lazy fixed-height thumbnail + "+N" images badge, attachment icon chips → native Obsidian `Menu` capped at `ATTACHMENT_MENU_MAX_ITEMS=20` with "…and N more"); neutral `FolderGroupNode` (subtle border, `--background-secondary` fill, label, "+N" badge, elk label padding); directed edges with themed arrowheads (CSS override defeats RF v12's hard-coded `#b1b1b7` marker color), mirrored A↔B offset curvature via pure `edgeGeometry.ts`, "×N" badge when count > 1; corner "+N hidden" overlay with per-folder tooltip; tier styling MAIN / pinned-central / regular.
- **Interactions**: click opens note (current tab), ctrl/cmd-click new tab (`getLeaf(true)`, RF multi-select disabled to avoid gesture conflict), hover fires `hover-link` for native page previews (source registered in Page-preview settings). All Obsidian UI access behind new `GraphUiPort`/`ObsidianGraphUi` + navigator extensions (resource paths via `vault.getResourcePath`) — obsidian imports stay out of `.tsx`.
- **Theming**: all new styling in authored `src/view/graph-view.css` keyed to Obsidian theme variables — light↔dark works with zero plugin changes (e2e-asserted).
- **Playwright e2e (Phase C)**: `npm run test:e2e` drives REAL Obsidian (headless, sandboxed user-data-dir + vault copy) via `chromium.connectOverCDP` (fused Electron ignores `--inspect` — documented); 18 state-based DOM assertions (tiers, badges, breadcrumb, arrowhead theming both themes, icon strips, thumbnail `app://` src) — no screenshots/LLM judgment; fail-fast without `OBSIDIAN_PATH`; separate from the unit gate, re-runnable at release.

Verified: `npm test` (451 root + 69 sublib), `npm run check`, `npm run build` green; `npm run test:e2e` 18/18 against Obsidian 1.12.7, independently re-run twice by reviewer (idempotent). Three implementation phases each independently reviewed → iterated → CONVERGED-READY (Phase B round 1 caught a real theming violation + an incorrect implementer claim, both fixed). Visual-polish smoke run pending: [[tickets/ticket-step-05-human-smoke-run]].

## 2026-07-18 — step-04-view-shell: first visible graph

The milestone where it feels real: an `ItemView` (right sidebar, draggable to main) renders the active file's vicinity as plain React Flow nodes laid out by elkjs, rebuilding on navigation and debounced vault changes (executes [[plan/steps/step-04-view-shell]], Phase 4 of [[plan/high-level-plan]]; binding decisions in step-04 CLARIFICATION Q1–Q5 — layered elk, inline async, latest-wins, no V1 scroll/zoom persistence, `@xyflow/react` v12):

- Thin `ItemView` (`src/view/VicinityGraphView.tsx`): createRoot/unmount lifecycle, registers `active-leaf-change`/`file-open`/metadataCache `resolved` via `registerEvent`, thin `getState`/`setState` that persist nothing (Q4); `main.ts` passes `graphBuilder` in through the `registerView` closure.
- `GraphViewController` (`src/view/`): owns the pipeline `events → graphBuilder.build → structural diff → elkjs → React Flow` as a `useSyncExternalStore` store; **latest-wins** via a monotonic rebuild token checked after every await (no sleeps, Q2); metadata-resolve rebuilds debounced `REBUILD_DEBOUNCE_MS=500`; MAIN tracking gates on `FileKinds.isNodeBearingPath` (md/canvas only), and active-file change cancels a pending debounce. Obsidian navigation sits behind a `NoteNavigatorPort` (`viewPorts.ts`/`ObsidianNoteNavigator.ts`) so the controller is fully node-testable.
- Pure, node-tested decision modules (no obsidian/React/elkjs-runtime imports): `GraphStructureDiff` (unchanged structure ⇒ `reuse-layout`; any surviving node grown past `SIZE_RELAYOUT_THRESHOLD=1.0` = +100% `sizePx` ⇒ `relayout`), `RebuildDecision`, `flowMapping` (engine → React Flow, node id = `path`, edge id = `${source}->${target}`), `elkMapping` (compound-ready: root + children + parent-offset extraction so step-05 folder groups lay out), `graphIdentity` (shared id/size conventions).
- Layout: `ElkLayoutRunner` wraps `elkjs` in-thread (no worker, Q3) with `layered` + `hierarchyHandling: INCLUDE_CHILDREN` chosen now for the compound-graph future; `VicinityGraphFlow.tsx` renders default nodes + `<Background>`/`<Controls>`, pan/zoom/fit-view, click-opens-note, empty state on `build()===null`.
- Deps `@xyflow/react` + `elkjs` bundle into `main.js` (no externals change); `styles.css` is now **generated at build time** (`@xyflow/react` base CSS + authored `src/view/graph-view.css`) so it can't drift from the installed version — gitignored like `main.js`.

Verified: `npm test` (335 root + 69 sublib), `npm run check`, `npm run build` all green (implementer + independent reviewer round 1 READY → iteration adds controller latest-wins tests behind a DIP seam → round-2 CONVERGED-READY, 0 blocking). Human smoke run in real Obsidian pending: [[tickets/ticket-step-04-human-smoke-run]].

## 2026-07-17 — step-03-adapters-and-persistence: Obsidian adapters + persistence

Implemented everything between the pure engine and Obsidian (executes [[plan/steps/step-03-adapters-and-persistence]], Phases 2+3 of [[plan/high-level-plan]]; binding decisions in step-03 CLARIFICATION Q1–Q3):

- `ObsidianLinkProvider` (`src/adapters/`): outgoing links in true reference order via `getFileCache().links/embeds` (resolution via `resolvedLinks`); incoming via a single typed wrapper over undocumented `metadataCache.getBacklinksForFile` with runtime presence check + `resolvedLinks`-inversion fallback (Q1).
- Canvas capability detection at build time + fallback `.canvas` JSON parser (file-type nodes only, malformed JSON never throws, mtime-cached). Devtools check on the target install found NO `.canvas` keys in `resolvedLinks` → the fallback parser is the active path there (Q2, recorded in the step doc).
- `obsidian-id-lib` wired per contract: `getDocId` (read-only) on all bulk/read paths; `ensureDocId` only on explicit write intent; `null` → doc not pinnable/persistable, surfaced as typed reason.
- Persistence (`src/persistence/`): versioned JSON shapes from day one; `data.json` (global settings + pinned set with pin timestamps); per-doc files at `doc-data/<docid>.json` via `vault.adapter.write`; pin-on-toggle per-field semantics (absence = inherit); unsafe-docid filenames refused with typed reason for a future non-popup node emblem (Q3).
- Live cleanup: `vault.on('delete'/'rename')` + path→docid map (warmed by sweep, lazily filled); orphan sweep delayed ~15s, chunked with yields, tolerant of foreign files, race-safe via drop-time re-verification.
- `GraphRequestAssembler` translates docid-keyed persistence → path-keyed `GraphBuildRequest`; main.ts lifecycle wiring + debug command harness for real-vault builds; shared `VaultPathFacts`/`FileKinds` extracted (resolves step-02 iteration finding 4).

Verified: `npm test` (297 root + 69 sublib), `npm run check`, `npm run build` all green (implementer + independent reviewer; 8 review findings fixed test-first and empirically re-verified). Human smoke run in real Obsidian pending: [[tickets/ticket-step-03-human-smoke-run]].

## 2026-07-17 — step-02-core-engine: pure graph engine

Implemented the pure, fully-tested vicinity-graph engine under `src/engine/` (executes [[plan/steps/step-02-core-engine]]; binding decisions in step-02 CLARIFICATION Q1–Q5):

- Path-keyed identity (branded `VaultPath`; docids opaque, echoed through — adapter translates before the engine).
- Sync `LinkProvider` seam (the ONLY Obsidian touchpoint) + fixture-driven `FakeLinkProvider`; `NodeEligibility` owns node-bearing resolution.
- Multi-root directional BFS (independent per-root per-direction depth limits, full depth tags + `minDepth`, never re-expands), attachments + first image collected.
- Composable sizing metrics (own-file-size, total-linker-size, backlink/outlink counts, depth-decay) → `sizeScore` → `sizePx`; centrals forced to max.
- Truncation: hard cap on non-centrals (default 100), distance-to-MAIN ranking via the ONE shared `NodePriorityChain` comparator, per-folder hidden counts.
- Settings cascades: depth (own override → global), view per-field (MAIN → pinned gaps via priority chain → global).
- **Edge-visibility toggle** (Q5): `"walked-from-center"` (BFS-walked only, human-confirmed default — cleaner graph) vs `"all-edges"` (induced subgraph, available via toggle).
- Import-guard test keeps the engine pure (zero `obsidian`/`obsidian-id-lib`/react imports, all import forms matched).

Verified: `npm test` (136 root + 69 sublib) and `npm run check` green (implementer + independent reviewer + iteration). Review findings dispositioned in `.ai_out/step-02-core-engine/`.

## 2026-07-16 — step-01-scaffold: plugin dev environment

Scaffolded the Obsidian plugin toolchain (executes [[plan/steps/step-01-scaffold]], Phase 0 of [[plan/high-level-plan]]):

- TypeScript + esbuild build (`obsidian` types-only external), strict tsconfig; npm scripts `dev`/`build`/`test`/`check`.
- React 18 placeholder `ItemView` ("hello graph") with createRoot/unmount lifecycle.
- vitest wired for our code plus the `obsidian-id-lib` submodule suite (2 + 69 tests).
- `obsidian-id-lib` consumed as `file:submodules/obsidian-id-lib` raw-TS dep, bundled by our esbuild; `DocIdServices` import smoke-checked.
- `manifest.json`: id `vicinity-graph`, name "Vicinity Graph", `minAppVersion` **1.12.4** (floor; first public core canvas link indexing — the plan's original "canvas `metadata.frontmatter` version" premise was found false; human approved).
- Git-ignored `.dev-vault/` with build-time artifact copy; `.gitignore`, README fresh-clone docs (`git submodule update --init && npm install`).
- Follow-up ticket: [[tickets/ticket-eslint-adoption]].

Verified: `npm run build`, `npm test`, `npm run check` all pass (implementer + independent reviewer). GUI check confirmed by human (2026-07-16): plugin loads, placeholder view renders "hello graph", no console errors. All exit criteria met.
