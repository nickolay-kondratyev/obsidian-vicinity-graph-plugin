/**
 * SETTINGS SPEC — the SINGLE source of truth for every settings DEFAULT and
 * every settings LIMIT (min/max/step bound).
 *
 * The structure mirrors the persisted {@link import("../persistence/persistedShapes").PluginData}
 * type shape (`globalDepths` / `globalView` → `sizing.metrics`, `forceLayout` /
 * `nodeExclusion`), NOT the settings-tab UI order — so any default/bound is
 * trivial to locate by walking the same nesting as the settings types.
 *
 * Everything else derives from here (thin adapters, no duplicated literals):
 * - `EngineDefaults.*` factories read `.default`.
 * - `DEFAULT_*` named constants alias `.default`.
 * - `FORCE_LAYOUT_RANGES` reads `.min/.max/.step`.
 * - The view's `MIN_NODE_CAP` / stepper bounds read `.min/.max`.
 *
 * Pure engine module: imports only `./types` (import-guarded).
 */

import type {
	EdgeVisibilityMode,
	ForceLayoutSettings,
	NodePreviewPreference,
	SizeMetricId,
	SizingMetricSetting,
} from "./types";

// ---------------------------------------------------------------------------
// Leaf shapes
// ---------------------------------------------------------------------------

/** A numeric field carrying its default plus inclusive slider/stepper bounds. */
export interface BoundedNumberSpec {
	readonly default: number;
	readonly min: number;
	readonly max: number;
	readonly step: number;
}

/** A numeric field carrying its default and a lower bound only (no max/step). */
export interface MinBoundedNumberSpec {
	readonly default: number;
	readonly min: number;
}

/** A field carrying only a default value (booleans, enums, unbounded numbers, lists, composites). */
export interface DefaultSpec<T> {
	readonly default: T;
}

// ---------------------------------------------------------------------------
// Section shapes (mirror the settings types in ./types)
// ---------------------------------------------------------------------------

export interface DepthSpec {
	readonly outgoingDepth: BoundedNumberSpec;
	readonly incomingDepth: BoundedNumberSpec;
}

export interface SizingSpec {
	readonly metrics: Readonly<Record<SizeMetricId, DefaultSpec<SizingMetricSetting>>>;
	readonly depthDecayK: DefaultSpec<number>;
	readonly minPx: DefaultSpec<number>;
	readonly maxPx: DefaultSpec<number>;
}

export type ForceLayoutSpec = Readonly<Record<keyof ForceLayoutSettings, BoundedNumberSpec>>;

export interface ViewSpec {
	readonly nodeCap: MinBoundedNumberSpec;
	readonly outlineMaxDepth: BoundedNumberSpec;
	readonly nodePreviewPreference: DefaultSpec<NodePreviewPreference>;
	readonly groupByFolder: DefaultSpec<boolean>;
	readonly edgeVisibility: DefaultSpec<EdgeVisibilityMode>;
	readonly sizing: SizingSpec;
	readonly forceLayout: ForceLayoutSpec;
}

export interface NodeExclusionSpec {
	readonly enabled: DefaultSpec<boolean>;
	readonly patterns: DefaultSpec<readonly string[]>;
}

export interface SettingsSpec {
	readonly globalDepths: DepthSpec;
	readonly globalView: ViewSpec;
	readonly nodeExclusion: NodeExclusionSpec;
}

// ---------------------------------------------------------------------------
// Shared leaf building blocks (kept single-source to avoid duplicated literals)
// ---------------------------------------------------------------------------

/**
 * Depth-stepper input bounds (CLARIFICATION Q2), shared by both depth fields.
 * An AFFORDANCE limit on the toolbar/settings steppers — the engine itself
 * honors any depth; this is the UI's clamp so a stepper cannot dial a
 * nonsensical value. `min 0` = central only (no expansion that direction).
 */
const DEPTH_STEPPER_BOUNDS = { min: 0, max: 5, step: 1 } as const;

/** Default weight of every sizing metric (equal-weight composition until a metric slider ships). */
const DEFAULT_METRIC_WEIGHT = 1;

// ---------------------------------------------------------------------------
// THE spec
// ---------------------------------------------------------------------------

