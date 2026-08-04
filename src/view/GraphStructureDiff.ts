import type { ForceLayoutSettings, GraphNode, VicinityGraph } from "../engine";
import { FORCE_LAYOUT_RANGES } from "../engine";
import { edgeIdOf, nodeDimensionsPx } from "./graphIdentity";

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
 * a force-layout tuning change (the sliders must re-run the layout live — reusing
 * positions would silently swallow the new values), or a surviving node whose
 * RENDERED box (`nodeDimensionsPx` — engine sizing or a user size override) grew
 * beyond the threshold. Structural changes accept layout jumps in V1 (position
 * seeding is V2).
 */
export type LayoutDecision = "relayout" | "reuse-layout";

export function decideLayout(
	previous: VicinityGraph | null,
	next: VicinityGraph,
	sizeGrowthThreshold: number,
): LayoutDecision {
	if (previous === null) {
		return "relayout";
	}
	if (!sameForceLayout(previous.viewSettings.forceLayout, next.viewSettings.forceLayout)) {
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

/**
 * Every force-layout field, derived from FORCE_LAYOUT_RANGES rather than hand-listed:
 * the ranges table is typed `Record<keyof ForceLayoutSettings, …>`, so a future field
 * is compile-forced into it and automatically compared here (a hand-written field
 * list could silently miss one, leaving that slider without live effect).
 */
const FORCE_LAYOUT_FIELDS = Object.keys(FORCE_LAYOUT_RANGES) as readonly (keyof ForceLayoutSettings)[];

/** Value equality over every force-layout field (each build resolves a fresh object, so identity cannot be used). */
function sameForceLayout(a: ForceLayoutSettings, b: ForceLayoutSettings): boolean {
	return FORCE_LAYOUT_FIELDS.every((field) => a[field] === b[field]);
}

function nodeIdsOf(graph: VicinityGraph): Set<string> {
	return new Set(graph.nodes.map((node) => node.path));
}

function edgeIdsOf(graph: VicinityGraph): Set<string> {
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
 * fraction of its previous size) in EITHER rendered dimension. Compared on
 * {@link nodeDimensionsPx} — the box elk laid out and React Flow renders — not
 * on the raw engine `sizePx`, so a per-node size override committed by a
 * drag-resize is seen exactly like an engine growth (that is what makes ONE
 * relayout follow a big resize). Reached only when the id sets already match,
 * so every `next` node has a `previous` counterpart. A previous dimension of 0
 * is treated as no meaningful ratio (avoids divide-by-zero; dimensions are
 * >= minPx in practice).
 */
function anyNodeGrewBeyond(
	previous: readonly GraphNode[],
	next: readonly GraphNode[],
	threshold: number,
): boolean {
	const previousDimensionsByPath = new Map(previous.map((node) => [node.path, nodeDimensionsPx(node)]));
	const grewBeyond = (previousPx: number, nextPx: number): boolean =>
		previousPx > 0 && (nextPx - previousPx) / previousPx > threshold;
	return next.some((node) => {
		const previousDimensions = previousDimensionsByPath.get(node.path);
		if (previousDimensions === undefined) {
			return false;
		}
		const nextDimensions = nodeDimensionsPx(node);
		return (
			grewBeyond(previousDimensions.width, nextDimensions.width) ||
			grewBeyond(previousDimensions.height, nextDimensions.height)
		);
	});
}
