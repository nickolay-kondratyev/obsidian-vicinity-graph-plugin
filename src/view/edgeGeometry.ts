/**
 * Pure SVG path math for the custom graph edge (step-05). RF-free so the
 * curvature/label rules are node-testable; the edge component only interpolates
 * the returned strings/coordinates.
 */

// Type-only import: erased at compile time, so it introduces NO runtime import
// cycle with edgeRouting.ts (which imports EDGE_PAIR_CURVATURE_PX from here).
import type { RoutedPoint } from "./edgeRouting";

export interface EdgePathGeometry {
	/** SVG path data for the edge line. */
	readonly path: string;
	/** Where the count badge anchors (on the curve for paired edges). */
	readonly labelX: number;
	readonly labelY: number;
	/** Arrowhead tip, inset back from the target along the incoming tangent. */
	readonly arrowX: number;
	readonly arrowY: number;
	/** Arrowhead orientation (degrees, SVG clockwise), pointing at the target. */
	readonly arrowAngleDeg: number;
	/**
	 * Symmetric SOURCE-side arrowhead tip, inset back from the source along the
	 * OUTGOING tangent, pointing at the source. Drawn only for bidirectional
	 * (group-collapsed) edges, which show an arrowhead at each end.
	 */
	readonly sourceArrowX: number;
	readonly sourceArrowY: number;
	readonly sourceArrowAngleDeg: number;
}

/**
 * How far the arrowhead tip sits back from the target, as a fraction of the
 * edge length, clamped to [MIN, MAX] px. The tip is drawn on the line rather
 * than at its end (React Flow's `marker-end` can only anchor at the terminal
 * point) so heads on edges converging on ONE node fan apart instead of stacking
 * into a single smudge at the shared boundary: each edge arrives at its own
 * angle, so insetting each tip along its own direction spreads them out. The
 * fraction keeps the inset proportional ("a few percent from the end"); the MIN
 * floor stops tiny edges putting the head right on the node, and the MAX cap
 * stops a long lone edge floating its head far out mid-span
 * (see [[ticket-edge-arrowhead-and-badge-visual-polish]]).
 */
export const EDGE_ARROWHEAD_INSET_FRACTION = 0.12;
export const EDGE_ARROWHEAD_INSET_MIN_PX = 14;
export const EDGE_ARROWHEAD_INSET_MAX_PX = 48;

/**
 * Perpendicular offset of a paired edge's control point. Both edges of an
 * A↔B pair bow to the RIGHT of their OWN travel direction, so the pair mirrors
 * around the straight line automatically and neither the lines nor their count
 * badges overlap. Widened from 24 → 34 in the 2026-07-20 smoke run: the tighter
 * bow let each incoming arrowhead sit almost on top of the returning edge near
 * the shared node, reading as one clipped smudge. More separation fans the two
 * curves apart at their endpoints so each arrowhead is individually legible
 * (see [[ticket-edge-arrowhead-and-badge-visual-polish]]).
 */
export const EDGE_PAIR_CURVATURE_PX = 34;

/**
 * Builds the edge path: a straight line normally, a quadratic curve bowed
 * right-of-travel when the opposite edge is also rendered. The label sits at
 * the path midpoint (for the quadratic that is the curve point at t = 0.5,
 * i.e. `0.25·P0 + 0.5·C + 0.25·P1` — half the control-point offset).
 */
