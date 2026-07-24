# EXPLORATION_CODE — `edge-routing__05` (facing-side attachment)

> Produced by the EXPLORATION_CODE sub-agent (read-only); transcribed by TOP_LEVEL_AGENT.

## 1. Where libavoid routing is invoked

**Single implementation file: `src/view/edgeRouting.ts`** (420 lines).

- Seam `EdgeRouter { route(input): Promise<EdgeRouteMap> }` — `edgeRouting.ts:56-58`. Input types
  `RoutingObstacle` (`:23-38`, carries `kind: "note" | "folder-group"`), `RoutingEdge` (`:41-45`),
  `EdgeRoutingInput` (`:47-50`), `RoutedPoint` (`:17-20`).
- Pure extraction `extractEdgeRoutingInput({nodes, edges, positions, groupDimensions})` — `:119-165`.
  Notes → `FlowNode.width/height` at absolute position; folder-groups → elk `groupDimensions`.
  Edges whose endpoints aren't obstacles are dropped. **This is where a facing-side pre-computation
  would have all rects available, pure and wasm-free.**
- `LibavoidEdgeRouter.route()` — `:364-410`:
  - lazy `await import("./libavoidLoader"); const avoid = await loadAvoid();` (`:369-370`) —
    deliberate so importing the module under vitest doesn't pull the esbuild-only virtual wasm module.
  - `new avoid.Router(avoid.PolyLineRouting)` via `AvoidArena.newRouter()` (`:306-310`).
    **PolyLine mode, not Orthogonal** → all `idealNudgingDistance` / nudging / shared-path knobs are
    orthogonal-only and therefore inert today.
  - Router parameters, `:374-376`, all three and only these:
    - `shapeBufferDistance = EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2 = 17` (`:71`)
    - `segmentPenalty = EDGE_ROUTING_SEGMENT_PENALTY_PX = 50` (`:82`)
    - `crossingPenalty = EDGE_ROUTING_CROSSING_PENALTY_PX = 0` (`:96`, perf-cliff rationale inline)
    - No `portDirectionPenalty`, no `setRoutingOption(...)`, no ClusterRef.
  - Obstacle loop `:378-385`: `arena.shape(router, rectOf(obstacle))` →
    `registerPinsForShape(avoid, shape, obstacle.kind)` → `shapeById.set(id, shape)`.
  - Connector loop `:387-399`: `arena.connEnd(shape, PIN_CLASS)` for both ends,
    `new avoid.ConnRef(router, src, dst)` (router-owned). Missing shape ⇒ throw (pass-level
    fallback, no per-edge silent skip) `:390-394`.
  - One `router.processTransaction()` (`:400`), then `readRoute(conn)` = `conn.displayRoute()`
    polyline walk (`:345-353`).
  - `arena.dispose()` in `finally` (`:406-408`).
- **Ownership gotcha documented at `:288-298`**: the Router owns ShapeRefs/ConnRefs/
  **ShapeConnectionPins** and frees them; destroying them ourselves double-frees → wasm abort. Only
  Points/Rectangles/ConnEnds are tracked in `AvoidArena.owned` (`:301`). Consequence: pins created
  for per-connector cost tweaking must **not** be destroyed manually, and there is currently no
  handle kept to any pin object (`new avoid.ShapeConnectionPin(...)` result is discarded, `:269-277`)
  — calling `setConnectionCost`/`setExclusive` requires keeping the returned object.
- Binding typings: `src/view/libavoidLoader.ts:20-56` (hand-narrowed `Avoid` interface;
  `ConnDirUp/Down/Left/Right/All` `:27-31`; the three router params `:32-34`; `ShapeConnectionPin`
  ctor typed to return `unknown` at `:40-48`; `AvoidRouter` exposes only
  `processTransaction/setRoutingParameter/setRoutingOption` `:75-79`). Index signature
  `readonly [key: string]: unknown` (`:55`) means runtime enum constants are reachable without
  regenerating typings, but need a named field to stay cast-free (pattern already used for `ConnDir*`).
- Wasm loading: `loadAvoid()` singleton with retry-on-failure (`libavoidLoader.ts:113-141`); base64
  data-URL path only; wasm inlined by `esbuild.config.mjs` (virtual id `libavoid-wasm`,
  `esbuild.config.mjs:9-24` + `loader: {".wasm": "base64"}`).
- Production wiring: `src/view/VicinityGraphView.tsx:55-59` — `new GraphViewController(navigator,
  source, new GraphLayoutRunner(), new LibavoidEdgeRouter())`.

## 2. `BOUNDARY_PIN_SPECS` and note-square centre pin

- `PIN_CLASS = 1` — `edgeRouting.ts:173`. **One shared class for every pin on every shape**;
  `ConnEnd(shape, PIN_CLASS)` binds to whichever same-class pin is cheapest.
