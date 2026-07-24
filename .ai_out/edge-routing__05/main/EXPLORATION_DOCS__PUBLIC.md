# EXPLORATION_DOCS — `edge-routing__05` (facing-side attachment vs. wrap-around routes)

> Produced by the EXPLORATION_DOCS sub-agent (read-only); transcribed by TOP_LEVEL_AGENT.

## 0. Ticket under work

`_tickets/edge-routing05-over-stretched-wrap-around-routes-pick-the-facing-side-when-a-better-attachment-exists.md`
(id `nid_4lmhpfc64eb4auw27wqis8wqe_e`, status open, priority 1, created 2026-07-24T22:09Z)

Repro asset: vault `.out/public`, note `clear-goals.md`; screenshot `.tmp/Screenshot From 2026-07-24 15-41-26.png` (not source-controlled).

**Doc discrepancy the PLANNER must not propagate:** the ticket says "12-per-note blew the
edge-routing__04 Phase A budget". The actual measurement was **8 pins on ALL shapes**
(group boxes *and* ~100 note squares) ≈ **8.8s** vs **~1.45s** layout. 12-pins-per-group-box
is what ships today and is fine; nothing has ever been measured with 12 pins on note squares.

## 1. Diagnosis — `docs-internal/research/research-layout-aesthetics.md` (path is `research/`, not `notes/`)

Problem index: **P1** wrap-around attachment · **P2** crossings · **P3** shared parallel corridors ·
**P4** group interior blind to outside · **P5** no layout↔routing feedback.

### Verified pipeline (section A)

```
engine graph → vicinityGraphToElk (elkMapping.ts): root elk `force` (seed only), SEPARATE_CHILDREN;
               group interiors elk `layered` DOWN; cross-boundary edges PROJECTED onto containers
 → GraphLayoutRunner.layout: elk pass, then refineForceRootLayout (d3ForceRefinement.ts) moving ONLY
               root-level boxes (groups = opaque rectangles)
 → resolveRoutes (GraphViewController.ts) → libavoid PolyLine (edgeRouting.ts):
               shapeBuffer 17px, segmentPenalty 50, crossingPenalty 0 (perf-disabled);
               group boxes: 12 boundary pins; note squares: 1 centre pin
 → clipRouteToEndpointRects → arrow terminates on the border
 → publish → React Flow
```

Pipeline is **strictly one-directional**; nothing feeds routing pain back into placement.
The research pass concluded this is industry-standard (yFiles also does layout→routing
sequentially), so P5 is a ceiling-raiser, not a defect.

### B1 — the Epictetus diagnosis (headline symptom, four causes)

Routing **is** active in the screenshot (rounded routed corridors hugging the group's left
border are visible). Epictetus sits directly LEFT of the folder-group box, yet its edge wraps
around and attaches at the group's **BOTTOM**. Causes:

1. The group's 12 boundary pins **share one class at equal cost**; libavoid minimizes the
   cheapest *path*, never "prefer the facing *side*". With `crossingPenalty = 0` a long wrap
   costs almost nothing extra.
2. The corridor between Epictetus and the group's left border is **crowded** (other note
   squares, each inflated by the 17px shape buffer) → left-side pins are expensive/unreachable
   → router detours to a bottom pin.
3. Note squares have a **single `ConnDirAll` centre pin**, so the counterpart end is
   side-agnostic too.
4. Nothing re-examines the result: `detourRatio ≫ 1` is **logged** (`detourStats`) but never
   acted on.

### B2 / B3 (context, out of this ticket's scope)

- B2 (P4): group interiors are laid out by elk `layered` with **zero knowledge of the outside
  world** (`SEPARATE_CHILDREN`). elk has **no option** to rotate/reflect a separately-laid-out
  child toward external neighbours; elk `force`/`stress` do not support `INCLUDE_CHILDREN`
  (only `layered` does), so the current force root can structurally never see cross-hierarchy
  edges.
