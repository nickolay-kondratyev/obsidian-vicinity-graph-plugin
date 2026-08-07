import type { ElkNode } from "elkjs";
import type { FolderPath, GraphEdge, GraphNode, VicinityGraph } from "../engine";
import {
	ELK_GROUP_PADDING,
	ELK_ROOT_ID,
	elkForceRootOptions,
	elkGroupMemberOptions,
	nestingContainerOptions,
} from "./constants";
import { deriveFolderGroups } from "./folderGrouping";
import type { FolderGroupingResult } from "./folderGrouping";
import { deriveNestingForest, isIntraTreeEdge, nestedPaths, outermostContainerOf } from "./embedNesting";
import type { NestingForest } from "./embedNesting";
import { edgeIdOf, folderGroupIdOf, nodeContentFitPx } from "./graphIdentity";
import type { Dimensions, XY } from "./flowMapping";

/**
 * Pure engine → elk graph mapping and position extraction. `import type` of
 * `ElkNode` is erased at compile time, so this module pulls in no runtime
 * dependency and stays node-testable; the actual elk engine is invoked by
 * {@link ElkLayoutRunner}.
 *
 * Compound layout (step-05 folder groups): members of a rendered group nest
 * under a folder container child; elk's JSON contract requires every edge to
 * live on the closest common ancestor of its endpoints, so intra-group edges
 * move onto their container while every other edge stays on the root.
 *
 * The root runs elk's `force` algorithm ({@link elkForceRootOptions}), which
 * does not support `INCLUDE_CHILDREN`, so elk's default `SEPARATE_CHILDREN`
 * applies: each container packs its members internally
 * ({@link elkGroupMemberOptions}), then the root arranges containers and
 * ungrouped leaves as fixed boxes. Cross-boundary edges are PROJECTED onto
 * containers (see {@link projectedRootEdges}). The elk root pass is only a seed —
 * `GraphLayoutRunner` then refines the root boxes with d3-force
 * (`d3ForceRefinement.ts`).
 */

export function vicinityGraphToElk(graph: VicinityGraph): ElkNode {
	// Nesting first: its nested set is excluded from folder grouping (decision Q4).
	// Both derivations are pure and deterministic, so this matches flowMapping's
	// parentIds exactly.
	const nesting = deriveNestingForest(graph);
	const grouping = deriveFolderGroups(graph.nodes, nestedPaths(nesting));
	// The "Group member spacing" knob drives the group INTERIORS only; the root
	// force seed keeps its own internal separation (see `elkForceRootOptions`).
	const nodeSpacingPx = graph.viewSettings.forceLayout.elkNodeSpacingPx;
	const nodeByPath = new Map(graph.nodes.map((node): [string, GraphNode] => [node.path, node]));
	const buildNestingElkNode = (path: string): ElkNode => nestingElkNode(path, nodeByPath, nesting);

	const containers: ElkNode[] = [];
	const containerByFolder = new Map<FolderPath, ElkNode>();
	for (const group of grouping.groups) {
		// Members are ROOTS (nested nodes are excluded from grouping): each is a plain
		// leaf or a nesting compound subtree.
		const children = group.memberPaths.map(buildNestingElkNode);
		const container: ElkNode = {
			id: folderGroupIdOf(group.folder),
			children,
			edges: [],
			layoutOptions: { ...elkGroupMemberOptions(nodeSpacingPx), "elk.padding": ELK_GROUP_PADDING },
		};
		containers.push(container);
		containerByFolder.set(group.folder, container);
	}
	// Ungrouped ROOTS render at the root level (a plain leaf or a nesting subtree);
	// nested nodes live INSIDE their container's subtree, never at the root.
	const ungroupedRoots = graph.nodes
		.filter(
			(node) =>
				nesting.nestingByPath.get(node.path)?.containerPath === undefined &&
				!grouping.groupFolderByMemberPath.has(node.path),
		)
		.map((node) => buildNestingElkNode(node.path));

	const crossBoundaryEdges: GraphEdge[] = [];
	for (const edge of graph.edges) {
		// Intra-tree edges are dropped (decision Q5) — they steer nothing (children
		// stack by the ordering chain, not by real edges) and would reference a node
		// buried inside a container that the root/group level cannot address.
		// isIntraTreeEdge is the ONE statement of the rule, shared with flowMapping.
		if (isIntraTreeEdge(nesting, edge.source, edge.target)) {
			continue;
		}
		const intraGroup = intraGroupContainerOf(edge, grouping.groupFolderByMemberPath, containerByFolder, nesting);
		if (intraGroup !== undefined) {
			intraGroup.container.edges?.push({
				id: edgeIdOf(edge),
				sources: [intraGroup.sourceRef],
				targets: [intraGroup.targetRef],
			});
		} else {
			crossBoundaryEdges.push(edge);
		}
	}
	const rootEdges = projectedRootEdges(crossBoundaryEdges, grouping, nesting, graph.nodes);
	return {
		id: ELK_ROOT_ID,
		layoutOptions: { ...elkForceRootOptions() },
		children: [...containers, ...ungroupedRoots],
		edges: rootEdges,
	};
}

