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
import { nodePreviewKind, suppressedDuplicateThumbnails } from "../engine";
import { resolveNodePreviewPreference } from "./nodePreviewChoice";
import { OUTLINE_RENDER_LIMIT } from "./constants";
import type { AttachmentIconGroup } from "./attachmentIconStrip";
import { attachmentIconStrip } from "./attachmentIconStrip";
import { deriveFolderGroups } from "./folderGrouping";
import type { FolderGroup, FolderGroupingResult } from "./folderGrouping";
import type { OrphanTruncation } from "./truncationBadges";
import { deriveTruncationBadges } from "./truncationBadges";
import { edgeIdOf, folderGroupIdOf, nodeDimensionsPx, nodeSizeOverridePx } from "./graphIdentity";
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
	 * Whether this note's doc is in the GLOBAL persisted pinned set — the fact the
	 * global pin/unpin toggle switches on. Distinct from {@link tier}: a globally
	 * pinned MAIN still styles as `main` but must offer "unpin". Split from
	 * {@link isLocallyPinned} because a doc can hold BOTH pin kinds at once and each
	 * has its own toggle (the second, local, control lands in the dependent UI ticket).
	 */
	readonly isGloballyPinned: boolean;
	/**
	 * Whether this note's doc is locally pinned UNDER THE ACTIVE MAIN — pinned only
	 * while this main is active (never carried across mains; see {@link FlowPinFacts}).
	 * The engine sees local and global pins as one merged root list, so this flag is
	 * the ONLY place the view recovers the local-vs-global distinction.
	 */
	readonly isLocallyPinned: boolean;
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
};

/** Folder-group node payload (label + truncation badge). Type alias for the
 * same React Flow `data` constraint reason as {@link FlowNodeData}. */
export type FlowGroupData = {
	readonly folder: string;
	/** Display name (last path segment) — the group label. */
	readonly folderName: string;
	/** Truncated-away nodes of this folder — the group's "+N" badge; 0 = no badge. */
	readonly hiddenCount: number;
	/**
	 * True when `folderName` is a full chain path (the "Full folder path" setting),
	 * so the label front-truncates (`…/some/leaf`) to keep the meaningful tail.
	 * A leaf-name label (the default) keeps conventional trailing truncation.
	 */
	readonly fullPathLabel: boolean;
	/**
	 * Existing folder-note candidates of {@link folder} — the group's DEEPEST folder
	 * only, so a collapsed chain's ancestors are deliberately ineligible (ticket
	 * `nid_2pobjyfp5zgspx283bfukaugn_e`, R4) — in descending precedence. Drives the
	 * label's navigation: empty = inert, one = opens directly, 2+ = candidate menu.
	 */
	readonly folderNoteCandidates: readonly string[];
};

/**
 * Folder → existing folder-note candidates (descending precedence), read from
 * the SAME vault snapshot the graph was built from so a label can never offer a
 * note the traversal's folder-note rule would not see. Carried per build on
 * `GraphBuildResult`; implemented by the builder over the adapters'
 * `FolderNoteIndex`.
 */
export interface FolderNoteCandidatesLookup {
	folderNoteCandidatesOf(folder: FolderPath): readonly string[];
}

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
	/**
	 * True iff this ordered pair carries the folder-note HIERARCHY relation
	 * (parent → child; {@link import("../engine").GraphEdge.hierarchy}). The
	 * edge-click flyout reads it per pair to build its folder-relation section —
	 * a collapsed group edge can union hierarchy and link pairs, so the flag rides
	 * the pair, not just the {@link FlowEdge}.
	 */
	readonly hierarchy: boolean;
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
	 * True iff this rendered edge carries the folder-note HIERARCHY relation —
	 * the OR of its contributing pairs' {@link EdgeNotePair.hierarchy}. Drives the
	 * PURE-hierarchy dashed styling (`hierarchy && count === 0`, see
	 * {@link edgeClassName}); a merged pair (`hierarchy && count >= 1`) renders
	 * solid + badge, visually identical to a plain link edge.
	 */
	readonly hierarchy: boolean;
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

const FOLDER_SEPARATOR = "/";