- B3 (P2/P3): `crossingPenalty = 0` is deliberate (see §2). libavoid's whole nudging /
  shared-path machinery (`idealNudgingDistance`, `nudgeOrthogonalSegmentsConnectedToShapes`,
  `fixedSharedPathPenalty`, `penaliseOrthogonalSharedPathsAtConnEnds`) is **orthogonal-mode
  only** — in PolyLine mode P3 has essentially no native remedy.
- Evidence ranking (Purchase et al.): crossings ≫ bends > everything; so P2 ≥ P1 > P3, and
  `crossingPenalty = 0` is the most evidence-contradicted knob in the stack. Length-uniformity
  work is explicitly **not worth effort**.

### C1 — the ticketed option set (the levers this ticket is built on)

All on the libavoid API already shipped:

- Keep directional boundary pins on groups but **cheapen the facing side** via
  `ShapeConnectionPin.setConnectionCost(cost)` — among same-class pins, lower cost wins
  *before* raw path cost. Facing side is computable from the two endpoint rects **before**
  routing.
- Make pins **exclusive** (`setExclusive(true)`; directional pins are exclusive by default) so
  one connector per pin spreads attachments along the border.
- Replace the note-square centre pin with **4 directional side pins** — explicitly called
  "the middle ground to re-measure".
- (PARKED, not in this ticket) small `crossingPenalty` + `portDirectionPenalty`;
  `Avoid::ClusterRef` group boxes + `clusterCrossingPenalty`.
- **Fallback lever**: post-check any clipped route with `detourRatio > THRESHOLD`, re-route
  once with pins restricted to the facing side, keep the shorter.

2026-07-24 disposition recorded in the doc: C1-minus-crossing-penalty = ticket
`edge-routing__05`; C2 (worker offload) and C1's penalty items are **PARKED**, deliberately
not ticketed. Suggested sequencing puts C1 first with a **re-measure of the dense-fixture perf
budget**.

## 2. Perf cliff — `docs-internal/research/crossing-penalty-and-worker-offload.md` (parked)

Measured in the edge-routing__03 tuning pass (dense fixture ~100 nodes / ~292 edges, main thread):

| crossingPenalty | routing pass |
|---|---|
| 0 | **~140ms** |
| 100 | **~1700ms** (worse than the entire elk+d3 layout, ~1460ms) |

The crossing check is **~O(connectors²)** and is incurred for **any positive value** — "**it is
a cliff, not a slope**. 'A small penalty' does not buy a small cost." On Obsidian's Electron
renderer (= UI thread), 1.7s per relayout is an unacceptable freeze.

**FORBIDDEN in this ticket:** raising `EDGE_ROUTING_CROSSING_PENALTY_PX` above 0 (hard
constraint restated in the ticket itself). Two unpursued paths documented for later: Path A
size-gated penalty (target ≤200ms, one named threshold constant); Path B web-worker offload
(worker doesn't make routing faster, it makes it non-blocking; single-file `main.js` means the
worker script must be inlined via blob/data URL and the base64 wasm loaded inside the worker;
`rebuildToken` latest-wins already exists). Also flagged: `clusterCrossingPenalty` needs the
same measurement treatment before enabling. Revisit triggers: crossing clutter still a
complaint after `edge-routing__05` ships; a perf pass finds headroom; another feature needs
worker infra anyway.

## 3. Prior edge-routing tickets (all closed except __05)

Epic: `_tickets/edge-routing-via-libavoid-js-obstacle-avoiding-edges-for-all-layouts-force-directed-first.md`.
No archive dir exists — every ticket lives in `_tickets/`; prior agent flows live under `.ai_out/`.

**`edge-routing__00` — wasm spike** (closed 2026-07-22)
- libavoid-js pinned **0.4.5**; wasm base64-embedded, loaded via
  `AvoidLib.load("data:application/octet-stream;base64,…")` → Emscripten `locateFile` →
  Chromium `fetch()`. The `wasmBinary` fallback is **unreachable** on the browser build.
