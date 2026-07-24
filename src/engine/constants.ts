import type {
	DepthSettings,
	EdgeVisibilityMode,
	ForceLayoutSettings,
	NodeExclusionSettings,
	SizingSettings,
	ViewSettings,
} from "./types";

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

const DEFAULT_METRIC_WEIGHT = 1;

// ---------------------------------------------------------------------------
// Force-layout defaults + slider ranges (ticket-04). Defaults are the exact
// values the ticket-03 placement-quality work shipped as view constants —
// changing one here CHANGES THE DEFAULT LAYOUT (the stranding regression test
// runs at these defaults). Ranges are clamped so degenerate combinations are
// unreachable from the sliders AND from hand-edited JSON (the persistence
// parser clamps with the same table).
// ---------------------------------------------------------------------------

/**
 * Weak pull of every box toward the layout centre (d3 `forceX`/`forceY`
 * strength). Keeps weakly-connected satellites from drifting off; must stay
 * well below the link strength (~1) or the graph collapses onto the hub.
 */
export const DEFAULT_CENTER_PULL_STRENGTH = 0.05;

/**
 * Repulsion magnitude between root-level boxes (d3 `forceManyBody`, negated at
 * the call site). Deliberately moderate — collision + link distances do the
 * packing, the charge only untangles; a strong charge would re-create the
 * dispersion the d3 refinement exists to fix.
 */
export const DEFAULT_REPEL_STRENGTH = 300;

/**
 * Multiplier on d3's default per-link spring strength. 1 reproduces d3's
 * built-in `1 / min(degree)` default bit-for-bit — the behavior shipped before
 * the "Link force" slider introduced an explicit override.
 */
export const DEFAULT_LINK_STRENGTH_FACTOR = 1;

/**
 * Extra length on a link's resting distance beyond the endpoints' min
 * half-extents. The spring only pulls partners into touching range — the rect
 * collide force owns the actual separation (see `d3ForceRefinement.ts`).
 */
export const DEFAULT_LINK_GAP_PX = 40;

/**
 * Minimum gap enforced between each PAIR of boxes by the rectangular collide
 * force (`forceRectCollide.ts`) — applied once per pair, not per box. 20
 * validated by the ticket-03 prototype: doubling it measurably worsened
 * crowded layouts.
 */
export const DEFAULT_COLLIDE_PADDING_PX = 20;

/** Minimum gap between sibling nodes in elk passes (folder-group internals + root seed). */
export const DEFAULT_ELK_NODE_SPACING_PX = 40;

/** Inclusive slider bounds + step for one force-layout field. */
export interface ForceLayoutRange {
	readonly min: number;
	readonly max: number;
	readonly step: number;
}

/**
 * Single source of truth for the tuning-slider bounds — the settings-tab
 * sliders take their limits here and the persistence parser clamps with the
 * same table, so out-of-range values are unreachable end-to-end. WHY per field:
 *
 * - `centerPullStrength` max 0.15: the pull must stay WELL below the weakest
 *   per-link spring the ranges allow (`linkStrengthFactor` min 0.25 gives a
 *   degree-1 leaf strength 0.25), or satellites get dragged off their partners
 *   and the graph collapses onto the hub. Min 0 (no pull) is safe — the rect
 *   collide still owns separation.
 * - `repelStrength` [50, 1000]: 0/negative charge degenerates into attraction;
 *   below ~50 the charge stops untangling, far above ~1000 it re-creates the
 *   dispersion the d3 refinement exists to fix.
 * - `linkStrengthFactor` [0.25, 2]: min keeps links dominant over the max
 *   center pull (see above); above ~2 the stiff springs overshoot within the
 *   fixed-tick static run and the layout stops converging cleanly.
 * - `linkGapPx` [10, 150]: below the collide floor the spring and the collide
 *   force just fight (jitter, no visual gain); above 150 edges defeat the
 *   vicinity-compactness goal.
 * - `collidePaddingPx` [0, 80]: even at 0 the AABB collide prevents overlap
 *   (labels live INSIDE node boxes, so boxes-not-overlapping means labels
 *   never overlap); above 80 spacing defeats packing.
 * - `elkNodeSpacingPx` [10, 120]: elk spacing separates node BOUNDARIES, so
 *   members can never overlap; min 10 keeps them readable, above 120 the
 *   folder containers balloon. (The folder-name label is protected by the
 *   container's fixed top padding, not by this spacing.)
 */
export const FORCE_LAYOUT_RANGES: Readonly<Record<keyof ForceLayoutSettings, ForceLayoutRange>> = {
	centerPullStrength: { min: 0, max: 0.15, step: 0.01 },
	repelStrength: { min: 50, max: 1000, step: 10 },
	linkStrengthFactor: { min: 0.25, max: 2, step: 0.05 },
	linkGapPx: { min: 10, max: 150, step: 5 },
	collidePaddingPx: { min: 0, max: 80, step: 5 },
	elkNodeSpacingPx: { min: 10, max: 120, step: 5 },
};

/** Clamps every field into its {@link FORCE_LAYOUT_RANGES} bounds (steps are a UI affordance, not enforced). */
export function clampForceLayoutSettings(settings: ForceLayoutSettings): ForceLayoutSettings {
	const clamp = (field: keyof ForceLayoutSettings): number => {
		const range = FORCE_LAYOUT_RANGES[field];
		return Math.min(range.max, Math.max(range.min, settings[field]));
	};
	return {
		centerPullStrength: clamp("centerPullStrength"),
		repelStrength: clamp("repelStrength"),
		linkStrengthFactor: clamp("linkStrengthFactor"),
		linkGapPx: clamp("linkGapPx"),
		collidePaddingPx: clamp("collidePaddingPx"),
		elkNodeSpacingPx: clamp("elkNodeSpacingPx"),
	};
}

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

	/** Exclusion ships OFF with no patterns — an additive, opt-in feature. */
	static nodeExclusionSettings(): NodeExclusionSettings {
		return { enabled: false, patterns: [] };
	}

	/** The ticket-03 shipped layout constants — the "no default behavior change" baseline. */
	static forceLayoutSettings(): ForceLayoutSettings {
		return {
			centerPullStrength: DEFAULT_CENTER_PULL_STRENGTH,
			repelStrength: DEFAULT_REPEL_STRENGTH,
			linkStrengthFactor: DEFAULT_LINK_STRENGTH_FACTOR,
			linkGapPx: DEFAULT_LINK_GAP_PX,
			collidePaddingPx: DEFAULT_COLLIDE_PADDING_PX,
			elkNodeSpacingPx: DEFAULT_ELK_NODE_SPACING_PX,
		};
	}

	static viewSettings(): ViewSettings {
		return {
			nodeCap: DEFAULT_NODE_CAP,
			groupByFolder: true,
			edgeVisibility: DEFAULT_EDGE_VISIBILITY,
			sizing: EngineDefaults.sizingSettings(),
			forceLayout: EngineDefaults.forceLayoutSettings(),
		};
	}
}
