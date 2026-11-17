import type { TagKey } from "../shared/Tags";
import { CrossLinkSweep } from "./CrossLinkSweep";
import { EdgeAssembly } from "./EdgeAssembly";
import { GraphTruncator } from "./GraphTruncator";
import type { TruncationResult } from "./GraphTruncator";
import type { LinkProvider } from "./LinkProvider";
import { PathExclusionMatcher } from "./PathExclusionMatcher";
import { TagFilteredSelector } from "./TagFilteredGraph";
import { VicinityTraversal } from "./VicinityTraversal";
import type { TraversalRoot, TraversedNode } from "./VicinityTraversal";
import { NodeSizer } from "./NodeSizer";
import type {
	CentralNodeDescriptor,
	DepthSettings,
	DirectedLink,
	DocId,
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
 * Everything a TAG-FILTERED build needs ({@link VicinityEngine.buildForTag}). No
 * `main`, no pins and no depths: nothing is walked, so there is nothing to root or
 * budget. The view settings, exclusion and overrides mean what they mean in
 * {@link GraphBuildRequest}.
 */
export interface TagGraphBuildRequest {
	/** The filter tag's identity; notes carrying a tag nested below it match too. */
	readonly tag: TagKey;
	readonly globalView: ViewSettings;
	/** Global node exclusion. Applies to EVERY tagged note — there are no roots to exempt. */
	readonly nodeExclusion?: NodeExclusionSettings;
	readonly nodeOverrides?: ReadonlyMap<VaultPath, NodeOverride>;
	/**
	 * The docids of the globally PINNED docs, by path — ECHOED onto the tagged notes
	 * among them and nothing else (the same echo a root's docid gets in
	 * {@link GraphBuildRequest}), so the view can show a tagged note as pinned and
	 * unpin it. A pin still adds NO note and makes none central.
	 */
	readonly pinnedDocIds?: ReadonlyMap<VaultPath, DocId>;
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
		const truncation = GraphTruncator.truncate({
			nodes: traversal.nodes,
			edges: traversal.edges,
			mainPath: request.main.path,
			nodeCap: viewSettings.nodeCap,
		});
		const visibleNodes = new Map<VaultPath, TraversedNode>();
		for (const [path, node] of traversal.nodes) {
			if (truncation.visiblePaths.has(path)) {
				visibleNodes.set(path, node);
			}
		}
		return {
			nodes: this.sizedNodes(visibleNodes, viewSettings, request.nodeOverrides, request.main.path),
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
	 * The TAG-FILTERED build (tags-v1): every note carrying {@link TagGraphBuildRequest.tag}
	 * (or a nested child tag) with the links between them — no MAIN, no centrals, no
	 * walk. Selection and its most-linked truncation live in {@link TagFilteredSelector};
	 * sizing and edge assembly are the SAME stages {@link build} uses, so a tagged note
	 * renders exactly like the same note in a vicinity graph.
	 *
	 * Every link between two visible notes is an edge REGARDLESS of
	 * {@link ViewSettings.showCrossLinks}: that toggle chooses between "walked" and
	 * "all" links, and nothing is walked here.
	 */
	buildForTag(request: TagGraphBuildRequest): VicinityGraph {
		const viewSettings = request.globalView;
		const selection = TagFilteredSelector.select({
			provider: this.provider,
			tag: request.tag,
			exclusion: this.exclusionMatcher(request),
			nodeCap: viewSettings.nodeCap,
			...(request.pinnedDocIds === undefined ? {} : { echoedDocIds: request.pinnedDocIds }),
		});
		return {
			nodes: this.sizedNodes(selection.visibleNodes, viewSettings, request.nodeOverrides, undefined),
			// No pair-key sets: with no hierarchy channel walked, every pair is a link.
			edges: EdgeAssembly.attach({ visibleEdges: selection.visibleEdges, provider: this.provider }),
			hiddenNodeCountsByFolder: selection.hiddenNodeCountsByFolder,
			excludedNodeCount: selection.excludedNodeCount,
			viewSettings,
		};
	}

	/**
	 * Sizes the VISIBLE nodes only, AFTER truncation (the truncators' rankings are
	 * size-independent, so this order is safe). The sizer's image de-dup then sees
	 * exactly the nodes the VIEW renders and de-dups against, so a suppressed node's
	 * box matches the region it paints — a winner truncated away would otherwise
	 * leave a surviving loser sized for an image it now shows.
	 *
	 * `mainPath` is `undefined` for a build with no MAIN (the tag-filtered one).
	 */
	private sizedNodes(
		visibleNodes: ReadonlyMap<VaultPath, TraversedNode>,
		viewSettings: ViewSettings,
		nodeOverrides: ReadonlyMap<VaultPath, NodeOverride> | undefined,
		mainPath: VaultPath | undefined,
	): readonly GraphNode[] {
		const sizes = NodeSizer.computeSizes(visibleNodes, viewSettings);
		const nodes: GraphNode[] = [];
		for (const node of visibleNodes.values()) {
			const sizePx = sizes.get(node.path);
			if (sizePx === undefined) {
				// The sizer sizes every visible node; a gap is a pipeline bug.
				// Fail loud rather than render a silently wrong graph.
				throw new Error(`Engine invariant violated: no size computed for path=[${node.path}]`);
			}
			const override = nodeOverrides?.get(node.path);
			nodes.push({
				...node,
				isMain: node.path === mainPath,
				sizePx,
				...(override !== undefined ? { override } : {}),
			});
		}
		return nodes;
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
	private exclusionMatcher(request: Pick<GraphBuildRequest, "nodeExclusion">): PathExclusionMatcher {
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