- `main.js`: 1,877,709 B → **2,607,082 B** (+729,373 B ≈ +712 KiB).
- Load-bearing memory rule encoded in `AvoidArena`: **never `Avoid.destroy()` router-owned
  ShapeRef/ConnRef/connector pins** (double-free → wasm abort). Only Points/Rectangles/Router
  are destroyed explicitly.

**`edge-routing__01` — routing pass + snapshot threading** (closed)
- `src/view/edgeRouting.ts` (RF-free): `EdgeRouter` DIP + `LibavoidEdgeRouter`; pure
  `extractEdgeRoutingInput()`; `EdgeRouteMap = ReadonlyMap<edgeId, readonly RoutedPoint[]>`.
- Routing runs in **ABSOLUTE** coordinates.
- `EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2 = **17**`.
- **Signature-keyed route cache**; latest-wins via `isStale(token)`.
- **Single, documented, pass-level failure fallback**: one `console.warn`, publish without
  `routedPoints`. **No per-edge silent fallbacks** — an explicit design rule.
- `Avoid.` usage is grep-confined to `edgeRouting.ts` + `libavoidLoader.ts` (acceptance criterion).

**`edge-routing__02` — render routed edges** (closed)
- `routedPathFor` with `ROUTED_CORNER_RADIUS_PX = 10`; `polylineMidpoint`; tangent arrowheads
  reusing `arrowFromApproach`/`sourceArrowOf` (inset fraction 0.12, min 14px, max 48px).
- Routed edges deliberately do **not** re-apply the `hasOpposite` bow; NaN guard for duplicate
  waypoints.

**`edge-routing__03` — all layouts, tuning, default ON** (closed 2026-07-22) — **budget of record**
- Named constants: `segmentPenalty = 50`, `crossingPenalty = 0`, `shapeBufferDistance = 17`
  (chosen > the 14px arrowhead min inset).
- Dense fixture ~100 nodes / ~292 edges, `all-edges`, real headless Obsidian:
  - **force (default): routing ~137–140ms vs elk+d3 layout ~1460–1494ms (~9%)** ← the budget
  - layered: routing ~172–185ms vs layout ~276–300ms
  - radial: routing ~490ms vs ~45ms layout → gated off (moot; radial removed)
- Sparse/medium routing is "a few ms". `main.js` production = **2,610,310 B**.
- Mobile: **NOT verified**.
- Explicitly deferred/rejected: `OrthogonalRouting` mode, bidirectional-pair collapse, live
  re-route on drag, **web-worker offload**.
- **Enforced gate lives in `e2e/edgeRoutingEval.e2e.ts:183-195`** ("PERF BUDGET" test): asserts
  `routingMs < layoutMs` on dense/force, plus `routingMs >= 0` and `layoutMs > 0`. This is the
  only automated perf assertion; a ratio gate, not an absolute ms gate.

**`edge-routing__04` — boundary pins replace centre pins** (closed 2026-07-23)
- Root cause: centre pins made libavoid optimize a **centre→centre** path whose long interior
  leg is later clipped away, so the router's optimum diverged from the *visible* border→border
  optimum; plus a group's **own child squares are blocking obstacles** for the group's own
  connectors (each +17px buffer).
- Shipped **Phase A group-only boundary pins**: 8 proportional pins (4 side-midpoints with
  outward `visDirs` + 4 `ConnDirAll` corners) on **folder-group shapes only**; note squares keep
  the single centre pin. **8 pins on ALL shapes blew the dense budget: ~8.8s vs ~1.45s layout.**
  ← the single most important number for this ticket.
- Shipped **Phase B detour telemetry**: `detourRatio` = routed polyline arc length ÷ endpoint-rect
  boundary chord (`edgeGeometry.ts`, `DETOUR_RATIO_DEGENERATE = 1`), max/mean logged in the
  routing debug line. Fixed a telemetry-ordering bug: the pass is logged **before** the
  `isStale` early-return, because stale-discarded heavy passes let the PERF BUDGET e2e
  **false-pass**.