/**
 * Nesting depth of a folder path (segment count): an ancestor folder always has
 * a strictly smaller depth than its descendants. Used only to order group nodes
 * ancestor-first for React Flow's parent-before-child rule — group folders are
 * never the vault root, so the empty-string edge case does not arise.
 */
function folderDepthOf(folder: string): number {
	return folder.split(FOLDER_SEPARATOR).length;
}

/**
 * Group nodes are sized by elk (container wraps its children); before layout
 * they carry this placeholder, replaced via {@link withGroupDimensions}.
 */
const UNSIZED_GROUP_PX = 0;

/**
 * The docid sets that recover local-vs-global pinning after the engine has
 * merged both into ONE root list. Supplied by the caller because the engine
 * carries no such distinction (and skips main-as-pin, so a globally pinned
 * MAIN's docid must be in {@link globalPinnedDocids} for its toggle to read right).
 * {@link localPinnedDocids} is the ACTIVE main's local targets only.
 */
export interface FlowPinFacts {
	readonly globalPinnedDocids: ReadonlySet<string>;
	readonly localPinnedDocids: ReadonlySet<string>;
}

export function vicinityGraphToFlow(
	graph: VicinityGraph,
	pinFacts: FlowPinFacts,
	folderNoteCandidates: FolderNoteCandidatesLookup,
): FlowGraph {
	const grouping = deriveFolderGroups(graph.nodes);
	const badges = deriveTruncationBadges(
		graph.hiddenNodeCountsByFolder,
		grouping.nearestRenderedAncestorGroupOf,
	);
	// Parents must precede children in React Flow's nodes array. `grouping.groups`
	// is in first-seen (nearest-ancestor-first) order, which can place a nesting
	// parent AFTER its child, so order the group nodes by folder DEPTH — an
	// ancestor folder always has fewer segments than its descendants. A stable
	// sort keeps first-seen order among siblings (determinism unchanged). Note
	// nodes are appended after every group node, so a note always follows its group.
	const groupNodes = [...grouping.groups]
		.sort((a, b) => folderDepthOf(a.folder) - folderDepthOf(b.folder))
		.map(
		(group): GroupFlowNode => ({
			id: folderGroupIdOf(group.folder),
			kind: "folder-group",
			position: UNPLACED,
			width: UNSIZED_GROUP_PX,
			height: UNSIZED_GROUP_PX,
			// A nested group renders inside its parent group's subflow; a top-level
			// group's container is the canvas pane (no parentId). Mirrors the elk
			// container nesting so RF subflows and the layout tree agree.
			...(group.parentFolder === null ? {} : { parentId: folderGroupIdOf(group.parentFolder) }),
			data: {
				folder: group.folder,
				// Label text comes from the group MODEL (signed-off A1): the leaf folder
				// name by DEFAULT, or the collapsed-chain path (`A/B/C`) when the global
				// "Full folder path" label setting is on. For a group that is NOT a collapsed
				// chain `chainPath === leafName`, so the setting only ever adds segments for a
				// redundant single-child chain. The full folder path rides `folder` for
				// FolderGroupNode's tooltip regardless of the setting.
				folderName: graph.viewSettings.groupLabelFullPath ? group.chainPath : group.leafName,
				hiddenCount: badges.hiddenCountByGroupFolder.get(group.folder) ?? 0,
				fullPathLabel: graph.viewSettings.groupLabelFullPath,
				// The DEEPEST folder only (`group.folder`, never a collapsed ancestor):
				// a chain group `A/B/C` navigates to C's folder note, not A's or B's (R4).
				folderNoteCandidates: folderNoteCandidates.folderNoteCandidatesOf(group.folder),
			},
		}),
	);
	// De-dup the in-node image: when several nodes would render the SAME image as
	// their thumbnail, only the one highest in the folder hierarchy keeps it (the
	// rest fall back through their preview ladder without the image). Resolved here,
	// once, over the full node list — the per-node `preview` decision below reads the
	// result and never re-derives it.
	const suppressedThumbnails = suppressedDuplicateThumbnails(
		graph.nodes.map((node) => ({
			path: node.path,
			folder: node.folder,
			firstImagePath: node.firstImagePath,
			rendersThumbnail: resolveNodePreview(node, graph.viewSettings, node.firstImagePath !== undefined) === "thumbnail",
		})),
	);
	const noteNodes = graph.nodes.map((node): NoteFlowNode => {
		const groupFolder = grouping.groupFolderByMemberPath.get(node.path);
		const { width, height } = nodeDimensionsPx(node);
		return {
			id: node.path,
			kind: "note",
			position: UNPLACED,
			width,
			height,
			...(groupFolder === undefined ? {} : { parentId: folderGroupIdOf(groupFolder) }),
			data: toFlowNodeData(node, pinFacts, graph.viewSettings, suppressedThumbnails.has(node.path)),
		};
	});
	return {
		nodes: [...groupNodes, ...noteNodes],
		edges: buildFlowEdges(graph, grouping),
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
	kind: EdgeKind;
	/** The OR of every contributing pair's {@link EdgeNotePair.hierarchy}. */
	hierarchy: boolean;
	/** Contributing engine note→note pairs, in first-seen order. */
	readonly notePairs: EdgeNotePair[];
}

/** Separator that cannot occur in a vault path or folder-group id — a collision-proof delimiter. */
const UNORDERED_PAIR_KEY_SEPARATOR = "\u0000";

/**
 * Maps engine edges to rendered {@link FlowEdge}s, collapsing the fan of edges
 * crossing a folder-group boundary onto a single edge between the closest-common-
 * ancestor container's direct children (mirrors `attachEdgesToContainers` in
 * elkMapping via the SAME grouping-tree projection seam, so layout and rendering
 * agree). An engine edge is:
 * - PASSTHROUGH when neither endpoint is projected — both are direct leaf members
 *   of their LCA container (an intra-group edge, or two ungrouped notes at the
 *   root). Kept member-to-member so the container's internal links stay visible,
 *   never a group self-loop; keeps the curved-pair `hasOpposite` semantics.
 * - COLLAPSED when at least one endpoint projects onto a child GROUP of the LCA.
 *   Collapsed edges union by unordered projected pair: both directions → one
 *   bidirectional edge (arrowhead each end); one direction → single arrowhead;
 *   `count` = sum of every contributing edge. The projected endpoints always
 *   differ (both landing on the same child would make that child the LCA).
 */
function buildFlowEdges(graph: VicinityGraph, grouping: FolderGroupingResult): FlowEdge[] {
	// Per-endpoint depth allowance (the "Edge depth into groups" setting). RENDER-ONLY
	// (plan D2): the layout path (`elkMapping.attachEdgesToContainers`) keeps the
	// depth-0 projection, so only this — the rendered-edge builder — reads it.
	const edgeDepthIntoGroups = graph.viewSettings.edgeDepthIntoGroups;
	const projectId = (path: string, container: FolderGroup | null): string => {
		const child = grouping.projectOntoContainerChildOf(path, container, edgeDepthIntoGroups);
		return child === null ? path : folderGroupIdOf(child.folder);
	};
	const renderedEdgeIds = new Set(graph.edges.map(edgeIdOf));
	const passthrough: FlowEdge[] = [];
	const collapsedByPair = new Map<string, CollapsedEdgeAccumulator>();
	for (const edge of graph.edges) {
		const lca = grouping.lowestCommonAncestorContainerOf(edge.source, edge.target);
		const projSource = projectId(edge.source, lca);
		const projTarget = projectId(edge.target, lca);
		const wasProjected = projSource !== edge.source || projTarget !== edge.target;
		if (!wasProjected) {
			passthrough.push({
				id: edgeIdOf(edge),
				source: edge.source,
				target: edge.target,
				notePairs: [{ source: edge.source, target: edge.target, hierarchy: edge.hierarchy }],
				count: edge.count,
				kind: edge.kind,
				hierarchy: edge.hierarchy,
				hasOpposite: renderedEdgeIds.has(edgeIdOf({ source: edge.target, target: edge.source })),
				bidirectional: false,
			});
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
			hierarchy: pair.hierarchy,
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
			hierarchy: edge.hierarchy,
			notePairs: [{ source: edge.source, target: edge.target, hierarchy: edge.hierarchy }],
		});
		return;
	}
	existing.count += edge.count;
	existing.kind = mergeEdgeKinds(existing.kind, edge.kind);
	existing.hierarchy = existing.hierarchy || edge.hierarchy;
	existing.notePairs.push({ source: edge.source, target: edge.target, hierarchy: edge.hierarchy });
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
 * Class hook for a PURE folder-note hierarchy edge — dashed, badgeless (the
 * "collapse, don't multiply" treatment, plan `nid_ri1d36t7hmhu0kr652wny1dmz_e`).
 * A merged edge (`hierarchy && count >= 1`) is DELIBERATELY excluded: it renders
 * solid + count badge, visually identical to a plain link edge (owner pick D1-a);
 * the folder relation is discoverable in the flyout, not glanceable.
 */
export const PURE_HIERARCHY_EDGE_CLASS = "vicinity-graph-edge--hierarchy";

/**
 * The full class string the React Flow edge WRAPPER carries: the per-{@link EdgeKind}
 * hook, plus the pure-hierarchy dash hook when this edge is a PURE folder-note
 * relation (no link occurrence — {@link FlowEdge.count} 0).
 */
export function edgeClassName(edge: FlowEdge): string {
	const kindClass = edgeKindClassName(edge.kind);
	return edge.hierarchy && edge.count === 0 ? `${kindClass} ${PURE_HIERARCHY_EDGE_CLASS}` : kindClass;
}

/**
 * The heading entries this node actually RENDERS: filter THEN slice, so a depth-2
 * view of a note with 60 deep headings still finds its shallow ones (slicing first
 * could drop every survivor).
 */
function renderedOutline(node: GraphNode, view: ViewSettings): readonly OutlineEntry[] {
	return node.outline.filter((entry) => entry.level <= view.outlineMaxDepth).slice(0, OUTLINE_RENDER_LIMIT);
}

/**
 * The region this node's single preview slot resolves to. `hasImage` is a
 * PARAMETER, not `node.firstImagePath !== undefined`, because image de-dup can
 * withhold the image from every node but the one that owns it (see
 * {@link suppressedDuplicateThumbnails}) — the same note is then asked "what would
 * you show WITHOUT the image?". The per-node CONTENT override wins over the global
 * preference here (`resolveNodePreviewPreference`) — applied in the VIEW so a flip
 * stays a data-only refresh (the sizer reads the global preference only, so sizePx
 * does not move).
 */
function resolveNodePreview(node: GraphNode, view: ViewSettings, hasImage: boolean): NodePreviewKind {
	return nodePreviewKind({
		preference: resolveNodePreviewPreference(view.nodePreviewPreference, node.override?.content),
		// Decided from the RENDERABLE entry count, never the engine's raw outline: a
		// note whose every heading is deeper than the cap must not claim the outline
		// slot and render an empty box.
		outlineEntryCount: renderedOutline(node, view).length,
		hasImage,
		imagePrecedesOutline: node.imagePrecedesOutline,
		isCentral: node.isCentral,
	});
}

/**
 * @param view the effective view settings — passed whole (not knob by knob) so
 * every settings-driven derivation below reads one object.
 * @param suppressImage true when image de-dup handed this node's image to another
 * node higher in the folder hierarchy — the node then previews as if it had none.
 */
function toFlowNodeData(node: GraphNode, pinFacts: FlowPinFacts, view: ViewSettings, suppressImage: boolean): FlowNodeData {
	const outline = renderedOutline(node, view);
	return {
		path: node.path,
		title: node.title,
		...(node.docid === undefined ? {} : { docid: node.docid }),
		tier: tierOf(node),
		// The two pin facts come from the caller's docid sets, not from isCentral: a
		// central can be pinned globally, locally, or both, and only the sets know
		// which. A node with no docid (an ordinary neighbor) is in neither set.
		isGloballyPinned: node.docid !== undefined && pinFacts.globalPinnedDocids.has(node.docid),
		isLocallyPinned: node.docid !== undefined && pinFacts.localPinnedDocids.has(node.docid),
		hasSizeOverride: nodeSizeOverridePx(node) !== undefined,
		folder: node.folder,
		outline,
		preview: resolveNodePreview(node, view, node.firstImagePath !== undefined && !suppressImage),
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
 * Applies elk-computed container sizes to folder-group nodes. Note nodes keep
 * their mapping-time box (`nodeDimensionsPx`: engine-driven height, snug capped
 * label width) — elk echoes the input size for leaves anyway, so the mapping stays the
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
