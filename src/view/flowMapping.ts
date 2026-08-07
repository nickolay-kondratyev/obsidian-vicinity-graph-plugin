import type {
	EdgeKind,
	FolderPath,
	GraphEdge,
	GraphNode,
	NodeContentOverride,
	NodePreviewKind,
	OutlineEntry,
	ViewSettings,
	VicinityGraph,
} from "../engine";
import { nodePreviewKind } from "../engine";
import { resolveNodePreviewPreference } from "./nodePreviewChoice";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { OUTLINE_RENDER_LIMIT } from "./constants";
import type { AttachmentIconGroup } from "./attachmentIconStrip";
import { attachmentIconStrip } from "./attachmentIconStrip";
import { deriveFolderGroups } from "./folderGrouping";
import { deriveNestingForest, isIntraTreeEdge, nestedPaths, outermostContainerOf } from "./embedNesting";
import type { NestingForest } from "./embedNesting";
import type { OrphanTruncation } from "./truncationBadges";
import { deriveTruncationBadges } from "./truncationBadges";
import { edgeIdOf, folderGroupIdOf, nodeContentFitPx, nodeDimensionsPx, nodeSizeOverridePx } from "./graphIdentity";
import type { RoutedPoint } from "./edgeRouting";

/**
 * Pure engine → React Flow shape mapping. Emits plain objects only (no React,
 * no `@xyflow/react` import) so it is node-testable; the ItemView adapts these
 * into concrete React Flow `Node`/`Edge` values at the render boundary.
 */

export interface XY {
	readonly x: number;
	readonly y: number;
}

/**
 * Styling tier (step-05): MAIN, pinned central (isCentral without isMain), or
 * regular. An explicit discriminant so render components never re-derive it
 * from flag pairs.
 */
export type NodeTier = "main" | "pinned-central" | "regular";

/**
 * Note-node payload the rich renderer needs (step-05).
 *
 * WHY a type alias, not an interface: React Flow constrains node `data` to
 * `Record<string, unknown>`, which type-alias object types satisfy via their
 * implicit index signature while interfaces do not — the alias lets the render
 * boundary type `Node<FlowNodeData>` without casts.
 */
export type FlowNodeData = {
	readonly path: string;
	readonly title: string;
	/** Echoed engine docid — present on centrals (MAIN + pinned); drives unpin. */
	readonly docid?: string;
	readonly tier: NodeTier;
	/**
	 * Whether this note's doc is in the persisted pinned set — the fact the
	 * pin/unpin toggle switches on. Distinct from {@link tier}: a pinned MAIN
	 * still styles as `main` but must offer "unpin".
	 */
	readonly isPinned: boolean;
	/**
	 * Whether a persisted per-node size override shaped this node's box — the
	 * fact the context menu's "Reset size" entry switches on.
	 */
	readonly hasSizeOverride: boolean;
	/** Engine folder path ("" = vault root). */
	readonly folder: string;
	/**
	 * Heading outline to render inside the node: FLAT, in document order, with RAW
	 * heading text, already depth-filtered and capped at {@link OUTLINE_RENDER_LIMIT}.
	 * Empty when the note offers no outline at all. Carried even when
	 * {@link preview} is not `"outline"` — the mapping reports, it never deletes
	 * data. The flat array is the stable contract between this mapping and the
	 * outline UI: nesting, labels and markup are the UI's own business.
	 */
	readonly outline: readonly OutlineEntry[];
	/**
	 * Which region claims the node's single preview slot — the DECISION, already
	 * made (see {@link nodePreviewKind}), so the renderer decides nothing and
	 * `data-preview` can never advertise a region the node does not render.
	 */
	readonly preview: NodePreviewKind;
	/**
	 * The doc's stored per-node CONTENT override, or absent for "Inherit" — the
	 * fact the hover gear's Content menu checks the current choice against.
	 * REPORTED, not applied: {@link preview} already reflects it (resolved through
	 * {@link resolveNodePreviewPreference}); this echoes the raw override so the
	 * menu can distinguish "Inherit" from an override that happens to match global.
	 */
	readonly contentOverride?: NodeContentOverride;
	/** Thumbnail candidate (vault path; the component resolves it to a URL). */
	readonly firstImagePath?: string;
	/** Total images among attachments — the thumbnail's "+N more" badge is imageCount - 1. */
	readonly imageCount: number;
	/** Icon strip entries (per-extension counts + dropdown paths). */
	readonly attachmentGroups: readonly AttachmentIconGroup[];
	/**
	 * True when this note EMBEDS other rendered notes that nest inside it — it is
	 * a container (embed-nesting P3). Its own content renders in the TOP band; its
	 * nested children render below as React Flow subflow children. Drives the
	 * container styling and disables its drag-resize (decision Q8).
	 */
	readonly isContainer: boolean;
	/**
	 * True when this note renders INSIDE a container (its `parentId` is a note id,
	 * not a folder-group id). Nested nodes get the distinct nested styling, are
	 * non-draggable (their position is owned by the container's stack), and have
	 * their drag-resize disabled (decision Q8).
	 */
	readonly isNested: boolean;
};

