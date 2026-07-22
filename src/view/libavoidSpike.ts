// THROWAWAY — Phase 0 spike harness for ticket edge-routing__00-wasm-spike
// (nid_pgsj1vjjnmtflf55a4sd9txos_e). Proves libavoid-js routing works: obstacle
// avoidance (a), nested-shape endpoints (b), and repeated create/destroy (c).
// Phase 1 (`src/view/edgeRouting.ts`) replaces this; delete it then.
//
// The scenarios take an injected `Avoid` so the SAME logic runs two ways:
//   - vitest (libavoidSpike.test.ts) with the real WASM via the node build, and
//   - the dev-only Obsidian command in main.ts via the shipped base64/data-URL loader.
import type { Avoid, AvoidConnEnd, AvoidConnRef, AvoidPoint, AvoidRouter, AvoidShapeRef } from "./libavoidLoader";

/** A rectangle obstacle in absolute layout coordinates. */
export interface SpikeRect {
	readonly x1: number;
	readonly y1: number;
	readonly x2: number;
	readonly y2: number;
}

export interface RoutePoint {
	readonly x: number;
	readonly y: number;
}

/** Class id for the centre connection pins we attach to endpoint shapes (scenario b). */
const CENTRE_PIN_CLASS = 1;
/** Clearance kept around every obstacle (px). Named — no magic numbers. */
const SHAPE_BUFFER_PX = 4;

/**
 * Owns the libavoid bindings for one routing pass and frees them all in one sweep,
 * so a scenario cannot leak — or double-free — even on the throw path.
 *
 * OWNERSHIP GOTCHA (proven in the spike): the Router OWNS the ShapeRefs, ConnRefs,
 * and ShapeConnectionPins registered on it and frees them itself on `destroy(router)`.
 * Calling `destroy()` on a ShapeRef/ConnRef/pin ourselves DOUBLE-FREES → heap
 * corruption → "Maximum call stack size exceeded" / "program has already aborted".
 * So we only track the leaf objects WE own — Points, Rectangles, ConnEnds — and
 * destroy the Router last; router-owned objects are created but never tracked.
 */
class AvoidArena {
	/** Leaf objects we allocated and must free ourselves (Points, Rectangles, ConnEnds). */
	private readonly owned: unknown[] = [];
	private router: AvoidRouter | null = null;

	constructor(private readonly avoid: Avoid) {}

	newRouter(): AvoidRouter {
		const router = new this.avoid.Router(this.avoid.PolyLineRouting);
		this.router = router;
		return router;
	}

	point(x: number, y: number): AvoidPoint {
		const p = new this.avoid.Point(x, y);
		this.owned.push(p);
		return p;
	}

	connEnd(shapeOrPoint: AvoidShapeRef | AvoidPoint, classId?: number): AvoidConnEnd {
		const end =
			classId === undefined
				? new this.avoid.ConnEnd(shapeOrPoint)
				: new this.avoid.ConnEnd(shapeOrPoint, classId);
		this.owned.push(end);
		return end;
	}

	/** Registers an obstacle/endpoint rectangle shape (router-owned — not tracked for free). */
	shape(router: AvoidRouter, rect: SpikeRect): AvoidShapeRef {
		const topLeft = this.point(rect.x1, rect.y1);
		const bottomRight = this.point(rect.x2, rect.y2);
		const rectangle = new this.avoid.Rectangle(topLeft, bottomRight);
		this.owned.push(rectangle);
		return new this.avoid.ShapeRef(router, rectangle);
	}

	dispose(): void {
		for (const obj of this.owned) {
			this.avoid.destroy(obj);
		}
		this.owned.length = 0;
		if (this.router !== null) {
			this.avoid.destroy(this.router); // frees the ShapeRefs/ConnRefs/pins it owns
			this.router = null;
		}
	}
}

function readRoute(conn: AvoidConnRef): RoutePoint[] {
	const polyline = conn.displayRoute();
	const points: RoutePoint[] = [];
	for (let i = 0; i < polyline.size(); i++) {
		const p = polyline.get_ps(i);
		points.push({ x: p.x, y: p.y });
	}
	return points;
}

/** True when the point is STRICTLY inside the rect (a small epsilon keeps boundary points out). */
export function isStrictlyInside(point: RoutePoint, rect: SpikeRect): boolean {
	const eps = 0.01;
	return (
		point.x > rect.x1 + eps && point.x < rect.x2 - eps && point.y > rect.y1 + eps && point.y < rect.y2 - eps
	);
}