- Fraction constants `PIN_EDGE_MIN/Q1/MID/Q3/MAX` = 0/0.25/0.5/0.75/1 — `:182-186`;
  `PIN_INSIDE_OFFSET = 0` (`:189`, pins sit exactly on the border).
- `type PinDir = "up"|"down"|"left"|"right"|"all"` (`:192`);
  `interface BoundaryPinSpec { xFrac; yFrac; dir }` (`:194-198`) — **exported**, so pure spec-level
  unit tests already exist.
- `export const BOUNDARY_PIN_SPECS: readonly BoundaryPinSpec[]` — `:219-232`: exactly 12 specs,
  3 per side at 1/4, 1/2, 3/4, each facing outward-perpendicular. **No corner pins** (rationale
  `:206-208`). Doc block `:200-218` records the WHY-NOT-on-notes perf history.
- `CENTRE_PIN_SPEC: BoundaryPinSpec = { xFrac: 0.5, yFrac: 0.5, dir: "all" }` — `:240`
  (module-private, **not exported** — a test asserting note-pin behaviour would need it exported).
- `visDirsFor(avoid, dir)` maps to `avoid.ConnDirUp/Down/Left/Right/All` — `:243-256`.
- `registerPinsForShape(avoid, shape, kind)` — `:266-279`:
  `const specs = kind === "folder-group" ? BOUNDARY_PIN_SPECS : [CENTRE_PIN_SPEC];` then
  `new avoid.ShapeConnectionPin(shape, PIN_CLASS, xFrac, yFrac, /*proportional*/ true,
  PIN_INSIDE_OFFSET, visDirs)`. **No `setConnectionCost`, no `setExclusive` — the constructed pin
  object is discarded.**
- The `kind` field exists solely to drive this branch (`:29-37`).

## 3. `detourStats` / `detourRatio` telemetry

- `detourRatio(points)` — `src/view/edgeGeometry.ts:389-409`: arc length ÷ endpoint chord;
  zero-chord guard returns `DETOUR_RATIO_DEGENERATE = 1` (`:375`). Doc `:377-388` frames it as the
  numeric proxy because "the wasm router can't run under vitest" — **that statement is now partially
  outdated**, see §4.
- `detourStats(routes)` — `src/view/GraphViewController.ts:415-429` (private module fn): max + mean
  over **clipped** routes; `EMPTY_DETOUR_STATS = {max: 1, mean: 1}` at `:408`; `DetourStats`
  interface `:402-405`.
- Emission — `GraphViewController.ts:280-286`:
  `console.debug("vicinity-graph: edge routing pass", { obstacleCount, edgeCount, durationMs,
  maxDetourRatio, meanDetourRatio })`.
- **No threshold and no consumer**: nothing reads `maxDetourRatio` in code; there is no
  re-route/fallback path. (Ticket approach 5 would be the first consumer.)
- Deliberate ordering (`:274-279`): clip + stats + log run **before** the `isStale` early-return so
  the heaviest real pass is measured rather than a trivial superseded one.
- Tests: `detourRatio` has 4 unit tests (`src/view/edgeGeometry.test.ts:290-306`).
  **`detourStats` itself has no test.**
- Recorded baselines (edge-routing__04 round 2, 8-pin era,
  `.ai_out/edge-routing-04/edge-routing-04-boundary-pins/VERIFICATION__PUBLIC.md:168-179`):
  medium (5 folder groups) max 1.000 / mean 1.000; dense (ungrouped) max 3.096 / mean 1.161.
  Sparse not recorded there.

## 4. Layering — where routing lives, and wasm-in-vitest

- Rules: `CLAUDE.md` "Layering (enforced)" and `docs-internal/architecture-map.md:7-34`.
  `view → adapters → engine (pure)`; engine/shared may not import `obsidian`/`obsidian-id-lib`/
  `react` (enforced by `src/engine/importGuard.test.ts:14-27`, which guards **only** `src/engine`
  and `src/shared`).
- **All routing code is in `src/view/`** — `edgeRouting.ts`, `libavoidLoader.ts`, `edgeGeometry.ts`,
  `GraphViewController.ts`. No engine-layer routing code and no guard preventing view-layer geometry
  helpers. `architecture-map.md:44-51` lists libavoid under "Layout stack (`src/view/`)". A new pure
  module (e.g. facing-side computation) most naturally sits in `src/view/` beside
  `edgeRouting.ts`/`edgeGeometry.ts`.
