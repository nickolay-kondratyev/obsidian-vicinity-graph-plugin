import { Background, Controls, Panel, ReactFlow, useReactFlow, useStore } from "@xyflow/react";
import type { Edge, EdgeTypes, Node, NodeMouseHandler, NodeTypes } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { hiddenOverlayText, orphanBreakdownTitle } from "./badgeText";
import { GRAPH_MIN_ZOOM } from "./constants";
import { ControlsActionsContext } from "./ControlsActionsContext";
import { FolderGroupNode } from "./FolderGroupNode";
import type { FlowEdge, FlowNode } from "./flowMapping";
import { GraphToolbar } from "./GraphToolbar";
import type { GraphViewController } from "./GraphViewController";
import { GraphUiContext } from "./GraphUiContext";
import { VicinityEdge } from "./VicinityEdge";
import { NoteNode } from "./NoteNode";
import { NoteOpenContext } from "./NoteOpenContext";
import { opensInNewTab } from "./nodeOpenIntent";
import type { ControlsActionsPort, GraphUiPort, NoteOpenPort } from "./viewPorts";

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
		// Ctrl/cmd-click opens a NEW tab (CLARIFICATION Q2) — `opensInNewTab` is the
		// ONE definition of that gesture, shared with the outline entries. The
		// controller ignores folder-group ids.
		(event, node) => controller.openNode(node.id, { newTab: opensInNewTab(event) }),
		[controller],
	);

	// Node components cannot receive the controller as a prop (React Flow
	// instantiates them), so navigation reaches them through this one-method port.
	const noteOpen = useMemo<NoteOpenPort>(
		() => ({ openNote: (path, options) => controller.openNode(path, options) }),
		[controller],
	);

	// The note preview is triggered by NoteNode itself (scoped to its content
	// zone so the attachment tiles stay a dead zone), not here — a node-level
	// mouse-enter would re-cover those tiles with the popover.

	if (snapshot.status === "empty") {
		return <div className="vicinity-graph-empty">No vicinity graph for the active file.</div>;
	}

	return (
		<GraphUiContext.Provider value={ui}>
			<ControlsActionsContext.Provider value={actions}>
				<NoteOpenContext.Provider value={noteOpen}>
					<div className="vicinity-graph-flow">
						<ReactFlow
							nodes={nodes}
							edges={edges}
							nodeTypes={NODE_TYPES}
							edgeTypes={EDGE_TYPES}
							onNodeClick={onNodeClick}
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
							// See GRAPH_MIN_ZOOM — RF's 0.5 default clamps fitView on dense
							// graphs, leaving part of the vicinity unreachable off-pane.
							minZoom={GRAPH_MIN_ZOOM}
							// Mount only nodes overlapping the pan/zoom viewport so a
							// large/image-heavy graph doesn't hold every node (and its lazy
							// <img> thumbnail) in the DOM at once. Safe with folder-group
							// subflows: group parents render no <Handle>, so React Flow's
							// `forceInitialRender` (keyed on missing handleBounds) keeps them
							// always mounted, and children are culled by their own absolute
							// rect — the container never disappears out from under them.
							// Culling math never needs DOM measurement: every node carries
							// explicit width/height (toReactFlowNode).
							onlyRenderVisibleElements
							// WHY-NOT the `fitView` prop: it fires exactly once at mount,
							// racing Obsidian's pane layout (observed producing an off-graph
							// viewport in a fresh sidebar) and never refitting after rebuilds.
							// FitViewOnLayoutChange owns fitting instead.
						>
							<FitViewOnLayoutChange layoutVersion={snapshot.layoutVersion} />
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
				</NoteOpenContext.Provider>
			</ControlsActionsContext.Provider>
		</GraphUiContext.Provider>
	);
}

/**
 * Fits the viewport to the CURRENT graph whenever a fresh elk layout is
 * published ({@link FlowSnapshot.layoutVersion}) — including the first one
 * after mount. Deferred one animation frame so React Flow has ingested this
 * render's `nodes` prop and the Obsidian pane has real dimensions; `fitView`
 * works on the nodes' explicit width/height, so culled (unmounted) nodes are
 * fitted too.
 */
function FitViewOnLayoutChange({ layoutVersion }: { readonly layoutVersion: number }): null {
	const { fitView } = useReactFlow();
	// Fitting before React Flow has measured its pane is a silent no-op (or fits
	// a zero-sized rect) — the exact mount race behind the broken `fitView` prop.
	// The store's width/height flip once the pane is measured, re-running the
	// effect, so the first REAL fit is deterministic.
	const paneReady = useStore((store) => store.width > 0 && store.height > 0);
	useEffect(() => {
		if (!paneReady) {
			return;
		}
		const frame = requestAnimationFrame(() => void fitView());
		return () => cancelAnimationFrame(frame);
	}, [fitView, paneReady, layoutVersion]);
	return null;
}

function toReactFlowNode(node: FlowNode): Node {
	const base = {
		id: node.id,
		position: { x: node.position.x, y: node.position.y },
		// Explicit RF dimensions (not just style): culling and fitView then know
		// every node's rect WITHOUT waiting for a DOM measurement pass.
		width: node.width,
		height: node.height,
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
		// routedPoints are ABSOLUTE flow-space coordinates: RF re-derives each node's
		// absolute rect (even subflow children) for edge endpoints, so the routed
		// polyline needs NO coordinate transform to render (ticket decision #2). Threaded
		// unused this phase — VicinityEdge starts consuming it in edge-routing__02.
		data: {
			count: edge.count,
			hasOpposite: edge.hasOpposite,
			bidirectional: edge.bidirectional,
			...(edge.routedPoints === undefined ? {} : { routedPoints: edge.routedPoints }),
		},
	};
}
