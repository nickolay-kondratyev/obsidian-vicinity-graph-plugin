import { Background, Controls, Panel, ReactFlow } from "@xyflow/react";
import type { Edge, EdgeTypes, Node, NodeMouseHandler, NodeTypes } from "@xyflow/react";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { hiddenOverlayText, orphanBreakdownTitle } from "./badgeText";
import { ControlsActionsContext } from "./ControlsActionsContext";
import { FolderGroupNode } from "./FolderGroupNode";
import type { FlowEdge, FlowNode } from "./flowMapping";
import { GraphToolbar } from "./GraphToolbar";
import type { GraphViewController } from "./GraphViewController";
import { GraphUiContext } from "./GraphUiContext";
import { isFolderGroupId } from "./graphIdentity";
import { VicinityEdge } from "./VicinityEdge";
import { NoteNode } from "./NoteNode";
import type { ControlsActionsPort, GraphUiPort } from "./viewPorts";

/**
 * Renders the controller's flow snapshot with React Flow (step-05 rich
 * rendering): custom note/group nodes, directed edges with pair curvature and
 * count badges, and the corner "+N hidden" overlay. All state comes from the
 * controller's external store; Obsidian services reach the node components via
 * {@link GraphUiContext}. React Flow types stay confined to `.tsx` files —
 * the pure mapping modules remain `@xyflow/react`-free.
 */

const NODE_TYPES: NodeTypes = { note: NoteNode, "folder-group": FolderGroupNode };
const EDGE_TYPES: EdgeTypes = { vicinity: VicinityEdge };

export function VicinityGraphFlow({
	controller,
	ui,
	actions,
}: {
	readonly controller: GraphViewController;
	readonly ui: GraphUiPort;
	readonly actions: ControlsActionsPort;
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
		return <div className="vicinity-graph-empty">No vicinity graph for the active file.</div>;
	}

	return (
		<GraphUiContext.Provider value={ui}>
			<ControlsActionsContext.Provider value={actions}>
				<div className="vicinity-graph-flow">
					<ReactFlow
						nodes={nodes}
						edges={edges}
						nodeTypes={NODE_TYPES}
						edgeTypes={EDGE_TYPES}
						onNodeClick={onNodeClick}
						onNodeMouseEnter={onNodeMouseEnter}
						nodesConnectable={false}
						// The graph is read-only in V1: layout is elk-driven and would
						// overwrite any manual placement on the next rebuild, so a drag
						// would only snap back. Disable it rather than ship half-working
						// drag (decision 2026-07-20, [[ticket-node-drag-reposition]]).
						nodesDraggable={false}
						// Ctrl/cmd is the "open in new tab" gesture (CLARIFICATION Q2);
						// RF's default multiSelectionKeyCode is the SAME modifier, so
						// each new-tab click would also toggle a meaningless persistent
						// multi-selection in this read-only graph. Disable it.
						multiSelectionKeyCode={null}
						// Mount only nodes overlapping the pan/zoom viewport so a
						// large/image-heavy graph doesn't hold every node (and its lazy
						// <img> thumbnail) in the DOM at once. Safe with folder-group
						// subflows: group parents render no <Handle>, so React Flow's
						// `forceInitialRender` (keyed on missing handleBounds) keeps them
						// always mounted, and children are culled by their own absolute
						// rect — the container never disappears out from under them.
						onlyRenderVisibleElements
						fitView
					>
						<Background />
						<Controls />
						<Panel position="top-left">
							<GraphToolbar controls={snapshot.controls} />
						</Panel>
						{snapshot.orphanTruncation.totalHiddenCount > 0 && (
							<Panel position="top-right">
								<div
									className="vicinity-graph-overlay-badge"
									title={orphanBreakdownTitle(snapshot.orphanTruncation.breakdown)}
								>
									{hiddenOverlayText(snapshot.orphanTruncation.totalHiddenCount)}
								</div>
							</Panel>
						)}
					</ReactFlow>
				</div>
			</ControlsActionsContext.Provider>
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
		type: "vicinity",
		// Arrowhead is drawn by VicinityEdge (inset from the target), not RF's marker-end.
		data: { count: edge.count, hasOpposite: edge.hasOpposite },
	};
}
