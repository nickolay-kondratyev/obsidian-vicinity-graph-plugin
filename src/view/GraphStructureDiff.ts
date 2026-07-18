import type { GraphNode, NeighborhoodGraph } from "../engine";
import { edgeIdOf } from "./graphIdentity";

/**
 * Decides whether a rebuilt graph needs a fresh elk layout or can reuse the
 * previous one. Pure and node-testable — the ItemView only sequences it.
 *
 * `reuse-layout` (skip elk): identical node id set AND identical edge id set,
 * and no surviving node grew too much (see below). Only node DATA is refreshed,
 * positions are kept — this is the "no-structural-change edits skip layout"
 * exit criterion.
 *
 * `relayout`: first build, any structural change (a node or edge added/removed),
 * or a surviving node whose `sizePx` grew beyond the threshold. Structural
 * changes accept layout jumps in V1 (position seeding is V2).
 */
export type LayoutDecision = "relayout" | "reuse-layout";

export function decideLayout(
	previous: NeighborhoodGraph | null,
	next: NeighborhoodGraph,
	sizeGrowthThreshold: number,
): LayoutDecision {
	if (previous === null) {
		return "relayout";
	}
	if (!sameIds(nodeIdsOf(previous), nodeIdsOf(next))) {
		return "relayout";
	}
	if (!sameIds(edgeIdsOf(previous), edgeIdsOf(next))) {
		return "relayout";
	}
	if (anyNodeGrewBeyond(previous.nodes, next.nodes, sizeGrowthThreshold)) {
		return "relayout";
	}
	return "reuse-layout";
}

function nodeIdsOf(graph: NeighborhoodGraph): Set<string> {
	return new Set(graph.nodes.map((node) => node.path));
}

function edgeIdsOf(graph: NeighborhoodGraph): Set<string> {
	return new Set(graph.edges.map(edgeIdOf));
}

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
	if (a.size !== b.size) {
		return false;
	}
	for (const id of a) {
		if (!b.has(id)) {
			return false;
		}
	}
	return true;
}

/**
 * True if a node present in BOTH graphs grew by more than `threshold` (a
 * fraction of its previous size). Reached only when the id sets already match,
 * so every `next` node has a `previous` counterpart. A previous size of 0 is
 * treated as no meaningful ratio (avoids divide-by-zero; sizePx is >= minPx in
 * practice).
 */
function anyNodeGrewBeyond(
	previous: readonly GraphNode[],
	next: readonly GraphNode[],
	threshold: number,
): boolean {
	const previousSizeByPath = new Map(previous.map((node) => [node.path, node.sizePx]));
	return next.some((node) => {
		const previousSize = previousSizeByPath.get(node.path);
		if (previousSize === undefined || previousSize <= 0) {
			return false;
		}
		const growthRatio = (node.sizePx - previousSize) / previousSize;
		return growthRatio > threshold;
	});
}
