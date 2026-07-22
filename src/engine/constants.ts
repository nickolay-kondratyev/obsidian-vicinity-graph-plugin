import type { DepthSettings, EdgeVisibilityMode, LayoutMode, SizingSettings, ViewSettings } from "./types";

/** Hard cap default on non-central node count (step doc: default 100). */
export const DEFAULT_NODE_CAP = 100;

/** Depth defaults mirror Obsidian's local-graph default of 1 hop each way. */
export const DEFAULT_OUTGOING_DEPTH = 1;
export const DEFAULT_INCOMING_DEPTH = 1;

export const DEFAULT_MIN_NODE_PX = 40;
export const DEFAULT_MAX_NODE_PX = 160;

/** Default `k` of depth-decay `1 / (1 + k * depth)`. */
export const DEFAULT_DEPTH_DECAY_K = 1;

/**
 * Normalized value when a metric cannot discriminate (all raw values equal,
 * e.g. single-node graph or all-zero-byte notes): the neutral midpoint.
 */
export const NEUTRAL_NORMALIZED_VALUE = 0.5;

/**
 * Centrals (MAIN + pinned, even when disconnected from MAIN) bypass metric
 * composition and get the top score → max pixel size.
 */
export const CENTRAL_SIZE_SCORE = 1;

/**
 * Default edge mode shows only BFS-walked edges (human decision, CLARIFICATION
 * Q5: cleaner graph to see); `"all-edges"` stays available via the toggle.
 */
export const DEFAULT_EDGE_VISIBILITY: EdgeVisibilityMode = "walked-from-center";

/**
 * Default layout is force (human decision, superseding the earlier radial
 * default): a vicinity graph is hub-shaped, layered degenerates into one very
 * wide row on high fan-out, and radial rings disperse badly once a hub has
 * dozens of links — the d3-force packing stays compact.
 */
export const DEFAULT_LAYOUT_MODE: LayoutMode = "force";

/**
 * Obstacle-avoiding edge routing ships ON by default (ticket edge-routing__03):
 * the render pass, parameter tuning, and all-layout verification have landed, so
 * routed edges are the default reading experience. Users can still disable it from
 * the settings tab; when OFF the routing pass never runs and the libavoid wasm
 * never loads (lazy `await import` reached only inside `LibavoidEdgeRouter.route`).
 */
export const DEFAULT_EDGE_ROUTING = true;

const DEFAULT_METRIC_WEIGHT = 1;

/** Stateless factory for default settings shapes (used by tests and step-03 seeding). */
export class EngineDefaults {
	static depthSettings(): DepthSettings {
		return {
			outgoingDepth: DEFAULT_OUTGOING_DEPTH,
			incomingDepth: DEFAULT_INCOMING_DEPTH,
		};
	}

	/** `own-file-size` is the only default-on metric (step doc). */
	static sizingSettings(): SizingSettings {
		return {
			metrics: {
				"own-file-size": { enabled: true, weight: DEFAULT_METRIC_WEIGHT },
				"total-linker-size": { enabled: false, weight: DEFAULT_METRIC_WEIGHT },
				"backlink-count": { enabled: false, weight: DEFAULT_METRIC_WEIGHT },
				"outlink-count": { enabled: false, weight: DEFAULT_METRIC_WEIGHT },
				"depth-decay": { enabled: false, weight: DEFAULT_METRIC_WEIGHT },
			},
			depthDecayK: DEFAULT_DEPTH_DECAY_K,
			minPx: DEFAULT_MIN_NODE_PX,
			maxPx: DEFAULT_MAX_NODE_PX,
		};
	}

	static viewSettings(): ViewSettings {
		return {
			nodeCap: DEFAULT_NODE_CAP,
			groupByFolder: true,
			edgeVisibility: DEFAULT_EDGE_VISIBILITY,
			layoutMode: DEFAULT_LAYOUT_MODE,
			edgeRouting: DEFAULT_EDGE_ROUTING,
			sizing: EngineDefaults.sizingSettings(),
		};
	}
}
