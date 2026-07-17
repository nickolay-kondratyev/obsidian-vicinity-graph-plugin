import type { TraversedNode } from "./NeighborhoodTraversal";
import { NodePriorityChain } from "./NodePriorityChain";
import type { NodeSize } from "./NodeSizer";
import type { FolderPath, GraphEdge, VaultPath } from "./types";

export interface TruncationInput {
	readonly nodes: ReadonlyMap<VaultPath, TraversedNode>;
	readonly sizes: ReadonlyMap<VaultPath, NodeSize>;
	readonly edges: readonly GraphEdge[];
	readonly mainPath: VaultPath;
	/** Hard cap on the number of NON-central nodes kept. */
	readonly nodeCap: number;
}

export interface TruncationResult {
	readonly visiblePaths: ReadonlySet<VaultPath>;
	/** Edges whose two endpoints both survived truncation. */
	readonly visibleEdges: readonly GraphEdge[];
	/** Hidden (truncated) node counts per folder — feeds the UI badge on folder groups. */
	readonly hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>;
}

/**
 * Applies the hard node cap. Centrals are exempt and do not count against the
 * cap; folder containers are a UI construct that never reaches the engine, so
 * they cannot count either. Ordering is fully deterministic via
 * {@link NodePriorityChain} (same input → same output).
 */
export class GraphTruncator {
	static truncate(input: TruncationInput): TruncationResult {
		const distances = undirectedDistancesFrom(input.mainPath, input.edges);
		const candidates = [...input.nodes.values()].filter((node) => !node.isCentral);
		candidates.sort((a, b) =>
			NodePriorityChain.compare(toRankable(a, input, distances), toRankable(b, input, distances)),
		);
		const visiblePaths = new Set<VaultPath>();
		for (const node of input.nodes.values()) {
			if (node.isCentral) {
				visiblePaths.add(node.path);
			}
		}
		for (const kept of candidates.slice(0, input.nodeCap)) {
			visiblePaths.add(kept.path);
		}
		const hiddenNodeCountsByFolder = new Map<FolderPath, number>();
		for (const hidden of candidates.slice(input.nodeCap)) {
			hiddenNodeCountsByFolder.set(hidden.folder, (hiddenNodeCountsByFolder.get(hidden.folder) ?? 0) + 1);
		}
		return {
			visiblePaths,
			visibleEdges: input.edges.filter((edge) => visiblePaths.has(edge.source) && visiblePaths.has(edge.target)),
			hiddenNodeCountsByFolder,
		};
	}
}

function toRankable(node: TraversedNode, input: TruncationInput, distances: ReadonlyMap<VaultPath, number>) {
	return {
		path: node.path,
		minDepth: node.minDepth,
		sizeScore: input.sizes.get(node.path)?.sizeScore ?? 0,
		distanceToMain: distances.get(node.path),
		// Pinned nodes are centrals (cap-exempt), so recency never arbitrates here;
		// the pin-recency level of the shared chain serves the settings cascade.
		pinTimestamp: undefined,
		docid: node.docid,
	};
}

/** Undirected BFS distances from MAIN over the traversed edges ("graph distance to MAIN"). */
function undirectedDistancesFrom(start: VaultPath, edges: readonly GraphEdge[]): ReadonlyMap<VaultPath, number> {
	const adjacency = new Map<VaultPath, VaultPath[]>();
	const addNeighbor = (from: VaultPath, to: VaultPath): void => {
		const neighbors = adjacency.get(from) ?? [];
		neighbors.push(to);
		adjacency.set(from, neighbors);
	};
	for (const edge of edges) {
		addNeighbor(edge.source, edge.target);
		addNeighbor(edge.target, edge.source);
	}
	const distances = new Map<VaultPath, number>([[start, 0]]);
	const queue: VaultPath[] = [start];
	for (let head = 0; head < queue.length; head++) {
		const current = queue[head];
		if (current === undefined) {
			continue; // Unreachable: head < queue.length. Satisfies noUncheckedIndexedAccess.
		}
		const currentDistance = distances.get(current) ?? 0;
		for (const neighbor of adjacency.get(current) ?? []) {
			if (!distances.has(neighbor)) {
				distances.set(neighbor, currentDistance + 1);
				queue.push(neighbor);
			}
		}
	}
	return distances;
}
