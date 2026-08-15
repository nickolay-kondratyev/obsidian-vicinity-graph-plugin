import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { TestContext } from "vitest";
import { GROUP_BOX_PADDING_PX } from "./constants";
import { LibavoidEdgeRouter, PIERCE_PIN_CLASS, PIN_CLASS } from "./edgeRouting";
import type {
	EdgeRouteMap,
	EdgeRoutingInput,
	PassRouter,
	RoutedPoint,
	RoutingObstacle,
	RoutingPassInput,
} from "./edgeRouting";
import {
	HierarchicalEdgeRouter,
	deriveObstacleContainment,
	planHierarchicalRouting,
} from "./hierarchicalEdgeRouting";
import type { Avoid } from "./libavoidLoader";

// Same seam-mock as edgeRouting.test.ts: the leaf dynamically imports the browser
// loader, unresolvable under vitest, so the real-wasm block below points it at the
// node build. The fake-router tests never touch it.
const { loadAvoidMock } = vi.hoisted(() => ({ loadAvoidMock: vi.fn() }));
vi.mock("./libavoidLoader", () => ({ loadAvoid: loadAvoidMock }));

const CLEARANCE_PX = 8;

function note(id: string, x: number, y: number, widthPx: number, heightPx: number): RoutingObstacle {
	return { id, x, y, widthPx, heightPx, kind: "note" };
}

function group(id: string, x: number, y: number, widthPx: number, heightPx: number): RoutingObstacle {
	return { id, x, y, widthPx, heightPx, kind: "folder-group" };
}

function inputOf(obstacles: RoutingObstacle[], edges: EdgeRoutingInput["edges"]): EdgeRoutingInput {
	return { obstacles, edges, shapeBufferPx: CLEARANCE_PX };
}

/**
 * Records every pass it is asked to route and answers with a straight 2-point route
 * between each endpoint's REPRESENTATIVE point (a point end → itself, a shape end →
 * that obstacle's centre in the pass). Enough to drive the orchestration and to assert
 * WHICH passes were built; geometric avoidance is covered by the real-wasm block.
 */
class RecordingPassRouter implements PassRouter {
	readonly passes: RoutingPassInput[] = [];

	async routePass(input: RoutingPassInput): Promise<EdgeRouteMap> {
		this.passes.push(input);
		const byId = new Map(input.obstacles.map((o) => [o.id, o]));
		const routes = new Map<string, readonly RoutedPoint[]>();
		for (const edge of input.edges) {
			routes.set(edge.id, [representativeOf(edge.source, byId), representativeOf(edge.target, byId)]);
		}
		return routes;
	}
}

function representativeOf(
	endpoint: RoutingPassInput["edges"][number]["source"],
	byId: ReadonlyMap<string, RoutingObstacle>,
): RoutedPoint {
	if (endpoint.kind === "point") {
		return { x: endpoint.x, y: endpoint.y };
	}
	const obstacle = byId.get(endpoint.obstacleId);
	if (obstacle === undefined) {
		return { x: 0, y: 0 };
	}
	return { x: obstacle.x + obstacle.widthPx / 2, y: obstacle.y + obstacle.heightPx / 2 };
}

describe("deriveObstacleContainment", () => {
	// T ⊃ M ⊃ D, plus a note directly in T and one directly in M; X is top-level.
	const T = group("T", 0, 0, 500, 400);
	const M = group("M", 200, 150, 250, 200);
	const D = group("D", 350, 200, 60, 80);
	const nT = note("nT", 50, 200, 40, 40);
	const nM = note("nM", 220, 300, 40, 40);
	const X = note("X", -200, 200, 40, 40);
	const containment = deriveObstacleContainment([T, M, D, nT, nM, X]);

	it("WHEN a box is nested two deep THEN its ancestors list the containers outermost-first", () => {
		expect(containment.ancestorsOf("D")).toEqual(["T", "M"]);
	});

	it("WHEN a note sits directly in the outer box THEN only that box is its ancestor", () => {
		expect(containment.ancestorsOf("nT")).toEqual(["T"]);
	});

	it("WHEN an obstacle is top-level THEN it has no ancestors", () => {
		expect(containment.ancestorsOf("X")).toEqual([]);
	});

	it("WHEN listing a container's direct children THEN only its IMMEDIATE children appear", () => {
		expect([...containment.directChildrenOf("T")].sort()).toEqual(["M", "nT"]);
	});

	it("WHEN a mid box nests a deeper box THEN that deeper box is the mid box's direct child", () => {
		expect([...containment.directChildrenOf("M")].sort()).toEqual(["D", "nM"]);
	});
});

