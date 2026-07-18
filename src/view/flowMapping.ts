import type { NeighborhoodGraph } from "../engine";
import { edgeIdOf, nodeSideLengthPx } from "./graphIdentity";

/**
 * Pure engine → React Flow shape mapping. Emits plain objects only (no React,
 * no `@xyflow/react` import) so it is node-testable; the ItemView adapts these
 * into concrete React Flow `Node`/`Edge` values at the render boundary.
 */

export interface XY {
	readonly x: number;
	readonly y: number;
}

/** Node payload the renderer needs. `title` becomes the default node label. */
export interface FlowNodeData {
	readonly path: string;
	readonly title: string;
	readonly isCentral: boolean;
	readonly isMain: boolean;
	readonly sizePx: number;
}

export interface FlowNode {
	/** React Flow / elk node id — the vault path. */
	readonly id: string;
	readonly position: XY;
	readonly width: number;
	readonly height: number;
	readonly data: FlowNodeData;
}

export interface FlowEdge {
	readonly id: string;
	readonly source: string;
	readonly target: string;
}

export interface FlowGraph {
	readonly nodes: readonly FlowNode[];
	readonly edges: readonly FlowEdge[];
}

/** Position every node gets before layout runs (elk overwrites it). */
const UNPLACED: XY = { x: 0, y: 0 };

export function neighborhoodGraphToFlow(graph: NeighborhoodGraph): FlowGraph {
	const nodes = graph.nodes.map((node): FlowNode => {
		const side = nodeSideLengthPx(node);
		return {
			id: node.path,
			position: UNPLACED,
			width: side,
			height: side,
			data: {
				path: node.path,
				title: node.title,
				isCentral: node.isCentral,
				isMain: node.isMain,
				sizePx: node.sizePx,
			},
		};
	});
	const edges = graph.edges.map(
		(edge): FlowEdge => ({ id: edgeIdOf(edge), source: edge.source, target: edge.target }),
	);
	return { nodes, edges };
}

/**
 * Applies laid-out (or preserved) positions to freshly mapped nodes. Used both
 * after an elk relayout and on the reuse-layout path, where new node DATA is
 * kept but OLD positions are retained. A node with no known position stays at
 * its unplaced origin (only happens transiently on the reuse path if a caller
 * misuses it — structural diff guarantees the id set matches on that path).
 */
export function withPositions(nodes: readonly FlowNode[], positions: ReadonlyMap<string, XY>): readonly FlowNode[] {
	return nodes.map((node) => {
		const position = positions.get(node.id);
		return position === undefined ? node : { ...node, position };
	});
}