- **Wasm IS loadable in vitest today** (contrary to the older comment in `edgeGeometry.ts:384`):
  `src/view/edgeRouting.test.ts:205-222` mocks `./libavoidLoader` (`vi.mock`, `:23-24`) and loads
  the **node build** of `libavoid-js` by file URL (`createRequire(import.meta.url).resolve(
  "libavoid-js")` + `pathToFileURL`), then feeds `AvoidLib.getInstance()` into `loadAvoidMock`. On
  failure it sets `loaded = false` and each test early-returns (documented intentional skip,
  `:266-272`). Real-router assertions are possible in `npm test`, but they **silently no-op** if the
  node wasm can't load.
- Vitest scope: `vitest.config.ts` `include: ["src/**/*.test.{ts,tsx}"]`.

## 5. Existing tests around routing / pins

- `src/view/edgeRouting.test.ts` (370 lines), BDD `WHEN … THEN …`:
  - `extractEdgeRoutingInput` (`:26-107`).
  - Constants (`:109-131`) — buffer = curvature/2 = 17 and > arrowhead min inset 14; segment
    penalty 50; crossing penalty 0.
  - `BOUNDARY_PIN_SPECS` pure spec-lock (`:139-198`) — exactly 12 pins; no corner pins; never
    `dir:"all"`; each side has {0.25,0.5,0.75} with matching outward dir. **The template the ticket
    calls out for "pure pin-selection logic unit-tested".**
  - `LibavoidEdgeRouter with real wasm` (`:205-369`) — obstacle detour (>2 points, no waypoint
    strictly inside), and facing-side regression guards: horizontal pair attaches right→left borders
    (`:317-330`), vertical pair bottom→top (`:332-345`), diagonal pair keeps ≥12px corner clearance
    (`:355-369`). Comment at `:288-291`: these use `kind:"folder-group"` boxes because note→note
    edges attach at centres and would NOT show facing-side attachment.
- `src/view/edgeGeometry.test.ts` (307 lines) — clipping (`:135-178`), rounded routed path,
  arc-length midpoint, routed arrowheads, degenerate-waypoint guards, `detourRatio` (`:290-306`).
- `src/view/GraphViewController.test.ts:457-612` — `GraphViewController edge-routing pass`:
  route→`routedPoints` mapping, clipping to note borders and to a group box, absent-edge stays
  straight, router throws → straight-edge fallback, warn-exactly-once, route cache hit on
  reuse-layout, cached routes still attached. Fakes: `FakeEdgeRouter` (`:113-131`), `FakeLayout`
  (`:90-107`), `setup()` (`:157-163`).
- e2e: `e2e/edgeRouting.e2e.ts` (visual smoke — ≥1 edge with ≥2 `L` commands, `:78-80`),
  `e2e/edgeRoutingEval.e2e.ts` (measurement harness, see §6).

## 6. How routing perf is measured/logged today

- Two structured `console.debug` lines from `GraphViewController`:
  - `"vicinity-graph: elk+d3 layout pass" { nodeCount, durationMs }` — `:212-217` (skipped on
    reuse-layout `:203-207`).
  - `"vicinity-graph: edge routing pass" {...}` — `:261-286`.
- `e2e/edgeRoutingEval.e2e.ts` parses those console lines (`onConsole`, `:49-69`), picks the
  **heaviest** pass of each kind (`lastDurations`, `:117-137`) — the edge-routing__04 fix for a
  false-passing perf gate — and prints `[eval] …` lines. Fixed 4500 ms settle window (`:111`).
- Committed gate: `PERF BUDGET … routing pass stays well under the elk+d3 layout time` (`:183-196`)
  asserts `routingMs < layoutMs` on dense/force.
- Route cache short-circuits repeat passes: `routingSignature(input)` over obstacle geometry + edge
  endpoints (`GraphViewController.ts:362-370`), checked at `:253-256`, stored at `:290`. **Any
  change to pin cost/exclusivity that depends only on obstacle geometry is covered by this
  signature; a change depending on anything else would need the signature extended.**
- Historical numbers (`.ai_out/edge-routing-04/.../VERIFICATION__PUBLIC.md:139-152`):

  | fixture (force) | obstacles | edges | routingMs | layoutMs |
  |---|---|---|---|---|
  | sparse | 13 | 10 | 2.9 | 34.4 |
  | medium | 21 | 20 | 9.4 | 35.6 |
  | dense | 101 | 292 | 137.2 | 1463.6 |
  | PERF BUDGET dense | 101 | 292 | 125.7 | 1495.1 |

  Round 1 of that ticket (boundary pins on **all** shapes, 8 pins × ~100 notes) measured
  **8838 ms** on dense — a ~64× blowup and the reason notes kept the centre pin. Directly relevant
  to ticket approach 3 (4 side pins per note).
- `crossingPenalty` cliff: `docs-internal/research/crossing-penalty-and-worker-offload.md:16-30`.

## 7. Dev-vault fixtures and how to run a measurement