/** Folder-group node payload (label + truncation badge). Type alias for the
 * same React Flow `data` constraint reason as {@link FlowNodeData}. */
export type FlowGroupData = {
	readonly folder: string;
	/** Display name (last path segment) — the group label. */
	readonly folderName: string;
	/** Truncated-away nodes of this folder — the group's "+N" badge; 0 = no badge. */
	readonly hiddenCount: number;
};

interface FlowNodeBase {
	/** React Flow / elk node id — the vault path (notes) or folderGroupIdOf (groups). */
	readonly id: string;
	/**
	 * RF-ready position: relative to `parentId`'s origin when present,
	 * absolute otherwise (React Flow subflow convention).
	 */
	readonly position: XY;
	readonly width: number;
	readonly height: number;
	/** Rendered folder-group container (React Flow subflow parent). */
	readonly parentId?: string;
}

export interface NoteFlowNode extends FlowNodeBase {
	readonly kind: "note";
	readonly data: FlowNodeData;
}

export interface GroupFlowNode extends FlowNodeBase {
	readonly kind: "folder-group";
	readonly data: FlowGroupData;
}

export type FlowNode = NoteFlowNode | GroupFlowNode;

/** One engine note→note pair a rendered edge stands for (directed, vault paths). */
export interface EdgeNotePair {
	readonly source: string;
	readonly target: string;
}

export interface FlowEdge {
	readonly id: string;
	readonly source: string;
	readonly target: string;
	/**
	 * The engine note→note pairs behind this rendered edge, in first-seen engine
	 * order: exactly one for a passthrough edge; every contributor (both
	 * directions included) for a group-collapsed edge, whose `source`/`target`
	 * are folder-group ids. The edge-click preview queries occurrences per pair
	 * from this list — the rendered endpoints alone cannot name the notes.
	 */
	readonly notePairs: readonly EdgeNotePair[];
	/** Distinct links source→target — the edge's count badge (1 = no badge). */
	readonly count: number;
	/**
	 * The pair's relationship summary (engine truth) — drives the stroke styling
	 * via {@link edgeKindClassName}. A collapsed group edge UNIONS its
	 * contributors' kinds: any link+embed mix reads `"both"`.
	 */
	readonly kind: EdgeKind;
	/**
	 * True when the reverse edge (target→source) is also rendered as a SEPARATE
	 * FlowEdge. Both edges of such a pair curve away from the straight line on
	 * the right of their OWN travel direction, which mirrors them automatically
	 * — no extra offset-sign field needed. Mutually exclusive with
	 * {@link bidirectional}: a group-collapsed pair is a single edge, not two.
	 */
	readonly hasOpposite: boolean;
	/**
	 * True for a group-collapsed edge that unions BOTH directions into ONE
	 * straight line drawn with an arrowhead at each end. Only ever set on
	 * collapsed edges (see {@link vicinityGraphToFlow}); plain note↔note pairs
	 * use the curved {@link hasOpposite} mechanism instead.
	 */
	readonly bidirectional: boolean;
	/**
	 * Obstacle-avoiding polyline (ABSOLUTE coords) from the post-layout routing
	 * pass, present when the pass produced a route for this edge (absent on the
	 * documented pass-level failure fallback, where edges render straight).
	 */
	readonly routedPoints?: readonly RoutedPoint[];
}

