import { Background, ControlButton, Controls, Panel, ReactFlow, useReactFlow, useStore } from "@xyflow/react";
import type {
	Edge,
	EdgeMouseHandler,
	EdgeTypes,
	Node,
	NodeMouseHandler,
	NodeTypes,
	OnNodesChange,
} from "@xyflow/react";
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
import { isResizeGestureChange, startedOnResizeGrip } from "./nodeResize";
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

	// Any not-`ready` status unmounts the flow below; drop the drawer's model too,
	// or the NEXT graph would re-show a preview from the previous one.
	useEffect(() => {
		if (snapshot.status !== "ready") {
			linkPreview.close();
		}
	}, [snapshot.status, linkPreview]);

	// The nodes React Flow renders are mapped STRAIGHT from the published snapshot
	// each render — the controller is the one source of truth, so between gestures
	// the pane can never hold a box the store no longer has. `snapshot.nodes` changes
	// identity exactly once per publish, so this memo only remaps on a real rebuild.
	const baseNodes = useMemo<Node[]>(() => snapshot.nodes.map(toReactFlowNode), [snapshot.nodes]);

	// The ONE exception to "render the snapshot": a resize drag in flight. A
	// controlled <ReactFlow> applies no dimension change itself, so the NodeResizer
	// inside NoteNode only moves the box if we overlay the gesture's live size onto
	// the dragged node until the commit-on-release rebuild republishes it. This
	// overlay is the ONLY node state this view holds, and it is NARROW: one node, and
	// null between gestures.
	//
	// WHY-NOT the previous standing local `nodes` mirror reseeded on `snapshot.nodes`
	// identity (ticket nid_1s77g4wx33uj8b380d1oph1d6_e): that mirror could drift BELOW
	// the snapshot and never recover. React Flow's ResizeObserver re-measures a node
	// it already rendered and routes a `dimensions` change through `onNodesChange`;
	// under load that measured the node's PRE-repaint DOM and a functional `setNodes`
	// reverted the local box to the PREVIOUS build's, while the identity-keyed reseed
	// gate — having already consumed that snapshot — could not re-fire. A whole
	// refreshOpenViews() fan-out (every settings / pin / size-override write) was then
	// silently swallowed until some unrelated event rebuilt the pane. Deriving from the
	// snapshot deletes the mirror: with no gesture the overlay is null and
	// `nodes === baseNodes === snapshot`, so there is nothing left to strand.
	const [resizeOverlay, setResizeOverlay] = useState<ResizeOverlay | null>(null);
	const [overlaySeededFrom, setOverlaySeededFrom] = useState<readonly FlowNode[]>(snapshot.nodes);
	// A fresh publish makes the released/dragged box authoritative again — drop the
	// overlay so the node tracks the snapshot. Done DURING render (not an effect), the
	// same reason `edges` is a plain memo: an effect-based clear would commit one frame
	// of overlay box against a snapshot that already moved on. A REFUSED drag-resize
	// still publishes (its GuardedWriteOutcome triggers the rebuild), so this clear is
	// what snaps that node back to the stored box instead of stranding on the overlay.
	if (overlaySeededFrom !== snapshot.nodes) {
		setOverlaySeededFrom(snapshot.nodes);
		if (resizeOverlay !== null) {
			setResizeOverlay(null);
		}
	}
	const nodes = useMemo<Node[]>(
		() => applyResizeOverlay(baseNodes, resizeOverlay),
		[baseNodes, resizeOverlay],
	);

	// ONLY a resize GESTURE moves the overlay. Everything else React Flow routes
	// through this callback belongs to the controller (positions come from elk) or to
	// nobody (the graph is read-only: no deletion, and SELECTION is a state this view
	// has no meaning for — MAIN and pinned-central are its only node tiers, both
	// engine facts). The discriminator is by SOURCE, not just change TYPE: RF emits
	// `dimensions` changes both from the resize drag (carries a `resizing` flag) AND
	// from its own ResizeObserver re-measuring a node (no flag). Only the drag opens or
	// moves the overlay; a re-measure is ignored outright, so it can never feed a stale
	// box back in (ticket nid_c78k90su87jrzigxvfjv5t95g_e).
	const onNodesChange = useCallback<OnNodesChange>((changes) => {
		for (const change of changes) {
			if (!isResizeGestureChange(change) || change.dimensions === undefined) {
				continue;
			}
			setResizeOverlay({
				id: change.id,
				width: change.dimensions.width,
				height: change.dimensions.height,
			});
		}
	}, []);
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
			// A resize grip is a CONTROL riding the node wrapper, not the node's
			// body: a press on one that never moved still reaches here as a click
			// (d3-drag suppresses the click only once the pointer has MOVED), and
			// focusing the note on a mis-grabbed handle is the opposite of what the
			// gesture asked for.
			if (startedOnResizeGrip(event)) {
				return;
			}
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

	// Its own element, not the empty state's copy: the FIRST build waits on the
	// docid warm-up (ticket nid_y081nezeucka9l0x3umebi5zo_e), and "no graph for
	// this file" would be a wrong answer to a question still open. Only that build
	// publishes this status — see GraphViewController.firstBuildPending.
	if (snapshot.status === "building") {
		// The FIRST build after Obsidian loads pays the docid warm-up and can take
		// a moment on a large vault (FlowSnapshot.isInitialBuild); say so, so the
		// wait reads as a one-off rather than the graph's everyday speed. Every
		// later build reads a warm map and is fast, so it gets the plain copy.
		return (
			<div className="vicinity-graph-building">
				{snapshot.isInitialBuild
					? "Building the vicinity graph for the first time — this is quicker afterwards…"
					: "Building the vicinity graph…"}
			</div>
		);
	}
	if (snapshot.status === "empty") {
		return <div className="vicinity-graph-empty">No vicinity graph for the active file.</div>;
	}
	// Every attempt of the rebuild failed (GraphViewController.REBUILD_ATTEMPTS —
	// the automatic retry is already spent by the time this renders), so the pane
	// says so instead of standing behind a screen it can no longer vouch for. The
	// button is the ONLY way back into the pipeline short of a vault/settings event.
	if (snapshot.status === "failed") {
		return (
			<div className="vicinity-graph-failed">
				<div>Could not build the vicinity graph for the active file.</div>
				<button type="button" className="mod-cta" onClick={() => controller.retryRebuild()}>
					Try again
				</button>
			</div>
		);
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
							{/*
							 * Zoom + fit-view only. The library's interactivity LOCK toggles
							 * the store's nodesDraggable/nodesConnectable/elementsSelectable,
							 * and not one of them can reach this graph: React Flow drills the
							 * `nodesDraggable` PROP (false, above) into every node wrapper
							 * rather than reading the store, nothing is wired to `onConnect`,
							 * and selection changes are filtered out in `onNodesChange`. All
							 * the button ever did was drop the edge pointer cursor while
							 * "locked" and re-arm the decorative handles as connectable when
							 * unlocked — a control that promises interactivity it cannot
							 * grant (ticket nid_xvuptvuct2b9uget7oc2asyif_e).
							 */}
							<Controls showInteractive={false}>
								{/*
								 * Manual redraw (ticket nid_cd9x8a7ltnht3vvxh13qcvlzr_e): a
								 * data-only refresh can keep a stale layout (most visibly a
								 * folder-group box left oversized after a shrink), so this
								 * FORCES a fresh elk pass of the current main. Sits with the
								 * zoom/fit buttons as a native `ControlButton`, so it inherits
								 * the same themed chrome (graph-view.css) and icon sizing as
								 * the library's own buttons (which include `type="button"`).
								 */}
								<ControlButton
									onClick={() => controller.redraw()}
									title="Redraw graph"
									aria-label="Redraw graph"
								>
									<RedrawIcon />
								</ControlButton>
							</Controls>
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
		const frame = window.requestAnimationFrame(() => void fitView());
		return () => window.cancelAnimationFrame(frame);
	}, [fitView, paneReady, layoutVersion]);
	return null;
}