- Results: grouped-fixture **max detour ratio 1.000**; dense/force routing **~137ms** vs layout
  **~1464ms**.
- **Phase C (line-of-sight shortcutting) NOT needed.** **Explicitly rejected alternative:**
  dropping group children from the obstacle set.

**Adjacent context:**
- `_tickets/02-remove-edge-routing-setting-obstacle-avoidance-always-on.md` — the `edgeRouting`
  ViewSetting was **removed end-to-end** (persistence v2); routing runs unconditionally.
  `docs-internal/specs/graph/arrows.md:40-63` is **stale** on this.
- `_tickets/edge-routing-re-enable-radial-routing-via-web-worker-offload.md` — closed as
  superseded.
- Open, related, NOT this ticket:
  `_tickets/side-aware-edge-anchoring-for-non-routed-straight-edges-via-floating-edge-intersection.md`.

## 4. Prior full agent flow — `.ai_out/edge-routing-05-twelve-point-anchors/edge-routing-05-twelve-point-anchors/`

Despite the directory name, that flow was a **different, narrower feature** (corner-pin
removal), already SHIPPED. It is the best map of the code surface.

**Code map, all in `src/view/edgeRouting.ts`:**
- `PIN_CLASS = 1` (~:173) — **all pins share one class**; `ConnEnd(shape, PIN_CLASS)` resolves
  to the cheapest pin.
- Fraction constants ~:182-186: `PIN_EDGE_MIN=0`, `PIN_EDGE_Q1=0.25`, `PIN_EDGE_MID=0.5`,
  `PIN_EDGE_Q3=0.75`, `PIN_EDGE_MAX=1`; `PIN_INSIDE_OFFSET=0` (pins sit on the border).
- `PinDir` type + `BoundaryPinSpec` interface; `visDirsFor()` maps `PinDir` → `ConnDirFlag`
  bitmask.
- `BOUNDARY_PIN_SPECS` (:219-232 today, **exported**); `CENTRE_PIN_SPEC` (:240,
  `{0.5, 0.5, "all"}`).
- `registerPinsForShape` (:259-276):
  `specs = kind === "folder-group" ? BOUNDARY_PIN_SPECS : [CENTRE_PIN_SPEC]`, `proportional = true`.
- `LibavoidEdgeRouter.route()` (~:352-398): PolyLine `Router`, obstacle rects, pins,
  `ConnEnd`/`ConnRef` per edge, one `processTransaction()`, `displayRoute()`. **Pin selection is
  delegated entirely to libavoid — there is no custom selection algorithm today.**
- `extractEdgeRoutingInput()` sets `kind: "folder-group"` vs `kind: "note"` on `RoutingObstacle`.
- Telemetry/clipping: `GraphViewController.ts:250-300` (routing pass, `clipRoutesToObstacles`,
  `detourStats`, `console.debug("vicinity-graph: edge routing pass", {...})`), `:397-430`;
  `edgeGeometry.ts` `clipRouteToEndpointRects` (Liang–Barsky), `detourRatio`.

**What was built:** `BOUNDARY_PIN_SPECS` went 8 → **12 pins**, 4 sides × {0.25, 0.5, 0.75},
every one outward-perpendicular; **all 4 corner pins removed**. **Group boxes only** —
`CENTRE_PIN_SPEC`, the note-square branch, `visDirsFor`, the cost model, arena and router were
all explicitly untouched. Result: 681/681 tests.

**Existing tests the PLANNER will interact with (`src/view/edgeRouting.test.ts`):**
- Pure no-wasm `describe("BOUNDARY_PIN_SPECS")`: exactly 12 pins; none on a corner; every
  `dir !== "all"`; each side has {0.25, 0.5, 0.75} with matching outward dir. Durable spec anchor.