export function edgePathFor(
	sourceX: number,
	sourceY: number,
	targetX: number,
	targetY: number,
	hasOpposite: boolean,
): EdgePathGeometry {
	const midX = (sourceX + targetX) / 2;
	const midY = (sourceY + targetY) / 2;
	const deltaX = targetX - sourceX;
	const deltaY = targetY - sourceY;
	const length = Math.hypot(deltaX, deltaY);
	if (length === 0) {
		// Degenerate: no travel direction, so anchor both arrows on their endpoints.
		return {
			path: `M ${sourceX},${sourceY} L ${targetX},${targetY}`,
			labelX: midX,
			labelY: midY,
			arrowX: targetX,
			arrowY: targetY,
			arrowAngleDeg: 0,
			sourceArrowX: sourceX,
			sourceArrowY: sourceY,
			sourceArrowAngleDeg: 0,
		};
	}
	if (!hasOpposite) {
		// Straight edge: each tangent is the edge direction; the source anchor is
		// its mirror (reversed direction, inset back from the source).
		const arrow = arrowFromApproach(targetX, targetY, deltaX, deltaY, length);
		const sourceArrow = sourceArrowOf(arrowFromApproach(sourceX, sourceY, -deltaX, -deltaY, length));
		return {
			path: `M ${sourceX},${sourceY} L ${targetX},${targetY}`,
			labelX: midX,
			labelY: midY,
			...arrow,
			...sourceArrow,
		};
	}
	// Unit normal pointing right of travel on screen (y grows downwards).
	const normalX = -deltaY / length;
	const normalY = deltaX / length;
	const controlX = midX + normalX * EDGE_PAIR_CURVATURE_PX;
	const controlY = midY + normalY * EDGE_PAIR_CURVATURE_PX;
	// A quadratic's tangent at the endpoint (t=1) points along (P1 - control),
	// so the arrow follows the curve's real arrival angle, not the chord.
	const arrow = arrowFromApproach(targetX, targetY, targetX - controlX, targetY - controlY, length);
	// Curved edges never draw a source arrowhead (only bidirectional collapsed
	// edges do, and those are straight); the anchor follows the start tangent for
	// symmetry with the target side should a future caller want it.
	const sourceArrow = sourceArrowOf(arrowFromApproach(sourceX, sourceY, sourceX - controlX, sourceY - controlY, length));
	return {
		path: `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`,
		labelX: midX + (normalX * EDGE_PAIR_CURVATURE_PX) / 2,
		labelY: midY + (normalY * EDGE_PAIR_CURVATURE_PX) / 2,
		...arrow,
		...sourceArrow,
	};
}

/**
 * How far each interior bend of a routed polyline is rounded: the quadratic arc
 * starts/ends this many px back from the vertex along the two adjacent segments,
 * clamped to HALF of each adjacent segment so a short segment can never invert
 * (the shrink from two neighbouring corners never overruns the segment between
 * them). Turns the router's hard right-angle detours into smooth, organic curves.
 * Kept the same order of magnitude as `EDGE_ROUTING_SHAPE_BUFFER_PX` (in
 * edgeRouting.ts, ~17px) so corners read at roughly the routing clearance's
 * visual scale. Held at 10px through the edge-routing__03 tuning pass: on the
 * sparse/medium/dense dev-vault fixtures it rounds the router's right-angle
 * detours into organic curves without eating so much of a short segment that the
 * corner reads as a diagonal shortcut.
 */
export const ROUTED_CORNER_RADIUS_PX = 10;

/**
 * A rectangle a routed polyline is clipped to, in ABSOLUTE top-left coordinates —
 * the same shape as a routing obstacle (`{x, y, widthPx, heightPx}`). Kept LOCAL
 * (not imported from edgeRouting) so this pure math layer carries no routing types;
 * a `RoutingObstacle` is structurally assignable to it at the call site.
 */
export interface ClipRect {
	readonly x: number;
	readonly y: number;
	readonly widthPx: number;
	readonly heightPx: number;
}

/**
 * Clips a routed polyline so it BEGINS and ENDS on its endpoint rectangles'
 * boundaries instead of plunging to their centres. libavoid attaches connector
 * endpoints to a centre pin (`edgeRouting.ts`), so a raw route's first/last point
 * is the box centre; for a large collapsed-group box that terminus sits deep
 * inside, on a member node, reading as a node→node link. This drops the trailing
 * points that fall strictly inside `targetRect` and moves the terminus to where the
 * last outside→inside segment crosses the border, then does the same from the START
 * against `sourceRect`. The arrowhead thus lands on the side the route approaches
 * from (side-aware anchoring for free), and a group arrow stops at the GROUP
 * boundary — never inside it.
 *
 * Degenerate guard (same spirit as {@link distinctSegmentFrom}): if clipping would
 * consume the whole polyline — overlapping/nested source & target rects, or a route
 * lying entirely inside a rect — it falls back to the UNCLIPPED 2-point chord of the
 * first & last ORIGINAL points. It never emits an empty or NaN-bearing polyline.
 */
