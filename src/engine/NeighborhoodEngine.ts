import { EdgeVisibility } from "./EdgeVisibility";
import { GraphTruncator } from "./GraphTruncator";
import type { LinkProvider } from "./LinkProvider";
import { NeighborhoodTraversal } from "./NeighborhoodTraversal";
import type { TraversalRoot } from "./NeighborhoodTraversal";
import { NodeSizer } from "./NodeSizer";
import { TraversalSettingsResolver } from "./TraversalSettingsResolver";
import { ViewSettingsResolver } from "./ViewSettingsResolver";
import type { PinnedViewOverride } from "./ViewSettingsResolver";
import type {
	CentralNodeDescriptor,
	DepthOverride,
	DepthSettings,
	GraphNode,
	NeighborhoodGraph,
	PinnedNodeDescriptor,
	VaultPath,
	ViewSettings,
	ViewSettingsOverride,
} from "./types";

/**
 * Everything a graph build needs. All inputs are PATH-keyed: persisted
 * docid-keyed data (pins, depth overrides) must be translated by the step-03
 * adapter before it reaches the engine (see CLARIFICATION Q1).
 */
export interface GraphBuildRequest {
	/** The active document. */
	readonly main: CentralNodeDescriptor;
	readonly pinned?: readonly PinnedNodeDescriptor[];
	readonly globalDepths: DepthSettings;
	/** Per-root depth overrides (the root doc's own persisted depth settings). */
	readonly depthOverridesByRoot?: ReadonlyMap<VaultPath, DepthOverride>;
	readonly globalView: ViewSettings;
	readonly mainViewOverride?: ViewSettingsOverride;
	readonly pinnedViewOverrides?: readonly PinnedViewOverride[];
}

/**
 * The engine facade — the one call steps 03/04 make per rebuild:
 * resolve settings → multi-root BFS → sizing → truncation → edge visibility.
 * Pure and synchronous; Obsidian reaches it only through {@link LinkProvider}.
 */
export class NeighborhoodEngine {
	constructor(private readonly provider: LinkProvider) {}

	build(request: GraphBuildRequest): NeighborhoodGraph {
		const viewSettings = ViewSettingsResolver.resolve({
			global: request.globalView,
			mainOverride: request.mainViewOverride,
			pinnedOverrides: request.pinnedViewOverrides,
		});
		const traversal = new NeighborhoodTraversal(this.provider).traverse(this.toRoots(request));
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
			edges: EdgeVisibility.edgesFor({
				mode: viewSettings.edgeVisibility,
				visiblePaths: truncation.visiblePaths,
				walkedVisibleEdges: truncation.visibleEdges,
				provider: this.provider,
			}),
			hiddenNodeCountsByFolder: truncation.hiddenNodeCountsByFolder,
			viewSettings,
		};
	}

	/** MAIN first — when MAIN is also pinned, traversal dedupe keeps MAIN's descriptor. */
	private toRoots(request: GraphBuildRequest): readonly TraversalRoot[] {
		const descriptors: readonly CentralNodeDescriptor[] = [request.main, ...(request.pinned ?? [])];
		return descriptors.map((descriptor) => ({
			descriptor,
			depths: TraversalSettingsResolver.resolveForRoot(
				request.globalDepths,
				request.depthOverridesByRoot?.get(descriptor.path),
			),
		}));
	}
}