/**
 * The redraw control's glyph: the two-arrow "refresh" mark (lucide `refresh-cw`),
 * the conventional icon for "regenerate / redraw this". Inline SVG rather than
 * `GraphUiPort.renderIcon` so it renders exactly like React Flow's own zoom/fit
 * buttons (both inline SVG); the library's `.react-flow__controls-button svg`
 * rule sizes it, and `currentColor` inherits the themed button colour. This is a
 * STROKE (outline) glyph, so the `vicinity-graph-redraw-icon` class re-asserts
 * `fill: none` over that same library rule's `fill: currentColor` (graph-view.css).
 */
function RedrawIcon(): ReactElement {
	return (
		<svg
			className="vicinity-graph-redraw-icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<polyline points="23 4 23 10 17 10" />
			<polyline points="1 20 1 14 7 14" />
			<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
		</svg>
	);
}

/** A resize gesture's live box, overlaid on the ONE dragged node until it commits. */
export interface ResizeOverlay {
	readonly id: string;
	readonly width: number;
	readonly height: number;
}

/**
 * Overlays a resize gesture's live box onto the one node being dragged, leaving
 * every other node exactly as the snapshot published it. A null overlay (between
 * gestures) returns the base array unchanged, so React Flow keeps every node
 * identity and re-adopts nothing. Both the RF `width`/`height` and the inline
 * `style` are set — the wrapper reads `node.width ?? node.style.width`, so both
 * must move together for the box to follow the pointer.
 */
export function applyResizeOverlay(baseNodes: Node[], overlay: ResizeOverlay | null): Node[] {
	if (overlay === null) {
		return baseNodes;
	}
	return baseNodes.map((node) =>
		node.id === overlay.id
			? {
					...node,
					width: overlay.width,
					height: overlay.height,
					style: { ...node.style, width: overlay.width, height: overlay.height },
				}
			: node,
	);
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
