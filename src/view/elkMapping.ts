import type { ElkNode } from "elkjs";
import type { NeighborhoodGraph } from "../engine";
import { ELK_LAYOUT_OPTIONS, ELK_ROOT_ID } from "./constants";
import { edgeIdOf, nodeSideLengthPx } from "./graphIdentity";
import type { XY } from "./flowMapping";

/**
 * Pure engine → elk graph mapping and position extraction. `import type` of
 * `ElkNode` is erased at compile time, so this module pulls in no runtime
 * dependency and stays node-testable; the actual elk engine is invoked by
 * {@link ElkLayoutRunner}.
 *
 * Compound-ready by construction (step-05 folder groups): nodes are the elk
 * root's `children` and edges hang off the root. When folder groups arrive,
 * children get nested under folder container nodes and intra-folder edges move
 * onto those containers — the root shape and this module's contract do not
 * change, and {@link extractElkPositions} already accumulates parent offsets.
 */

export function neighborhoodGraphToElk(graph: NeighborhoodGraph): ElkNode {
	return {
		id: ELK_ROOT_ID,
		layoutOptions: { ...ELK_LAYOUT_OPTIONS },
		children: graph.nodes.map((node) => {
			const side = nodeSideLengthPx(node);
			return { id: node.path, width: side, height: side };
		}),
		edges: graph.edges.map((edge) => ({
			id: edgeIdOf(edge),
			sources: [edge.source],
			targets: [edge.target],
		})),
	};
}

/**
 * Flattens a laid-out elk graph into absolute node positions. elk reports child
 * coordinates relative to their parent; the offset accumulation keeps this
 * correct once nodes are nested under folder containers (step-05).
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
