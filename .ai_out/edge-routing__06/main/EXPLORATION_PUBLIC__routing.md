# EXPLORATION_PUBLIC__routing — edge routing map (ticket `edge-routing__06`)

## 1. `src/view/edgeRouting.ts` (419 lines)

| Lines | Content |
|---|---|
| 1-3 | imports: `EDGE_PAIR_CURVATURE_PX` from `./edgeGeometry`; types from `./libavoidLoader` (`Avoid, AvoidConnEnd, AvoidConnRef, AvoidPoint, AvoidRouter, AvoidShapeRef`); `Dimensions, FlowEdge, FlowNode, XY` from `./flowMapping` |
| 5-14 | module doc: pure of React Flow, DIP seam, wasm confined to `LibavoidEdgeRouter` |
| 17-20 | `RoutedPoint {x,y}` (absolute layout coords) |
| 23-38 | `RoutingObstacle {id,x,y,widthPx,heightPx,kind:"note"\|"folder-group"}`; comment 29-36 explains kind drives `registerPinsForShape` |
| 41-45 | `RoutingEdge {id,sourceId,targetId}` |
| 47-50 | `EdgeRoutingInput {obstacles, edges}` — **no settings/params field today** |
| 53 | `EdgeRouteMap = ReadonlyMap<string, readonly RoutedPoint[]>` |
| 56-58 | `interface EdgeRouter { route(input: EdgeRoutingInput): Promise<EdgeRouteMap> }` — the DIP seam |
| 60-71 | `EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2` (=17) with derivation rationale (17 > arrowhead min inset 14) |
| 73-82 | `EDGE_ROUTING_SEGMENT_PENALTY_PX = 50` |
| 84-96 | `EDGE_ROUTING_CROSSING_PENALTY_PX = 0` (long WHY: ~O(connectors^2), 1700ms on dense; named knob kept at 0) |
| 98-165 | `extractEdgeRoutingInput({nodes, edges, positions, groupDimensions})` — pure, no wasm |
| 167-173 | `const PIN_CLASS = 1` — one shared class on every pin of every shape |
| 175-189 | `PIN_EDGE_MIN/Q1/MID/Q3/MAX` = 0/0.25/0.5/0.75/1, `PIN_INSIDE_OFFSET = 0` |
| 191-198 | `type PinDir = "up"\|"down"\|"left"\|"right"\|"all"`; `export interface BoundaryPinSpec {xFrac,yFrac,dir}` |
| 200-232 | `export const BOUNDARY_PIN_SPECS` — 12 specs, 3 per side at 1/4,1/2,3/4, each facing outward; doc explains no-corner rule and WHY-NOT on note squares (perf) |
| 234-240 | `const CENTRE_PIN_SPEC = {xFrac:0.5,yFrac:0.5,dir:"all"}` (note squares) |
| 242-256 | `visDirsFor(avoid, dir): number` → `avoid.ConnDirUp/Down/Left/Right/All` |
| **258-279** | `registerPinsForShape(avoid, shape, kind)` — **the registration loop item (a) targets** |
| 281-286 | `interface AvoidRect {x1,y1,x2,y2}` |
| **288-298** | the ownership block comment |
| 299-343 | `class AvoidArena` |
| 345-353 | `readRoute(conn)` — `displayRoute()` → `size()`/`get_ps(i)` |
| 355-410 | `export class LibavoidEdgeRouter implements EdgeRouter` |
| 412-419 | `rectOf(obstacle)` |

### 1.1 The registration loop (item (a) site) — `src/view/edgeRouting.ts:266-279`

```ts
function registerPinsForShape(avoid: Avoid, shape: AvoidShapeRef, kind: RoutingObstacle["kind"]): void {
	const specs = kind === "folder-group" ? BOUNDARY_PIN_SPECS : [CENTRE_PIN_SPEC];
	for (const spec of specs) {
		new avoid.ShapeConnectionPin(          // line 269 — result discarded today
			shape, PIN_CLASS, spec.xFrac, spec.yFrac, true, PIN_INSIDE_OFFSET, visDirsFor(avoid, spec.dir),
		);
	}
}
```
The constructed pin is **not assigned**, so `setExclusive(false)` needs `const pin = new avoid.ShapeConnectionPin(...)`. The docstring at `:258-265` already ends with "Pins are owned by their shape (and thus the router) — never destroyed by us." — that is the sentence to point at `:288-298` from.

