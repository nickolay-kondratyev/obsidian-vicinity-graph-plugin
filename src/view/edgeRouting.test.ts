import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { TestContext } from "vitest";
import { asFolderPath, asVaultPath, EngineDefaults, FORCE_LAYOUT_RANGES } from "../engine";
import { GROUP_SIDE_PADDING_PX } from "./constants";
import { vicinityGraphToFlow } from "./flowMapping";
import type { Dimensions, XY } from "./flowMapping";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";
import { ARROWHEAD_HALF_WIDTH_PX } from "./VicinityEdge";
import {
	BOUNDARY_PIN_SPECS,
	EDGE_ROUTING_CROSSING_PENALTY_PX,
	EDGE_ROUTING_SEGMENT_PENALTY_PX,
	LibavoidEdgeRouter,
	extractEdgeRoutingInput,
} from "./edgeRouting";
import type { BoundaryPinSpec, EdgeRouteMap, RoutingObstacle } from "./edgeRouting";
import type { Avoid } from "./libavoidLoader";

// The real libavoid wasm loads via the node build (below); LibavoidEdgeRouter
// dynamically imports `./libavoidLoader` (the browser data-URL path, unresolvable
// under vitest). Mock that seam so the router routes against the node-built engine.
const { loadAvoidMock } = vi.hoisted(() => ({ loadAvoidMock: vi.fn() }));
vi.mock("./libavoidLoader", () => ({ loadAvoid: loadAvoidMock }));

/**
 * Every routing scene below runs at the SHIPPED default "Edge clearance", so these
 * tests measure what users actually get rather than an arbitrary test value.
 */
const SHIPPED_CLEARANCE_PX = EngineDefaults.forceLayoutSettings().edgeRoutingClearancePx;

/** The whole span a slider — or a clamped, hand-edited `data.json` — can reach. */
const CLEARANCE_RANGE = FORCE_LAYOUT_RANGES.edgeRoutingClearancePx;

describe("extractEdgeRoutingInput", () => {
	/**
	 * GIVEN a folder group `notes/` with two members (a, b), an ungrouped root
	 * note, an intra-group edge a→b (kept member-to-member) and a cross-boundary
	 * edge a→root (collapsed onto the group box).
	 */
	function scenario(): ReturnType<typeof extractEdgeRoutingInput> {
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("root.md"), folder: asFolderPath("") }),
			],
			edges: [makeEdge("notes/a.md", "notes/b.md"), makeEdge("notes/a.md", "root.md")],
		});
		const flow = vicinityGraphToFlow(graph, false);
		const positions = new Map<string, XY>([
			["folder-group:notes", { x: 100, y: 100 }],
			["notes/a.md", { x: 110, y: 140 }],
			["notes/b.md", { x: 160, y: 140 }],
			["root.md", { x: 400, y: 100 }],
		]);
		const groupDimensions = new Map<string, Dimensions>([["folder-group:notes", { width: 120, height: 120 }]]);
		return extractEdgeRoutingInput({
			nodes: flow.nodes,
			edges: flow.edges,
			positions,
			groupDimensions,
			shapeBufferPx: SHIPPED_CLEARANCE_PX,
		});
	}

	function obstacle(id: string): RoutingObstacle {
		const found = scenario().obstacles.find((o) => o.id === id);
		if (found === undefined) {
			throw new Error(`no obstacle ${id}`);
		}
		return found;
	}

	it("WHEN a note node has a position THEN its obstacle is a sizePx square at absolute coords", () => {
		expect(obstacle("notes/a.md")).toEqual({
			id: "notes/a.md",
			x: 110,
			y: 140,
			widthPx: 100,
			heightPx: 100,
			kind: "note",
		});
	});

	it("WHEN a folder group has elk dimensions THEN its obstacle is the container rect at absolute coords", () => {
		expect(obstacle("folder-group:notes")).toEqual({
			id: "folder-group:notes",
			x: 100,
			y: 100,
			widthPx: 120,
			heightPx: 120,
			kind: "folder-group",
		});
	});

	it("WHEN an intra-group edge is routed THEN it attaches to the child squares", () => {
		const edge = scenario().edges.find((e) => e.id === "notes/a.md->notes/b.md");
		expect(edge).toEqual({ id: "notes/a.md->notes/b.md", sourceId: "notes/a.md", targetId: "notes/b.md" });
	});

	it("WHEN a cross-boundary edge collapses THEN it attaches to the group container box", () => {
		const edge = scenario().edges.find((e) => e.id === "folder-group:notes->root.md");
		expect(edge).toEqual({
			id: "folder-group:notes->root.md",
			sourceId: "folder-group:notes",
			targetId: "root.md",
		});
	});

	it("WHEN a node lacks a position THEN it is skipped as an obstacle", () => {
		const graph = makeGraph({ nodes: [makeNode({ path: asVaultPath("lonely.md") })], edges: [] });
		const flow = vicinityGraphToFlow(graph, false);
		const input = extractEdgeRoutingInput({
			nodes: flow.nodes,
			edges: flow.edges,
			positions: new Map(),
			groupDimensions: new Map(),
			shapeBufferPx: SHIPPED_CLEARANCE_PX,
		});
		expect(input.obstacles).toEqual([]);
	});
});