export interface FlowGraph {
	readonly nodes: readonly FlowNode[];
	readonly edges: readonly FlowEdge[];
	/** Graph-corner "+N hidden" overlay data (zero-total constant when nothing is hidden). */
	readonly orphanTruncation: OrphanTruncation;
}

/** Position every node gets before layout runs (elk overwrites it). */
const UNPLACED: XY = { x: 0, y: 0 };

/**
 * Group nodes are sized by elk (container wraps its children); before layout
 * they carry this placeholder, replaced via {@link withGroupDimensions}.
 */
const UNSIZED_GROUP_PX = 0;

/**
 * @param mainPinned whether the MAIN doc itself is in the persisted pinned set
 * (the engine skips main-as-pin, so this fact must be supplied by the caller).
 */
export function vicinityGraphToFlow(graph: VicinityGraph, mainPinned: boolean): FlowGraph {
	// Nesting is derived FIRST: its nested set is excluded from folder grouping
	// (decision Q4 — nesting wins), so the same forest steers both parentIds here
	// and the elk container structure (elkMapping derives it independently — pure
	// and deterministic, so the two agree).
	const nesting = deriveNestingForest(graph);
	const nested = nestedPaths(nesting);
	const grouping = deriveFolderGroups(graph.nodes, nested);
	const badges = deriveTruncationBadges(
		graph.hiddenNodeCountsByFolder,
		new Set(grouping.groups.map((group) => group.folder)),
	);
	// Parents must precede children in React Flow's nodes array: folder groups first
	// (they parent containers and plain members), then note nodes ordered so a
	// container always precedes its nested subtree (see {@link orderNotesParentFirst}).
	const groupNodes = grouping.groups.map(
		(group): GroupFlowNode => ({
			id: folderGroupIdOf(group.folder),
			kind: "folder-group",
			position: UNPLACED,
			width: UNSIZED_GROUP_PX,
			height: UNSIZED_GROUP_PX,
			data: {
				folder: group.folder,
				folderName: VaultPathFacts.folderNameOf(group.folder),
				hiddenCount: badges.hiddenCountByGroupFolder.get(group.folder) ?? 0,
			},
		}),
	);
	const noteNodeByPath = new Map<string, NoteFlowNode>(
		graph.nodes.map((node): [string, NoteFlowNode] => {
			const assignment = nesting.nestingByPath.get(node.path);
			const isNested = assignment?.containerPath !== undefined;
			const isContainer = (assignment?.childPaths.length ?? 0) > 0;
			const groupFolder = grouping.groupFolderByMemberPath.get(node.path);
			// A nested node parents to its container note; a non-nested member parents
			// to its folder group; a nested/container node ignores its size override
			// (Q8), so its box is content-fit (elk resizes containers via
			// withGroupDimensions afterward).
			const parentId = isNested
				? assignment?.containerPath
				: groupFolder === undefined
					? undefined
					: folderGroupIdOf(groupFolder);
			const { width, height } = isNested || isContainer ? nodeContentFitPx(node) : nodeDimensionsPx(node);
			return [
				node.path,
				{
					id: node.path,
					kind: "note",
					position: UNPLACED,
					width,
					height,
					...(parentId === undefined ? {} : { parentId }),
					data: toFlowNodeData(node, mainPinned, graph.viewSettings, { isContainer, isNested }),
				},
			];
		}),
	);
	return {
		nodes: [...groupNodes, ...orderNotesParentFirst(graph.nodes, nesting, noteNodeByPath)],
		edges: buildFlowEdges(graph, grouping.groupFolderByMemberPath, nesting),
		orphanTruncation: badges.orphan,
	};
}

/**
 * Note flow nodes ordered so every container precedes its nested subtree — React
 * Flow's hard constraint (a `parentId` node must appear AFTER its parent). Emits
 * each nesting-tree ROOT in engine order, then its subtree pre-order (children in
 * the forest's already-ordered {@link NodeNesting.childPaths}); nested nodes are
 * reached only through their ancestor, never on their own. Deterministic.
 */
