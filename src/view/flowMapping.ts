import type { FolderPath, GraphNode, VicinityGraph } from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import type { AttachmentIconGroup } from "./attachmentIconStrip";
import { attachmentIconStrip } from "./attachmentIconStrip";
import { deriveFolderGroups } from "./folderGrouping";
import type { OrphanTruncation } from "./truncationBadges";
import { deriveTruncationBadges } from "./truncationBadges";
import { breadcrumbFolderOf, edgeIdOf, folderGroupIdOf, nodeDimensionsPx } from "./graphIdentity";
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
	readonly sizePx: number;
	readonly sizeScore: number;
	/** Engine folder path ("" = vault root). */
	readonly folder: string;
	/**
	 * Folder display name to render muted before the title
	 * (`<folder-name>/<title>`). Present ONLY on ungrouped non-root nodes —
	 * grouped nodes get folder identity from their group, root nodes have none.
	 */
	readonly breadcrumbFolder?: string;
	/** Thumbnail candidate (vault path; the component resolves it to a URL). */
	readonly firstImagePath?: string;
	/** Total images among attachments — the thumbnail's "+N more" badge is imageCount - 1. */
	readonly imageCount: number;
	/** Icon strip entries (per-extension counts + dropdown paths). */
	readonly attachmentGroups: readonly AttachmentIconGroup[];
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

export interface FlowEdge {
	readonly id: string;
	readonly source: string;
	readonly target: string;
	/** Distinct links source→target — the edge's count badge (1 = no badge). */
	readonly count: number;
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
	 * pass, present only when `edgeRouting` is on and the pass succeeded. Rides
	 * along unused this phase — rendering starts consuming it in edge-routing__02.
	 */
	readonly routedPoints?: readonly RoutedPoint[];
}

export interface FlowGraph {
	readonly nodes: readonly FlowNode[];
	readonly edges: readonly FlowEdge[];
	readonly groupByFolder: boolean;
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
	const grouping = deriveFolderGroups(graph.nodes, graph.viewSettings.groupByFolder);
	const badges = deriveTruncationBadges(
		graph.hiddenNodeCountsByFolder,
		new Set(grouping.groups.map((group) => group.folder)),
	);
	// Parents must precede children in React Flow's nodes array.
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
	const noteNodes = graph.nodes.map((node): NoteFlowNode => {
		const groupFolder = grouping.groupFolderByMemberPath.get(node.path);
		const breadcrumbFolder = breadcrumbFolderOf(node, groupFolder !== undefined);
		const { width, height } = nodeDimensionsPx(node, breadcrumbFolder);
		return {
			id: node.path,
			kind: "note",
			position: UNPLACED,
			width,
			height,
			...(groupFolder === undefined ? {} : { parentId: folderGroupIdOf(groupFolder) }),
			data: toFlowNodeData(node, breadcrumbFolder, mainPinned),
		};
	});
	return {
		nodes: [...groupNodes, ...noteNodes],
		edges: buildFlowEdges(graph, grouping.groupFolderByMemberPath),
		groupByFolder: graph.viewSettings.groupByFolder,
		orphanTruncation: badges.orphan,
	};
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
 */
function buildFlowEdges(
	graph: VicinityGraph,
	groupFolderByMemberPath: ReadonlyMap<string, FolderPath>,
): FlowEdge[] {
	const projectId = (path: string): string => {
		const folder = groupFolderByMemberPath.get(path);
		return folder === undefined ? path : folderGroupIdOf(folder);
	};
	const renderedEdgeIds = new Set(graph.edges.map(edgeIdOf));
	const passthrough: FlowEdge[] = [];
	const collapsedByPair = new Map<string, CollapsedEdgeAccumulator>();
	for (const edge of graph.edges) {
		const projSource = projectId(edge.source);
		const projTarget = projectId(edge.target);
		const wasProjected = projSource !== edge.source || projTarget !== edge.target;
		if (!wasProjected || projSource === projTarget) {
			passthrough.push({
				id: edgeIdOf(edge),
				source: edge.source,
				target: edge.target,
				count: edge.count,
				hasOpposite: renderedEdgeIds.has(edgeIdOf({ source: edge.target, target: edge.source })),
				bidirectional: false,
			});
			continue;
		}
		accumulateCollapsedEdge(collapsedByPair, projSource, projTarget, edge.count);
	}
	const collapsed = [...collapsedByPair.values()].map(
		(pair): FlowEdge => ({
			id: `${pair.from}->${pair.to}`,
			source: pair.from,
			target: pair.to,
			count: pair.count,
			hasOpposite: false,
			bidirectional: pair.forwardSeen && pair.backwardSeen,
		}),
	);
	return [...passthrough, ...collapsed];
}

function accumulateCollapsedEdge(
	collapsedByPair: Map<string, CollapsedEdgeAccumulator>,
	projSource: string,
	projTarget: string,
	count: number,
): void {
	const key = [projSource, projTarget].sort().join(UNORDERED_PAIR_KEY_SEPARATOR);
	const existing = collapsedByPair.get(key);
	if (existing === undefined) {
		collapsedByPair.set(key, { from: projSource, to: projTarget, forwardSeen: true, backwardSeen: false, count });
		return;
	}
	existing.count += count;
	if (projSource === existing.from && projTarget === existing.to) {
		existing.forwardSeen = true;
	} else {
		existing.backwardSeen = true;
	}
}

function toFlowNodeData(node: GraphNode, breadcrumbFolder: string | undefined, mainPinned: boolean): FlowNodeData {
	return {
		path: node.path,
		title: node.title,
		...(node.docid === undefined ? {} : { docid: node.docid }),
		tier: tierOf(node),
		// A non-MAIN central IS a pin by definition; MAIN's pinned-ness comes from the caller.
		isPinned: node.isMain ? mainPinned : node.isCentral,
		sizePx: node.sizePx,
		sizeScore: node.sizeScore,
		folder: node.folder,
		...(breadcrumbFolder === undefined ? {} : { breadcrumbFolder }),
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
 * Applies elk-computed container sizes to folder-group nodes. Note nodes keep
 * their mapping-time box (`nodeDimensionsPx`: engine-driven height, label-floored
 * width) — elk echoes the input size for leaves anyway, so the mapping stays the
 * single note-sizing truth.
 */
export function withGroupDimensions(
	nodes: readonly FlowNode[],
	dimensions: ReadonlyMap<string, Dimensions>,
): readonly FlowNode[] {
	return nodes.map((node) => {
		if (node.kind !== "folder-group") {
			return node;
		}
		const size = dimensions.get(node.id);
		return size === undefined ? node : { ...node, width: size.width, height: size.height };
	});
}
