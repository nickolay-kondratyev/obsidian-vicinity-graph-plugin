import { GROUP_BOX_PADDING_PX } from "./constants";
import type {
	EdgeRouteMap,
	EdgeRouter,
	EdgeRoutingInput,
	PassRouter,
	RoutedPoint,
	RoutingEndpoint,
	RoutingObstacle,
	RichRoutingEdge,
	RoutingPassInput,
} from "./edgeRouting";
import { PIERCE_PIN_CLASS, PIN_CLASS } from "./edgeRouting";

/**
 * Hierarchical composition of the obstacle-avoiding router so a PIERCING edge — one
 * whose endpoint (the "Edge depth into groups" setting projected it onto a NESTED
 * group box) sits inside container boxes the other endpoint is outside of — reaches
 * its deep target WITHOUT cutting across the note squares or the title bands of the
 * boxes it pierces (plan `nid_6fkhyw97hjs84xb62z6tommhi_e`, decision D3).
 *
 * WHY hierarchical: a single libavoid pass cannot do this. Once an endpoint is inside
 * a group-box obstacle, libavoid excludes every shape containing that endpoint and
 * runs STRAIGHT through the interior (measured spike fact 1). So instead of one pass
 * we compose several, each router-agnostic behind {@link PassRouter} (DIP), wasm only
 * in the libavoid leaf:
 *
 * - OUTER pass: today's all-obstacle pass, unchanged, EXCEPT a piercing edge's outer
 *   `ConnEnd` attaches to the OUTERMOST pierced container via its top-excluded
 *   {@link PIERCE_PIN_CLASS} pins (never entering through the title). A non-piercing
 *   edge is byte-identical to today, so with the slider at 0 (no piercing edges) the
 *   whole composer collapses to the historical single pass.
 * - INNER passes: per pierced container, a small pass whose obstacles are that
 *   container's DIRECT children + a title-strip blocker (its top band), routing from
 *   the border ENTRY point (a bare-point `ConnEnd`, spike fact 2) to the next box down
 *   (its pierce pins) or the final endpoint. Recurses one level per allowance step.
 * - STITCH: the outer segment and the inner descent segment(s) are joined at the shared
 *   border points into one polyline per edge; the controller clips it to the true
 *   endpoint rects exactly as before.
 *
 * The planning half ({@link planHierarchicalRouting}, {@link stitchPiercingRoute}) is a
 * PURE function of the flat {@link EdgeRoutingInput} — containment is derived from the
 * obstacle rectangles, so nothing new crosses the controller seam — and is unit-tested
 * with a fake {@link PassRouter}. {@link HierarchicalEdgeRouter} only sequences the
 * passes and reads their routes.
 */

/** Half-open tolerance (px) for geometric rectangle containment — children sit ≥16px inside a parent. */
const CONTAINMENT_TOLERANCE_PX = 0.5;

/** A rectangle in absolute top-left coordinates (the shape shared by every obstacle). */
interface Rect {
	readonly x: number;
	readonly y: number;
	readonly widthPx: number;
	readonly heightPx: number;
}

/**
 * Geometric containment tree derived from the flat obstacle set: for every obstacle,
 * the folder-group boxes that strictly contain it (OUTERMOST first), and each
 * container's direct children. Two obstacles never share a rect (a group box is always
 * larger than its padded children), so area order is a faithful nesting order.
 */
export interface ObstacleContainment {
	readonly byId: ReadonlyMap<string, RoutingObstacle>;
	/** Ancestor container ids of an obstacle, OUTERMOST → innermost (immediate parent last). */
	readonly ancestorsOf: (id: string) => readonly string[];
	/** Obstacle ids whose IMMEDIATE parent is this container (its direct children). */
	readonly directChildrenOf: (containerId: string) => readonly string[];
}

/** `true` iff `inner` lies within `outer` (with tolerance) and `outer` is strictly larger. */
function strictlyContains(outer: Rect, inner: Rect): boolean {
	if (areaOf(outer) <= areaOf(inner)) {
		return false;
	}
	return (
		inner.x >= outer.x - CONTAINMENT_TOLERANCE_PX &&
		inner.y >= outer.y - CONTAINMENT_TOLERANCE_PX &&
		inner.x + inner.widthPx <= outer.x + outer.widthPx + CONTAINMENT_TOLERANCE_PX &&
		inner.y + inner.heightPx <= outer.y + outer.heightPx + CONTAINMENT_TOLERANCE_PX
	);
}

