import type { ElkNode } from "elkjs";
import type { FolderPath, GraphEdge, VicinityGraph } from "../engine";
import { ELK_GROUP_PADDING, ELK_LAYOUT_OPTIONS, ELK_ROOT_ID } from "./constants";
import { deriveFolderGroups } from "./folderGrouping";
import { edgeIdOf, folderGroupIdOf, nodeSideLengthPx } from "./graphIdentity";
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
 * `elk.hierarchyHandling=INCLUDE_CHILDREN` (constants) makes the root
 * algorithm lay out the whole hierarchy in one pass.
 */

export function vicinityGraphToElk(graph: VicinityGraph): ElkNode {
	const grouping = deriveFolderGroups(graph.nodes, graph.viewSettings.groupByFolder);
	const leafById = new Map(
		graph.nodes.map((node): [string, ElkNode] => {
			const side = nodeSideLengthPx(node);
			return [node.path, { id: node.path, width: side, height: side }];
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
			layoutOptions: { "elk.padding": ELK_GROUP_PADDING },
		};
		containers.push(container);
		containerByFolder.set(group.folder, container);
	}
	const ungroupedLeaves = graph.nodes
		.filter((node) => !grouping.groupFolderByMemberPath.has(node.path))
		.map((node) => leafById.get(node.path))
		.filter((leaf): leaf is ElkNode => leaf !== undefined);
	const rootEdges: NonNullable<ElkNode["edges"]> = [];
	for (const edge of graph.edges) {
		const elkEdge = { id: edgeIdOf(edge), sources: [edge.source], targets: [edge.target] };
		const container = intraGroupContainerOf(edge, grouping.groupFolderByMemberPath, containerByFolder);
		if (container?.edges !== undefined) {
			container.edges.push(elkEdge);
		} else {
			rootEdges.push(elkEdge);
		}
	}
	return {
		id: ELK_ROOT_ID,
		layoutOptions: { ...ELK_LAYOUT_OPTIONS },
		children: [...containers, ...ungroupedLeaves],
		edges: rootEdges,
	};
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