export function clipRouteToEndpointRects(
	points: readonly RoutedPoint[],
	sourceRect: ClipRect,
	targetRect: ClipRect,
): RoutedPoint[] {
	const first = points[0];
	const last = points[points.length - 1];
	if (points.length < 2 || first === undefined || last === undefined) {
		return points.map((point) => ({ x: point.x, y: point.y }));
	}
	const chordFallback: RoutedPoint[] = [
		{ x: first.x, y: first.y },
		{ x: last.x, y: last.y },
	];
	const targetClipped = clipTrailingInsideRect(points, targetRect);
	if (targetClipped === null) {
		return chordFallback;
	}
	const sourceClipped = clipTrailingInsideRect([...targetClipped].reverse(), sourceRect);
	if (sourceClipped === null) {
		return chordFallback;
	}
	return sourceClipped.reverse();
}

/**
 * Drops the run of points at the END of `points` that lie strictly inside `rect`
 * and replaces the terminus with the border crossing of the last outside→inside
 * segment. Returns the polyline UNCHANGED when the endpoint is already on/outside
 * the border, and `null` (the degenerate signal) when every point is strictly
 * inside `rect` or the crossing is indeterminate — letting the caller fall back to
 * the chord. Clipping the START is this same walk on the reversed polyline.
 */
function clipTrailingInsideRect(points: readonly RoutedPoint[], rect: ClipRect): RoutedPoint[] | null {
	let lastOutside = -1;
	for (let i = points.length - 1; i >= 0; i -= 1) {
		const point = points[i];
		if (point !== undefined && !isStrictlyInsideRect(point, rect)) {
			lastOutside = i;
			break;
		}
	}
	if (lastOutside === -1) {
		return null; // whole polyline strictly inside the rect
	}
	const copy = points.map((point) => ({ x: point.x, y: point.y }));
	if (lastOutside === copy.length - 1) {
		return copy; // terminus already on/outside the border — nothing to clip
	}
	const outside = points[lastOutside];
	const inside = points[lastOutside + 1];
	if (outside === undefined || inside === undefined) {
		return null;
	}
	const crossing = segmentRectEntryPoint(outside, inside, rect);
	if (crossing === null) {
		return null;
	}
	const kept = copy.slice(0, lastOutside + 1);
	kept.push(crossing);
	return kept;
}

/** Strict point-in-rect: a point exactly ON the border is NOT inside, so it is kept as a terminus. */
function isStrictlyInsideRect(point: RoutedPoint, rect: ClipRect): boolean {
	return (
		point.x > rect.x && point.x < rect.x + rect.widthPx && point.y > rect.y && point.y < rect.y + rect.heightPx
	);
}

/**
 * Liang–Barsky: the point where segment `from`→`to` first ENTERS `rect`. Callers
 * pass `from` outside/on the border and `to` strictly inside, so the entry
 * parameter is in [0, 1] and the returned point is on the rect border. Returns
 * `null` when the segment never enters (parallel-and-outside / degenerate), so the
 * caller falls back to the unclipped chord rather than emitting NaN geometry.
 *
 * `edgeDistances` (Liang–Barsky `p`) and `boundaryGaps` (`q`) index the four rect
 * slabs as [left, right, top, bottom]; `p<0` bounds the ENTER parameter, `p>0` the
 * LEAVE parameter, and `p==0` with `q<0` means parallel to a slab and fully outside.
 */