function areaOf(rect: Rect): number {
	return rect.widthPx * rect.heightPx;
}

/**
 * Derives the {@link ObstacleContainment} from the obstacle rectangles alone. Only
 * folder-group boxes can be containers; a note or a title strip never contains
 * anything. Ancestors are sorted by area DESCENDING so index 0 is the outermost box
 * and the last is the immediate parent.
 */
export function deriveObstacleContainment(obstacles: readonly RoutingObstacle[]): ObstacleContainment {
	const byId = new Map(obstacles.map((o) => [o.id, o]));
	const containers = obstacles.filter((o) => o.kind === "folder-group");
	const ancestorIds = new Map<string, string[]>();
	for (const obstacle of obstacles) {
		const ancestors = containers
			.filter((c) => c.id !== obstacle.id && strictlyContains(c, obstacle))
			.sort((a, b) => areaOf(b) - areaOf(a))
			.map((c) => c.id);
		ancestorIds.set(obstacle.id, ancestors);
	}
	const directChildren = new Map<string, string[]>();
	for (const obstacle of obstacles) {
		const ancestors = ancestorIds.get(obstacle.id) ?? [];
		const immediateParent = ancestors[ancestors.length - 1];
		if (immediateParent === undefined) {
			continue; // top-level obstacle — its parent is the canvas pane, not a box.
		}
		const siblings = directChildren.get(immediateParent) ?? [];
		siblings.push(obstacle.id);
		directChildren.set(immediateParent, siblings);
	}
	return {
		byId,
		ancestorsOf: (id) => ancestorIds.get(id) ?? [],
		directChildrenOf: (id) => directChildren.get(id) ?? [],
	};
}

/**
 * The containers one endpoint pierces to reach its obstacle: its ancestor boxes that do
 * NOT also contain the OTHER endpoint (and are not the other endpoint itself), OUTERMOST
 * first. Empty when the endpoint sits at or above the two endpoints' lowest common
 * container — i.e. a non-piercing (top-level or intra-group) edge.
 */
function piercedContainersOf(
	endpointId: string,
	otherEndpointId: string,
	containment: ObstacleContainment,
): readonly string[] {
	const otherAncestors = new Set(containment.ancestorsOf(otherEndpointId));
	return containment
		.ancestorsOf(endpointId)
		.filter((container) => container !== otherEndpointId && !otherAncestors.has(container));
}

/** One edge's routing plan across the passes. */
interface EdgePlan {
	readonly id: string;
	/** Containers the SOURCE endpoint pierces (outermost first); empty ⇒ source not pierced. */
	readonly piercedSource: readonly string[];
	/** Containers the TARGET endpoint pierces (outermost first); empty ⇒ target not pierced. */
	readonly piercedTarget: readonly string[];
	readonly sourceId: string;
	readonly targetId: string;
}

/** The full plan: the outer pass to run first, plus per-edge descent metadata. */
export interface HierarchicalPlan {
	readonly outerPass: RoutingPassInput;
	readonly edgePlans: readonly EdgePlan[];
	/** `true` when at least one edge pierces — otherwise the outer pass IS the whole result. */
	readonly hasPiercing: boolean;
	readonly containment: ObstacleContainment;
	readonly shapeBufferPx: number;
}

/** Shape endpoint on the normal pin class (facing-side / centre attachment). */
function normalEndpoint(obstacleId: string): RoutingEndpoint {
	return { kind: "shape", obstacleId, pinClass: PIN_CLASS };
}

/** Shape endpoint on the pierce-entry (top-excluded) pin class. */
function pierceEndpoint(obstacleId: string): RoutingEndpoint {
	return { kind: "shape", obstacleId, pinClass: PIERCE_PIN_CLASS };
}

/**
 * Plans the whole composition from the flat {@link EdgeRoutingInput}: classifies every
 * edge, builds the OUTER pass (piercing edges retargeted onto their outermost pierced
 * container's pierce pins, those containers flagged to register those pins), and records
 * each edge's pierced-container chains for the inner descent.
 */