describe("planHierarchicalRouting classification", () => {
	it("WHEN no obstacle nests another THEN no edge pierces (single-pass, byte-identical regime)", () => {
		const plan = planHierarchicalRouting(
			inputOf([note("A", 0, 0, 20, 20), note("B", 200, 0, 20, 20)], [{ id: "A->B", sourceId: "A", targetId: "B" }]),
		);
		expect(plan.hasPiercing).toBe(false);
	});

	it("WHEN no edge pierces THEN every outer endpoint stays on the normal pin class", () => {
		const plan = planHierarchicalRouting(
			inputOf([note("A", 0, 0, 20, 20), note("B", 200, 0, 20, 20)], [{ id: "A->B", sourceId: "A", targetId: "B" }]),
		);
		const edge = plan.outerPass.edges[0];
		expect(edge?.source).toEqual({ kind: "shape", obstacleId: "A", pinClass: PIN_CLASS });
	});

	it("WHEN no edge pierces THEN no obstacle is asked to register pierce pins", () => {
		const plan = planHierarchicalRouting(
			inputOf(
				[group("G", 0, 0, 200, 200), note("A", 250, 40, 20, 20), note("B", 500, 0, 20, 20)],
				[{ id: "A->B", sourceId: "A", targetId: "B" }],
			),
		);
		expect(plan.outerPass.obstacles.some((o) => o.registerPierceEntryPins === true)).toBe(false);
	});

	it("WHEN an endpoint sits inside a box the other endpoint is outside THEN the edge pierces that box", () => {
		const plan = planHierarchicalRouting(
			inputOf(
				[group("T", 0, 0, 400, 300), group("D", 300, 140, 60, 100), note("X", -200, 140, 40, 40)],
				[{ id: "X->D", sourceId: "X", targetId: "D" }],
			),
		);
		expect(plan.hasPiercing).toBe(true);
	});

	it("WHEN the target pierces a box THEN the outer edge targets that box on the pierce pin class", () => {
		const plan = planHierarchicalRouting(
			inputOf(
				[group("T", 0, 0, 400, 300), group("D", 300, 140, 60, 100), note("X", -200, 140, 40, 40)],
				[{ id: "X->D", sourceId: "X", targetId: "D" }],
			),
		);
		const edge = plan.outerPass.edges[0];
		expect(edge?.target).toEqual({ kind: "shape", obstacleId: "T", pinClass: PIERCE_PIN_CLASS });
	});

	it("WHEN the target pierces a box THEN that box is flagged to register pierce pins in the outer pass", () => {
		const plan = planHierarchicalRouting(
			inputOf(
				[group("T", 0, 0, 400, 300), group("D", 300, 140, 60, 100), note("X", -200, 140, 40, 40)],
				[{ id: "X->D", sourceId: "X", targetId: "D" }],
			),
		);
		expect(plan.outerPass.obstacles.find((o) => o.id === "T")?.registerPierceEntryPins).toBe(true);
	});

	it("WHEN two notes share a group box (intra-group) THEN neither endpoint pierces it", () => {
		// Both notes are direct children of G, so the edge is a passthrough, NOT piercing —
		// it is routed by G's own INTERIOR pass instead (ticket nid_6qk78tgfvwzhgb5xru63hu7n3_e).
		const plan = planHierarchicalRouting(
			inputOf(
				[group("G", 0, 0, 300, 300), note("a", 40, 60, 20, 20), note("b", 240, 240, 20, 20)],
				[{ id: "a->b", sourceId: "a", targetId: "b" }],
			),
		);
		expect(plan.hasPiercing).toBe(false);
	});

	it("WHEN two notes share their immediate parent box THEN the edge is planned as intra-group for that box", () => {
		const plan = planHierarchicalRouting(
			inputOf(
				[group("G", 0, 0, 300, 300), note("a", 40, 60, 20, 20), note("b", 240, 240, 20, 20)],
				[{ id: "a->b", sourceId: "a", targetId: "b" }],
			),
		);
		expect(plan.intraGroupEdges).toEqual([{ id: "a->b", containerId: "G", sourceId: "a", targetId: "b" }]);
	});

	it("WHEN an edge is intra-group THEN it is kept OUT of the outer pass", () => {
		const plan = planHierarchicalRouting(
			inputOf(
				[group("G", 0, 0, 300, 300), note("a", 40, 60, 20, 20), note("b", 240, 240, 20, 20)],
				[{ id: "a->b", sourceId: "a", targetId: "b" }],
			),
		);
		expect(plan.outerPass.edges).toHaveLength(0);
	});

	it("WHEN both endpoints are top-level THEN the edge is NOT intra-group", () => {
		const plan = planHierarchicalRouting(
			inputOf([note("A", 0, 0, 20, 20), note("B", 200, 0, 20, 20)], [{ id: "A->B", sourceId: "A", targetId: "B" }]),
		);
		expect(plan.intraGroupEdges).toEqual([]);
	});

	it("WHEN the endpoints sit in DIFFERENT boxes THEN the edge is NOT intra-group", () => {
		// a lives in G, b in H — different immediate parents, so this is a piercing edge.
		const plan = planHierarchicalRouting(
			inputOf(
				[group("G", 0, 0, 200, 200), group("H", 400, 0, 200, 200), note("a", 40, 60, 20, 20), note("b", 440, 60, 20, 20)],
				[{ id: "a->b", sourceId: "a", targetId: "b" }],
			),
		);
		expect(plan.intraGroupEdges).toEqual([]);
	});

	it("WHEN an edge points from a member to its OWN group box THEN it is NOT intra-group", () => {
		const plan = planHierarchicalRouting(
			inputOf(
				[group("G", 0, 0, 300, 300), note("a", 40, 60, 20, 20)],
				[{ id: "a->G", sourceId: "a", targetId: "G" }],
			),
		);
		expect(plan.intraGroupEdges).toEqual([]);
	});
});

