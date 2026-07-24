import type { ElkNode } from "elkjs";
import type { FolderPath, GraphEdge, GraphNode, VicinityGraph } from "../engine";
import { ELK_GROUP_PADDING, ELK_ROOT_ID, elkForceRootOptions, elkGroupMemberOptions } from "./constants";
import { deriveFolderGroups } from "./folderGrouping";
import type { FolderGroupingResult } from "./folderGrouping";
import { edgeIdOf, folderGroupIdOf, nodeDimensionsPx } from "./graphIdentity";
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
 * applies: each container is laid out internally (layered,
 * {@link elkGroupMemberOptions}), then the root arranges containers and
 * ungrouped leaves as fixed boxes. Cross-boundary edges are PROJECTED onto
 * containers (see {@link projectedRootEdges}). The elk root pass is only a seed —
 * `GraphLayoutRunner` then refines the root boxes with d3-force
 * (`d3ForceRefinement.ts`).
 */

export function vicinityGraphToElk(graph: VicinityGraph): ElkNode {
	const grouping = deriveFolderGroups(graph.nodes, graph.viewSettings.groupByFolder);
	// The "Group member spacing" knob drives BOTH elk passes (group internals and
	// the root force seed) — one spacing concept, resolved per build.
	const nodeSpacingPx = graph.viewSettings.forceLayout.elkNodeSpacingPx;
	const leafById = new Map(
		graph.nodes.map((node): [string, ElkNode] => {
			const { width, height } = nodeDimensionsPx(node);
			return [node.path, { id: node.path, width, height }];
		}),
	);
	const containers: ElkNode[] = [];
	const containerByFolder = new Map<FolderPath, ElkNode>();
	for (const group of grouping.groups) {
		const children = group.memberPaths
			.map((path) => leafById.get(path))
			.filter((child): child is ElkNode => child !== undefined);
		const container: ElkNode = {
			id: folderGroupIdOf(group.folder),
			children,
			edges: [],
			layoutOptions: { ...elkGroupMemberOptions(nodeSpacingPx), "elk.padding": ELK_GROUP_PADDING },
		};
		containers.push(container);
		containerByFolder.set(group.folder, container);
	}
	const ungroupedLeaves = graph.nodes
		.filter((node) => !grouping.groupFolderByMemberPath.has(node.path))
		.map((node) => leafById.get(node.path))
		.filter((leaf): leaf is ElkNode => leaf !== undefined);
	const crossBoundaryEdges: GraphEdge[] = [];
	for (const edge of graph.edges) {
		const container = intraGroupContainerOf(edge, grouping.groupFolderByMemberPath, containerByFolder);
		if (container?.edges !== undefined) {
			container.edges.push({ id: edgeIdOf(edge), sources: [edge.source], targets: [edge.target] });
		} else {
			crossBoundaryEdges.push(edge);
		}
	}
	const rootEdges = projectedRootEdges(crossBoundaryEdges, grouping, graph.nodes);
	return {
		id: ELK_ROOT_ID,
		layoutOptions: { ...elkForceRootOptions(nodeSpacingPx) },
		children: [...containers, ...ungroupedLeaves],
		edges: rootEdges,
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
	nodes: readonly GraphNode[],
): NonNullable<ElkNode["edges"]> {
	const projectedIdOf = (path: string): string => {
		const folder = grouping.groupFolderByMemberPath.get(path);
		return folder === undefined ? path : folderGroupIdOf(folder);
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

/** The container owning BOTH endpoints, or undefined when the edge belongs on the root. */
function intraGroupContainerOf(
	edge: GraphEdge,
	groupFolderByMemberPath: ReadonlyMap<string, FolderPath>,
	containerByFolder: ReadonlyMap<FolderPath, ElkNode>,
): ElkNode | undefined {
	const sourceFolder = groupFolderByMemberPath.get(edge.source);
	const targetFolder = groupFolderByMemberPath.get(edge.target);
	if (sourceFolder === undefined || sourceFolder !== targetFolder) {
		return undefined;
	}
	return containerByFolder.get(sourceFolder);
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
 * Collects elk-computed node sizes (containers get wrapped-around-children
 * dimensions; leaves echo their input). Feeds `withGroupDimensions` — only
 * folder-group nodes consume these.
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