export function planHierarchicalRouting(input: EdgeRoutingInput): HierarchicalPlan {
	const containment = deriveObstacleContainment(input.obstacles);
	const edgePlans: EdgePlan[] = [];
	const pierceEntryContainers = new Set<string>();
	const outerEdges: RichRoutingEdge[] = [];
	for (const edge of input.edges) {
		const piercedSource = piercedContainersOf(edge.sourceId, edge.targetId, containment);
		const piercedTarget = piercedContainersOf(edge.targetId, edge.sourceId, containment);
		edgePlans.push({
			id: edge.id,
			piercedSource,
			piercedTarget,
			sourceId: edge.sourceId,
			targetId: edge.targetId,
		});
		const outerSource = piercedSource[0];
		const outerTarget = piercedTarget[0];
		if (outerSource !== undefined) {
			pierceEntryContainers.add(outerSource);
		}
		if (outerTarget !== undefined) {
			pierceEntryContainers.add(outerTarget);
		}
		outerEdges.push({
			id: edge.id,
			source: outerSource === undefined ? normalEndpoint(edge.sourceId) : pierceEndpoint(outerSource),
			target: outerTarget === undefined ? normalEndpoint(edge.targetId) : pierceEndpoint(outerTarget),
		});
	}
	const outerObstacles = input.obstacles.map((obstacle) =>
		pierceEntryContainers.has(obstacle.id) ? { ...obstacle, registerPierceEntryPins: true } : obstacle,
	);
	return {
		outerPass: { obstacles: outerObstacles, edges: outerEdges, shapeBufferPx: input.shapeBufferPx },
		edgePlans,
		hasPiercing: pierceEntryContainers.size > 0,
		containment,
		shapeBufferPx: input.shapeBufferPx,
	};
}

/** A pending descent down ONE side of ONE piercing edge, advanced one container per level. */
interface DescentJob {
	readonly edgeId: string;
	readonly side: "source" | "target";
	/** Containers to descend THROUGH, outermost first (= the pierced chain). */
	readonly chain: readonly string[];
	/** The true deep endpoint obstacle this side terminates at. */
	readonly finalTargetId: string;
	/** Border entry point for the CURRENT level (updated after each pass). */
	entryPoint: RoutedPoint;
	/** Inner polyline so far, from the outer border toward the final target. */
	segments: RoutedPoint[];
	/** Index into {@link chain} of the container being descended next. */
	level: number;
}

/** Connector id for one descent job within an inner pass (unique per edge + side). */
function descentConnectorId(edgeId: string, side: "source" | "target"): string {
	return `${edgeId}::${side}`;
}

/**
 * The libavoid-backed {@link EdgeRouter} the controller uses. Delegates to a
 * {@link PassRouter} leaf (the wasm router) for every pass and composes piercing edges
 * hierarchically. With no piercing edges it runs EXACTLY one pass — the leaf's own —
 * so its output is byte-identical to the pre-hierarchy behaviour.
 */
export class HierarchicalEdgeRouter implements EdgeRouter {
	constructor(private readonly leaf: PassRouter) {}

	async route(input: EdgeRoutingInput): Promise<EdgeRouteMap> {
		const plan = planHierarchicalRouting(input);
		const outerRoutes = await this.leaf.routePass(plan.outerPass);
		if (!plan.hasPiercing) {
			return outerRoutes;
		}
		const jobs = this.startDescents(plan, outerRoutes);
		await this.runDescents(plan, jobs);
		return this.stitchAll(plan, outerRoutes, jobs);
	}

	/** One descent job per pierced side of each piercing edge, seeded from the outer route ends. */
	private startDescents(plan: HierarchicalPlan, outerRoutes: EdgeRouteMap): DescentJob[] {
		const jobs: DescentJob[] = [];
		for (const edgePlan of plan.edgePlans) {
			const outerRoute = outerRoutes.get(edgePlan.id);
			if (outerRoute === undefined || outerRoute.length === 0) {
				continue; // leaf produced no outer route — nothing to descend from (edge stays absent).
			}
			const firstPoint = outerRoute[0];
			const lastPoint = outerRoute[outerRoute.length - 1];
			if (edgePlan.piercedSource.length > 0 && firstPoint !== undefined) {
				jobs.push(this.newJob(edgePlan.id, "source", edgePlan.piercedSource, edgePlan.sourceId, firstPoint));
			}
			if (edgePlan.piercedTarget.length > 0 && lastPoint !== undefined) {
				jobs.push(this.newJob(edgePlan.id, "target", edgePlan.piercedTarget, edgePlan.targetId, lastPoint));
			}
		}
		return jobs;
	}