describe("HierarchicalEdgeRouter pass composition (fake leaf)", () => {
	it("WHEN nothing pierces THEN exactly ONE pass runs (the outer pass)", async () => {
		const leaf = new RecordingPassRouter();
		await new HierarchicalEdgeRouter(leaf).route(
			inputOf([note("A", 0, 0, 20, 20), note("B", 200, 0, 20, 20)], [{ id: "A->B", sourceId: "A", targetId: "B" }]),
		);
		expect(leaf.passes).toHaveLength(1);
	});

	// T ⊃ M ⊃ D two-level scene; X top-level to the left. Edge X→D pierces T then M.
	const scene: EdgeRoutingInput = inputOf(
		[
			group("T", 0, 0, 500, 400),
			group("M", 200, 150, 250, 200),
			group("D", 350, 200, 60, 80),
			note("nT", 50, 200, 40, 40),
			note("nM", 220, 300, 40, 40),
			note("X", -200, 200, 40, 40),
		],
		[{ id: "X->D", sourceId: "X", targetId: "D" }],
	);

	it("WHEN a target pierces two levels THEN one inner pass runs per pierced container (outer + 2)", async () => {
		const leaf = new RecordingPassRouter();
		await new HierarchicalEdgeRouter(leaf).route(scene);
		expect(leaf.passes).toHaveLength(3);
	});

	it("WHEN descending into a container THEN its inner pass carries that container's direct children plus a title strip", async () => {
		const leaf = new RecordingPassRouter();
		await new HierarchicalEdgeRouter(leaf).route(scene);
		const tPass = leaf.passes[1];
		expect([...(tPass?.obstacles ?? [])].map((o) => o.id).sort()).toEqual(["M", "T::title-strip", "nT"]);
	});

	it("WHEN a container's inner pass includes its title band THEN that strip's height is the top padding", async () => {
		const leaf = new RecordingPassRouter();
		await new HierarchicalEdgeRouter(leaf).route(scene);
		const strip = leaf.passes[1]?.obstacles.find((o) => o.kind === "title-strip");
		expect(strip?.heightPx).toBe(GROUP_BOX_PADDING_PX.top);
	});

	it("WHEN the descent reaches the innermost pierced box THEN the deepest inner pass targets the final group on the pierce class", async () => {
		const leaf = new RecordingPassRouter();
		await new HierarchicalEdgeRouter(leaf).route(scene);
		const deepest = leaf.passes[2]?.edges[0];
		expect(deepest?.target).toEqual({ kind: "shape", obstacleId: "D", pinClass: PIERCE_PIN_CLASS });
	});

	it("WHEN an inner pass starts THEN its edge leaves from the border point the previous pass ended on", async () => {
		const leaf = new RecordingPassRouter();
		await new HierarchicalEdgeRouter(leaf).route(scene);
		// The fake ends the outer route at T's centre; the T inner pass must start there.
		const source = leaf.passes[1]?.edges[0]?.source;
		expect(source).toEqual({ kind: "point", x: 250, y: 200 });
	});

	it("WHEN the whole descent finishes THEN the stitched route runs from source, through the border hand-offs, to the deep target", async () => {
		const leaf = new RecordingPassRouter();
		const routes = await new HierarchicalEdgeRouter(leaf).route(scene);
		// X centre (-180,220) → T centre (250,200) → M centre (325,250) → D centre (380,240).
		expect(routes.get("X->D")).toEqual([
			{ x: -180, y: 220 },
			{ x: 250, y: 200 },
			{ x: 325, y: 250 },
			{ x: 380, y: 240 },
		]);
	});

	// Intra-group scene: a and b are both direct members of G; s straddles between them.
	const intraScene: EdgeRoutingInput = inputOf(
		[group("G", 0, 0, 300, 300), note("a", 40, 60, 20, 20), note("s", 140, 140, 20, 20), note("b", 240, 240, 20, 20)],
		[{ id: "a->b", sourceId: "a", targetId: "b" }],
	);

	it("WHEN an edge is intra-group THEN exactly TWO passes run (outer + the shared container's interior pass)", async () => {
		const leaf = new RecordingPassRouter();
		await new HierarchicalEdgeRouter(leaf).route(intraScene);
		expect(leaf.passes).toHaveLength(2);
	});

	it("WHEN the interior pass runs THEN its obstacles are the container's direct children plus its title strip", async () => {
		const leaf = new RecordingPassRouter();
		await new HierarchicalEdgeRouter(leaf).route(intraScene);
		expect([...(leaf.passes[1]?.obstacles ?? [])].map((o) => o.id).sort()).toEqual(["G::title-strip", "a", "b", "s"]);
	});

	it("WHEN the interior pass routes a member-to-member edge THEN both ends attach to the member notes on the normal pin class", async () => {
		const leaf = new RecordingPassRouter();
		await new HierarchicalEdgeRouter(leaf).route(intraScene);
		expect(leaf.passes[1]?.edges[0]).toEqual({
			id: "a->b",
			source: { kind: "shape", obstacleId: "a", pinClass: PIN_CLASS },
			target: { kind: "shape", obstacleId: "b", pinClass: PIN_CLASS },
		});
	});

	it("WHEN an intra-group edge is routed THEN the returned map carries the interior pass's route under the edge's own id", async () => {
		const leaf = new RecordingPassRouter();
		const routes = await new HierarchicalEdgeRouter(leaf).route(intraScene);
		// The fake routes a's centre (50,70) → b's centre (250,250).
		expect(routes.get("a->b")).toEqual([
			{ x: 50, y: 70 },
			{ x: 250, y: 250 },
		]);
	});

	it("WHEN two intra-group edges share their container THEN both ride ONE interior pass", async () => {
		const leaf = new RecordingPassRouter();
		await new HierarchicalEdgeRouter(leaf).route(
			inputOf(
				[group("G", 0, 0, 300, 300), note("a", 40, 60, 20, 20), note("s", 140, 140, 20, 20), note("b", 240, 240, 20, 20)],
				[
					{ id: "a->b", sourceId: "a", targetId: "b" },
					{ id: "a->s", sourceId: "a", targetId: "s" },
				],
			),
		);
		expect(leaf.passes).toHaveLength(2);
	});

	it("WHEN the interior pass FAILS THEN the intra-group edge degrades to a straight centre-to-centre leg (not gone)", async () => {
		const leaf = new (class extends RecordingPassRouter {
			override async routePass(input: RoutingPassInput): Promise<EdgeRouteMap> {
				const isInterior = input.obstacles.some((o) => o.kind === "title-strip");
				if (isInterior) {
					throw new Error("interior pass failure");
				}
				return super.routePass(input);
			}
		})();
		const routes = await new HierarchicalEdgeRouter(leaf).route(intraScene);
		expect(routes.get("a->b")).toEqual([
			{ x: 50, y: 70 },
			{ x: 250, y: 250 },
		]);
	});
});