- `scripts/setup-dev-vault.sh` creates `.dev-vault/` idempotently (`npm run setup:dev-vault`):
  - **sparse** — `note1.md` vicinity (~9 notes, projects/solo groups).
  - **medium** — `hub-medium.md` + `grp-{a..e}/m{letter}{1,2,3}.md`: five 3-member folder groups,
    each member → hub, plus an inter-group ring (`:139-174`). **The only fixture with group boxes ⇒
    the only fixture that exercises `BOUNDARY_PIN_SPECS` today.**
  - **dense** — `zzdense-hub.md` + 110 root-level spokes with a chord 7 ahead (`:176-200`);
    ungrouped by design so the router sees ~100 note squares (nodeCap 100) — the perf stress case.
  - Also `stranded-main.md` + `p/ep/` (`:202-215`) — a grouped-hub + degree-1 leaf case that
    **resembles the Epictetus pathology**.
- Running: `npm run test:e2e` → `scripts/run-e2e.sh` (auto-downloads pinned Obsidian if
  `OBSIDIAN_PATH` unset, seeds the dev vault, `tsc -p e2e/tsconfig.json`, then Playwright). Filter
  with `npm run test:e2e -- edgeRoutingEval.e2e.ts`. Config: `e2e/playwright.config.ts` (1 worker,
  serial, 120 s test timeout, artifacts → `.tmp/e2e-artifacts`, screenshots → `.out/`).
- The eval spec sets `edgeVisibility: "all-edges"` before measuring (`edgeRoutingEval.e2e.ts:84-90`).
- The ticket's real-world repro vault is `.out/public` (contains `_/clear-goals.md`,
  `p/Epictetus/Epictetus.md`); screenshot `.tmp/Screenshot From 2026-07-24 15-41-26.png`.

## 8. Flags / risks for the PLANNER (facts, not design)

1. **`node_modules/` is NOT installed in this checkout.** `npm test` and the wasm-backed tests
   cannot run until `npm ci`. (Binding questions themselves are RESOLVED — see
   `EXPLORATION_BINDINGS__PUBLIC.md`; note that agent verified against the sha512-matched registry
   tarball and **confirmed `setConnectionCost` IS bound**, correcting risk item 2 below.)
2. Prior evidence (`.ai_out/edge-routing-04/.../EXPLORATION_libavoid__PUBLIC.md:81-87`) listed
   `setExclusive`/`isExclusive`/`directions`/`position`/`updatePosition` but **not**
   `setConnectionCost`. → **Superseded by EXPLORATION_BINDINGS: `setConnectionCost` is bound**
   (`typings/libavoid.d.ts:59`).
3. **Pin objects are currently discarded** (`edgeRouting.ts:269`); any per-pin method call needs the
   reference retained — and it must **not** be added to `AvoidArena.owned` (router-owned ⇒
   double-free ⇒ wasm abort, `:288-298`).
4. **`e2e/edgeRoutingEval.e2e.ts` is partly stale and likely failing.** `layoutMode` was removed
   from settings (commit `e68a86a` "force-only layout"); `src` has zero occurrences of "radial";
   `src/persistence/persistedShapes.test.ts:45-50` asserts a persisted `layoutMode` is ignored.
   `harness.setLayoutMode()` (`e2e/obsidianHarness.ts:298-307`) writes an ignored field, so the
   "layered"/"radial" eval tests actually run **force**, and the test asserting
   `routingMs === undefined` for radial ("routing gated off") can no longer hold. **The measurement
   harness this ticket depends on needs a check/repair pass before before/after numbers are
   trustworthy.**
5. **Measuring on the ticket's real vault is not currently possible via e2e**: `ObsidianHarness`
   hardcodes `DEV_VAULT_DIR = path.join(REPO_ROOT, ".dev-vault")` (`e2e/obsidianHarness.ts:52`) with
   no env override. The Epictetus case must either be reproduced as a dev-vault fixture
   (`stranded-main`/`p/ep/` is the closest existing analogue) or measured manually.
6. **Only the medium fixture has folder groups**, so any group-pin change is measurable for quality
   on medium (baseline already 1.000/1.000) while dense measures perf. A note-side pin change
   (approach 3) is the one that moves the dense number — the 8-pins-on-notes experiment cost 64×.
7. **PolyLine mode**: `idealNudgingDistance` and the nudging/shared-path family are
   orthogonal-mode-only — not available without a visual-language change (out of scope).
8. `routeCache` keys only on obstacle rects + edge endpoints (`GraphViewController.ts:362-370`); a
   facing-side computation derived from those same rects is consistent with the existing cache, but
   a two-pass "re-route offenders" scheme (approach 5) would double the measured `durationMs` inside
   the same timed block (`:261-263`).