	private newJob(
		edgeId: string,
		side: "source" | "target",
		chain: readonly string[],
		finalTargetId: string,
		entryPoint: RoutedPoint,
	): DescentJob {
		return { edgeId, side, chain, finalTargetId, entryPoint, segments: [{ ...entryPoint }], level: 0 };
	}

	/** Advances every descent one container per level, batching jobs that share a container. */
	private async runDescents(plan: HierarchicalPlan, jobs: readonly DescentJob[]): Promise<void> {
		let active = jobs.filter((job) => job.level < job.chain.length);
		while (active.length > 0) {
			const byContainer = new Map<string, DescentJob[]>();
			for (const job of active) {
				const container = job.chain[job.level];
				if (container === undefined) {
					continue;
				}
				const bucket = byContainer.get(container) ?? [];
				bucket.push(job);
				byContainer.set(container, bucket);
			}
			// Independent passes (disjoint obstacle sets) — run them concurrently.
			await Promise.all(
				[...byContainer.entries()].map(([containerId, containerJobs]) =>
					this.runContainerPass(plan, containerId, containerJobs),
				),
			);
			active = jobs.filter((job) => job.level < job.chain.length);
		}
	}

	/** Runs the inner pass for ONE container and advances every job routed through it. */
	private async runContainerPass(plan: HierarchicalPlan, containerId: string, jobs: readonly DescentJob[]): Promise<void> {
		const pass = this.buildContainerPass(plan, containerId, jobs);
		let routes: EdgeRouteMap;
		try {
			routes = await this.leaf.routePass(pass);
		} catch {
			// A failed inner pass must not sink the whole rebuild: finish each job with a
			// straight leg to its next target so the edge still renders (degraded, not gone).
			routes = new Map();
		}
		for (const job of jobs) {
			const route = routes.get(descentConnectorId(job.edgeId, job.side));
			const nextTargetId = job.chain[job.level + 1] ?? job.finalTargetId;
			const fallbackEnd = job.level + 1 < job.chain.length ? undefined : rectCentreOf(plan.containment.byId.get(nextTargetId));
			this.advanceJob(job, route, fallbackEnd);
		}
	}

	/** Builds the inner {@link RoutingPassInput} for one container: its children + a title strip. */
	private buildContainerPass(plan: HierarchicalPlan, containerId: string, jobs: readonly DescentJob[]): RoutingPassInput {
		const pierceChildren = new Set<string>();
		const edges: RichRoutingEdge[] = [];
		for (const job of jobs) {
			const deeper = job.chain[job.level + 1];
			const targetId = deeper ?? job.finalTargetId;
			const targetObstacle = plan.containment.byId.get(targetId);
			// A group-box target is entered through its pierce pins (never its title); a note
			// target keeps its centre pin.
			const entersGroupBox = targetObstacle !== undefined && targetObstacle.kind === "folder-group";
			if (entersGroupBox) {
				pierceChildren.add(targetId);
			}
			const targetEndpoint = entersGroupBox ? pierceEndpoint(targetId) : normalEndpoint(targetId);
			edges.push({
				id: descentConnectorId(job.edgeId, job.side),
				source: { kind: "point", x: job.entryPoint.x, y: job.entryPoint.y },
				target: targetEndpoint,
			});
		}
		const obstacles: RoutingObstacle[] = [];
		for (const childId of plan.containment.directChildrenOf(containerId)) {
			const child = plan.containment.byId.get(childId);
			if (child === undefined) {
				continue;
			}
			obstacles.push(
				pierceChildren.has(childId) ? { ...child, registerPierceEntryPins: true } : child,
			);
		}
		const container = plan.containment.byId.get(containerId);
		if (container !== undefined) {
			obstacles.push(titleStripOf(container));
		}
		return { obstacles, edges, shapeBufferPx: plan.shapeBufferPx };
	}