export const SETTINGS_SPEC: SettingsSpec = {
	globalDepths: {
		/** Depth defaults mirror Obsidian's local-graph default of 1 hop each way. */
		outgoingDepth: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		incomingDepth: { default: 1, ...DEPTH_STEPPER_BOUNDS },
	},
	globalView: {
		/**
		 * Hard cap default on non-central node count (step doc: default 100).
		 * `min 1`: at least the central must be renderable.
		 */
		nodeCap: { default: 100, min: 1 },
		/**
		 * How many markdown heading levels a node's in-node outline renders.
		 * Markdown has 6 levels; `2` shows sections + subsections, which is what
		 * fits the ≤160px node the engine's sizing can produce. `min 1` (never 0):
		 * DEPTH is not an on/off switch — choosing outline vs image is
		 * {@link ViewSpec.nodePreviewPreference}'s job, and under its `auto` default
		 * document position still decides (image above the first heading wins).
		 */
		outlineMaxDepth: { default: 2, min: 1, max: 6, step: 1 },
		/**
		 * `auto` preserves the documented document-position rule (an image above the
		 * first heading wins the preview slot) exactly as it shipped, so upgrading
		 * changes nothing on screen; `outline`/`image` are opt-in overrides.
		 */
		nodePreviewPreference: { default: "auto" },
		/** Folder grouping ships ON — the richer, folder-aware layout is the whole point of the plugin. */
		groupByFolder: { default: true },
		/**
		 * Default edge mode shows only BFS-walked edges (human decision,
		 * CLARIFICATION Q5: cleaner graph to see); `"all-edges"` stays available
		 * via the toggle.
		 */
		edgeVisibility: { default: "walked-from-center" },
		sizing: {
			/** `own-file-size` is the only default-on metric (step doc); the other four ship OFF. */
			metrics: {
				"own-file-size": { default: { enabled: true, weight: DEFAULT_METRIC_WEIGHT } },
				"total-linker-size": { default: { enabled: false, weight: DEFAULT_METRIC_WEIGHT } },
				"backlink-count": { default: { enabled: false, weight: DEFAULT_METRIC_WEIGHT } },
				"outlink-count": { default: { enabled: false, weight: DEFAULT_METRIC_WEIGHT } },
				"depth-decay": { default: { enabled: false, weight: DEFAULT_METRIC_WEIGHT } },
			},
			/** Default `k` of depth-decay `1 / (1 + k * depth)`. */
			depthDecayK: { default: 1 },
			minPx: { default: 40 },
			maxPx: { default: 160 },
		},
		// -------------------------------------------------------------------
		// Force-layout defaults + slider ranges (ticket-04). Defaults are the
		// exact values the ticket-03 placement-quality work shipped as view
		// constants — changing one CHANGES THE DEFAULT LAYOUT (the stranding
		// regression test runs at these defaults). Ranges are clamped so
		// degenerate combinations are unreachable from the sliders AND from
		// hand-edited JSON (the persistence parser clamps with the same bounds).
		// -------------------------------------------------------------------
		forceLayout: {
			/**
			 * UI "Center force" — weak pull of every box toward the layout centre
			 * (d3 `forceX`/`forceY`). Keeps weakly-connected satellites from
			 * drifting off; must stay well below the link strength (~1) or the
			 * graph collapses onto the hub.
			 *
			 * `max 0.15`: the pull must stay WELL below the weakest per-link spring
			 * the ranges allow (`linkStrengthFactor` min 0.25 gives a degree-1 leaf
			 * strength 0.25), or satellites get dragged off their partners and the
			 * graph collapses onto the hub. `min 0` (no pull) is safe — the rect
			 * collide still owns separation.
			 */
			centerPullStrength: { default: 0.05, min: 0, max: 0.15, step: 0.01 },
			/**
			 * UI "Repel force" — repulsion magnitude between root-level boxes (d3
			 * `forceManyBody`, negated at the call site). Deliberately moderate —
			 * collision + link distances do the packing, the charge only untangles;
			 * a strong charge would re-create the dispersion the d3 refinement fixes.
			 *
			 * `[50, 1000]`: 0/negative charge degenerates into attraction; below ~50
			 * the charge stops untangling, far above ~1000 it re-creates the
			 * dispersion the d3 refinement exists to fix.
			 */
			repelStrength: { default: 300, min: 50, max: 1000, step: 10 },
			/**
			 * UI "Link force" — multiplier on d3's default per-link spring strength.
			 * `1` reproduces d3's built-in `1 / min(degree)` default bit-for-bit —
			 * the behavior shipped before the "Link force" slider introduced an
			 * explicit override.
			 *
			 * `[0.25, 2]`: min keeps links dominant over the max center pull (see
			 * above); above ~2 the stiff springs overshoot within the fixed-tick
			 * static run and the layout stops converging cleanly.
			 */
			linkStrengthFactor: { default: 1, min: 0.25, max: 4, step: 0.05 },
			/**
			 * UI "Link distance" — extra length on a link's resting distance beyond
			 * the endpoints' min half-extents. The spring only pulls partners into
			 * touching range — the rect collide force owns the actual separation
			 * (see `d3ForceRefinement.ts`).
			 *
			 * `[10, 250]`: below the collide floor the spring and the collide force
			 * just fight (jitter, no visual gain); the ceiling was raised to 250 so
			 * users who want an airy, spread-out vicinity can have it — past that,
			 * edges defeat the vicinity-compactness goal entirely.
			 */
			linkGapPx: { default: 40, min: 10, max: 250, step: 5 },
			/**
			 * UI "Node spacing" (advanced) — minimum gap enforced between each PAIR
			 * of boxes by the rectangular collide force (`forceRectCollide.ts`),
			 * applied once per pair, not per box. Shipped default raised 20 → 50 in
			 * `22bd5cb`: the ticket-03 prototype's 20 packed boxes tighter than the
			 * shipped node sizes read comfortably at.
			 *
			 * `[0, 100]`: even at 0 the AABB collide prevents overlap (labels live
			 * INSIDE node boxes, so boxes-not-overlapping means labels never
			 * overlap); above 100 spacing defeats packing.
			 */
			collidePaddingPx: { default: 50, min: 0, max: 100, step: 5 },
			/**
			 * UI "Group member spacing" (advanced) — minimum gap between sibling
			 * nodes in elk passes (folder-group internals + root seed).
			 *
			 * `[10, 120]`: elk spacing separates node BOUNDARIES, so members can
			 * never overlap; min 10 keeps them readable, above 120 the folder
			 * containers balloon. (The folder-name label is protected by the
			 * container's fixed top padding, not by this spacing.)
			 */
			elkNodeSpacingPx: { default: 40, min: 10, max: 120, step: 5 },
		},
	},
	nodeExclusion: {
		/** Exclusion ships OFF with no patterns — an additive, opt-in feature. */
		enabled: { default: false },
		patterns: { default: [] },
	},
};
