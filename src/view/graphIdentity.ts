import type { GraphEdge, GraphNode } from "../engine";

/**
 * Structural identity helpers shared by the React-Flow mapping, the elk mapping
 * and the structural diff. Single source of the two conventions those three
 * modules must agree on: how an edge is identified, and how a node's on-screen
 * side length is derived. Pure — safe for node tests.
 */

/**
 * Engine edges carry no id ({@link GraphEdge} is `{source, target}`); React Flow
 * and elk both require one. Synthesized from the ordered pair — deterministic
 * and unique because the engine deduplicates edges per `(source, target)`.
 */
export function edgeIdOf(edge: GraphEdge): string {
	return `${edge.source}->${edge.target}`;
}

/**
 * Nodes render (and lay out) as squares of the engine's diff-stable `sizePx`.
 * Both the elk input and the React Flow node must use the SAME number or layout
 * positions and rendered boxes drift apart.
 */
export function nodeSideLengthPx(node: GraphNode): number {
	return node.sizePx;
}