/** Prefix for the synthetic ordering edges of a nesting stack (never rendered — RF draws its own edges). */
const NESTING_ORDER_EDGE_PREFIX = "nest-order:";

/**
 * An embed-container's elk subtree (embed-nesting P3): a plain leaf when the node
 * embeds nothing rendered, otherwise a COMPOUND node whose nested children stack
 * VERTICALLY in the forest's child order (decision Q8). The vertical order is held
 * by a chain of synthetic ordering edges consumed by `layered` DOWN
 * ({@link nestingContainerOptions}); the container's own content size floors the
 * box via `elk.nodeSize.minimum`, and its height is reserved as top padding so
 * children never render under its title. Recursive — a child may itself be a
 * container. Sizes ignore per-node overrides (Q8) via {@link nodeContentFitPx}.
 */
function nestingElkNode(
	path: string,
	nodeByPath: ReadonlyMap<string, GraphNode>,
	nesting: NestingForest,
): ElkNode {
	const node = nodeByPath.get(path);
	const { width, height } = node === undefined ? { width: 0, height: 0 } : nodeContentFitPx(node);
	const childPaths = nesting.nestingByPath.get(path)?.childPaths ?? [];
	if (childPaths.length === 0) {
		return { id: path, width, height };
	}
	const children = childPaths.map((childPath) => nestingElkNode(childPath, nodeByPath, nesting));
	const orderingEdges = childPaths.slice(1).map((childPath, index) => ({
		id: `${NESTING_ORDER_EDGE_PREFIX}${childPaths[index]}->${childPath}`,
		sources: [childPaths[index] as string],
		targets: [childPath],
	}));
	return {
		id: path,
		children,
		edges: orderingEdges,
		layoutOptions: nestingContainerOptions(width, height),
	};
}

/**
 * Root-level edges for the `SEPARATE_CHILDREN` force root. Elk cannot reference a
 * node nested inside a container from the root level, so each grouped endpoint is
 * projected onto its folder container. Positions are all the pipeline consumes
 * (React Flow draws its own edges from node positions), so these edges exist
 * purely to steer the layout:
 * - edges collapsing onto the same projected pair are deduped;
 * - every edge is oriented centre-outward (lower `minDepth` endpoint first), a
 *   stable tree-like hint that keeps the hub centred regardless of link
 *   direction (incoming links). Harmless for the force seed.
 */
