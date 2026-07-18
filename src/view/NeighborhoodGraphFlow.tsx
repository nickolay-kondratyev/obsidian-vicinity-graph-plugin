import { Background, Controls, ReactFlow } from "@xyflow/react";
import type { Edge, Node, NodeMouseHandler } from "@xyflow/react";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import type { GraphViewController } from "./GraphViewController";
import type { FlowEdge, FlowNode } from "./flowMapping";

/**
 * Renders the controller's current flow snapshot with React Flow. Deliberately
 * plain (step-04 scope): default nodes labelled by title, pan/zoom/fit-view and
 * click-to-open. All state comes from the controller's external store; this
 * component holds none of its own. React Flow's types are confined to this file
 * — the pure mapping modules stay `@xyflow/react`-free.
 */
export function NeighborhoodGraphFlow({ controller }: { readonly controller: GraphViewController }): ReactElement {
	const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

	const nodes = useMemo<Node[]>(() => snapshot.nodes.map(toReactFlowNode), [snapshot.nodes]);
	const edges = useMemo<Edge[]>(() => snapshot.edges.map(toReactFlowEdge), [snapshot.edges]);

	const onNodeClick = useCallback<NodeMouseHandler>(
		(_event, node) => controller.openNode(node.id),
		[controller],
	);

	if (snapshot.status === "empty") {
		return <div className="neighborhood-graph-empty">No neighborhood graph for the active file.</div>;
	}

	return (
		<div className="neighborhood-graph-flow">
			<ReactFlow nodes={nodes} edges={edges} onNodeClick={onNodeClick} fitView>
				<Background />
				<Controls />
			</ReactFlow>
		</div>
	);
}

function toReactFlowNode(node: FlowNode): Node {
	return {
		id: node.id,
		position: { x: node.position.x, y: node.position.y },
		// Default React Flow node renders `data.label`.
		data: { label: node.data.title },
		style: { width: node.width, height: node.height },
	};
}

function toReactFlowEdge(edge: FlowEdge): Edge {
	return { id: edge.id, source: edge.source, target: edge.target };
}
