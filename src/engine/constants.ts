import type { DepthSettings, EdgeVisibilityMode, SizingSettings, ViewSettings } from "./types";

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
 * Default edge mode is the induced subgraph (POLS: two visibly linked notes
 * should show their edge). Chosen by TOP_LEVEL_AGENT — the human resolved the
 * toggle itself (CLARIFICATION Q5) but did not specify the default.
 */
export const DEFAULT_EDGE_VISIBILITY: EdgeVisibilityMode = "all-edges";

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
			sizing: EngineDefaults.sizingSettings(),
		};
	}
}
