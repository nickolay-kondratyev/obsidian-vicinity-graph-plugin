import { CrossLinkSweep } from "./CrossLinkSweep";
import { EdgeCounts } from "./EdgeCounts";
import { GraphTruncator } from "./GraphTruncator";
import type { TruncationResult } from "./GraphTruncator";
import type { LinkProvider } from "./LinkProvider";
import { PathExclusionMatcher } from "./PathExclusionMatcher";
import { VicinityTraversal } from "./VicinityTraversal";
import type { TraversalRoot } from "./VicinityTraversal";
import { NodeSizer } from "./NodeSizer";
import type {
	CentralNodeDescriptor,
	DepthSettings,
	DirectedLink,
	GraphNode,
	VicinityGraph,
	NodeExclusionSettings,
	PinnedNodeDescriptor,
	ViewSettings,
} from "./types";

/**
 * Everything a graph build needs. All inputs are PATH-keyed: persisted
 * docid-keyed data (the pinned set) must be translated by the step-03 adapter
 * before it reaches the engine (see CLARIFICATION Q1).
 *
 * Settings are GLOBAL-only: {@link globalDepths} applies to MAIN and to EVERY
 * pinned root alike, and {@link globalView} is the view configuration verbatim.
 * There is no per-doc override layer to cascade (owner decision 2026-07-29).
 */
export interface GraphBuildRequest {
	/** The active document. */
	readonly main: CentralNodeDescriptor;
	readonly pinned?: readonly PinnedNodeDescriptor[];
	/** The one depth configuration every root traverses with. */
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	/**
	 * Global node exclusion (vault-wide). Absent ⇒ no exclusion. Honored only for
	 * discovered NEIGHBORS (never roots), at BFS neighbor discovery.
	 */
	readonly nodeExclusion?: NodeExclusionSettings;
}

/**
 * The engine facade — the one call steps 03/04 make per rebuild:
 * multi-root BFS → sizing → truncation → edge visibility. Pure and
 * synchronous; Obsidian reaches it only through {@link LinkProvider}.
 */
export class VicinityEngine {
	constructor(private readonly provider: LinkProvider) {}

	build(request: GraphBuildRequest): VicinityGraph {
		const viewSettings = request.globalView;
		const traversal = new VicinityTraversal(this.provider, this.exclusionMatcher(request)).traverse(
			this.toRoots(request),
		);
		const sizes = new NodeSizer(this.provider).computeSizes(traversal.nodes, viewSettings.sizing);
		const truncation = GraphTruncator.truncate({
			nodes: traversal.nodes,
			sizes: sizes,
			edges: traversal.edges,
			mainPath: request.main.path,
			nodeCap: viewSettings.nodeCap,
		});
		const nodes: GraphNode[] = [];
		for (const node of traversal.nodes.values()) {
			if (!truncation.visiblePaths.has(node.path)) {
				continue;
			}
			const size = sizes.get(node.path);
			if (size === undefined) {
				// The sizer sizes every traversed node; a gap is a pipeline bug.
				// Fail loud rather than render a silently wrong graph.
				throw new Error(`Engine invariant violated: no size computed for path=[${node.path}]`);
			}
			nodes.push({
				...node,
				isMain: node.path === request.main.path,
				sizeScore: size.sizeScore,
				sizePx: size.sizePx,
			});
		}
		return {
			nodes,
			edges: EdgeCounts.attach({
				visibleEdges: this.visibleEdges(viewSettings, truncation),
				provider: this.provider,
			}),
			hiddenNodeCountsByFolder: truncation.hiddenNodeCountsByFolder,
			excludedNodeCount: traversal.excludedNodeCount,
			viewSettings,
		};
	}

	/**
	 * THE "which links are edges" decision, made once: the walked set, or — with
	 * {@link ViewSettings.showCrossLinks} on — every link between two visible nodes.
	 *
	 * Reached only AFTER truncation, and deliberately: sizing and the truncator's
	 * distance-to-MAIN ranking above have already run on the WALKED edges, so the toggle
	 * cannot move a node in or out of the graph (see {@link CrossLinkSweep}).
	 */
	private visibleEdges(viewSettings: ViewSettings, truncation: TruncationResult): readonly DirectedLink[] {
		if (!viewSettings.showCrossLinks) {
			return truncation.visibleEdges;
		}
		return CrossLinkSweep.inducedPairs({ visiblePaths: truncation.visiblePaths, provider: this.provider });
	}

	/**
	 * Builds the neighbor-exclusion matcher for this request. A disabled flag or an
	 * absent config yields an empty (no-op) matcher — the `enabled` gate lives here
	 * so {@link PathExclusionMatcher} stays pure regex-lite logic.
	 */
	private exclusionMatcher(request: GraphBuildRequest): PathExclusionMatcher {
		const exclusion = request.nodeExclusion;
		const patterns = exclusion?.enabled ? exclusion.patterns : [];
		return PathExclusionMatcher.fromPatterns(patterns);
	}

	/**
	 * MAIN first — when MAIN is also pinned, traversal dedupe keeps MAIN's
	 * descriptor. Every root gets the SAME depths: one global dial, no per-root
	 * layer to resolve.
	 */
	private toRoots(request: GraphBuildRequest): readonly TraversalRoot[] {
		const descriptors: readonly CentralNodeDescriptor[] = [request.main, ...(request.pinned ?? [])];
		return descriptors.map((descriptor) => ({ descriptor, depths: request.globalDepths }));
	}
}
