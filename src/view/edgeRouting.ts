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
	/**
	 * The flow-node kind this obstacle came from. Drives pin registration
	 * ({@link registerPinsForShape}): folder-group boxes get the boundary pins so
	 * cross-group edges attach on the facing side; note squares keep a single centre
	 * pin (the pre-edge-routing__04 behaviour) — many pins × the many ungrouped spokes of
	 * a dense hub blew the routing perf budget, and the roundabout pathology the
	 * boundary pins fix is specific to group boxes distorted by their own children.
	 */
	readonly kind: "note" | "folder-group";
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
 * - note boxes → `FlowNode.width/height` (height = engine `sizePx`; width floored
 *   to the label) at their absolute position;
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
			obstacles.push({
				id: node.id,
				x: position.x,
				y: position.y,
				widthPx: size.width,
				heightPx: size.height,
				kind: "folder-group",
			});
		} else {
			obstacles.push({
				id: node.id,
				x: position.x,
				y: position.y,
				widthPx: node.width,
				heightPx: node.height,
				kind: "note",
			});
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

/**
 * Class id shared by EVERY connection pin on EVERY endpoint shape. A `ConnEnd`
 * bound to this class attaches to whichever same-class pin libavoid finds cheapest
 * for that connector, so registering several boundary pins per shape (below) lets
 * each edge pick the side facing its counterpart.
 */
const PIN_CLASS = 1;

/**
 * Proportional pin offsets along a side: 0 = left/top border, 1 = right/bottom border
 * (libavoid multiplies these by the shape's width/height when `proportional = true`).
 * The three interior fractions 1/4, 1/2, 3/4 give each side three attachment points so
 * an edge can meet a box square-on near where it actually approaches, without ever
 * landing on a corner.
 */
const PIN_EDGE_MIN = 0;
const PIN_EDGE_Q1 = 0.25;
const PIN_EDGE_MID = 0.5;
const PIN_EDGE_Q3 = 0.75;
const PIN_EDGE_MAX = 1;

/** No inward nudge: pins sit exactly on the shape border. */
const PIN_INSIDE_OFFSET = 0;

/** Allowed approach/leave direction for a boundary pin (resolved to a ConnDirFlag at route time). */
type PinDir = "up" | "down" | "left" | "right" | "all";

export interface BoundaryPinSpec {
	readonly xFrac: number;
	readonly yFrac: number;
	readonly dir: PinDir;
}

/**
 * The twelve boundary connection pins registered on a FOLDER-GROUP obstacle (all sharing
 * {@link PIN_CLASS}). Each of the four sides carries three pins — at 1/4, 1/2, 3/4 along the
 * side — every one facing OUTWARD perpendicular to its own side, so an edge leaves/enters the
 * box square-on near where it actually approaches instead of skimming along the border.
 *
 * WHY no corner pins: at a corner an edge can visually read as continuing PAST the node even
 * though it terminated there. Side-only anchors keep every attachment unambiguously on a face.
 * (Superseded the earlier 8-pin set of 4 side-midpoints + 4 "all"-direction corners.) This whole
 * pin set replaced the single centre pin that made libavoid optimise a centre→centre path whose
 * long interior leg — later clipped away by `clipRouteToEndpointRects` — diverged from the visible
 * border→border route and let a group's own child squares distort it (ticket edge-routing__04).
 * libavoid picks the cheapest pin per connector end.
 *
 * WHY-NOT on note squares: the roundabout pathology is specific to group boxes, and a dense
 * vicinity is mostly UNGROUPED spokes — many pins on each of ~100 note squares pushed the routing
 * pass far over budget (ticket edge-routing__04 Phase A). Note squares therefore keep the single
 * {@link CENTRE_PIN_SPEC}.
 */
export const BOUNDARY_PIN_SPECS: readonly BoundaryPinSpec[] = [
	{ xFrac: PIN_EDGE_Q1, yFrac: PIN_EDGE_MIN, dir: "up" }, // top 1/4
	{ xFrac: PIN_EDGE_MID, yFrac: PIN_EDGE_MIN, dir: "up" }, // top 1/2
	{ xFrac: PIN_EDGE_Q3, yFrac: PIN_EDGE_MIN, dir: "up" }, // top 3/4
	{ xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_Q1, dir: "right" }, // right 1/4
	{ xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_MID, dir: "right" }, // right 1/2
	{ xFrac: PIN_EDGE_MAX, yFrac: PIN_EDGE_Q3, dir: "right" }, // right 3/4
	{ xFrac: PIN_EDGE_Q3, yFrac: PIN_EDGE_MAX, dir: "down" }, // bottom 3/4
	{ xFrac: PIN_EDGE_MID, yFrac: PIN_EDGE_MAX, dir: "down" }, // bottom 1/2
	{ xFrac: PIN_EDGE_Q1, yFrac: PIN_EDGE_MAX, dir: "down" }, // bottom 1/4
	{ xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_Q3, dir: "left" }, // left 3/4
	{ xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_MID, dir: "left" }, // left 1/2
	{ xFrac: PIN_EDGE_MIN, yFrac: PIN_EDGE_Q1, dir: "left" }, // left 1/4
];

/**
 * The single centre pin registered on a NOTE-SQUARE obstacle (the pre-edge-routing__04
 * behaviour): one pin at the shape centre accepting any approach direction. One pin
 * per note keeps the dense-fixture routing pass within its perf budget; the interior
 * leg it produces is clipped to the box boundary by `clipRouteToEndpointRects`.
 */
const CENTRE_PIN_SPEC: BoundaryPinSpec = { xFrac: PIN_EDGE_MID, yFrac: PIN_EDGE_MID, dir: "all" };

/** Resolves a pin's abstract facing to the libavoid `ConnDirFlag` bitmask on this binding. */
function visDirsFor(avoid: Avoid, dir: PinDir): number {
	switch (dir) {
		case "up":
			return avoid.ConnDirUp;
		case "down":
			return avoid.ConnDirDown;
		case "left":
			return avoid.ConnDirLeft;
		case "right":
			return avoid.ConnDirRight;
		case "all":
			return avoid.ConnDirAll;
	}
}

/**
 * Registers the connection pins for one obstacle shape, all under {@link PIN_CLASS}
 * so every `ConnEnd(shape, PIN_CLASS)` resolves to the cheapest pin regardless of
 * count. Folder-group boxes get the {@link BOUNDARY_PIN_SPECS} (facing-side
 * attachment); note squares get the single {@link CENTRE_PIN_SPEC} (perf fallback,
 * ticket edge-routing__04 Phase A). Pins are owned by their shape (and thus the
 * router) — never destroyed by us.
 */
function registerPinsForShape(avoid: Avoid, shape: AvoidShapeRef, kind: RoutingObstacle["kind"]): void {
	const specs = kind === "folder-group" ? BOUNDARY_PIN_SPECS : [CENTRE_PIN_SPEC];
	for (const spec of specs) {
		const pin = new avoid.ShapeConnectionPin(
			shape,
			PIN_CLASS,
			spec.xFrac,
			spec.yFrac,
			true,
			PIN_INSIDE_OFFSET,
			visDirsFor(avoid, spec.dir),
		);
		// WHY (ticket edge-routing__06 item (a)): an EXCLUSIVE pin accepts at most ONE
		// connector, and this binding derives that default from the pin's visibility —
		// measured, a directional pin reports `isExclusive() === true`, a ConnDirAll pin
		// false. The 12 directional BOUNDARY pins are therefore a finite pool: the 4th edge
		// approaching a side is pushed onto a pin of the WRONG side, and the 13th finds none
		// at all — libavoid then warns ("no pins with class id of 1") and falls back to the
		// shape CENTRE, reviving the pre-edge-routing__04 roundabout attachment. Shared pins
		// fix both and cost nothing: still one routing pass (measured over 400 crowded scenes
		// at realistic group degree: non-facing attachments 82 -> 40, total length -2.3%).
		// On the note CENTRE pin this is a measured no-op (ConnDirAll is already shared — 0 of
		// 949 routes changed); it is applied uniformly so the requirement is stated in code
		// rather than resting on a default that a change of pin direction would silently flip.
		// The local const exists ONLY for this call — see the OWNERSHIP GOTCHA on AvoidArena
		// below: this pin is router-owned, so it must never be tracked or destroyed by us.
		pin.setExclusive(false);
	}
}

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
 * (PolyLine routing), obstacles as Rectangle+ShapeRef carrying connection pins
 * ({@link registerPinsForShape}: boundary pins on folder-group boxes, a centre pin on
 * note squares), endpoints SHAPE-ATTACHED via `ConnEnd(shapeRef, PIN_CLASS)` (so a
 * source/target box does not block its own edge and group-box edges attach on the
 * facing side), a single `processTransaction()`, then `displayRoute()` per connector.
 * All allocation/cleanup is owned by an internal {@link AvoidArena}.
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
				// A shape-attached endpoint needs pins (all PIN_CLASS): folder-group boxes
				// get boundary pins for facing-side attachment, note squares a single centre
				// pin (perf fallback). See registerPinsForShape.
				registerPinsForShape(avoid, shape, obstacle.kind);
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
				const src = arena.connEnd(sourceShape, PIN_CLASS);
				const dst = arena.connEnd(targetShape, PIN_CLASS);
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
