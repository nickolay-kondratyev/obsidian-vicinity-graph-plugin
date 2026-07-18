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
}

/**
 * Perpendicular offset of a paired edge's control point. Both edges of an
 * A↔B pair bow to the RIGHT of their OWN travel direction, so the pair mirrors
 * around the straight line automatically and neither the lines nor their count
 * badges overlap.
 */
export const EDGE_PAIR_CURVATURE_PX = 24;

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
	if (!hasOpposite || length === 0) {
		return { path: `M ${sourceX},${sourceY} L ${targetX},${targetY}`, labelX: midX, labelY: midY };
	}
	// Unit normal pointing right of travel on screen (y grows downwards).
	const normalX = -deltaY / length;
	const normalY = deltaX / length;
	const controlX = midX + normalX * EDGE_PAIR_CURVATURE_PX;
	const controlY = midY + normalY * EDGE_PAIR_CURVATURE_PX;
	return {
		path: `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`,
		labelX: midX + (normalX * EDGE_PAIR_CURVATURE_PX) / 2,
		labelY: midY + (normalY * EDGE_PAIR_CURVATURE_PX) / 2,
	};
}