function orderNotesParentFirst(
	nodes: readonly GraphNode[],
	nesting: NestingForest,
	noteNodeByPath: ReadonlyMap<string, NoteFlowNode>,
): NoteFlowNode[] {
	const ordered: NoteFlowNode[] = [];
	const emit = (path: string): void => {
		const flowNode = noteNodeByPath.get(path);
		if (flowNode === undefined) {
			return;
		}
		ordered.push(flowNode);
		for (const childPath of nesting.nestingByPath.get(path)?.childPaths ?? []) {
			emit(childPath);
		}
	};
	for (const node of nodes) {
		if (nesting.nestingByPath.get(node.path)?.containerPath === undefined) {
			emit(node.path);
		}
	}
	return ordered;
}

/**
 * A collapsed edge under construction: one per UNORDERED projected pair. The
 * first-seen `{from,to}` fixes the emitted orientation (deterministic — no
 * sort); later contributing engine edges union their direction and sum `count`.
 */
interface CollapsedEdgeAccumulator {
	readonly from: string;
	readonly to: string;
	forwardSeen: boolean;
	backwardSeen: boolean;
	count: number;
	kind: EdgeKind;
	/** Contributing engine note→note pairs, in first-seen order. */
	readonly notePairs: EdgeNotePair[];
}

/** Separator that cannot occur in a vault path or folder-group id — a collision-proof delimiter. */
const UNORDERED_PAIR_KEY_SEPARATOR = "\u0000";

/**
 * Maps engine edges to rendered {@link FlowEdge}s, collapsing the fan of edges
 * crossing a folder-group boundary onto a single edge to the group box (mirrors
 * `projectedRootEdges` in elkMapping, so layout and rendering agree). An engine
 * edge is:
 * - PASSTHROUGH when neither endpoint is projected (both ungrouped) or both
 *   endpoints project to the SAME group (intra-group — kept member-to-member so
 *   the container's internal links stay visible, never a group self-loop). These
 *   keep the curved-pair `hasOpposite` semantics unchanged.
 * - COLLAPSED when its projected endpoints differ and at least one was projected
 *   onto its group. Collapsed edges union by unordered projected pair: both
 *   directions → one bidirectional edge (arrowhead each end); one direction →
 *   single arrowhead; `count` = sum of every contributing edge.
 *
 * Embed nesting (P3) layers TWO things on top:
 * - projection composes nesting THEN folder: a nested endpoint projects to its
 *   OUTERMOST container, and that container projects to its folder group if it is
 *   a grouped member. So an edge to a nested note behaves exactly like an edge to
 *   its outermost container — link previews keep the true note pairs in
 *   {@link FlowEdge.notePairs} regardless.
 * - INTRA-TREE edges are DROPPED entirely (decision Q5): any edge whose two
 *   endpoints share an outermost container (ancestor↔descendant, sibling, or
 *   relative) is removed — V1 draws no edges inside a drawn nesting tree. A losing
 *   embedder that lands OUTSIDE the winner's tree still gets its collapsed edge to
 *   the winner's outermost container (decision Q6) — that falls out of the one
 *   projection rule with no special case.
 */