function projectedRootEdges(
	crossBoundaryEdges: readonly GraphEdge[],
	grouping: FolderGroupingResult,
	nesting: NestingForest,
	nodes: readonly GraphNode[],
): NonNullable<ElkNode["edges"]> {
	// Composite projection (embed-nesting P3): a nested endpoint projects to its
	// outermost container, and that container projects to its folder group if it is
	// a grouped member — so an edge to a nested node steers the same box an edge to
	// its container would (matches flowMapping's projectId).
	const projectedIdOf = (path: string): string => {
		const container = outermostContainerOf(nesting, path);
		const folder = grouping.groupFolderByMemberPath.get(container);
		return folder === undefined ? container : folderGroupIdOf(folder);
	};
	const minDepthById = new Map<string, number>();
	for (const node of nodes) {
		const id = projectedIdOf(node.path);
		minDepthById.set(id, Math.min(minDepthById.get(id) ?? Number.POSITIVE_INFINITY, node.minDepth));
	}
	const edgesById = new Map<string, NonNullable<ElkNode["edges"]>[number]>();
	for (const edge of crossBoundaryEdges) {
		const sourceId = projectedIdOf(edge.source);
		const targetId = projectedIdOf(edge.target);
		const outward = (minDepthById.get(targetId) ?? 0) < (minDepthById.get(sourceId) ?? 0);
		const [from, to] = outward ? [targetId, sourceId] : [sourceId, targetId];
		const id = `${from}->${to}`;
		if (!edgesById.has(id)) {
			edgesById.set(id, { id, sources: [from], targets: [to] });
		}
	}
	return [...edgesById.values()];
}

/** A resolved intra-group edge: the folder container it belongs on, plus the member-root ids elk must reference. */
interface IntraGroupEdge {
	readonly container: ElkNode;
	readonly sourceRef: string;
	readonly targetRef: string;
}

/**
 * The folder container owning BOTH endpoints, or undefined when the edge belongs
 * on the root. Group membership is judged by each endpoint's MEMBER ROOT (its
 * outermost container — the direct child of the folder container), so an edge to a
 * nested note counts as intra-group when its container's root shares the folder.
 * The elk references are those member roots, never the buried nested node (elk
 * cannot address a grandchild from the container level). Intra-tree edges are
 * dropped before this is reached, so the two roots always differ here.
 */
function intraGroupContainerOf(
	edge: GraphEdge,
	groupFolderByMemberPath: ReadonlyMap<string, FolderPath>,
	containerByFolder: ReadonlyMap<FolderPath, ElkNode>,
	nesting: NestingForest,
): IntraGroupEdge | undefined {
	const sourceRef = outermostContainerOf(nesting, edge.source);
	const targetRef = outermostContainerOf(nesting, edge.target);
	const sourceFolder = groupFolderByMemberPath.get(sourceRef);
	const targetFolder = groupFolderByMemberPath.get(targetRef);
	if (sourceFolder === undefined || sourceFolder !== targetFolder) {
		return undefined;
	}
	const container = containerByFolder.get(sourceFolder);
	return container === undefined ? undefined : { container, sourceRef, targetRef };
}

/**
 * Flattens a laid-out elk graph into absolute node positions. elk reports child
 * coordinates relative to their parent; the offset accumulation keeps this
 * correct for nodes nested under folder containers (step-05). The RF-side
 * conversion back to parent-relative coordinates happens in `withPositions`.
 */
export function extractElkPositions(laidOut: ElkNode): ReadonlyMap<string, XY> {
	const positions = new Map<string, XY>();
	collectPositions(laidOut, 0, 0, positions);
	return positions;
}

function collectPositions(node: ElkNode, offsetX: number, offsetY: number, out: Map<string, XY>): void {
	for (const child of node.children ?? []) {
		const x = (child.x ?? 0) + offsetX;
		const y = (child.y ?? 0) + offsetY;
		out.set(child.id, { x, y });
		collectPositions(child, x, y, out);
	}
}

/**
 * Collects elk-computed node sizes for EVERY node, recursively (folder-group and
 * embed-container compounds get their wrapped-around-children dimensions; leaves —
 * plain notes and nested leaf children — echo their input). Feeds
 * `withGroupDimensions`, which applies them to the wrapping nodes (folder groups
 * and containers) and leaves the rest at their mapping-time box.
 */
export function extractElkDimensionsById(laidOut: ElkNode): ReadonlyMap<string, Dimensions> {
	const dimensions = new Map<string, Dimensions>();
	collectDimensions(laidOut, dimensions);
	return dimensions;
}

function collectDimensions(node: ElkNode, out: Map<string, Dimensions>): void {
	for (const child of node.children ?? []) {
		if (child.width !== undefined && child.height !== undefined) {
			out.set(child.id, { width: child.width, height: child.height });
		}
		collectDimensions(child, out);
	}
}