function segmentRectEntryPoint(from: RoutedPoint, to: RoutedPoint, rect: ClipRect): RoutedPoint | null {
	const deltaX = to.x - from.x;
	const deltaY = to.y - from.y;
	const edgeDistances = [-deltaX, deltaX, -deltaY, deltaY];
	const boundaryGaps = [
		from.x - rect.x,
		rect.x + rect.widthPx - from.x,
		from.y - rect.y,
		rect.y + rect.heightPx - from.y,
	];
	let enter = 0;
	let leave = 1;
	for (let i = 0; i < edgeDistances.length; i += 1) {
		const edge = edgeDistances[i] ?? 0;
		const gap = boundaryGaps[i] ?? 0;
		if (edge === 0) {
			if (gap < 0) {
				return null; // parallel to this slab and fully outside it
			}
			continue;
		}
		const t = gap / edge;
		if (edge < 0) {
			enter = Math.max(enter, t);
		} else {
			leave = Math.min(leave, t);
		}
	}
	if (enter > leave) {
		return null;
	}
	return { x: from.x + enter * deltaX, y: from.y + enter * deltaY };
}

/**
 * SVG path over a routed polyline with rounded interior corners. Each interior
 * vertex is replaced by a quadratic arc between the two points {@link ROUTED_CORNER_RADIUS_PX}
 * back along its adjacent segments (clamped to half each segment length). A
 * 2-point polyline is a plain `M..L..` line, byte-identical to the straight
 * {@link edgePathFor} case so a cleanly-routed (unobstructed) edge renders
 * exactly like its OFF-routing counterpart.
 */
export function routedPathFor(points: readonly RoutedPoint[]): string {
	const first = points[0];
	const last = points[points.length - 1];
	if (first === undefined || last === undefined) {
		// Defensive: an empty polyline has no line to draw; anchor a zero-length
		// path at the origin so callers never emit a NaN-bearing path string.
		return "M 0,0 L 0,0";
	}
	if (points.length === 2) {
		return `M ${first.x},${first.y} L ${last.x},${last.y}`;
	}
	let path = `M ${first.x},${first.y}`;
	for (let i = 1; i < points.length - 1; i += 1) {
		const prev = points[i - 1];
		const corner = points[i];
		const next = points[i + 1];
		if (prev === undefined || corner === undefined || next === undefined) {
			continue;
		}
		const inLength = Math.hypot(corner.x - prev.x, corner.y - prev.y);
		const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
		if (inLength === 0 || outLength === 0) {
			// Duplicate consecutive waypoint: no tangent to round, pass straight through.
			path += ` L ${corner.x},${corner.y}`;
			continue;
		}
		const shrink = Math.min(ROUTED_CORNER_RADIUS_PX, inLength / 2, outLength / 2);
		const entryX = corner.x - ((corner.x - prev.x) / inLength) * shrink;
		const entryY = corner.y - ((corner.y - prev.y) / inLength) * shrink;
		const exitX = corner.x + ((next.x - corner.x) / outLength) * shrink;
		const exitY = corner.y + ((next.y - corner.y) / outLength) * shrink;
		path += ` L ${entryX},${entryY} Q ${corner.x},${corner.y} ${exitX},${exitY}`;
	}
	path += ` L ${last.x},${last.y}`;
	return path;
}

/**
 * Point half-way along a routed polyline BY ARC LENGTH (walk the segments until
 * their cumulative length reaches half the total). Anchors the count badge on
 * the routed path rather than at the straight-line midpoint.
 */
export function polylineMidpoint(points: readonly RoutedPoint[]): { readonly x: number; readonly y: number } {
	const first = points[0] ?? { x: 0, y: 0 };
	let total = 0;
	for (let i = 1; i < points.length; i += 1) {
		const a = points[i - 1];
		const b = points[i];
		if (a === undefined || b === undefined) {
			continue;
		}
		total += Math.hypot(b.x - a.x, b.y - a.y);
	}
	if (total === 0) {
		return { x: first.x, y: first.y };
	}
	const half = total / 2;
	let walked = 0;
	for (let i = 1; i < points.length; i += 1) {
		const a = points[i - 1];
		const b = points[i];
		if (a === undefined || b === undefined) {
			continue;
		}
		const segment = Math.hypot(b.x - a.x, b.y - a.y);
		if (walked + segment >= half) {
			const t = segment === 0 ? 0 : (half - walked) / segment;
			return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
		}
		walked += segment;
	}
	// Unreachable (half <= total), but keeps the return total for the type-checker.
	return { x: first.x, y: first.y };
}