function buildFlowEdges(
	graph: VicinityGraph,
	groupFolderByMemberPath: ReadonlyMap<string, FolderPath>,
	nesting: NestingForest,
): FlowEdge[] {
	const outermost = (path: string): string => outermostContainerOf(nesting, path);
	const projectId = (path: string): string => {
		const container = outermost(path);
		const folder = groupFolderByMemberPath.get(container);
		return folder === undefined ? container : folderGroupIdOf(folder);
	};
	const renderedEdgeIds = new Set(graph.edges.map(edgeIdOf));
	const passthrough: FlowEdge[] = [];
	const collapsedByPair = new Map<string, CollapsedEdgeAccumulator>();
	for (const edge of graph.edges) {
		// Edges wholly inside one nesting tree are dropped (Q5) — the ONE rule
		// shared with elkMapping via isIntraTreeEdge.
		if (isIntraTreeEdge(nesting, edge.source, edge.target)) {
			continue;
		}
		const rootSource = outermost(edge.source);
		const rootTarget = outermost(edge.target);
		const nestingMoved = rootSource !== edge.source || rootTarget !== edge.target;
		const projSource = projectId(edge.source);
		const projTarget = projectId(edge.target);
		const wasProjected = projSource !== edge.source || projTarget !== edge.target;
		if (!wasProjected || (projSource === projTarget && !nestingMoved)) {
			// Untouched by both projections, or intra-group between PLAIN members —
			// member-to-member passthrough with curved-pair semantics, as ever.
			passthrough.push({
				id: edgeIdOf(edge),
				source: edge.source,
				target: edge.target,
				notePairs: [{ source: edge.source, target: edge.target }],
				count: edge.count,
				kind: edge.kind,
				hasOpposite: renderedEdgeIds.has(edgeIdOf({ source: edge.target, target: edge.source })),
				bidirectional: false,
			});
			continue;
		}
		if (projSource === projTarget) {
			// Intra-group with a NESTED endpoint: the edge lives member-root to
			// member-root — the exact refs elkMapping's intraGroupContainerOf hands
			// elk — never the buried nested node, and never a group self-loop.
			// Collapsed (not passthrough) because several true pairs can share one
			// root pair once nesting projects them.
			accumulateCollapsedEdge(collapsedByPair, rootSource, rootTarget, edge);
			continue;
		}
		accumulateCollapsedEdge(collapsedByPair, projSource, projTarget, edge);
	}
	const collapsed = [...collapsedByPair.values()].map(
		(pair): FlowEdge => ({
			id: `${pair.from}->${pair.to}`,
			source: pair.from,
			target: pair.to,
			notePairs: pair.notePairs,
			count: pair.count,
			kind: pair.kind,
			hasOpposite: false,
			bidirectional: pair.forwardSeen && pair.backwardSeen,
		}),
	);
	return [...passthrough, ...collapsed];
}

/**
 * Kind union for a collapsed edge: two agreeing contributors keep their kind,
 * any disagreement (which necessarily mixes link with embed) reads `"both"` —
 * the same "summary, not a race" rule the engine applies per pair.
 */
function mergeEdgeKinds(a: EdgeKind, b: EdgeKind): EdgeKind {
	return a === b ? a : "both";
}

function accumulateCollapsedEdge(
	collapsedByPair: Map<string, CollapsedEdgeAccumulator>,
	projSource: string,
	projTarget: string,
	edge: GraphEdge,
): void {
	const key = [projSource, projTarget].sort().join(UNORDERED_PAIR_KEY_SEPARATOR);
	const existing = collapsedByPair.get(key);
	if (existing === undefined) {
		collapsedByPair.set(key, {
			from: projSource,
			to: projTarget,
			forwardSeen: true,
			backwardSeen: false,
			count: edge.count,
			kind: edge.kind,
			notePairs: [{ source: edge.source, target: edge.target }],
		});
		return;
	}
	existing.count += edge.count;
	existing.kind = mergeEdgeKinds(existing.kind, edge.kind);
	existing.notePairs.push({ source: edge.source, target: edge.target });
	if (projSource === existing.from && projTarget === existing.to) {
		existing.forwardSeen = true;
	} else {
		existing.backwardSeen = true;
	}
}

/**
 * Class the React Flow edge WRAPPER carries per {@link EdgeKind} — the CSS-only
 * hook for per-kind styling (currently all kinds share one solid stroke, see
 * graph-view.css). A `Record`, so a new kind cannot ship without a class.
 */
const EDGE_KIND_CLASS: Readonly<Record<EdgeKind, string>> = {
	link: "vicinity-graph-edge--kind-link",
	embed: "vicinity-graph-edge--kind-embed",
	both: "vicinity-graph-edge--kind-both",
};

export function edgeKindClassName(kind: EdgeKind): string {
	return EDGE_KIND_CLASS[kind];
}

/**
 * @param view the effective view settings — passed whole (not knob by knob) so
 * every settings-driven derivation below reads one object.
 * @param nestingRole whether this node is a container and/or nested — decides its
 * nesting styling and (since resize is disabled while nested, Q8) whether it
 * advertises an EFFECTIVE size override at all.
 */