/**
 * The routing clearance is the user-facing "Edge clearance" setting
 * (`ForceLayoutSettings.edgeRoutingClearancePx`), so these lock the whole REACHABLE
 * RANGE, not merely the shipped default: every value a slider — or a hand-edited,
 * clamped `data.json` — can produce must satisfy both invariants.
 *
 * They REPLACE the pair that shipped before edge-routing__06 (`=== EDGE_PAIR_CURVATURE_PX
 * / 2` and `> EDGE_ARROWHEAD_INSET_MIN_PX`) — deliberately STRONGER statements, not
 * looser ones (that ticket's human decision D3). Each relates the clearance to a
 * constant that measurably bounds it, so the bound moves when the geometry moves.
 */
describe("edge-routing clearance range invariants (edge-routing__06)", () => {
	it("WHEN the clearance is at its maximum THEN it still stays under the folder-group side padding", () => {
		// REPLACES `buffer === EDGE_PAIR_CURVATURE_PX / 2` (17), a tie to the hand-drawn
		// bow curvature that nothing in the routing geometry justified.
		// MEASURED cliff: a group's member squares are their OWN routing obstacles, inset
		// GROUP_SIDE_PADDING_PX from the container border by ELK_GROUP_PADDING. Once the
		// clearance exceeds that inset, a member's clearance region escapes the group border
		// and seals the group's own boundary pins from outside, so cross-boundary edges wrap
		// around to a non-facing side (400-scene corpus at realistic group degree: 22-26
		// non-facing attachments at clearance <= 14 against 40 at 17). The cliff MOVES when
		// the inset moves — that is what makes this a relation and not a magic number
		// (edge-routing__06 `SWEEP__PUBLIC.md` §4). The old 17 sat 1-2px over it.
		expect(CLEARANCE_RANGE.max).toBeLessThan(GROUP_SIDE_PADDING_PX);
	});

	it("WHEN the clearance is at its minimum THEN it is still at least the arrowhead's half-width", () => {
		// REPLACES `buffer > EDGE_ARROWHEAD_INSET_MIN_PX` (14), which never described a real
		// containment relation: it compared this PERPENDICULAR clearance against the
		// arrowhead's LONGITUDINAL inset back along the route — two different axes.
		// The half-width is perpendicular like the clearance, so THIS one has geometric
		// meaning: an arrowhead drawn on a route that clears every box by `clearance` keeps
		// its own body outside those boxes. `>=` rather than `>` is the decided floor (D3):
		// at the very minimum the head's body grazes the boundary without crossing it.
		expect(CLEARANCE_RANGE.min).toBeGreaterThanOrEqual(ARROWHEAD_HALF_WIDTH_PX);
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

/**
 * Pure spec lock for the folder-group boundary pins (no wasm). This is the durable
 * regression anchor for the 12-point change: it fixes the geometry independent of
 * libavoid's cost model / tie-break. Corner pins (both fracs extreme) are forbidden
 * so an edge never appears to continue PAST a node it terminated at.
 */
describe("BOUNDARY_PIN_SPECS", () => {
	const EXTREMES = new Set([0, 1]);
	const QUARTER_FRACS = [0.25, 0.5, 0.75] as const;

	function isCorner(spec: BoundaryPinSpec): boolean {
		return EXTREMES.has(spec.xFrac) && EXTREMES.has(spec.yFrac);
	}

	// The side a pin sits on (identified by the coordinate pinned to a border) plus the
	// pin's free coordinate along that side. Vertical sides pin xFrac; horizontal sides yFrac.
	interface SidePin {
		readonly side: "top" | "bottom" | "left" | "right";
		readonly along: number;
	}
	function sidePinOf(spec: BoundaryPinSpec): SidePin {
		if (spec.xFrac === 0) {
			return { side: "left", along: spec.yFrac };
		}
		if (spec.xFrac === 1) {
			return { side: "right", along: spec.yFrac };
		}
		if (spec.yFrac === 0) {
			return { side: "top", along: spec.xFrac };
		}
		return { side: "bottom", along: spec.xFrac };
	}

	const OUTWARD_DIR: Record<SidePin["side"], BoundaryPinSpec["dir"]> = {
		top: "up",
		bottom: "down",
		left: "left",
		right: "right",
	};

	it("WHEN the pin set is defined THEN there are exactly 12 boundary pins", () => {
		expect(BOUNDARY_PIN_SPECS.length).toBe(12);
	});

	it("WHEN a pin is inspected THEN none sits on a corner (both fracs at an extreme)", () => {
		expect(BOUNDARY_PIN_SPECS.some(isCorner)).toBe(false);
	});

	it("WHEN a pin is inspected THEN every pin faces outward-perpendicular (never 'all')", () => {
		expect(BOUNDARY_PIN_SPECS.every((s) => s.dir !== "all")).toBe(true);
	});

	it("WHEN pins are grouped by side THEN each of the 4 sides has pins at 1/4, 1/2, 3/4 facing outward", () => {
		const bySide = new Map<SidePin["side"], number[]>();
		for (const spec of BOUNDARY_PIN_SPECS) {
			const { side, along } = sidePinOf(spec);
			expect(spec.dir).toBe(OUTWARD_DIR[side]); // dir matches the side's outward perpendicular
			(bySide.get(side) ?? bySide.set(side, []).get(side)!).push(along);
		}
		const sortedFor = (side: SidePin["side"]): number[] => [...(bySide.get(side) ?? [])].sort((a, b) => a - b);
		expect(sortedFor("top")).toEqual([...QUARTER_FRACS]);
		expect(sortedFor("bottom")).toEqual([...QUARTER_FRACS]);
		expect(sortedFor("left")).toEqual([...QUARTER_FRACS]);
		expect(sortedFor("right")).toEqual([...QUARTER_FRACS]);
	});
});

/**
 * Integration against the REAL libavoid wasm (node build, same engine as the
 * shipped browser build). Proves obstacle avoidance end-to-end through the actual
 * LibavoidEdgeRouter (arena + shape-attached endpoints + processTransaction).
 */
describe("LibavoidEdgeRouter with real wasm", () => {
	const require = createRequire(import.meta.url);
	const LIBAVOID_NODE_BUILD = require.resolve("libavoid-js");
	let avoid: Avoid | null = null;

	beforeAll(async () => {
		try {
			// Load the NODE build explicitly by file URL (reads the wasm off disk); a
			// bare import resolves to the Chromium-only browser build, which aborts here.
			const libavoid = (await import(pathToFileURL(LIBAVOID_NODE_BUILD).href)) as {
				AvoidLib: { load(path?: string): Promise<void>; getInstance(): unknown };
			};
			await libavoid.AvoidLib.load();
			avoid = libavoid.AvoidLib.getInstance() as Avoid;
			loadAvoidMock.mockResolvedValue(avoid);
		} catch {
			avoid = null;
		}
	});

	/**
	 * Marks the test SKIPPED when the node wasm build is unavailable in this environment.
	 * WHY not a bare `return`: that reports a PASS, so a lost wasm build would turn this
	 * whole block green while asserting nothing. WHY-NOT `it.runIf(loaded)`: availability
	 * is only known after `beforeAll`, long after `runIf` is evaluated at collection time.
	 */
	function requireWasm(ctx: TestContext): Avoid {
		const instance = avoid;
		if (instance === null) {
			ctx.skip("the libavoid node wasm build did not load in this environment");
		}
		return instance;
	}

	function isStrictlyInside(point: { x: number; y: number }, rect: RoutingObstacle): boolean {
		const eps = 0.01;
		return (
			point.x > rect.x + eps &&
			point.x < rect.x + rect.widthPx - eps &&
			point.y > rect.y + eps &&
			point.y < rect.y + rect.heightPx - eps
		);
	}

	const CORNER_CLEARANCE_TOL_PX = 12; // quarter pins sit 25px from a corner; a corner sits 0px away

	function cornersOf(r: RoutingObstacle): { x: number; y: number }[] {
		return [
			{ x: r.x, y: r.y },
			{ x: r.x + r.widthPx, y: r.y },
			{ x: r.x, y: r.y + r.heightPx },
			{ x: r.x + r.widthPx, y: r.y + r.heightPx },
		];
	}

	function minCornerDistance(p: { x: number; y: number }, r: RoutingObstacle): number {
		return Math.min(...cornersOf(r).map((c) => Math.hypot(p.x - c.x, p.y - c.y)));
	}

	// Two nodes on a horizontal line with a rectangle straddling the straight path.
	const nodeA: RoutingObstacle = { id: "A", x: 0, y: 40, widthPx: 20, heightPx: 20, kind: "note" }; // centre (10,50)
	const nodeB: RoutingObstacle = { id: "B", x: 200, y: 40, widthPx: 20, heightPx: 20, kind: "note" }; // centre (210,50)
	const blocker: RoutingObstacle = { id: "OBS", x: 95, y: 20, widthPx: 40, heightPx: 60, kind: "note" };

	async function routeAtClearance(shapeBufferPx: number): Promise<readonly { x: number; y: number }[]> {
		const routes = await new LibavoidEdgeRouter().route({
			obstacles: [nodeA, nodeB, blocker],
			edges: [{ id: "A->B", sourceId: "A", targetId: "B" }],
			shapeBufferPx,
		});
		const polyline = routes.get("A->B");
		if (polyline === undefined) {
			throw new Error("router produced no route for A->B");
		}
		return polyline;
	}

	async function route(): Promise<readonly { x: number; y: number }[]> {
		return routeAtClearance(SHIPPED_CLEARANCE_PX);
	}

	it("WHEN a rectangle blocks the straight path THEN the route bends around it (>2 points)", async (ctx) => {
		requireWasm(ctx);
		expect((await route()).length).toBeGreaterThan(2);
	});

	it("WHEN routing around the obstacle THEN no waypoint falls strictly inside it", async (ctx) => {
		requireWasm(ctx);
		expect((await route()).some((p) => isStrictlyInside(p, blocker))).toBe(false);
	});

	function polylineLengthPx(polyline: readonly { x: number; y: number }[]): number {
		let total = 0;
		for (let i = 1; i < polyline.length; i++) {
			const from = polyline[i - 1];
			const to = polyline[i];
			if (from !== undefined && to !== undefined) {
				total += Math.hypot(to.x - from.x, to.y - from.y);
			}
		}
		return total;
	}

	// THE LAST HOP: everything upstream of `router.setRoutingParameter(shapeBufferDistance, …)`
	// — spec, persistence, cascade, `EdgeRoutingInput`, the route-cache signature — is guarded by
	// its own test, but the handoff INTO libavoid was not, so re-hardcoding that one line left the
	// whole suite (and every e2e spec) green while shipping a dead slider.
	// This closes it from the far side: the same scene, only the clearance differing, must produce
	// a MEASURABLY different route. A wider clearance pushes the detour further off the blocker, so
	// route length grows monotonically with it (measured on this scene: 216.6px at 6, 222.6 at 11,
	// 226.7 at 14, 231.3 at the retired 17). Asserted as the RELATION between the two range
	// endpoints rather than against either length — the numbers move with the scene, the ordering
	// does not, and both endpoints come from `FORCE_LAYOUT_RANGES` like the two invariants above.
	it("WHEN the same scene is routed at the minimum and the maximum clearance THEN the tighter clearance gives the shorter route (the setting reaches libavoid)", async (ctx) => {
		requireWasm(ctx);
		const atMin = polylineLengthPx(await routeAtClearance(CLEARANCE_RANGE.min));
		const atMax = polylineLengthPx(await routeAtClearance(CLEARANCE_RANGE.max));
		expect(atMin).toBeLessThan(atMax);
	});

	// WHY these two: they are the regression guard for edge-routing__04's central fix —
	// boundary pins whose `visDirs` face OUTWARD, so an edge attaches on the side FACING
	// its counterpart. Without a facing-side assertion, an inverted/reverted `visDirs`
	// mapping keeps all other tests green while silently breaking the whole point of the
	// ticket. These lock the outward mapping in.
	//
	// NOTE: the boxes are FOLDER-GROUP obstacles (kind: "folder-group"). Boundary pins are
	// registered on group boxes ONLY; note squares intentionally keep a single centre pin
	// (perf fallback, Phase A), so a NOTE→NOTE edge attaches at centres and would NOT show
	// facing-side attachment. The roundabout pathology this guards is group-box specific.
	const FACING_BORDER_TOL_PX = 3; // endpoint must sit on the facing border (within a few px)
	const MID_SPAN_TOL_PX = 10; // and roughly at the facing side's midpoint, not a corner

	// Two 100x100 boxes with a clear gap between them; the edge should hop directly
	// across the gap, attaching on the two facing borders.
	async function routePair(
		source: RoutingObstacle,
		target: RoutingObstacle,
	): Promise<{ first: { x: number; y: number }; last: { x: number; y: number } }> {
		const routes = await new LibavoidEdgeRouter().route({
			obstacles: [source, target],
			edges: [{ id: "S->T", sourceId: source.id, targetId: target.id }],
			shapeBufferPx: SHIPPED_CLEARANCE_PX,
		});
		const polyline = routes.get("S->T");
		if (polyline === undefined || polyline.length < 2) {
			throw new Error("router produced no route for S->T");
		}
		const first = polyline[0];
		const last = polyline[polyline.length - 1];
		if (first === undefined || last === undefined) {
			throw new Error("route missing endpoints");
		}
		return { first, last };
	}

	it("WHEN two boxes are separated horizontally THEN the edge attaches on the facing (right→left) borders", async (ctx) => {
		requireWasm(ctx);
		const boxL: RoutingObstacle = { id: "L", x: 0, y: 0, widthPx: 100, heightPx: 100, kind: "folder-group" }; // right border x=100
		const boxR: RoutingObstacle = { id: "R", x: 300, y: 0, widthPx: 100, heightPx: 100, kind: "folder-group" }; // left border x=300
		const { first, last } = await routePair(boxL, boxR);
		// Source leaves L's RIGHT border (x≈100), not its centre (50) or far/left border (0);
		// target enters R's LEFT border (x≈300), not its centre (350). Both near mid-height (50).
		expect(Math.abs(first.x - 100)).toBeLessThanOrEqual(FACING_BORDER_TOL_PX);
		expect(Math.abs(first.y - 50)).toBeLessThanOrEqual(MID_SPAN_TOL_PX);
		expect(Math.abs(last.x - 300)).toBeLessThanOrEqual(FACING_BORDER_TOL_PX);
		expect(Math.abs(last.y - 50)).toBeLessThanOrEqual(MID_SPAN_TOL_PX);
	});

	it("WHEN two boxes are separated vertically THEN the edge attaches on the facing (bottom→top) borders", async (ctx) => {
		requireWasm(ctx);
		const boxT: RoutingObstacle = { id: "T", x: 0, y: 0, widthPx: 100, heightPx: 100, kind: "folder-group" }; // bottom border y=100
		const boxB: RoutingObstacle = { id: "B", x: 0, y: 300, widthPx: 100, heightPx: 100, kind: "folder-group" }; // top border y=300
		const { first, last } = await routePair(boxT, boxB);
		// Source leaves T's BOTTOM border (y≈100), target enters B's TOP border (y≈300);
		// both near mid-width (50). An inverted up/down mapping would force a detour off-side.
		expect(Math.abs(first.y - 100)).toBeLessThanOrEqual(FACING_BORDER_TOL_PX);
		expect(Math.abs(first.x - 50)).toBeLessThanOrEqual(MID_SPAN_TOL_PX);
		expect(Math.abs(last.y - 300)).toBeLessThanOrEqual(FACING_BORDER_TOL_PX);
		expect(Math.abs(last.x - 50)).toBeLessThanOrEqual(MID_SPAN_TOL_PX);
	});

	// Corner-removal guard (12-point anchors): two group boxes offset DIAGONALLY so the
	// natural straight path runs corner-to-corner. The old 8-pin set would attach exactly
	// on L's bottom-right / R's top-left corner (minCornerDistance = 0); the side-only
	// 12-pin set forces a face pin ~25px from any corner. CORNER_CLEARANCE_TOL_PX = 12
	// cleanly separates 25 (new) from 0 (old) — the actual contract is corner-clearance.
	const boxL: RoutingObstacle = { id: "L", x: 0, y: 0, widthPx: 100, heightPx: 100, kind: "folder-group" };
	const boxR: RoutingObstacle = { id: "R", x: 300, y: 300, widthPx: 100, heightPx: 100, kind: "folder-group" };

	it("WHEN two group boxes are offset diagonally THEN the source endpoint clears every corner of its box", async (ctx) => {
		requireWasm(ctx);
		const { first } = await routePair(boxL, boxR);
		expect(minCornerDistance(first, boxL)).toBeGreaterThan(CORNER_CLEARANCE_TOL_PX);
	});

	it("WHEN two group boxes are offset diagonally THEN the target endpoint clears every corner of its box", async (ctx) => {
		requireWasm(ctx);
		const { last } = await routePair(boxL, boxR);
		expect(minCornerDistance(last, boxR)).toBeGreaterThan(CORNER_CLEARANCE_TOL_PX);
	});

	// The premise the whole non-exclusive-pin fix rests on, measured rather than asserted in
	// prose: libavoid derives a pin's exclusivity default from its visibility directions. If a
	// libavoid upgrade flips either default, the WHY block at `registerPinsForShape` stops
	// being true — and these fail instead of the pathology re-appearing silently in routes.
	const PROBE_BOX_PX = 100;
	const PROBE_PIN_CLASS = 1;
	const PROBE_PIN_FRAC = 0.5; // mid-side: the exclusivity default depends on visDirs only, not placement

	/**
	 * `isExclusive()` of a pin read immediately after construction, on a throwaway
	 * router. Teardown here mirrors `AvoidArena` by hand: the pin is ROUTER-owned (see
	 * AvoidArena's OWNERSHIP GOTCHA), so only the Points/Rectangle are destroyed and the
	 * Router last, and `processTransaction()` flushes the pending shape add first — WHY:
	 * the TEARDOWN PROTOCOL comment in `AvoidArena.dispose()`.
	 */
	function freshPinExclusivity(instance: Avoid, visDirs: number): boolean {
		const router = new instance.Router(instance.PolyLineRouting);
		const topLeft = new instance.Point(0, 0);
		const bottomRight = new instance.Point(PROBE_BOX_PX, PROBE_BOX_PX);
		const rectangle = new instance.Rectangle(topLeft, bottomRight);
		const shape = new instance.ShapeRef(router, rectangle);
		const pin = new instance.ShapeConnectionPin(shape, PROBE_PIN_CLASS, PROBE_PIN_FRAC, 0, true, 0, visDirs);
		const exclusive = pin.isExclusive();
		router.processTransaction();
		for (const owned of [topLeft, bottomRight, rectangle]) {
			instance.destroy(owned);
		}
		instance.destroy(router);
		return exclusive;
	}

	it("WHEN a directional boundary pin is constructed THEN libavoid defaults it to EXCLUSIVE", (ctx) => {
		const instance = requireWasm(ctx);
		expect(freshPinExclusivity(instance, instance.ConnDirUp)).toBe(true);
	});

	it("WHEN the ConnDirAll note centre pin is constructed THEN libavoid defaults it to NON-exclusive", (ctx) => {
		const instance = requireWasm(ctx);
		expect(freshPinExclusivity(instance, instance.ConnDirAll)).toBe(false);
	});

	// Pin-exhaustion guard (edge-routing__06 item (a)). Mechanism and measurements: see the
	// WHY block at `registerPinsForShape` in `edgeRouting.ts`. In short, exclusive pins are one
	// finite pool claimed by globally cheapest visible pin, so a crowded side spills onto the
	// WRONG side (the 8-edge test below) and a fully claimed 12-pin pool falls back to the shape
	// CENTRE (the 16-edge test). Routes are UNCLIPPED at this layer (GraphViewController clips
	// them later), so both failures are directly observable in the terminal point of the route.
	const FACING_SIDE_EDGE_COUNT = 8; // > 3 pins on the facing side: the crowd spills sideways
	const PIN_POOL_EXHAUSTING_EDGE_COUNT = 16; // > 12 pins on the box: libavoid falls back to the centre
	const GROUP_CENTRE_TOL_PX = 1; // a centre fallback lands ON the centre, not near it
	const tallGroup: RoutingObstacle = { id: "G", x: 400, y: 0, widthPx: 200, heightPx: 800, kind: "folder-group" };

	/**
	 * Terminal (group-side) point of every route in a scene of `edgeCount` leaf notes
	 * stacked down the LEFT of {@link tallGroup}, one edge each — so every edge's facing
	 * side is unambiguously the group's left border.
	 */
	async function crowdedSideTerminals(edgeCount: number): Promise<{ x: number; y: number }[]> {
		const leaves: RoutingObstacle[] = Array.from({ length: edgeCount }, (_unused, index) => ({
			id: `L${index}`,
			x: 100,
			y: Math.round(10 + (index * tallGroup.heightPx) / edgeCount),
			widthPx: 60,
			heightPx: 30,
			kind: "note",
		}));
		const routes = await new LibavoidEdgeRouter().route({
			obstacles: [tallGroup, ...leaves],
			shapeBufferPx: SHIPPED_CLEARANCE_PX,
			edges: leaves.map((leaf) => ({ id: `${leaf.id}->G`, sourceId: leaf.id, targetId: tallGroup.id })),
		});
		return leaves.map((leaf) => {
			const polyline = routes.get(`${leaf.id}->G`);
			if (polyline === undefined || polyline.length < 2) {
				throw new Error(`router produced no route for ${leaf.id}->G`);
			}
			const last = polyline[polyline.length - 1];
			if (last === undefined) {
				throw new Error(`route ${leaf.id}->G missing its terminal point`);
			}
			return last;
		});
	}

	it("WHEN more edges approach a group box than it has pins THEN no route terminates at the group centre", async (ctx) => {
		requireWasm(ctx);
		const centre = { x: tallGroup.x + tallGroup.widthPx / 2, y: tallGroup.y + tallGroup.heightPx / 2 };
		const terminals = await crowdedSideTerminals(PIN_POOL_EXHAUSTING_EDGE_COUNT);
		expect(terminals.filter((p) => Math.hypot(p.x - centre.x, p.y - centre.y) <= GROUP_CENTRE_TOL_PX)).toEqual([]);
	});

	it("WHEN eight edges approach the same side of a group box THEN every route still terminates on that facing side", async (ctx) => {
		requireWasm(ctx);
		const terminals = await crowdedSideTerminals(FACING_SIDE_EDGE_COUNT);
		expect(terminals.filter((p) => Math.abs(p.x - tallGroup.x) > FACING_BORDER_TOL_PX)).toEqual([]);
	});

	// The note CENTRE pin is the other half of the exclusivity decision, where the call is a
	// measured no-op today (see the WHY block at `registerPinsForShape`). This is therefore a
	// guard, not a fix — and it has teeth: force that pin exclusive (directly, or by giving it
	// a direction, which flips libavoid's default) and every spoke after the first loses its
	// pin and routes STRAIGHT THROUGH whatever lies between — 5 of the 6 spokes below do
	// exactly that when the pin is made exclusive.
	const HUB_SPOKE_COUNT = 6;
	const HUB_CENTRE = { x: 500, y: 400 };
	const SPOKE_RADIUS_PX = 400;
	const BLOCKER_RADIUS_PX = 200;
	const hubNote: RoutingObstacle = { id: "H", x: 470, y: 385, widthPx: 60, heightPx: 30, kind: "note" };

	/** Note squares (60x30) evenly around the hub, each shadowed by an 80x80 box mid-spoke. */
	function hubSpokes(): { leaves: RoutingObstacle[]; blockers: RoutingObstacle[] } {
		const leaves: RoutingObstacle[] = [];
		const blockers: RoutingObstacle[] = [];
		for (let index = 0; index < HUB_SPOKE_COUNT; index++) {
			const angle = (index / HUB_SPOKE_COUNT) * Math.PI * 2;
			const at = (radius: number): { x: number; y: number } => ({
				x: Math.round(HUB_CENTRE.x + Math.cos(angle) * radius),
				y: Math.round(HUB_CENTRE.y + Math.sin(angle) * radius),
			});
			const leaf = at(SPOKE_RADIUS_PX);
			const blocker = at(BLOCKER_RADIUS_PX);
			leaves.push({ id: `S${index}`, x: leaf.x - 30, y: leaf.y - 15, widthPx: 60, heightPx: 30, kind: "note" });
			blockers.push({ id: `X${index}`, x: blocker.x - 40, y: blocker.y - 40, widthPx: 80, heightPx: 80, kind: "note" });
		}
		return { leaves, blockers };
	}

	/**
	 * WHAT: Liang–Barsky clip of segment a→b against `rect` — true when they overlap at all.
	 * WHY not `isStrictlyInside`: a route that cuts through a box places NO waypoint inside
	 * it (it is one straight segment from end to end), so only a segment test can see it.
	 */
	function segmentCrosses(a: { x: number; y: number }, b: { x: number; y: number }, rect: RoutingObstacle): boolean {
		let tMin = 0;
		let tMax = 1;
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const clips: readonly (readonly [number, number])[] = [
			[-dx, a.x - rect.x],
			[dx, rect.x + rect.widthPx - a.x],
			[-dy, a.y - rect.y],
			[dy, rect.y + rect.heightPx - a.y],
		];
		for (const [edgeDir, edgeDist] of clips) {
			if (edgeDir === 0) {
				if (edgeDist < 0) {
					return false; // parallel to this edge and outside it
				}
				continue;
			}
			const t = edgeDist / edgeDir;
			if (edgeDir < 0) {
				if (t > tMax) {
					return false;
				}
				tMin = Math.max(tMin, t);
			} else {
				if (t < tMin) {
					return false;
				}
				tMax = Math.min(tMax, t);
			}
		}
		return tMax > tMin;
	}

	function routeCrosses(polyline: readonly { x: number; y: number }[], rect: RoutingObstacle): boolean {
		for (let i = 1; i < polyline.length; i++) {
			const from = polyline[i - 1];
			const to = polyline[i];
			if (from !== undefined && to !== undefined && segmentCrosses(from, to, rect)) {
				return true;
			}
		}
		return false;
	}

	it("WHEN several edges attach to the same note square THEN no route cuts through the boxes in between", async (ctx) => {
		requireWasm(ctx);
		const { leaves, blockers } = hubSpokes();
		const routes = await new LibavoidEdgeRouter().route({
			obstacles: [hubNote, ...leaves, ...blockers],
			shapeBufferPx: SHIPPED_CLEARANCE_PX,
			edges: leaves.map((leaf) => ({ id: `${leaf.id}->H`, sourceId: leaf.id, targetId: hubNote.id })),
		});
		const cutting = leaves.filter((leaf) => {
			const polyline = routes.get(`${leaf.id}->H`);
			if (polyline === undefined || polyline.length < 2) {
				throw new Error(`router produced no route for ${leaf.id}->H`);
			}
			return blockers.some((blocker) => routeCrosses(polyline, blocker));
		});
		expect(cutting.map((leaf) => leaf.id)).toEqual([]);
	});

	// Session-survival guard (ticket `edge-routing-a-throw-inside-route-kills-…`). A contract
	// violation must cost ONE pass, not the session: `route()` throws on an edge whose obstacle
	// was never registered, and `finally { arena.dispose() }` then destroys the Router. WITHOUT
	// THIS TEARDOWN FLUSH, that Router's shapes were never flushed by `processTransaction()`;
	// libavoid's `~Router` asserts `visGraph.size() == 0`, so the tear-down ABORTS the wasm
	// module — and `loadAvoid()` hands the same dead instance to every later pass, silently
	// degrading the whole session to straight edges. Only an assertion on a SUBSEQUENT pass can
	// tell "one pass failed" (correct) from "the module is dead" (the bug); the throw itself
	// looks identical either way.
	//
	// KEEP THE TWO TESTS BELOW LAST IN THIS DESCRIBE, and append new ones ABOVE this comment:
	// if the teardown flush ever regresses, the first `doomedPass()` aborts the shared wasm
	// instance and every test AFTER it fails for the wrong reason, hiding the real cause.
	const UNREGISTERED_OBSTACLE_ID = "NEVER_REGISTERED";

	/**
	 * One pass that must fail: its only edge names an obstacle that is never registered. The
	 * scene carries TWO obstacles on purpose — the abort needs at least two connection pins
	 * pending in the Router (measured: a Router holding a single pin, or none, tears down
	 * cleanly), so a one-obstacle scene would not exercise the teardown at all.
	 */
	function doomedPass(): Promise<EdgeRouteMap> {
		return new LibavoidEdgeRouter().route({
			obstacles: [nodeA, nodeB],
			edges: [{ id: "A->missing", sourceId: nodeA.id, targetId: UNREGISTERED_OBSTACLE_ID }],
			shapeBufferPx: SHIPPED_CLEARANCE_PX,
		});
	}

	/**
	 * Runs {@link doomedPass} and swallows ONLY its documented throw. A pass that does NOT
	 * throw means the premise has moved, so it fails loudly here rather than quietly turning
	 * the test below into a second copy of the plain routing tests.
	 */
	async function routeEdgeWithUnregisteredObstacle(): Promise<void> {
		try {
			await doomedPass();
		} catch {
			return; // expected: the pass-level failure whose AFTERMATH this test is about
		}
		throw new Error("premise broken: an edge referencing an unregistered obstacle routed without throwing");
	}

	// The other half of the same guard: the pass must fail with the diagnostic
	// `GraphViewController.resolveRoutes()` logs. A wasm abort raised inside
	// `finally { arena.dispose() }` REPLACES it (measured: `RangeError: Maximum call stack
	// size exceeded`), so the useful message is lost even before the session dies.
	it("WHEN a pass throws on an edge referencing an unregistered obstacle THEN it rejects with our own diagnostic error", async (ctx) => {
		requireWasm(ctx);
		await expect(doomedPass()).rejects.toThrow("references an obstacle with no registered shape");
	});

	it("WHEN a pass throws on an edge referencing an unregistered obstacle THEN a later pass still routes (the wasm module survives)", async (ctx) => {
		requireWasm(ctx);
		await routeEdgeWithUnregisteredObstacle();
		expect((await route()).length).toBeGreaterThan(2);
	});
});
