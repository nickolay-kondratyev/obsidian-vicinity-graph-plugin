import { applyNodeChanges, Background, Controls, Panel, ReactFlow, useReactFlow, useStore } from "@xyflow/react";
import type { Edge, EdgeMouseHandler, EdgeTypes, Node, NodeMouseHandler, NodeTypes, OnNodesChange } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { hiddenOverlayText, orphanBreakdownTitle } from "./badgeText";
import { GRAPH_MIN_ZOOM } from "./constants";
import { ControlsActionsContext } from "./ControlsActionsContext";
import { FolderGroupNode } from "./FolderGroupNode";
import type { FlowEdge, FlowNode } from "./flowMapping";
import { edgeKindClassName } from "./flowMapping";
import { GraphToolbar } from "./GraphToolbar";
import type { GraphViewController } from "./GraphViewController";
import { GraphUiContext } from "./GraphUiContext";
import { LinkPreviewDrawer } from "./LinkPreviewDrawer";
import { REACT_FLOW_GLOBAL_KEY_BINDINGS } from "./reactFlowKeyBindings";
import type { LinkPreviewOverlayStore } from "./LinkPreviewOverlayStore";
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
	linkPreview,
}: {
	readonly controller: GraphViewController;
	readonly ui: GraphUiPort;
	readonly actions: ControlsActionsPort;
	/** The drawer's model store — the controller writes it, this component renders it. */
	readonly linkPreview: LinkPreviewOverlayStore;
}): ReactElement {
	const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
	const previewModel = useSyncExternalStore(linkPreview.subscribe, linkPreview.getSnapshot);

	// An emptied graph unmounts the flow below; drop the drawer's model too, or
	// the NEXT graph would re-show a preview from the previous one.
	useEffect(() => {
		if (snapshot.status === "empty") {
			linkPreview.close();
		}
	}, [snapshot.status, linkPreview]);

	// Nodes are LOCAL React state seeded from the controller's snapshot, not the
	// snapshot mapped straight into the prop: a controlled <ReactFlow> applies NO
	// change itself, so the NodeResizer drag inside NoteNode only moves the box if
	// onNodesChange applies its dimension changes somewhere. The controller stays
	// the one source of truth — every publish (including the commit-on-release
	// rebuild) replaces this state wholesale in the reseed below.
	const mappedNodes = useMemo<Node[]>(() => snapshot.nodes.map(toReactFlowNode), [snapshot.nodes]);
	const [nodes, setNodes] = useState<Node[]>(mappedNodes);
	const [seededFrom, setSeededFrom] = useState<Node[]>(mappedNodes);
	// Reseeded DURING the render that brings the new mapping, not from an effect:
	// `edges` below is a plain memo, so an effect-based reseed would COMMIT one frame
	// of new edges against the previous build's nodes — React Flow would resolve those
	// edges against ids that are not there yet. React re-runs this render before
	// committing anything, so the two props can never disagree.
	if (seededFrom !== mappedNodes) {
		setSeededFrom(mappedNodes);
		setNodes(mappedNodes);
	}
	const onNodesChange = useCallback<OnNodesChange>(
		(changes) => setNodes((current) => applyNodeChanges(changes, current)),
		[],
	);
	const edges = useMemo<Edge[]>(() => snapshot.edges.map(toReactFlowEdge), [snapshot.edges]);

	const onNodeClick = useCallback<NodeMouseHandler>(
		// Plain click FOCUSES the node — it becomes the graph's MAIN and its
		// markdown opens in the current tab (tickets
		// nid_lfcyfbrggrusyv8xn1aroc7h1_e + nid_r5xy3vuw2kj1v75soe4ffwdjz_e,
		// superseding the flyout of ticket
		// nid_z2k1eebic1nilpz9z3r65cnrx_e); ctrl/cmd-click opens the note in a
		// NEW tab — `opensInNewTab` is the ONE definition of that gesture,
		// shared with the outline entries. Any open drawer is dismissed first
		// (same rule as the pane click). The controller ignores folder-group
		// ids on both paths.
		(event, node) => {
			if (opensInNewTab(event)) {
				controller.openNode(node.id, { newTab: true });
				return;
			}
			linkPreview.close();
			controller.focusNode(node.id);
		},
		[controller, linkPreview],
	);

	const onEdgeClick = useCallback<EdgeMouseHandler>(
		// By id, not endpoints: a group-collapsed edge's source/target are
		// folder-group ids — the controller resolves the note pairs behind the
		// visual from the published FlowEdge.notePairs.
		(_event, edge) => void controller.openEdgePreview(edge.id),
		[controller],
	);

	// Clicking the empty pane dismisses the preview drawer (ticket
	// nid_5j9mygfywppaiakuim3utf6r2_e); a no-op while nothing is shown.
	const onPaneClick = useCallback(() => linkPreview.close(), [linkPreview]);

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
							onNodesChange={onNodesChange}
							onNodeClick={onNodeClick}
							onEdgeClick={onEdgeClick}
							onPaneClick={onPaneClick}
							nodesConnectable={false}
							// The graph is read-only in V1: layout is elk-driven and would
							// overwrite any manual placement on the next rebuild, so a drag
							// would only snap back. Disable it rather than ship half-working
							// drag (decision 2026-07-20, [[ticket-node-drag-reposition]]).
							nodesDraggable={false}
							// Null EVERY RF key binding — RF would otherwise grab keys
							// window-wide (ate Space in canvas cards, ticket
							// nid_156zg4bvhjc7nnl0gwut20bvs_e). WHY lives on the constant.
							{...REACT_FLOW_GLOBAL_KEY_BINDINGS}
							// See GRAPH_MIN_ZOOM — RF's 0.5 default clamps fitView on dense
							// graphs, leaving part of the vicinity unreachable off-pane.
							minZoom={GRAPH_MIN_ZOOM}
							// Mount only nodes overlapping the pan/zoom viewport so a
							// large/image-heavy graph doesn't hold every node (and its lazy
							// <img> thumbnail) in the DOM at once. Safe with folder-group
							// subflows: React Flow renders EVERY visible node as a flat
							// sibling of `.react-flow__nodes`, transformed by its own
							// `positionAbsolute` — group members are not DOM children of
							// their container, so culling the container cannot take them
							// with it. (Culling is "partially visible" anyway, so a group
							// box only unmounts once it is fully off-pane, by which point
							// its members are too.) Culling math never needs DOM
							// measurement: every node carries explicit width/height
							// (toReactFlowNode).
							onlyRenderVisibleElements
							// Hide React Flow's "React Flow" attribution badge: inside an
							// Obsidian pane it reads as chrome from another app and overlaps
							// the bottom-right of the graph. NOTE: xyflow asks that only Pro
							// subscribers set this — see the ticket/release note.
							proOptions={{ hideAttribution: true }}
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
						{previewModel !== null && (
							<LinkPreviewDrawer
								model={previewModel}
								renderIcon={(el, iconId) => ui.renderIcon(el, iconId)}
								renderMarkdown={(el, markdown, sourcePath) => ui.renderMarkdown(el, markdown, sourcePath)}
								// A snippet's [[link]] click carries a LINKTEXT, not a node path.
								onOpenLink={(linktext, sourcePath) => controller.openMarkdownLink(linktext, sourcePath)}
								onClose={() => linkPreview.close()}
								// GO reuses the node-open path (folder-group guard included);
								// the drawer already closed itself before reporting.
								onGo={(target) => controller.openNode(target.path, { newTab: false, line: target.line })}
							/>
						)}
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
		// Rides the RF edge wrapper <g>, so the kind styling stays CSS-only.
		className: edgeKindClassName(edge.kind),
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