/**
 * Value {@link detourRatio} returns when the endpoint chord is zero. Coincident
 * termini (overlapping/degenerate endpoint rects) have no straight distance to
 * compare against, so we report 1 — "no detour" — rather than dividing by zero and
 * emitting NaN/Infinity into the pass-level max/mean telemetry.
 */
export const DETOUR_RATIO_DEGENERATE = 1;

/**
 * How much longer a routed polyline is than the straight hop between its endpoints:
 * total arc length ÷ endpoint chord (`hypot(last - first)`). 1 = dead straight;
 * >1 = a detour. Meant to run on the CLIPPED route (termini already on the endpoint
 * boundaries), so the chord is the border→border distance the edge visually spans.
 *
 * A telemetry aid for the edge-routing__04 boundary-pin change (logged max/mean per
 * pass in GraphViewController): the wasm router can't run under vitest, so route
 * QUALITY is tracked numerically here rather than asserted in unit tests. Reuses the
 * arc-length walk from {@link polylineMidpoint}; guards the zero chord (see
 * {@link DETOUR_RATIO_DEGENERATE}) so it never emits NaN.
 */
export function detourRatio(points: readonly RoutedPoint[]): number {
	const first = points[0];
	const last = points[points.length - 1];
	if (first === undefined || last === undefined) {
		return DETOUR_RATIO_DEGENERATE;
	}
	let arcLength = 0;
	for (let i = 1; i < points.length; i += 1) {
		const a = points[i - 1];
		const b = points[i];
		if (a === undefined || b === undefined) {
			continue;
		}
		arcLength += Math.hypot(b.x - a.x, b.y - a.y);
	}
	const chord = Math.hypot(last.x - first.x, last.y - first.y);
	if (chord === 0) {
		return DETOUR_RATIO_DEGENERATE;
	}
	return arcLength / chord;
}

/**
 * Full geometry for a routed edge, in the SAME {@link EdgePathGeometry} shape the
 * straight/curved {@link edgePathFor} returns, so the edge component renders both
 * paths through one code path.
 *
 * Coordinate space: `points` are ABSOLUTE flow coordinates and React Flow gives
 * custom edges absolute `sourceX/Y`/`targetX/Y` too (it re-derives each node's
 * absolute rect, even subflow children) — so NO transform is applied here; the
 * polyline is drawn in the coordinates it arrives in (ticket edge-routing__02 item 3).
 *
 * - 2 points (or degenerate): delegates to {@link edgePathFor} with `hasOpposite=false`,
 *   so a cleanly-routed edge is identical to today's straight edge.
 * - >=3 points: rounded path; target arrowhead follows the LAST segment tangent and
 *   the source arrowhead the FIRST segment tangent (reusing the shared inset rules
 *   via {@link arrowFromApproach}/{@link sourceArrowOf}), each inset scaled by its own
 *   approach segment's length; the badge sits at the polyline arc-length midpoint.
 *   `hasOpposite` bowing is intentionally NOT applied — routed pairs are separated by
 *   the libavoid clearance buffer, not by a hand-drawn bow.
 */