	/** Appends an inner leg to a job and moves it to the next level (or a straight fallback). */
	private advanceJob(job: DescentJob, route: readonly RoutedPoint[] | undefined, fallbackEnd: RoutedPoint | undefined): void {
		if (route !== undefined && route.length >= 2) {
			appendPolyline(job.segments, route);
			const last = route[route.length - 1];
			if (last !== undefined) {
				job.entryPoint = last;
			}
			job.level += 1;
			return;
		}
		// No usable inner route: close this side with a straight leg to the target centre and
		// stop descending (jump the level past the end of the chain).
		if (fallbackEnd !== undefined) {
			appendPolyline(job.segments, [job.entryPoint, fallbackEnd]);
		}
		job.level = job.chain.length;
	}

	/** Stitches each edge's outer segment with its per-side descents; passes others through. */
	private stitchAll(plan: HierarchicalPlan, outerRoutes: EdgeRouteMap, jobs: readonly DescentJob[]): EdgeRouteMap {
		const jobsByEdge = new Map<string, DescentJob[]>();
		for (const job of jobs) {
			const bucket = jobsByEdge.get(job.edgeId) ?? [];
			bucket.push(job);
			jobsByEdge.set(job.edgeId, bucket);
		}
		const stitched = new Map<string, readonly RoutedPoint[]>();
		for (const [edgeId, route] of outerRoutes) {
			const edgeJobs = jobsByEdge.get(edgeId);
			stitched.set(edgeId, edgeJobs === undefined ? route : stitchPiercingRoute(route, edgeJobs));
		}
		return stitched;
	}
}

/**
 * Joins a piercing edge's outer segment with its source-/target-side descents into one
 * source→target polyline: `A → A's outer border → B's outer border → B`. Pure — the
 * unit tests exercise it directly.
 */
export function stitchPiercingRoute(outerRoute: readonly RoutedPoint[], jobs: readonly DescentJob[]): readonly RoutedPoint[] {
	const sourceJob = jobs.find((job) => job.side === "source");
	const targetJob = jobs.find((job) => job.side === "target");
	let result: RoutedPoint[] = [];
	if (sourceJob !== undefined) {
		// Source descent runs outer-border → A; reversed it is A → outer-border, the head.
		result = [...sourceJob.segments].reverse();
		appendPolyline(result, outerRoute);
	} else {
		result = outerRoute.map((point) => ({ ...point }));
	}
	if (targetJob !== undefined) {
		appendPolyline(result, targetJob.segments);
	}
	return result;
}

/** The title-band blocker of a container: its top strip, height {@link GROUP_BOX_PADDING_PX.top}. */
function titleStripOf(container: RoutingObstacle): RoutingObstacle {
	return {
		id: `${container.id}::title-strip`,
		x: container.x,
		y: container.y,
		widthPx: container.widthPx,
		heightPx: Math.min(GROUP_BOX_PADDING_PX.top, container.heightPx),
		kind: "title-strip",
	};
}

/** Centre point of an obstacle rect, or the origin when the obstacle is missing. */
function rectCentreOf(rect: Rect | undefined): RoutedPoint {
	if (rect === undefined) {
		return { x: 0, y: 0 };
	}
	return { x: rect.x + rect.widthPx / 2, y: rect.y + rect.heightPx / 2 };
}

/** Squared distance below which two waypoints are treated as the same junction point. */
const JUNCTION_EPSILON_SQ = 0.01;

/**
 * Appends `tail` onto `into`, dropping `tail`'s first point when it coincides with
 * `into`'s last (the shared border hand-off between two stitched segments), so the
 * seam never leaves a duplicate vertex.
 */
function appendPolyline(into: RoutedPoint[], tail: readonly RoutedPoint[]): void {
	const last = into[into.length - 1];
	let start = 0;
	const first = tail[0];
	if (last !== undefined && first !== undefined && samePoint(last, first)) {
		start = 1;
	}
	for (let i = start; i < tail.length; i += 1) {
		const point = tail[i];
		if (point !== undefined) {
			into.push({ x: point.x, y: point.y });
		}
	}
}

function samePoint(a: RoutedPoint, b: RoutedPoint): boolean {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy <= JUNCTION_EPSILON_SQ;
}
