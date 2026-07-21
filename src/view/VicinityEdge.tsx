import { BaseEdge, EdgeLabelRenderer } from "@xyflow/react";
import type { Edge, EdgeProps } from "@xyflow/react";
import type { ReactElement } from "react";
import { linkCountBadgeText } from "./badgeText";
import { edgePathFor } from "./edgeGeometry";

/**
 * Directed graph edge (step-05): straight line with an arrowhead normally;
 * when the reverse edge is also rendered (A↔B pair) both bow right of their
 * own travel direction and mirror apart (see `edgeGeometry`). Collapsed
 * multi-links show a "×N" badge at the path midpoint.
 */

/** Payload threaded from {@link FlowEdge} at the render boundary. */
export type VicinityEdgeData = {
	readonly count: number;
	readonly hasOpposite: boolean;
};

export type VicinityEdgeType = Edge<VicinityEdgeData, "vicinity">;

export function VicinityEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	markerEnd,
	data,
}: EdgeProps<VicinityEdgeType>): ReactElement {
	const geometry = edgePathFor(sourceX, sourceY, targetX, targetY, data?.hasOpposite ?? false);
	const badge = linkCountBadgeText(data?.count ?? 1);
	return (
		<>
			<BaseEdge id={id} path={geometry.path} markerEnd={markerEnd} />
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