export function routedGeometryFor(points: readonly RoutedPoint[]): EdgePathGeometry {
	const first = points[0] ?? { x: 0, y: 0 };
	const last = points[points.length - 1] ?? first;
	if (points.length <= 2) {
		return edgePathFor(first.x, first.y, last.x, last.y, false);
	}
	// Tangents walk PAST any duplicate consecutive waypoints (which the router can
	// emit) to the nearest DISTINCT neighbour, so a zero-length end segment never
	// divides the arrow angle by zero. `distinctSegmentFrom` returns the vector
	// FROM the endpoint TO that neighbour, so negating it gives the direction
	// pointing AT the endpoint that `arrowFromApproach` expects.
	const targetSegment = distinctSegmentFrom(points, points.length - 1, -1);
	const sourceSegment = distinctSegmentFrom(points, 0, 1);
	const arrow = arrowFromApproach(last.x, last.y, -targetSegment.deltaX, -targetSegment.deltaY, targetSegment.length);
	const sourceArrow = sourceArrowOf(
		arrowFromApproach(first.x, first.y, -sourceSegment.deltaX, -sourceSegment.deltaY, sourceSegment.length),
	);
	const midpoint = polylineMidpoint(points);
	return {
		path: routedPathFor(points),
		labelX: midpoint.x,
		labelY: midpoint.y,
		...arrow,
		...sourceArrow,
	};
}

/** Relabels a target-style {@link ArrowAnchor} as the source-side anchor fields. */
function sourceArrowOf(anchor: ArrowAnchor): {
	readonly sourceArrowX: number;
	readonly sourceArrowY: number;
	readonly sourceArrowAngleDeg: number;
} {
	return { sourceArrowX: anchor.arrowX, sourceArrowY: anchor.arrowY, sourceArrowAngleDeg: anchor.arrowAngleDeg };
}

interface ArrowAnchor {
	readonly arrowX: number;
	readonly arrowY: number;
	readonly arrowAngleDeg: number;
}

interface SegmentVector {
	readonly deltaX: number;
	readonly deltaY: number;
	readonly length: number;
}

/**
 * Vector from `points[fromIndex]` to the nearest point in the `step` direction
 * (`1` forward, `-1` backward) that does NOT coincide with it, skipping the
 * duplicate consecutive waypoints the router may emit. Returns a zero vector
 * when every point in that direction coincides (a fully degenerate end), so the
 * caller's arrow anchors flat on the endpoint instead of chasing a zero tangent.
 */
function distinctSegmentFrom(points: readonly RoutedPoint[], fromIndex: number, step: 1 | -1): SegmentVector {
	const origin = points[fromIndex];
	if (origin !== undefined) {
		for (let i = fromIndex + step; i >= 0 && i < points.length; i += step) {
			const point = points[i];
			if (point === undefined) {
				continue;
			}
			const deltaX = point.x - origin.x;
			const deltaY = point.y - origin.y;
			const length = Math.hypot(deltaX, deltaY);
			if (length > 0) {
				return { deltaX, deltaY, length };
			}
		}
	}
	return { deltaX: 0, deltaY: 0, length: 0 };
}

/**
 * Places the arrowhead tip `inset` px back from the target along the incoming
 * tangent (`approachX/Y`, the un-normalised direction pointing AT the target).
 * `edgeLength` drives the proportional inset; the tangent sets the angle.
 */
function arrowFromApproach(
	targetX: number,
	targetY: number,
	approachX: number,
	approachY: number,
	edgeLength: number,
): ArrowAnchor {
	const inset = Math.min(
		EDGE_ARROWHEAD_INSET_MAX_PX,
		Math.max(EDGE_ARROWHEAD_INSET_MIN_PX, edgeLength * EDGE_ARROWHEAD_INSET_FRACTION),
	);
	const approachLength = Math.hypot(approachX, approachY);
	if (approachLength === 0) {
		// No tangent direction (coincident points): anchor flat on the endpoint,
		// mirroring the degenerate `edgePathFor` case, so callers never emit NaN.
		return { arrowX: targetX, arrowY: targetY, arrowAngleDeg: 0 };
	}
	const unitX = approachX / approachLength;
	const unitY = approachY / approachLength;
	return {
		arrowX: targetX - unitX * inset,
		arrowY: targetY - unitY * inset,
		arrowAngleDeg: (Math.atan2(approachY, approachX) * 180) / Math.PI,
	};
}