describe("HierarchicalEdgeRouter with real wasm", () => {
	const require = createRequire(import.meta.url);
	const LIBAVOID_NODE_BUILD = require.resolve("libavoid-js");
	let avoid: Avoid | null = null;

	beforeAll(async () => {
		try {
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

	function requireWasm(ctx: TestContext): void {
		if (avoid === null) {
			ctx.skip("the libavoid node wasm build did not load in this environment");
		}
	}

	function isStrictlyInside(point: RoutedPoint, rect: RoutingObstacle): boolean {
		const eps = 0.01;
		return (
			point.x > rect.x + eps &&
			point.x < rect.x + rect.widthPx - eps &&
			point.y > rect.y + eps &&
			point.y < rect.y + rect.heightPx - eps
		);
	}

	async function routePierced(scene: EdgeRoutingInput, edgeId: string): Promise<readonly RoutedPoint[]> {
		const routes = await new HierarchicalEdgeRouter(new LibavoidEdgeRouter()).route(scene);
		const route = routes.get(edgeId);
		if (route === undefined) {
			throw new Error(`no route for ${edgeId}`);
		}
		return route;
	}

	// T box 0..400 × 0..300. Inner note "n1" straddles the straight path from an external
	// left endpoint to the deep group "D" on T's right. Title band = T's top 36px.
	const T = group("T", 0, 0, 400, 300);
	const D = group("D", 300, 130, 60, 100);
	const n1 = note("n1", 150, 120, 40, 40);
	const titleStrip: RoutingObstacle = { id: "strip", x: 0, y: 0, widthPx: 400, heightPx: GROUP_BOX_PADDING_PX.top, kind: "title-strip" };

	it("WHEN a piercing edge crosses an inner note THEN no routed waypoint falls inside that note", async (ctx) => {
		requireWasm(ctx);
		const X = note("X", -200, 140, 40, 40);
		const scene = inputOf([T, D, n1, X], [{ id: "X->D", sourceId: "X", targetId: "D" }]);
		const route = await routePierced(scene, "X->D");
		expect(route.some((p) => isStrictlyInside(p, n1))).toBe(false);
	});

	it("WHEN a piercing edge enters a group THEN no routed waypoint falls inside its title band", async (ctx) => {
		requireWasm(ctx);
		const X = note("X", -200, 140, 40, 40);
		const scene = inputOf([T, D, n1, X], [{ id: "X->D", sourceId: "X", targetId: "D" }]);
		const route = await routePierced(scene, "X->D");
		expect(route.some((p) => isStrictlyInside(p, titleStrip))).toBe(false);
	});

	it("WHEN the outer endpoint is directly ABOVE the group THEN the edge does NOT enter through the top/title side", async (ctx) => {
		requireWasm(ctx);
		// X sits above T; the only straight way in is the title side, which pierce pins forbid.
		const X = note("X", 180, -220, 40, 40);
		const scene = inputOf([T, D, n1, X], [{ id: "X->D", sourceId: "X", targetId: "D" }]);
		const route = await routePierced(scene, "X->D");
		// Every waypoint that lies within T's horizontal span and at/above the title band's
		// bottom edge would mean the route came in over the title. The border crossing must be
		// on a side (x≈0 or x≈400) or the bottom, never across the top band.
		const crossedTopBand = route.some(
			(p) => p.x > T.x + 1 && p.x < T.x + T.widthPx - 1 && p.y < T.y + GROUP_BOX_PADDING_PX.top && p.y > T.y - 1,
		);
		expect(crossedTopBand).toBe(false);
	});

	it("WHEN an intra-group edge crosses a sibling note THEN no routed waypoint falls inside that sibling", async (ctx) => {
		requireWasm(ctx);
		// a (top-left) → b (bottom-right) inside T; sibling s1 straddles the straight diagonal.
		const a = note("a", 30, 60, 40, 40);
		const s1 = note("s1", 170, 130, 40, 40);
		const b = note("b", 320, 220, 40, 40);
		const scene = inputOf([T, a, s1, b], [{ id: "a->b", sourceId: "a", targetId: "b" }]);
		const route = await routePierced(scene, "a->b");
		expect(route.some((p) => isStrictlyInside(p, s1))).toBe(false);
	});

	it("WHEN an intra-group edge would cut the title band THEN no routed waypoint falls inside it", async (ctx) => {
		requireWasm(ctx);
		// Both members hug T's top edge just below the title band, with a sibling between
		// them: the shortest detour around s1 is UP through the band, which must be blocked.
		const a = note("a", 20, 40, 40, 40);
		const s1 = note("s1", 170, 40, 40, 40);
		const b = note("b", 330, 40, 40, 40);
		const scene = inputOf([T, a, s1, b], [{ id: "a->b", sourceId: "a", targetId: "b" }]);
		const route = await routePierced(scene, "a->b");
		expect(route.some((p) => isStrictlyInside(p, titleStrip))).toBe(false);
	});

	it("WHEN nothing pierces THEN the hierarchical router reproduces the leaf's own route byte-for-byte", async (ctx) => {
		requireWasm(ctx);
		const A = group("A", 0, 0, 100, 100);
		const B = group("B", 300, 0, 100, 100);
		const scene = inputOf([A, B], [{ id: "A->B", sourceId: "A", targetId: "B" }]);
		const viaLeaf = await new LibavoidEdgeRouter().route(scene);
		const viaHierarchy = await new HierarchicalEdgeRouter(new LibavoidEdgeRouter()).route(scene);
		expect(viaHierarchy.get("A->B")).toEqual(viaLeaf.get("A->B"));
	});
});