- Real-WASM block `LibavoidEdgeRouter with real wasm` (guarded by `if (!loaded) return;`):
  bend-around-obstacle, no-waypoint-inside-obstacle, **facing-side attachment guard** with
  `FACING_BORDER_TOL_PX = 3` and `MID_SPAN_TOL_PX = 10`, plus diagonal corner-clearance tests
  with `CORNER_CLEARANCE_TOL_PX = 12`. All use `kind: "folder-group"` **because pins only exist
  on group boxes** — note-square pin work needs new fixtures.
- Standing instruction: if a facing-side test goes red, **investigate; do NOT loosen the
  tolerance to force green**. Those tests currently pass via libavoid's **tie-break** on
  equal-cost aligned pins, not a strict cost gap — so `setConnectionCost` work will very
  plausibly move them.

**Lessons that transfer:** the pin set is inert data — prefer data/constant-level edits over new
abstractions; a pure spec-lock test is the cheap durable anchor while one real-WASM test proves
the end-to-end guarantee; group-only scope is what keeps the edge-routing__04 perf pathology
dormant; that analysis recommended **no follow-up** for "pins on note squares too" because it
revives the perf pathology. `edge-routing__05` deliberately reopens exactly that question
(4 pins, not 8/12) → measurement is mandatory, not optional.

## 5. Binding-surface PREREQ (the ticket's stated RISK) — unresolved by this agent

`src/view/libavoidLoader.ts` narrows the WebIDL binding to a hand-written `Avoid` interface.
Typed today: `PolyLineRouting`, `OrthogonalRouting`, `ConnDirUp/Down/Left/Right/All`,
`shapeBufferDistance`, `segmentPenalty`, `crossingPenalty`, `Point`, `Rectangle`, `Router`,
`ShapeRef`, `ShapeConnectionPin(shape, classId, xOffset, yOffset, proportional, insideOffset, visDirs)`,
`ConnEnd`, `ConnRef`, `destroy`. **`setConnectionCost`, `setExclusive`, `portDirectionPenalty`,
`ClusterRef`, `clusterCrossingPenalty` are NOT typed anywhere.** There is a catch-all
`readonly [key: string]: unknown` index signature ("the binding exposes ~300 enum constants /
helpers flat on the instance"), and `AvoidRouter` exposes `setRoutingParameter` / `setRoutingOption`.

This agent could **not** verify the runtime binding: **`node_modules/` was not installed** at the
time it looked. Precedent for extending the typed surface exists: edge-routing__04 added
`ConnDirUp/Down/Left/Right` to the interface because the upstream `.d.ts` ships `ConnDirFlags`
as an **empty enum** while the runtime instance carries them.

→ See `EXPLORATION_BINDINGS__PUBLIC.md` for the resolved verdict.

## 6. Docs to touch / not touch

- `docs-internal/architecture-map.md:44-61` — one line for libavoid-js under "Layout stack"; no
  pin detail (and it inaccurately calls the mode "orthogonal edge routing" — it is PolyLine).
- `docs-internal/plan/high-level-plan.md` — **no routing-anchor content**; "pin" there means
  user-pinned central notes.
- `docs-internal/specs/graph/arrows.md:40-63` — the routing spec section. Currently **stale**:
  still describes the removed `edgeRouting` setting.
- `docs-internal/CHANGELOG.md` — routing lineage at ~51-75, 130-155, 177-200. One new entry expected.

## 7. Acceptance/verification bar the PLANNER must design to

From the ticket: Epictetus-style case attaches on the facing side with no wrap-around;
`maxDetourRatio` **drops vs baseline on the sparse/medium/dense dev-vault fixtures** with
before/after recorded in ticket notes; routing pass stays **well under** elk+d3 layout time on
the dense fixture (log both); `crossingPenalty` stays 0; **no new settings/knobs exposed**; pure
pin-selection logic unit-tested (wasm-free, same pattern as `BOUNDARY_PIN_SPECS`); screenshot
smoke run recorded. Route quality cannot be unit-tested against the real router in the plugin
build — the `libavoid-wasm` virtual module only resolves under esbuild; vitest reaches real wasm
only via the node build behind the `if (!loaded) return;` guard.
