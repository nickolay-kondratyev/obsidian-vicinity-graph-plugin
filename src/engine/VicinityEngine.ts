import { CrossLinkSweep } from "./CrossLinkSweep";
import { EdgeAssembly } from "./EdgeAssembly";
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
	NodeOverride,
	PinnedNodeDescriptor,
	VaultPath,
	ViewSettings,
} from "./types";
import { DepthSettingsFacts } from "./types";

/**
 * Everything a graph build needs. All inputs are PATH-keyed: persisted
 * docid-keyed data (the pinned set) must be translated by the step-03 adapter
 * before it reaches the engine (see CLARIFICATION Q1).
 *
 * Settings are GLOBAL-only: {@link globalDepths} carries one set of budgets for
 * the MAIN root and one for every pinned root (never per-note), and
 * {@link globalView} is the view configuration verbatim. There is no per-doc
 * override layer to cascade (owner decision 2026-07-29).
 */
export interface GraphBuildRequest {
	/** The active document. */
	readonly main: CentralNodeDescriptor;
	readonly pinned?: readonly PinnedNodeDescriptor[];
	/** The one depth configuration: active-note budgets + pinned-note budgets. */
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	/**
	 * Global node exclusion (vault-wide). Absent ⇒ no exclusion. Honored only for
	 * discovered NEIGHBORS (never roots), at BFS neighbor discovery.
	 */
	readonly nodeExclusion?: NodeExclusionSettings;
	/**
	 * Per-node user overrides, already docid→path translated by the adapter
	 * (like the pinned set). The engine ECHOES a matching entry onto its output
	 * node ({@link GraphNode.override}) — application is downstream: pixels in
	 * the view mapping, content in `nodePreviewKind`. Absent ⇒ no overrides.
	 */
	readonly nodeOverrides?: ReadonlyMap<VaultPath, NodeOverride>;
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
		const sizes = NodeSizer.computeSizes(traversal.nodes, viewSettings);
		const truncation = GraphTruncator.truncate({
			nodes: traversal.nodes,
			edges: traversal.edges,
			mainPath: request.main.path,
			nodeCap: viewSettings.nodeCap,
		});
		const nodes: GraphNode[] = [];
		for (const node of traversal.nodes.values()) {
			if (!truncation.visiblePaths.has(node.path)) {
				continue;
			}
			const sizePx = sizes.get(node.path);
			if (sizePx === undefined) {
				// The sizer sizes every traversed node; a gap is a pipeline bug.
				// Fail loud rather than render a silently wrong graph.
				throw new Error(`Engine invariant violated: no size computed for path=[${node.path}]`);
			}
			const override = request.nodeOverrides?.get(node.path);
			nodes.push({
				...node,
				isMain: node.path === request.main.path,
				sizePx,
				...(override !== undefined ? { override } : {}),
			});
		}
		return {
			nodes,
			edges: EdgeAssembly.attach({
				visibleEdges: this.visibleEdges(viewSettings, truncation),
				hierarchyPairKeys: traversal.hierarchyPairKeys,
				linkPairKeys: traversal.linkPairKeys,
				crossLinksOn: viewSettings.showCrossLinks,
				provider: this.provider,
			}),
			hiddenNodeCountsByFolder: truncation.hiddenNodeCountsByFolder,
			excludedNodeCount: traversal.excludedNodeCount,
			viewSettings,
		};
	}

	/**
	 * THE "which links are edges" decision, made once: the walked set, or — with
	 * {@link ViewSettings.showCrossLinks} on — the walked set WIDENED to every link
	 * between two visible nodes.
	 *
	 * Reached only AFTER truncation, and deliberately: sizing and the truncator's
	 * distance-to-MAIN ranking above have already run on the WALKED edges, so the toggle
	 * cannot move a node in or out of the graph (see {@link CrossLinkSweep}).
	 */
	private visibleEdges(viewSettings: ViewSettings, truncation: TruncationResult): readonly DirectedLink[] {
		if (!viewSettings.showCrossLinks) {
			return truncation.visibleEdges;
		}
		return CrossLinkSweep.inducedPairs({
			walkedVisibleEdges: truncation.visibleEdges,
			visiblePaths: truncation.visiblePaths,
			provider: this.provider,
		});
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
	 * descriptor, so such a note traverses with the ACTIVE-note budgets (the
	 * assembler also drops a pin on the main path before it gets here). Depths
	 * are per ROLE, never per note: one dial for the active note, one for every
	 * pinned note.
	 */
	private toRoots(request: GraphBuildRequest): readonly TraversalRoot[] {
		const pinnedDepths = DepthSettingsFacts.pinnedChannelDepths(request.globalDepths);
		return [
			{ descriptor: request.main, depths: DepthSettingsFacts.activeChannelDepths(request.globalDepths) },
			...(request.pinned ?? []).map((descriptor) => ({ descriptor, depths: pinnedDepths })),
		];
	}
}
