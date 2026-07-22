import { EDGE_PAIR_CURVATURE_PX } from "./edgeGeometry";
import type { Avoid, AvoidConnEnd, AvoidConnRef, AvoidPoint, AvoidRouter, AvoidShapeRef } from "./libavoidLoader";
import type { Dimensions, FlowEdge, FlowNode, XY } from "./flowMapping";

/**
 * Post-layout obstacle-avoiding edge routing (ticket edge-routing__01). Pure of
 * React Flow (only `.tsx` files import `@xyflow/react`) and node-testable like
 * `elkMapping`/`flowMapping`. The libavoid wasm binding is confined to
 * {@link LibavoidEdgeRouter}; the extraction half ({@link extractEdgeRoutingInput})
 * is a pure function testable without wasm.
 *
 * DIP: callers depend on {@link EdgeRouter}; tests inject a fake, production wires
 * {@link LibavoidEdgeRouter}.
 */

/** A routed waypoint in ABSOLUTE layout coordinates (same space as extractElkPositions). */
export interface RoutedPoint {
	readonly x: number;
	readonly y: number;
}

/** An obstacle rectangle the router must route around, in ABSOLUTE top-left coordinates. */
export interface RoutingObstacle {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly widthPx: number;
	readonly heightPx: number;
}

/** An edge to route: endpoints reference {@link RoutingObstacle.id}s (note squares or group boxes). */
export interface RoutingEdge {
	readonly id: string;
	readonly sourceId: string;
	readonly targetId: string;
}

export interface EdgeRoutingInput {
	readonly obstacles: readonly RoutingObstacle[];
	readonly edges: readonly RoutingEdge[];
}

/** Routed polyline per edge id. Edges the router could not route are simply absent. */
export type EdgeRouteMap = ReadonlyMap<string, readonly RoutedPoint[]>;

/** The routing seam (DIP). */
export interface EdgeRouter {
	route(input: EdgeRoutingInput): Promise<EdgeRouteMap>;
}

/**
 * Clearance libavoid keeps around every obstacle. Derived from the hand-drawn
 * paired-edge bow ({@link EDGE_PAIR_CURVATURE_PX}) so routed detours read at a
 * comparable visual scale: half the curvature = 17px, comfortably beyond the
 * arrowhead's minimum inset (`EDGE_ARROWHEAD_INSET_MIN_PX = 14px`) so a route
 * clears a box further out than the arrowhead ever sits, yet small relative to
 * inter-node spacing (min node 40px, layouts space centres hundreds of px apart)
 * so dense vicinities don't detour absurdly. Kept at 17px after the edge-routing__03
 * tuning pass: screenshots on the sparse/medium/dense dev-vault fixtures showed
 * routes clearing boxes cleanly without ballooning — see that ticket's PUBLIC notes.
 */
export const EDGE_ROUTING_SHAPE_BUFFER_PX = EDGE_PAIR_CURVATURE_PX / 2;

/**
 * Cost libavoid adds per connector SEGMENT beyond the first, in the same length
 * units as the route (so ~50px of virtual length per extra bend). A positive
 * penalty makes the router prefer a straight shot and only introduce a bend when
 * detouring saves more than the penalty — killing spurious near-collinear
 * zig-zags so routes read calm. 50 is libavoid's own documented example value;
 * on the dev-vault fixtures it removed jitter without suppressing the genuine
 * obstacle detours (tuned in edge-routing__03).
 */
export const EDGE_ROUTING_SEGMENT_PENALTY_PX = 50;

/**
 * Cost libavoid adds per edge-edge CROSSING. DISABLED (0) after the edge-routing__03
 * perf pass: crossing avoidance is the expensive part of libavoid's search (it is
 * ~O(connectors²) in the crossing check, incurred for ANY positive value — it is
 * NOT paid only "when cheap"). On the ~100-node / ~292-edge dense fixture a value of
 * 100 pushed the routing pass to ~1700ms — above the elk+d3 layout time — whereas 0
 * kept it at ~140ms under the default force layout (well under the ~1460ms layout).
 * The segment penalty above already calms routes; crossing minimisation buys little
 * extra on these hub-shaped vicinities for a cost the interactive rebuild can't
 * afford. Kept as a NAMED knob (not deleted) so the tuning decision is explicit and
 * a future web-worker offload (deferred) can revisit it. See edge-routing__03 PUBLIC.
 */
export const EDGE_ROUTING_CROSSING_PENALTY_PX = 0;

/**
 * Extracts the router's input from the SAME post-layout data the publish step
 * consumes: the flow node set (authoritative obstacle set), the final collapsed
 * edge list, and the ABSOLUTE positions/dimensions maps (pre-`withPositions`, so
 * nested group children compare in one shared space).
 *
 * Obstacles:
 * - note squares → `FlowNode.width/height` (= engine `sizePx`) at their absolute position;
 * - folder-group containers → elk-computed `groupDimensions` at their absolute position.
 *
 * Edge attachment is already resolved by `buildFlowEdges`: a collapsed edge's
 * source/target are folder-group ids (→ group box obstacle); a passthrough
 * intra-group edge's are member note paths (→ child-square obstacle). So no
 * per-edge group logic is needed here — the ids line up with the obstacles.
 *
 * A node lacking a position (or a group lacking dimensions) is skipped as an
 * obstacle; an edge whose endpoint is not among the emitted obstacles is dropped
 * from the routing input (defines valid input — post-layout this never fires
 * because every flow node has a position).
 */
