import type { ForceLayoutSettings, GraphNode, VicinityGraph } from "../engine";
import { FORCE_LAYOUT_RANGES } from "../engine";
import { deriveNestingForest } from "./embedNesting";
import { edgeIdOf, nodeDimensionsPx, nodeSizeOverridePx, sameNodeSizeOverridePx } from "./graphIdentity";
import { resizedNodesFitRenderedLayout } from "./layoutFit";
import type { RenderedLayout } from "./layoutFit";

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
 * positions would silently swallow the new values), a surviving node whose per-node
 * size OVERRIDE changed into a box that no longer FITS where the rendered layout
 * put it (see {@link resizedPaths}), or a surviving node whose RENDERED box
 * (`nodeDimensionsPx`) grew beyond the threshold. Structural changes accept layout
 * jumps in V1 (position seeding is V2).
 *
 * `renderedLayout` is the geometry the reuse path would keep — needed because the
 * resize rule is a question about SPACE, not about the graph alone.
 */
export type LayoutDecision = "relayout" | "reuse-layout";

export function decideLayout(
	previous: VicinityGraph | null,
	next: VicinityGraph,
	sizeGrowthThreshold: number,
	renderedLayout: RenderedLayout,
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
	// A nesting change (a node gained, lost, or switched its container) restructures
	// the React Flow parent chain and the elk compound tree even when the node and
	// edge id SETS are unchanged — e.g. pinning flips `isCentral`, which can move
	// container precedence (embed-nesting P3). Reusing positions would leave a node
	// visually parented where it no longer belongs, so force a relayout.
	if (!sameNesting(previous, next)) {
		return "relayout";
	}
	const resized = resizedPaths(previous.nodes, next.nodes);
	if (resized.size > 0 && !resizedNodesFitRenderedLayout(resized, next.nodes, renderedLayout)) {
		return "relayout";
	}
	if (anyNodeGrewBeyond(previous.nodes, next.nodes, sizeGrowthThreshold, resized)) {
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

/**
 * Value equality of the two graphs' nesting FORESTS by each node's container
 * assignment. Reached only when the node id sets already match, so a differing
 * `containerPath` for any path is a genuine nesting change (a node re-parented, or
 * a container gained/lost a child). Compared on `containerPath` — the direct
 * parent, which is exactly what React Flow's parent chain and elk's compound tree
 * key on; the outermost/child lists are derived from it. `deriveNestingForest` is
 * pure, so this re-derivation is deterministic.
 */
function sameNesting(previous: VicinityGraph, next: VicinityGraph): boolean {
	const previousForest = deriveNestingForest(previous);
	const nextForest = deriveNestingForest(next);
	for (const node of next.nodes) {
		const previousContainer = previousForest.nestingByPath.get(node.path)?.containerPath;
		const nextContainer = nextForest.nestingByPath.get(node.path)?.containerPath;
		if (previousContainer !== nextContainer) {
			return false;
		}
	}
	return true;
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
 * The nodes present in BOTH graphs whose per-node size override MOVED — set,
 * cleared, or changed to another box (ticket `nid_sj9qg27cmear9lgdlz5umwra5_e`).
 * These are exactly the nodes the user just resized: an override moves for one
 * reason only, a released drag-resize or "Reset size". It cannot move mid-drag —
 * the drag lives in React Flow's local node state and reaches the store, hence a
 * rebuild, only on release.
 *
 * WHY this is not folded into {@link anyNodeGrewBeyond}'s threshold: the threshold
 * exists for PASSIVE growth (the engine re-scoring a node after a large paste),
 * where a layout jump under the user's reading position is the bigger evil. A
 * resize is the opposite — the new box is what the user just asked for and is
 * looking straight at, so ratios are beside the point; what matters is whether it
 * still fits, which {@link resizedNodesFitRenderedLayout} answers (ticket
 * `nid_9ep12hkmk4zjv2p28emmrhieq_e`: a resize with room to spare must NOT
 * re-arrange — and re-fit — the whole graph). A SHRINK and a clear are reported
 * here for the same reason, and the threshold never saw shrinks at all.
 *
 * Equality (including "no override at all") is {@link sameNodeSizeOverridePx}'s
 * to define — this rule only decides what a difference MEANS. Reached only when
 * the id sets already match, so every `next` node has a `previous` counterpart.
 */
function resizedPaths(previous: readonly GraphNode[], next: readonly GraphNode[]): ReadonlySet<string> {
	const previousOverrideByPath = new Map(previous.map((node) => [node.path, nodeSizeOverridePx(node)]));
	return new Set(
		next
			.filter((node) => !sameNodeSizeOverridePx(previousOverrideByPath.get(node.path), nodeSizeOverridePx(node)))
			.map((node) => node.path),
	);
}

/**
 * True if a node present in BOTH graphs grew by more than `threshold` (a
 * fraction of its previous size) in EITHER rendered dimension. Compared on
 * {@link nodeDimensionsPx} — the box elk laid out and React Flow renders — not
 * on the raw engine `sizePx`, so a growth of the label-driven WIDTH counts too.
 * A node the user just RESIZED is skipped (`justResized`): its box was already
 * judged by the one rule that applies to it — does it still fit — and re-judging
 * the same growth by ratio here would relayout a big-but-fitting resize through
 * the back door. What is left is PASSIVE growth, the only kind the threshold was
 * ever meant to damp. Reached only when the id sets already match,
 * so every `next` node has a `previous` counterpart. A previous dimension of 0
 * is treated as no meaningful ratio (avoids divide-by-zero; dimensions are
 * >= minPx in practice).
 */
function anyNodeGrewBeyond(
	previous: readonly GraphNode[],
	next: readonly GraphNode[],
	threshold: number,
	justResized: ReadonlySet<string>,
): boolean {
	const previousDimensionsByPath = new Map(previous.map((node) => [node.path, nodeDimensionsPx(node)]));
	const grewBeyond = (previousPx: number, nextPx: number): boolean =>
		previousPx > 0 && (nextPx - previousPx) / previousPx > threshold;
	return next.some((node) => {
		if (justResized.has(node.path)) {
			return false;
		}
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