function toFlowNodeData(
	node: GraphNode,
	mainPinned: boolean,
	view: ViewSettings,
	nestingRole: { readonly isContainer: boolean; readonly isNested: boolean },
): FlowNodeData {
	// Filter THEN slice: a depth-2 view of a note with 60 deep headings must
	// still find its shallow ones (slicing first could drop every survivor).
	const outline = node.outline
		.filter((entry) => entry.level <= view.outlineMaxDepth)
		.slice(0, OUTLINE_RENDER_LIMIT);
	return {
		path: node.path,
		title: node.title,
		...(node.docid === undefined ? {} : { docid: node.docid }),
		tier: tierOf(node),
		// A non-MAIN central IS a pin by definition; MAIN's pinned-ness comes from the caller.
		isPinned: node.isMain ? mainPinned : node.isCentral,
		// A nested or container node ignores its override (Q8), so it advertises no
		// EFFECTIVE override — the "Reset size" affordance would target a size the
		// screen does not show. A plain node reports its stored override as usual.
		hasSizeOverride:
			!nestingRole.isContainer && !nestingRole.isNested && nodeSizeOverridePx(node) !== undefined,
		isContainer: nestingRole.isContainer,
		isNested: nestingRole.isNested,
		folder: node.folder,
		outline,
		// Decided from the RENDERABLE entry count, never the engine's raw outline:
		// a note whose every heading is deeper than the cap must not claim the
		// outline slot and render an empty box. The per-node CONTENT override wins
		// over the global preference here (resolveNodePreviewPreference) — applied
		// in the VIEW so a flip stays a data-only refresh (the sizer reads the
		// global preference only, so sizePx does not move).
		preview: nodePreviewKind({
			preference: resolveNodePreviewPreference(view.nodePreviewPreference, node.override?.content),
			outlineEntryCount: outline.length,
			hasImage: node.firstImagePath !== undefined,
			imagePrecedesOutline: node.imagePrecedesOutline,
			isCentral: node.isCentral,
		}),
		...(node.override?.content === undefined ? {} : { contentOverride: node.override.content }),
		...(node.firstImagePath === undefined ? {} : { firstImagePath: node.firstImagePath }),
		imageCount: node.attachments.filter((attachment) => attachment.isImage).length,
		attachmentGroups: attachmentIconStrip(node.attachments),
	};
}

function tierOf(node: GraphNode): NodeTier {
	if (node.isMain) {
		return "main";
	}
	return node.isCentral ? "pinned-central" : "regular";
}

/**
 * Applies laid-out (or preserved) positions to freshly mapped nodes. Used both
 * after an elk relayout and on the reuse-layout path, where new node DATA is
 * kept but OLD positions are retained. Positions in the map are ABSOLUTE
 * (extractElkPositions); children of a rendered group are converted to
 * parent-relative coordinates here, because that is what React Flow subflows
 * expect. A node with no known position stays at its unplaced origin (only
 * happens transiently on the reuse path if a caller misuses it — structural
 * diff guarantees the id set matches on that path).
 */
export function withPositions(nodes: readonly FlowNode[], positions: ReadonlyMap<string, XY>): readonly FlowNode[] {
	return nodes.map((node) => {
		const absolute = positions.get(node.id);
		if (absolute === undefined) {
			return node;
		}
		// Missing parent position falls back to (0,0): the child then keeps its
		// absolute coordinates, which is the least-surprising degradation.
		const parentOrigin = (node.parentId === undefined ? undefined : positions.get(node.parentId)) ?? UNPLACED;
		return { ...node, position: { x: absolute.x - parentOrigin.x, y: absolute.y - parentOrigin.y } };
	});
}

export interface Dimensions {
	readonly width: number;
	readonly height: number;
}

/**
 * Applies elk-computed container sizes to nodes that WRAP other nodes: folder
 * groups AND embed-containers (a note whose `data.isContainer` is set — elk grew
 * its box to hold its nested stack plus its own-content top band). Plain note
 * nodes and nested LEAF children keep their mapping-time box (`nodeDimensionsPx` /
 * `nodeContentFitPx`) — elk echoes a leaf's input size, so the mapping stays the
 * single note-sizing truth for them.
 */
export function withGroupDimensions(
	nodes: readonly FlowNode[],
	dimensions: ReadonlyMap<string, Dimensions>,
): readonly FlowNode[] {
	return nodes.map((node) => {
		const wraps = node.kind === "folder-group" || (node.kind === "note" && node.data.isContainer);
		if (!wraps) {
			return node;
		}
		const size = dimensions.get(node.id);
		return size === undefined ? node : { ...node, width: size.width, height: size.height };
	});
}
