/**
 * Pure SVG path math for the custom graph edge (step-05). RF-free so the
 * curvature/label rules are node-testable; the edge component only interpolates
 * the returned strings/coordinates.
 */

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
	const unitX = approachX / approachLength;
	const unitY = approachY / approachLength;
	return {
		arrowX: targetX - unitX * inset,
		arrowY: targetY - unitY * inset,
		arrowAngleDeg: (Math.atan2(approachY, approachX) * 180) / Math.PI,
	};
}