`registerPinsForShape` receives only `(avoid, shape, kind)`; item (a) needs no signature change. Decide whether `setExclusive(false)` also applies to the centre pin (the probe applied it only to the group's 12).

### 1.2 Router-owned-pin block comment — `src/view/edgeRouting.ts:288-298` (verbatim)

```
/**
 * Owns the libavoid bindings for ONE routing pass and frees them in a single
 * sweep, so a pass cannot leak — or double-free — even on the throw path.
 *
 * OWNERSHIP GOTCHA (proven in the phase-0 spike): the Router OWNS the ShapeRefs,
 * ConnRefs and ShapeConnectionPins registered on it and frees them itself on
 * `destroy(router)`. Calling `destroy()` on any of those ourselves DOUBLE-FREES →
 * heap corruption → wasm abort. So we track only the leaf objects WE own — Points,
 * Rectangles, ConnEnds — and destroy the Router LAST; router-owned objects are
 * created but never tracked. No libavoid object escapes this class.
 */
```

### 1.3 `AvoidArena` and `owned` semantics — `edgeRouting.ts:299-343`

- `private readonly owned: unknown[] = []` (`:301`) — **only** Points, Rectangles, ConnEnds.
- `point()` (`:312-316`) pushes the `Point`; `connEnd()` (`:318-322`) pushes the `ConnEnd`; `shape()` (`:325-331`) pushes 2 `Point`s + `Rectangle`, returns `new ShapeRef(router, rectangle)` **without pushing it** (router-owned).
- `ConnRef` created in `route()` at `:397` with `// router-owned`, never pushed.
- `dispose()` (`:333-342`): destroys `owned`, then the Router LAST (`:339` `// frees the ShapeRefs/ConnRefs/pins it owns`).
- **Invariant for (a):** a pin must never reach `arena.owned`. `registerPinsForShape` takes `avoid`, not `arena` — structurally enforced. Keep it that way.

### 1.4 Where the buffer is applied — `edgeRouting.ts:364-409`

```ts
export class LibavoidEdgeRouter implements EdgeRouter {
	async route(input: EdgeRoutingInput): Promise<EdgeRouteMap> {   // :365 — the ONLY public entry
		const { loadAvoid } = await import("./libavoidLoader");      // :369 lazy
		const avoid = await loadAvoid();                             // :370
		const arena = new AvoidArena(avoid);                         // :371
		const router = arena.newRouter();                            // :372
		try {
			router.setRoutingParameter(avoid.shapeBufferDistance, EDGE_ROUTING_SHAPE_BUFFER_PX);   // :374  <- item (b)
			router.setRoutingParameter(avoid.segmentPenalty, EDGE_ROUTING_SEGMENT_PENALTY_PX);     // :375
			router.setRoutingParameter(avoid.crossingPenalty, EDGE_ROUTING_CROSSING_PENALTY_PX);   // :376
			// shapes :378-385 (registerPinsForShape at :383) -> connectors :386-399
			router.processTransaction();                                                           // :400
		} finally { arena.dispose(); }                                                             // :406-408
	}
}
```

### 1.5 How a per-call buffer value would flow in (item (b) plumbing)

Today there is **zero** settings plumbing in the routing layer:
- `EdgeRouter.route(input)` — one argument, no options (`edgeRouting.ts:57`).
- `LibavoidEdgeRouter` has **no constructor** (`:364`), constructed argument-free at `src/view/VicinityGraphView.tsx:59`, injected as `private readonly edgeRouter: EdgeRouter` (`src/view/GraphViewController.ts:107`).
- Controller calls `await this.edgeRouter.route(input)` at `GraphViewController.ts:262`; input built at `:247-252`.
- Controller caches by `routingSignature(input)` (`GraphViewController.ts:253-256`, field at `:99`) — **a buffer change must invalidate this cache**. Biggest correctness trap for (b): with the current signature (obstacles+edges only) a slider move would serve stale routes.

Three viable shapes (pick in planning):
1. **Constructor arg**: `new LibavoidEdgeRouter(() => settings.shapeBufferPx)` — no seam change, but cache invalidation still needs the value in `routingSignature`.
2. **Extend `EdgeRoutingInput`** with `shapeBufferPx` — flows into `routingSignature` automatically if that helper hashes the whole input (verify body ~`GraphViewController.ts:340-375`).
3. **Second `route(input, params)` arg** — changes the DIP seam and `FakeEdgeRouter` (`GraphViewController.test.ts:113`).

Settings would originate in `src/engine/constants.ts` → `SettingsSpec.ts` → `engine/index.ts` → `src/persistence/persistedShapes.ts` → `src/view/VicinityGraphSettingTab.ts` → README. Settings currently reach the controller/layout, **not** the router — that wiring is net-new work.

## 2. `src/view/libavoidLoader.ts` (141 lines)

- "Narrow only what we use" documented at `:12-19`; `readonly [key: string]: unknown` at `:55` is the escape hatch for unnamed enum constants.
- `interface Avoid` (`:20-56`): routing flags, `ConnDirUp/Down/Left/Right/All` (`:27-31`), parameter ids `shapeBufferDistance`/`segmentPenalty`/`crossingPenalty` (`:32-34`), constructors, `destroy(obj: unknown): void` (`:52`).
- **The `unknown` return** — `libavoidLoader.ts:40-48`:
```ts
	ShapeConnectionPin: new (
		shape: AvoidShapeRef, classId: number, xOffset: number, yOffset: number,
		proportional: boolean, insideOffset: number, visDirs: number,
	) => unknown;                       // :48  <- narrow this
```
- Narrowed type to add (file convention: `AvoidRectangle`/`AvoidShapeRef`/`AvoidConnEnd` at `:62-70` are brand-only; `AvoidRouter`/`AvoidConnRef` at `:75-82` expose methods):
```ts
export interface AvoidShapeConnectionPin {
	setExclusive(exclusive: boolean): void;
	isExclusive(): boolean;
}
```
  Verified: `node_modules/libavoid-js/dist/index.d.ts:55-66` declares `setConnectionCost`, `setExclusive`, `isExclusive`, `directions()`, `position()`, `updatePosition()`. Package 0.4.5; both browser and node builds expose them (vitest real-wasm uses the node build).
- Do NOT add `setConnectionCost` — pin costs are the closed negative result.
- `loadAvoid()` (`:113-128`) memoizes only successful instances; `initAvoid()` (`:130-141`).

## 3. `src/view/edgeGeometry.ts` — the two constants item (b) is tied to

- `EDGE_ARROWHEAD_INSET_MIN_PX = 14` at `:45` (siblings `EDGE_ARROWHEAD_INSET_FRACTION = 0.12` `:44`, `..._MAX_PX = 48` `:46`; rationale `:32-43`). Consumed only in `arrowFromApproach` `:516-519`: `inset = min(MAX, max(MIN, len * FRACTION))`. Test dependents: `edgeGeometry.test.ts:59, 81, 242`; plus `edgeRouting.test.ts:117`.
- `EDGE_PAIR_CURVATURE_PX = 34` at `:58` (rationale `:48-57`: widened 24→34 on 2026-07-20). Consumers: control point `:108-109`, label midpoint `:119-120`, tests `edgeGeometry.test.ts:33, 38, 82, 85, 86`, and **`edgeRouting.ts:71`**. `edgeGeometry.ts:8` notes constants live here to avoid a cycle.
- Consequence: buffer 5 breaks both invariants. Option 2 (shrink inset) ripples into 3 edgeGeometry tests; changing curvature ripples into 5 tests plus all bowed-pair visuals.

## 4. `src/view/edgeRouting.test.ts` (370 lines) — structure

Imports (`:9-18`): `createRequire`/`pathToFileURL`, vitest, `asFolderPath/asVaultPath` from `../engine`, `EDGE_ARROWHEAD_INSET_MIN_PX`, `vicinityGraphToFlow`, fixtures `makeEdge/makeGraph/makeNode`, routing exports.

**wasm-seam mock** (`:20-24`): `vi.hoisted` + `vi.mock("./libavoidLoader", () => ({ loadAvoid: loadAvoidMock }))`.

Blocks:
1. `describe("extractEdgeRoutingInput")` `:26-107` — PURE. `scenario()` builds a `notes/` folder group with 2 members + a root note, hardcoded `positions`/`groupDimensions` (`:42-48`).
2. `describe("EDGE_ROUTING_SHAPE_BUFFER_PX")` `:109-119` — PURE, the item-(b) invariants.
3. `describe("edge-routing tuning penalties (edge-routing__03)")` `:121-131` — PURE (segment 50, crossing 0).
4. `describe("BOUNDARY_PIN_SPECS")` `:139-198` — PURE spec lock. Local helpers `isCorner` (`:143-145`), **`SidePin`/`sidePinOf` (`:149-164`)**, `OUTWARD_DIR` (`:166-171`).
5. `describe("LibavoidEdgeRouter with real wasm")` `:205-370`.

### 4.1 Real-wasm setup (recipe for the new item-(a) test) — `:205-222`

```ts
const require = createRequire(import.meta.url);
const LIBAVOID_NODE_BUILD = require.resolve("libavoid-js");
let loaded = true;
beforeAll(async () => {
	try {
		const libavoid = (await import(pathToFileURL(LIBAVOID_NODE_BUILD).href)) as {...};
		await libavoid.AvoidLib.load();
		loadAvoidMock.mockResolvedValue(libavoid.AvoidLib.getInstance() as Avoid);
	} catch { loaded = false; }
});
```
Every real-wasm `it` opens with `if (!loaded) { return; }` (documented `:267-271`).

Helpers in this block:
- `isStrictlyInside(point, rect)` `:224-232`, eps 0.01.
- `CORNER_CLEARANCE_TOL_PX = 12` `:234`; `cornersOf(r)` `:236-243`; `minCornerDistance(p, r)` `:245-247`.
- Obstacles declared inline: `nodeA/nodeB/blocker` `:250-252` (`"note"`); per-test `boxL/boxR/boxT/boxB` (`"folder-group"`) at `:321-322`, `:336-337`, `:352-353`.
- `route()` `:254-264` — 3 obstacles, 1 edge, returns the `A->B` polyline.
- **`routePair(source, target)` `:297-315`** — one `S->T` edge over two obstacles, returns `{first, last}`. The new test needs 8 leaf obstacles + 8 edges into one group → expect a sibling helper returning the terminal point per edge id.
- `FACING_BORDER_TOL_PX = 3` `:292`, `MID_SPAN_TOL_PX = 10` `:293` (after WHY block `:282-291`).

**Side/termination determination:** no `sideOfRect` helper exists in the test file. Facing-side assertions are explicit coordinate comparisons (`Math.abs(first.x - 100) <= FACING_BORDER_TOL_PX`). Probe reference (`.tmp/probe11-reviewer.mjs`):
```js
const sideOfRect = (p, g) => (Math.abs(p.x - g.x) < 1 ? "L" : Math.abs(p.x - (g.x + g.w)) < 1 ? "R"
  : Math.abs(p.y - g.y) < 1 ? "T" : Math.abs(p.y - (g.y + g.h)) < 1 ? "B" : "?");
```
`"?"` == centre attachment. Routes are UNCLIPPED at this layer (clipping in `GraphViewController.clipRoutesToObstacles`, `:268/379-397`), so a centre-attached route's last point is literally the group centre `(g.x+g.w/2, g.y+g.h/2)` — assert on that directly.

### 4.2 The two invariant tests, VERBATIM (`edgeRouting.test.ts:109-131`)

```ts
describe("EDGE_ROUTING_SHAPE_BUFFER_PX", () => {
	it("WHEN derived from the paired-edge curvature THEN it is half of it (17px)", () => {
		expect(EDGE_ROUTING_SHAPE_BUFFER_PX).toBe(17);
	});

	it("WHEN a route clears an obstacle THEN the buffer exceeds the arrowhead min inset (14px)", () => {
		// The clearance must be larger than where the arrowhead ever sits, so a route
		// clears a box further out than its own head (edge-routing__03 tuning rationale).
		expect(EDGE_ROUTING_SHAPE_BUFFER_PX).toBeGreaterThan(EDGE_ARROWHEAD_INSET_MIN_PX);
	});
});

describe("edge-routing tuning penalties (edge-routing__03)", () => {
	it("WHEN each extra bend is penalised THEN the segment penalty is 50px of virtual length", () => {
		expect(EDGE_ROUTING_SEGMENT_PENALTY_PX).toBe(50);
	});

	it("WHEN crossing avoidance is too costly for the interactive rebuild THEN the crossing penalty is disabled (0)", () => {
		// Evaluated in edge-routing__03: any positive value pays libavoid's ~O(connectors²)
		// crossing check, blowing the dense-fixture perf budget. Kept as a named knob at 0.
		expect(EDGE_ROUTING_CROSSING_PENALTY_PX).toBe(0);
	});
});
```
(Ticket cites "109-131": buffer invariants are `:110-118`, penalty locks `:122-130`.)

## 5. Probe / eval harness

**Probes: present on disk, gitignored, untracked** (`.gitignore` has `.tmp/`, `.out/`; `git ls-files .tmp` empty). They vanish on a clean clone.

In `.tmp/`:
- `probe-pin-cost.mjs`, `probe2..probe10.mjs` — edge-routing__05 planner probes.
- **`probe11-reviewer.mjs`** (154 lines) — the item-(a) measurement. Variants `A` = today (shared class, default exclusive), `B` = shared class + `setExclusive(false)`, `C` = side classes + `setExclusive(false)`, plus keep-better KB/KA at 1.25. Prints `nonFacing`, `centreAttach`, `totalLen` (% vs A), `ms`. Ends with `evaluate("low degree (1-3 …)", 4)` and `evaluate("higher degree (1-7 …)", 8)` — the runs the ticket quotes.
- `probe12-reviewer.mjs` — adds `bendCheck`. `probe13-reviewer.mjs` — sweeps keep-better ratios.

**How to run** (no npm script): `node .tmp/probe11-reviewer.mjs` from repo root; needs `node_modules/libavoid-js`.

Shared probe harness (self-contained, no repo imports):
- loads `libavoid-js` via `createRequire`+`pathToFileURL`;
- `SPECS` duplicates the 12 `BOUNDARY_PIN_SPECS`; `SHARED = 1`, `SIDE_CLASS = {up:11,right:12,down:13,left:14}`;
- `run(obstacles, edges, {sideClasses, exclusive})` sets `shapeBufferDistance 17 / segmentPenalty 50 / crossingPenalty 0` — **the hook for the item-(b) buffer sweep**: parametrise that literal 17;
- `corpus(maxLeaves, seedInit)` — 400 scenes, LCG seed 12345, one group box (160-420px/side) with 2-4 child rows, 1..maxLeaves leaf notes at radius 220-520 edged to the group, plus 3-10 crowding notes at radius 60-320. `maxLeaves=4` ⇒ low degree, `8` ⇒ realistic;
- metrics: `facingSides(s,t)`, `sideOfRect`, `len(pts)`; counters `nf`, `centre`, `len`, `ms`;
- cleanup follows the same ownership rule (pins/ConnRefs never destroyed, router last).

**E2E eval harness `e2e/edgeRoutingEval.e2e.ts`** — see `EXPLORATION_PUBLIC__e2e.md` for the full map. Key: it measures timing + (unprinted) detour ratios only; **no non-facing count exists in e2e** — that metric lives solely in the `.tmp` node probes.

## 6. Research facts relevant to (a)/(b) — summary only

From `docs-internal/research/facing-side-edge-attachment.md:13-36` and `research-layout-aesthetics.md:43-63` (B1) / `:108-141` (C1):
- **Root cause of the wrap-around is visibility blocking, not cost.** The 17px `shapeBufferDistance` on every obstacle seals the corridor between a neighbour note and the group's facing border; facing pins become unreachable. All pin-cost measurements (0/818 changed, still 0 at cost 100000) and `portDirectionPenalty` (0 vs 100) follow from that. → item (b) attacks the measured lever.
- **Directional pins are exclusive by default**; the useful move is `setExclusive(false)`. With 3 pins/side, the 4th edge approaching a side falls back to the group **CENTRE** — the pre-__04 pathology, live today. Measured 82 → 40 non-facing at realistic degree, total route length −2.3% (low degree 24 → 22, −0.3%). → item (a).
- Parked/forbidden: two-pass per-edge pin-class design, 4 directional pins on note squares (~64x perf blowup), detour-triggered re-route, `clusterCrossingPenalty` (`ClusterRef` unbound in 0.4.5).
- Baselines of record (__04): sparse 2.9ms routing / 34.4ms layout; medium 9.4 / 35.6, maxDetour 1.000; dense 137.2 / 1463.6, maxDetour 3.096, meanDetour 1.161.

## 7. Gotcha list for the implementer

1. Never put a pin into `AvoidArena.owned`; never `destroy()` it (`edgeRouting.ts:288-298`, `:339`).
2. The buffer is read once per pass at `:374`; making it dynamic REQUIRES touching `routingSignature`/`routeCache` (`GraphViewController.ts:99, 253-256`) or stale routes will be served after a slider move.
3. `LibavoidEdgeRouter` is constructed argument-free at `VicinityGraphView.tsx:59`; any constructor change lands there and in `FakeEdgeRouter` (`GraphViewController.test.ts:113`).
4. `EDGE_ROUTING_SHAPE_BUFFER_PX` is imported by the test only plus the router — the invariants at `:109-119` are the only guardrails.
5. Real-wasm tests must keep the `if (!loaded) return;` skip shape and use `kind: "folder-group"` obstacles.
