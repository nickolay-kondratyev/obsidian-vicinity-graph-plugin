import { Background, Controls, MarkerType, Panel, ReactFlow } from "@xyflow/react";
import type { Edge, EdgeTypes, Node, NodeMouseHandler, NodeTypes } from "@xyflow/react";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { hiddenOverlayText, orphanBreakdownTitle } from "./badgeText";
import { FolderGroupNode } from "./FolderGroupNode";
import type { FlowEdge, FlowNode } from "./flowMapping";
import type { GraphViewController } from "./GraphViewController";
import { GraphUiContext } from "./GraphUiContext";
import { isFolderGroupId } from "./graphIdentity";
import { NeighborhoodEdge } from "./NeighborhoodEdge";
import { NoteNode } from "./NoteNode";
import type { GraphUiPort } from "./viewPorts";

/**
 * Renders the controller's flow snapshot with React Flow (step-05 rich
 * rendering): custom note/group nodes, directed edges with pair curvature and
 * count badges, and the corner "+N hidden" overlay. All state comes from the
 * controller's external store; Obsidian services reach the node components via
 * {@link GraphUiContext}. React Flow types stay confined to `.tsx` files —
 * the pure mapping modules remain `@xyflow/react`-free.
 */

const NODE_TYPES: NodeTypes = { note: NoteNode, "folder-group": FolderGroupNode };
const EDGE_TYPES: EdgeTypes = { neighborhood: NeighborhoodEdge };

/** Arrowhead size in px; RF's default (12.5) reads too faint at graph zoom levels. */
const EDGE_ARROWHEAD_SIZE_PX = 18;

export function NeighborhoodGraphFlow({
	controller,
	ui,
}: {
	readonly controller: GraphViewController;
	readonly ui: GraphUiPort;
}): ReactElement {
	const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

	const nodes = useMemo<Node[]>(() => snapshot.nodes.map(toReactFlowNode), [snapshot.nodes]);
	const edges = useMemo<Edge[]>(() => snapshot.edges.map(toReactFlowEdge), [snapshot.edges]);

	const onNodeClick = useCallback<NodeMouseHandler>(
		// Ctrl/cmd-click opens a NEW tab (CLARIFICATION Q2); the controller
		// ignores folder-group ids.
		(event, node) => controller.openNode(node.id, { newTab: event.ctrlKey || event.metaKey }),
		[controller],
	);

	const onNodeMouseEnter = useCallback<NodeMouseHandler>(
		(event, node) => {
			if (isFolderGroupId(node.id)) {
				return; // Groups have no note to preview.
			}
			ui.showHoverPreview({
				nativeEvent: event.nativeEvent,
				targetEl: event.currentTarget as HTMLElement,
				path: node.id,
			});
		},
		[ui],
	);

	if (snapshot.status === "empty") {
		return <div className="neighborhood-graph-empty">No neighborhood graph for the active file.</div>;
	}

	return (
		<GraphUiContext.Provider value={ui}>
			<div className="neighborhood-graph-flow">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					nodeTypes={NODE_TYPES}
					edgeTypes={EDGE_TYPES}
					onNodeClick={onNodeClick}
					onNodeMouseEnter={onNodeMouseEnter}
					nodesConnectable={false}
					fitView
				>
					<Background />
					<Controls />
					{snapshot.orphanTruncation.totalHiddenCount > 0 && (
						<Panel position="top-right">
							<div
								className="neighborhood-graph-overlay-badge"
								title={orphanBreakdownTitle(snapshot.orphanTruncation.breakdown)}
							>
								{hiddenOverlayText(snapshot.orphanTruncation.totalHiddenCount)}
							</div>
						</Panel>
					)}
				</ReactFlow>
			</div>
		</GraphUiContext.Provider>
	);
}

function toReactFlowNode(node: FlowNode): Node {
	const base = {
		id: node.id,
		position: { x: node.position.x, y: node.position.y },
		style: { width: node.width, height: node.height },
		...(node.parentId === undefined ? {} : { parentId: node.parentId }),
	};
	if (node.kind === "folder-group") {
		return { ...base, type: "folder-group", data: node.data };
	}
	return { ...base, type: "note", data: node.data };
}

function toReactFlowEdge(edge: FlowEdge): Edge {
	return {
		id: edge.id,
		source: edge.source,
		target: edge.target,
		type: "neighborhood",
		markerEnd: {
			type: MarkerType.ArrowClosed,
			width: EDGE_ARROWHEAD_SIZE_PX,
			height: EDGE_ARROWHEAD_SIZE_PX,
		},
		data: { count: edge.count, hasOpposite: edge.hasOpposite },
	};
}
