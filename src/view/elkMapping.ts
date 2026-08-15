import type { ElkNode } from "elkjs";
import type { FolderPath, VicinityGraph } from "../engine";
import { ELK_GROUP_PADDING, ELK_ROOT_ID, elkForceRootOptions, elkGroupMemberOptions } from "./constants";
import { deriveFolderGroups, UNLIMITED_GROUP_NESTING_DEPTH } from "./folderGrouping";
import type { FolderGroup, FolderGroupingResult } from "./folderGrouping";
import { edgeIdOf, folderGroupIdOf, nodeDimensionsPx } from "./graphIdentity";
import type { Dimensions, XY } from "./flowMapping";

/**
 * Pure engine → elk graph mapping and position extraction. `import type` of
 * `ElkNode` is erased at compile time, so this module pulls in no runtime
 * dependency and stays node-testable; the actual elk engine is invoked by
 * {@link ElkLayoutRunner}.
 *
 * Compound layout (recursive folder groups): a rendered group becomes a folder
 * container nested inside its PARENT group's container (a top-level group nests
 * under the root), so the elk tree mirrors the grouping tree to arbitrary depth.
 * Each container holds its direct note members AND its child group containers.
 *
 * elk's JSON contract requires every edge to live on the CLOSEST COMMON ANCESTOR
 * container of its endpoints ({@link FolderGroupingResult.lowestCommonAncestorContainerOf}
 * — never re-derived here). Because the root force pass and the rectpacking
 * interiors both run `SEPARATE_CHILDREN` (neither supports `INCLUDE_CHILDREN`),
 * an edge cannot reference a node nested BELOW its host container's direct
 * children; so each endpoint is PROJECTED onto the direct child of the LCA that
 * renders it ({@link FolderGroupingResult.projectOntoContainerChildOf}) — a
 * sibling note leaf or a sibling group container. Intra-group edges (LCA = that
 * group, both endpoints direct members) stay member-to-member.
 *
 * The root runs elk's `force` algorithm ({@link elkForceRootOptions}); each
 * container packs its members with `rectpacking` ({@link elkGroupMemberOptions}).
 * The elk root pass is only a seed — `GraphLayoutRunner` then refines the
 * top-level boxes with d3-force (`d3ForceRefinement.ts`).
 */

export function vicinityGraphToElk(graph: VicinityGraph): ElkNode {
	const grouping = deriveFolderGroups(graph.nodes, UNLIMITED_GROUP_NESTING_DEPTH);
	// The "Group member spacing" knob drives the group INTERIORS only; the root
	// force seed keeps its own internal separation (see `elkForceRootOptions`).
	const nodeSpacingPx = graph.viewSettings.forceLayout.elkNodeSpacingPx;
	const leafById = new Map(
		graph.nodes.map((node): [string, ElkNode] => {
			const { width, height } = nodeDimensionsPx(node);
			return [node.path, { id: node.path, width, height }];
		}),
	);
	// Build every container first (with its direct note-member leaves), then nest
	// each under its parent group — parents and children both come from
	// `grouping.groups`, so a second pass wires the tree once all exist.
	const containerByFolder = new Map<FolderPath, ElkNode>();
	for (const group of grouping.groups) {
		const memberLeaves = group.memberPaths
			.map((path) => leafById.get(path))
			.filter((child): child is ElkNode => child !== undefined);
		containerByFolder.set(group.folder, {
			id: folderGroupIdOf(group.folder),
			children: memberLeaves,
			edges: [],
			layoutOptions: { ...elkGroupMemberOptions(nodeSpacingPx), "elk.padding": ELK_GROUP_PADDING },
		});
	}
	const topLevelContainers: ElkNode[] = [];
	for (const group of grouping.groups) {
		const container = containerByFolder.get(group.folder);
		if (container === undefined) {
			continue;
		}
		if (group.parentFolder === null) {
			topLevelContainers.push(container);
		} else {
			containerByFolder.get(group.parentFolder)?.children?.push(container);
		}
	}
	const ungroupedLeaves = graph.nodes
		.filter((node) => !grouping.groupFolderByMemberPath.has(node.path))
		.map((node) => leafById.get(node.path))
		.filter((leaf): leaf is ElkNode => leaf !== undefined);
	// Attach each edge to its LCA container, projecting both endpoints onto that
	// container's direct children. Root-bound edges (LCA null) are deduped +
	// reoriented centre-outward; interior edges keep their id (rectpacking ignores
	// them, they exist only to satisfy elk's common-ancestor contract).
	const rootEdges = attachEdgesToContainers(graph, grouping, containerByFolder);
	return {
		id: ELK_ROOT_ID,
		layoutOptions: { ...elkForceRootOptions() },
		children: [...topLevelContainers, ...ungroupedLeaves],
		edges: rootEdges,
	};
}

/**
 * Distributes every edge onto its closest-common-ancestor container (mutating
 * each container's `edges`) and returns the root-level edge list. Endpoints are
 * projected onto the LCA's direct children so no edge references a node elk
 * cannot see under `SEPARATE_CHILDREN`.
 *
 * Root-bound edges (LCA null) are the force seed: positions are all the pipeline
 * consumes (React Flow draws its own edges), so they are deduped by projected
 * pair and oriented centre-outward (lower `minDepth` endpoint first, ties
 * broken lexicographically so the pair keys identically both ways) — a stable
 * tree-like hint that keeps the hub centred regardless of link direction.
 */
function attachEdgesToContainers(
	graph: VicinityGraph,
	grouping: FolderGroupingResult,
	containerByFolder: ReadonlyMap<FolderPath, ElkNode>,
): NonNullable<ElkNode["edges"]> {
	const projectedIdOf = (path: string, container: FolderGroup | null): string => {
		const child = grouping.projectOntoContainerChildOf(path, container);
		return child === null ? path : folderGroupIdOf(child.folder);
	};
	const minDepthById = new Map<string, number>();
	for (const node of graph.nodes) {
		const id = projectedIdOf(node.path, null);
		minDepthById.set(id, Math.min(minDepthById.get(id) ?? Number.POSITIVE_INFINITY, node.minDepth));
	}
	const rootEdgesById = new Map<string, NonNullable<ElkNode["edges"]>[number]>();
	for (const edge of graph.edges) {
		const lca = grouping.lowestCommonAncestorContainerOf(edge.source, edge.target);
		const sourceId = projectedIdOf(edge.source, lca);
		const targetId = projectedIdOf(edge.target, lca);
		if (lca === null) {
			const sourceDepth = minDepthById.get(sourceId) ?? 0;
			const targetDepth = minDepthById.get(targetId) ?? 0;
			// On a depth tie, order lexicographically so mutual links A<->B mint ONE key.
			const outward =
				targetDepth < sourceDepth || (targetDepth === sourceDepth && targetId < sourceId);
			const [from, to] = outward ? [targetId, sourceId] : [sourceId, targetId];
			const id = `${from}->${to}`;
			if (!rootEdgesById.has(id)) {
				rootEdgesById.set(id, { id, sources: [from], targets: [to] });
			}
			continue;
		}
		containerByFolder.get(lca.folder)?.edges?.push({ id: edgeIdOf(edge), sources: [sourceId], targets: [targetId] });
	}
	return [...rootEdgesById.values()];
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
