import { BaseEdge, EdgeLabelRenderer, useInternalNode } from "@xyflow/react";
import type { Edge, EdgeProps, InternalNode, Node } from "@xyflow/react";
import type { ReactElement } from "react";
import type { RelationLabel } from "../engine";
import { linkCountBadgeText, relationLabelText } from "./badgeText";
import {
	ARROWHEAD_HALF_WIDTH_PX,
	ARROWHEAD_LENGTH_PX,
	edgePathFor,
	facingSideAnchorsFor,
	routedGeometryFor,
} from "./edgeGeometry";
import type { ClipRect } from "./edgeGeometry";
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

/** Payload threaded from {@link FlowEdge} at the render boundary. */
export type VicinityEdgeData = {
	readonly count: number;
	readonly hasOpposite: boolean;
	/** Group-collapsed edge unioning both directions: draw a second arrowhead at the source. */
	readonly bidirectional: boolean;
	/**
	 * Named-relationship labels this edge draws (glance-level union;
	 * {@link import("./flowMapping").FlowEdge.relations}) — stacked above the line,
	 * a qualifier rendered as `name [X] qualifier`. ABSENT/empty ⇒ an unnamed edge.
	 */
	readonly relations?: readonly RelationLabel[];
	/**
	 * Obstacle-avoiding polyline in ABSOLUTE flow-space (no transform needed — RF
	 * edge endpoints are absolute too). Present only when edge routing is on and
	 * the pass succeeded. NOT consumed by rendering yet (ticket edge-routing__02).
	 */
	readonly routedPoints?: readonly RoutedPoint[];
};

export type VicinityEdgeType = Edge<VicinityEdgeData, "vicinity">;

/**
 * The node's absolute rect, or `undefined` while React Flow has not registered it.
 * Falls back from the MEASURED size to the explicit `width`/`height` every node
 * carries (`toReactFlowNode`) — `onlyRenderVisibleElements` unmounts culled nodes,
 * so a measurement may never have happened, but the node stays in the RF store.
 */
function clipRectOf(node: InternalNode<Node> | undefined): ClipRect | undefined {
	if (node === undefined) {
		return undefined;
	}
	const widthPx = node.measured.width ?? node.width;
	const heightPx = node.measured.height ?? node.height;
	if (widthPx === undefined || heightPx === undefined) {
		return undefined;
	}
	return { x: node.internals.positionAbsolute.x, y: node.internals.positionAbsolute.y, widthPx, heightPx };
}

export function VicinityEdge({
	id,
	source,
	target,
	sourceX,
	sourceY,
	targetX,
	targetY,
	data,
}: EdgeProps<VicinityEdgeType>): ReactElement {
	// Straight edges anchor on the sides the two boxes FACE, not on the fixed
	// top/bottom handles React Flow derives sourceX/Y from — see facingSideAnchorsFor.
	// `null` (node not in the store yet, or nested/overlapping rects) keeps RF's
	// handle endpoints, which is exactly today's behaviour.
	const sourceNode = useInternalNode(source);
	const targetNode = useInternalNode(target);
	const anchors = facingSideAnchorsFor(clipRectOf(sourceNode), clipRectOf(targetNode)) ?? {
		sourceX,
		sourceY,
		targetX,
		targetY,
	};
	// When the routing pass produced an obstacle-avoiding polyline (edge routing
	// ON), draw it; otherwise fall back to EXACTLY the straight/curved geometry.
	// routedPoints are ABSOLUTE flow coords and RF gives us absolute sourceX/Y too,
	// so routedGeometryFor applies no transform (see its doc + edge-routing__02 item 3).
	const routedPoints = data?.routedPoints;
	const geometry =
		routedPoints !== undefined && routedPoints.length >= 2
			? routedGeometryFor(routedPoints)
			: edgePathFor(
					anchors.sourceX,
					anchors.sourceY,
					anchors.targetX,
					anchors.targetY,
					data?.hasOpposite ?? false,
				);
	const badge = linkCountBadgeText(data?.count ?? 1);
	const relationLabels = (data?.relations ?? []).map(relationLabelText);
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
			{relationLabels.length > 0 && (
				<EdgeLabelRenderer>
					{/* Stacked ABOVE the line so the count badge keeps the midpoint; the
					    dedicated GREAT-UI ticket iterates the multi-name presentation. */}
					<div
						className="vicinity-graph-edge__relations"
						style={{
							transform: `translate(-50%, -100%) translate(${geometry.labelX}px, ${geometry.labelY - EDGE_RELATION_LABEL_GAP_PX}px)`,
						}}
					>
						{relationLabels.map((text, index) => (
							// Index key: two distinct rel notes can share a display name, and the
							// list is a stable, display-only projection of the deduped labels.
							<span key={index} className="vicinity-graph-edge__relation">
								{text}
							</span>
						))}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}

/** Gap (px) between the stacked relation labels and the edge line beneath them. */
const EDGE_RELATION_LABEL_GAP_PX = 6;
