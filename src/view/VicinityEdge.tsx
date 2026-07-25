import { BaseEdge, EdgeLabelRenderer } from "@xyflow/react";
import type { Edge, EdgeProps } from "@xyflow/react";
import type { ReactElement } from "react";
import { linkCountBadgeText } from "./badgeText";
import { edgePathFor, routedGeometryFor } from "./edgeGeometry";
import type { RoutedPoint } from "./edgeRouting";

/**
 * Directed graph edge (step-05): straight line with an arrowhead normally;
 * when the reverse edge is also rendered (A↔B pair) both bow right of their
 * own travel direction and mirror apart (see `edgeGeometry`). Collapsed
 * multi-links show a "×N" badge at the path midpoint.
 *
 * The arrowhead is a self-drawn triangle inset back from the target (not React
 * Flow's `marker-end`, which can only sit at the path end): heads on edges
 * converging on one node then fan apart by arrival angle instead of stacking
 * into a single smudge at the shared boundary
 * (see [[ticket-edge-arrowhead-and-badge-visual-polish]]).
 */

/** Triangle drawn tip-forward (+x, pre-rotation): length back from the tip and half-width. */
const ARROWHEAD_LENGTH_PX = 11;
/**
 * Half-width of the arrowhead triangle — the head's PERPENDICULAR reach off its
 * own route. Exported (not module-private) because it is the measured FLOOR of
 * the edge-routing clearance: a head drawn on a route that clears every box by
 * `clearance` px keeps its body outside those boxes as long as
 * `clearance > ARROWHEAD_HALF_WIDTH_PX`. Asserted in `edgeRouting.test.ts`.
 */
export const ARROWHEAD_HALF_WIDTH_PX = 6;

/** Payload threaded from {@link FlowEdge} at the render boundary. */
export type VicinityEdgeData = {
	readonly count: number;
	readonly hasOpposite: boolean;
	/** Group-collapsed edge unioning both directions: draw a second arrowhead at the source. */
	readonly bidirectional: boolean;
	/**
	 * Obstacle-avoiding polyline in ABSOLUTE flow-space (no transform needed — RF
	 * edge endpoints are absolute too). Present only when edge routing is on and
	 * the pass succeeded. NOT consumed by rendering yet (ticket edge-routing__02).
	 */
	readonly routedPoints?: readonly RoutedPoint[];
};

export type VicinityEdgeType = Edge<VicinityEdgeData, "vicinity">;

export function VicinityEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	data,
}: EdgeProps<VicinityEdgeType>): ReactElement {
	// When the routing pass produced an obstacle-avoiding polyline (edge routing
	// ON), draw it; otherwise fall back to EXACTLY the straight/curved geometry.
	// routedPoints are ABSOLUTE flow coords and RF gives us absolute sourceX/Y too,
	// so routedGeometryFor applies no transform (see its doc + edge-routing__02 item 3).
	const routedPoints = data?.routedPoints;
	const geometry =
		routedPoints !== undefined && routedPoints.length >= 2
			? routedGeometryFor(routedPoints)
			: edgePathFor(sourceX, sourceY, targetX, targetY, data?.hasOpposite ?? false);
	const badge = linkCountBadgeText(data?.count ?? 1);
	// Triangle authored tip-at-origin pointing +x, then translated to the tip
	// and rotated to the edge's arrival angle.
	const arrowPoints = `0,0 ${-ARROWHEAD_LENGTH_PX},${-ARROWHEAD_HALF_WIDTH_PX} ${-ARROWHEAD_LENGTH_PX},${ARROWHEAD_HALF_WIDTH_PX}`;
	return (
		<>
			<BaseEdge id={id} path={geometry.path} />
			<polygon
				className="vicinity-graph-edge__arrowhead"
				points={arrowPoints}
				transform={`translate(${geometry.arrowX} ${geometry.arrowY}) rotate(${geometry.arrowAngleDeg})`}
			/>
			{data?.bidirectional === true && (
				<polygon
					className="vicinity-graph-edge__arrowhead"
					points={arrowPoints}
					transform={`translate(${geometry.sourceArrowX} ${geometry.sourceArrowY}) rotate(${geometry.sourceArrowAngleDeg})`}
				/>
			)}
			{badge !== null && (
				<EdgeLabelRenderer>
					<span
						className="vicinity-graph-edge__count-badge"
						data-count={data?.count}
						style={{
							transform: `translate(-50%, -50%) translate(${geometry.labelX}px, ${geometry.labelY}px)`,
						}}
					>
						{badge}
					</span>
				</EdgeLabelRenderer>
			)}
		</>
	);
}