export function extractEdgeRoutingInput(input: {
	readonly nodes: readonly FlowNode[];
	readonly edges: readonly FlowEdge[];
	readonly positions: ReadonlyMap<string, XY>;
	readonly groupDimensions: ReadonlyMap<string, Dimensions>;
}): EdgeRoutingInput {
	const obstacles: RoutingObstacle[] = [];
	const obstacleIds = new Set<string>();
	for (const node of input.nodes) {
		const position = input.positions.get(node.id);
		if (position === undefined) {
			continue;
		}
		if (node.kind === "folder-group") {
			const size = input.groupDimensions.get(node.id);
			if (size === undefined) {
				continue;
			}
			obstacles.push({ id: node.id, x: position.x, y: position.y, widthPx: size.width, heightPx: size.height });
		} else {
			obstacles.push({ id: node.id, x: position.x, y: position.y, widthPx: node.width, heightPx: node.height });
		}
		obstacleIds.add(node.id);
	}
	const edges: RoutingEdge[] = [];
	for (const edge of input.edges) {
		if (!obstacleIds.has(edge.source) || !obstacleIds.has(edge.target)) {
			continue;
		}
		edges.push({ id: edge.id, sourceId: edge.source, targetId: edge.target });
	}
	return { obstacles, edges };
}

/** Class id for the centre connection pins attached to endpoint shapes. */
const CENTRE_PIN_CLASS = 1;

/** Proportional pin at the shape centre (0.5, 0.5) so connectors originate/terminate there. */
const PIN_CENTRE_FRACTION = 0.5;

interface AvoidRect {
	readonly x1: number;
	readonly y1: number;
	readonly x2: number;
	readonly y2: number;
}

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

	private point(x: number, y: number): AvoidPoint {
		const p = new this.avoid.Point(x, y);
		this.owned.push(p);
		return p;
	}

	connEnd(shape: AvoidShapeRef, classId: number): AvoidConnEnd {
		const end = new this.avoid.ConnEnd(shape, classId);
		this.owned.push(end);
		return end;
	}

	/** Registers an obstacle rectangle shape (router-owned — not tracked for free). */
	shape(router: AvoidRouter, rect: AvoidRect): AvoidShapeRef {
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

function readRoute(conn: AvoidConnRef): RoutedPoint[] {
	const polyline = conn.displayRoute();
	const points: RoutedPoint[] = [];
	for (let i = 0; i < polyline.size(); i++) {
		const p = polyline.get_ps(i);
		points.push({ x: p.x, y: p.y });
	}
	return points;
}

/**
 * The libavoid implementation of {@link EdgeRouter}. One `Avoid.Router` per pass
 * (PolyLine routing), obstacles as Rectangle+ShapeRef with a centre pin, endpoints
 * SHAPE-ATTACHED via `ConnEnd(shapeRef, classId)` (so a source/target box does not
 * block its own edge), a single `processTransaction()`, then `displayRoute()` per
 * connector. All allocation/cleanup is owned by an internal {@link AvoidArena}.
 */
export class LibavoidEdgeRouter implements EdgeRouter {
	async route(input: EdgeRoutingInput): Promise<EdgeRouteMap> {
		// Lazy import so merely importing this module (for extraction/types) never
		// pulls the `libavoid-wasm` virtual module — it only resolves under esbuild,
		// not vitest. loadAvoid stays a singleton; the wasm loads on first route only.
		const { loadAvoid } = await import("./libavoidLoader");
		const avoid = await loadAvoid();
		const arena = new AvoidArena(avoid);
		const router = arena.newRouter();
		try {
			router.setRoutingParameter(avoid.shapeBufferDistance, EDGE_ROUTING_SHAPE_BUFFER_PX);
			router.setRoutingParameter(avoid.segmentPenalty, EDGE_ROUTING_SEGMENT_PENALTY_PX);
			router.setRoutingParameter(avoid.crossingPenalty, EDGE_ROUTING_CROSSING_PENALTY_PX);
			const shapeById = new Map<string, AvoidShapeRef>();
			for (const obstacle of input.obstacles) {
				const shape = arena.shape(router, rectOf(obstacle));
				// A shape-attached endpoint needs a pin; a proportional centre pin makes
				// the connector originate/terminate at the box centre. Pins are owned by
				// their shape (and thus the router) — never destroyed by us.
				new avoid.ShapeConnectionPin(
					shape,
					CENTRE_PIN_CLASS,
					PIN_CENTRE_FRACTION,
					PIN_CENTRE_FRACTION,
					true,
					0,
					avoid.ConnDirAll,
				);
				shapeById.set(obstacle.id, shape);
			}
			const connectors: Array<{ readonly id: string; readonly conn: AvoidConnRef }> = [];
			for (const edge of input.edges) {
				const sourceShape = shapeById.get(edge.sourceId);
				const targetShape = shapeById.get(edge.targetId);
				if (sourceShape === undefined || targetShape === undefined) {
					// Contract violation: extraction guarantees an obstacle per endpoint.
					// Throwing surfaces the single pass-level fallback (no silent per-edge skip).
					throw new Error(`edge ${edge.id} references an obstacle with no registered shape`);
				}
				const src = arena.connEnd(sourceShape, CENTRE_PIN_CLASS);
				const dst = arena.connEnd(targetShape, CENTRE_PIN_CLASS);
				const conn = new avoid.ConnRef(router, src, dst); // router-owned
				connectors.push({ id: edge.id, conn });
			}
			router.processTransaction();
			const routes = new Map<string, readonly RoutedPoint[]>();
			for (const { id, conn } of connectors) {
				routes.set(id, readRoute(conn));
			}
			return routes;
		} finally {
			arena.dispose();
		}
	}
}

function rectOf(obstacle: RoutingObstacle): AvoidRect {
	return {
		x1: obstacle.x,
		y1: obstacle.y,
		x2: obstacle.x + obstacle.widthPx,
		y2: obstacle.y + obstacle.heightPx,
	};
}