export interface ObstacleScenarioResult {
	readonly points: RoutePoint[];
	readonly pointCount: number;
	readonly anyPointInsideObstacle: boolean;
}

/**
 * Scenario (a): a connector from (0,50) to (200,50) with a rectangle obstacle
 * straddling the straight line. A correct route bends around it: >2 points, none inside.
 */
export function runObstacleScenario(avoid: Avoid): ObstacleScenarioResult {
	const arena = new AvoidArena(avoid);
	const router = arena.newRouter();
	try {
		router.setRoutingParameter(avoid.shapeBufferDistance, SHAPE_BUFFER_PX);
		const obstacle: SpikeRect = { x1: 80, y1: 20, x2: 120, y2: 80 };
		arena.shape(router, obstacle);
		const src = arena.connEnd(arena.point(0, 50));
		const dst = arena.connEnd(arena.point(200, 50));
		const conn = new avoid.ConnRef(router, src, dst); // router-owned
		router.processTransaction();
		const points = readRoute(conn);
		return {
			points,
			pointCount: points.length,
			anyPointInsideObstacle: points.some((p) => isStrictlyInside(p, obstacle)),
		};
	} finally {
		arena.dispose();
	}
}

export interface NestedScenarioResult {
	readonly points: RoutePoint[];
	readonly pointCount: number;
	readonly startsAtChildCentre: boolean;
	readonly avoidsOutsideObstacle: boolean;
}

/**
 * Scenario (b): a child shape NESTED inside a group container, connected (via a
 * centre pin) to a shape OUTSIDE the group, with a separate obstacle between them.
 * Mirrors our subflow/folder-group structure. A sane route starts at the child
 * centre, crosses its own enclosing group, and avoids the outside obstacle.
 */
export function runNestedScenario(avoid: Avoid): NestedScenarioResult {
	const arena = new AvoidArena(avoid);
	const router = arena.newRouter();
	try {
		router.setRoutingParameter(avoid.shapeBufferDistance, SHAPE_BUFFER_PX);
		const group: SpikeRect = { x1: 100, y1: 100, x2: 300, y2: 300 };
		const child: SpikeRect = { x1: 150, y1: 150, x2: 200, y2: 200 };
		const outside: SpikeRect = { x1: 500, y1: 160, x2: 540, y2: 200 };
		const blocker: SpikeRect = { x1: 360, y1: 120, x2: 400, y2: 260 };

		arena.shape(router, group);
		const childShape = arena.shape(router, child);
		const outsideShape = arena.shape(router, outside);
		arena.shape(router, blocker);

		// Shape-attached endpoints need a connection pin; a proportional (0.5,0.5)
		// centre pin makes the connector originate/terminate at the shape centre.
		// Pins are owned by their shape (and thus the router) — never destroyed by us.
		new avoid.ShapeConnectionPin(childShape, CENTRE_PIN_CLASS, 0.5, 0.5, true, 0, avoid.ConnDirAll);
		new avoid.ShapeConnectionPin(outsideShape, CENTRE_PIN_CLASS, 0.5, 0.5, true, 0, avoid.ConnDirAll);
		const src = arena.connEnd(childShape, CENTRE_PIN_CLASS);
		const dst = arena.connEnd(outsideShape, CENTRE_PIN_CLASS);
		const conn = new avoid.ConnRef(router, src, dst); // router-owned
		router.processTransaction();

		const points = readRoute(conn);
		const childCentre: RoutePoint = { x: (child.x1 + child.x2) / 2, y: (child.y1 + child.y2) / 2 };
		const first = points[0];
		return {
			points,
			pointCount: points.length,
			startsAtChildCentre: first !== undefined && first.x === childCentre.x && first.y === childCentre.y,
			avoidsOutsideObstacle: !points.some((p) => isStrictlyInside(p, blocker)),
		};
	} finally {
		arena.dispose();
	}
}

export interface StressLoopResult {
	readonly iterations: number;
	readonly completed: number;
	readonly allProducedValidRoute: boolean;
}

/**
 * Scenario (c): run create-router/route/destroy `iterations` times. Proves the
 * WebIDL memory-cleanup pattern survives the repeated view open/close churn Phase 1
 * will drive, with no crash and a stable result every iteration.
 */
export function runStressLoop(avoid: Avoid, iterations: number): StressLoopResult {
	let completed = 0;
	let allValid = true;
	for (let i = 0; i < iterations; i++) {
		const result = runObstacleScenario(avoid);
		completed++;
		if (result.pointCount < 2) {
			allValid = false;
		}
	}
	return { iterations, completed, allProducedValidRoute: allValid };
}
