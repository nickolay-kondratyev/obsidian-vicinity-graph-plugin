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
 * - The view's stepper/input bounds read `.min/.max`.
 *
 * Pure engine module: imports only `./types` (import-guarded).
 */

import type {
	DepthSettings,
	ForceLayoutSettings,
	NodeExclusionSettings,
	NodePreviewPreference,
	SizeMetricId,
	SizingMetricSetting,
	ViewSettings,
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

/** A field carrying only a default value (booleans, enums, lists, composites). */
export interface DefaultSpec<T> {
	readonly default: T;
}

// ---------------------------------------------------------------------------
// Section shapes (mirror the settings types in ./types)
// ---------------------------------------------------------------------------

export interface DepthSpec {
	readonly linkDepthOut: BoundedNumberSpec;
	readonly embedDepthOut: BoundedNumberSpec;
	readonly linkDepthIn: BoundedNumberSpec;
	readonly pinnedLinkDepthOut: BoundedNumberSpec;
	readonly pinnedEmbedDepthOut: BoundedNumberSpec;
	readonly pinnedLinkDepthIn: BoundedNumberSpec;
}

export interface SizingSpec {
	readonly metrics: Readonly<Record<SizeMetricId, DefaultSpec<SizingMetricSetting>>>;
	/** Bounds for EVERY metric's weight (the per-metric spec above carries only its default). */
	readonly metricWeight: BoundedNumberSpec;
	readonly depthDecayK: BoundedNumberSpec;
	readonly minPx: BoundedNumberSpec;
	readonly maxPx: BoundedNumberSpec;
}

export type ForceLayoutSpec = Readonly<Record<keyof ForceLayoutSettings, BoundedNumberSpec>>;

export interface ViewSpec {
	readonly nodeCap: BoundedNumberSpec;
	readonly outlineMaxDepth: BoundedNumberSpec;
	readonly nodePreviewPreference: DefaultSpec<NodePreviewPreference>;
	readonly showCrossLinks: DefaultSpec<boolean>;
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
// Spec completeness — the ROOT guard of the settings family
// ---------------------------------------------------------------------------

/**
 * A settings field with no spec entry has no default and no bounds, so every
 * table downstream (defaults, ranges, clamps, reset plans, parsers) is built on
 * sand — and nothing about that is a compile error today. These two guards make
 * it one, in both directions, because BOTH have bitten this repo: a field with
 * no spec entry, and a spec entry for a field that no longer exists
 * (`groupByFolder` / `edgeVisibility`, deleted by the previous ticket).
 *
 * The error names the offending key, e.g.
 *   Type 'true' is not assignable to type '"embedDepthOut"'.
 *
 * NOTE: only TOP-LEVEL keys are compared. {@link SizingSpec} deliberately carries
 * an extra `metricWeight` (bounds shared by every metric's weight) with no
 * `SizingSettings` counterpart, so a leaf-level guard would false-positive.
 *
 * WHY-NOT a generic `assertTotal<A, B>()` helper for the idiom: it would make the
 * compiler report the helper's type parameters instead of the missing key name,
 * and naming the key IS the feature.
 */
type UnspeccedSettingsField =
	| Exclude<keyof ViewSettings, keyof ViewSpec>
	| Exclude<keyof DepthSettings, keyof DepthSpec>
	| Exclude<keyof NodeExclusionSettings, keyof NodeExclusionSpec>;
export const _assertEverySettingsFieldSpecced: UnspeccedSettingsField extends never
	? true
	: UnspeccedSettingsField = true;

/** The reverse: a spec entry whose settings field was deleted (an orphan default). */
type OrphanSpecField =
	| Exclude<keyof ViewSpec, keyof ViewSettings>
	| Exclude<keyof DepthSpec, keyof DepthSettings>
	| Exclude<keyof NodeExclusionSpec, keyof NodeExclusionSettings>;
export const _assertNoOrphanSpecField: OrphanSpecField extends never ? true : OrphanSpecField = true;

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

/**
 * Node pixel-size input bounds, shared by `minPx` and `maxPx`. These numbers
 * BECOME geometry: `sizePx` is a React-Flow node width/height and then a
 * libavoid obstacle rectangle, so the reachable range must stay inside what the
 * layout and the router can render. `min 1`: a 0/negative box is not a box (and
 * it is the floor both size inputs already shipped with). `max 400`: 2.5x the
 * shipped 160 default — one node past that fills a typical vicinity pane and
 * the graph stops being an overview.
 */
const NODE_SIZE_PX_BOUNDS = { min: 1, max: 400, step: 4 } as const;

// ---------------------------------------------------------------------------
// THE spec
// ---------------------------------------------------------------------------

export const SETTINGS_SPEC: SettingsSpec = {
	globalDepths: {
		/** Depth defaults mirror Obsidian's local-graph default of 1 hop each way. */
		linkDepthOut: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		/**
		 * DELIBERATELY EQUAL to `linkDepthOut`: at these ONE-HOP defaults the two
		 * outgoing channels union to exactly the single kind-blind outgoing BFS that
		 * shipped before embeds got their own budget, so nothing moves on screen for
		 * anyone who does not change a setting. Pinned by `VicinityTraversal.test.ts`
		 * ("channel split at the shipped defaults").
		 *
		 * The equality is a ONE-HOP property, not an equal-budget property: kind-pure
		 * channels cannot walk a chain that CHANGES kind, and a chain needs two hops
		 * to change kind, so at BOTH budgets raised to 2 the graph is strictly
		 * smaller than the old kind-blind depth-2 walk (also pinned). Raising this
		 * default therefore changes the default graph in TWO ways.
		 */
		embedDepthOut: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		linkDepthIn: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		/**
		 * The pinned-note budgets DELIBERATELY EQUAL the active-note defaults above:
		 * before pinned notes had their own dials, every root traversed with the one
		 * global set — so at these defaults, pinning a note draws exactly the graph
		 * it always drew, and the split is invisible until someone moves a dial.
		 */
		pinnedLinkDepthOut: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		pinnedEmbedDepthOut: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		pinnedLinkDepthIn: { default: 1, ...DEPTH_STEPPER_BOUNDS },
	},
	globalView: {
		/**
		 * Hard cap on non-central node count (step doc: default 100).
		 * `min 1`: at least the central must be renderable. `max 1000` (owner
		 * decision 2026-07-29, nid_aau4r0sj8oudhi711qr9j5x1l_e): comfortably above
		 * any legible graph — a legitimate request is effectively never blocked —
		 * and a deliberate hard "no" to whole-vault rendering, which is not what
		 * this plugin is for. The failure mode the ceiling closes is a typo/paste
		 * (`100000000`), which used to degrade silently to "no truncation"
		 * (`GraphTruncator` just slices) and push unbounded cost onto elk +
		 * React Flow layout. The number inputs REFUSE out-of-spec entries and
		 * `clampNodeCap` backstops the load path — superseding the earlier
		 * loaded-verbatim call (nid_5meu9s38sbrv1703na77of4m7_e): unpublished
		 * repo, so stored out-of-range values clamp on load, no migration.
		 */
		nodeCap: { default: 100, min: 1, max: 1000, step: 1 },
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
		/**
		 * OFF preserves the walked-only graph this plugin shipped with (step-02
		 * CLARIFICATION Q5, "the cleaner graph"): a link is an edge only where the BFS
		 * reached it. ON is the opt-in denser reading — every link between two visible
		 * nodes — which cannot be the default, because a dense vault turns a vicinity
		 * into a hairball the moment it is switched on.
		 */
		showCrossLinks: { default: false },
		sizing: {
			/** `own-file-size` is the only default-on metric (step doc); the other four ship OFF. */
			metrics: {
				"own-file-size": { default: { enabled: true, weight: DEFAULT_METRIC_WEIGHT } },
				"total-linker-size": { default: { enabled: false, weight: DEFAULT_METRIC_WEIGHT } },
				"backlink-count": { default: { enabled: false, weight: DEFAULT_METRIC_WEIGHT } },
				"outlink-count": { default: { enabled: false, weight: DEFAULT_METRIC_WEIGHT } },
				"depth-decay": { default: { enabled: false, weight: DEFAULT_METRIC_WEIGHT } },
			},
			/**
			 * Relative weight of one metric in the weighted average. Only RATIOS
			 * matter (the composition divides by the total weight), so the range
			 * only has to span "ignored" to "dominant": `min 0` mutes a metric
			 * without untoggling it, and at `max 100` a metric already outvotes an
			 * equal-weight peer 100:1 — past that nothing on screen changes, while
			 * an unbounded weight makes `weightedSum / totalWeight` `Infinity/Infinity`
			 * = `NaN` and poisons every node's size.
			 */
			metricWeight: { default: DEFAULT_METRIC_WEIGHT, min: 0, max: 100, step: 0.5 },
			/**
			 * `k` of depth-decay `1 / (1 + k * depth)`.
			 *
			 * `min 0` is a CORRECTNESS bound, not taste: the denominator vanishes at
			 * `k = -1 / depth` (`k = -1` at depth 1 → `Infinity` `sizePx`), and a
			 * `k >= 0` keeps it `>= 1` at every depth. `k = 0` disables the decay
			 * (every node scores 1). `max 10`: a depth-1 node already decays to
			 * 1/11 of the central there, so a steeper curve is indistinguishable.
			 */
			depthDecayK: { default: 1, min: 0, max: 10, step: 0.5 },
			minPx: { default: 40, ...NODE_SIZE_PX_BOUNDS },
			maxPx: { default: 160, ...NODE_SIZE_PX_BOUNDS },
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
			 * `[0.25, 4]`: the factor scales d3's `1 / min(degree)`, so for a
			 * degree-1 leaf the spring strength IS the factor — `min 0.25` therefore
			 * keeps such a leaf's spring dominant over the strongest center pull the
			 * ranges allow (see above). `max 4` is a maintainer-chosen headroom
			 * ceiling, NOT a measured stability limit: well above 1 the fixed-tick
			 * static run relies on d3's alpha decay rather than on the spring
			 * settling by itself.
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
			 * UI "Group member spacing" (advanced) — minimum gap elk leaves between
			 * sibling members INSIDE a folder group. (The root force seed keeps its
			 * own internal separation; this knob no longer reaches it.)
			 *
			 * `[10, 120]`: elk spacing separates node BOUNDARIES, so members can
			 * never overlap; min 10 keeps them readable, above 120 the folder
			 * containers balloon. (The folder-name label is protected by the
			 * container's fixed top padding, not by this spacing.)
			 *
			 * Shipped default lowered 40 -> 20: at 40 a member sat FARTHER from its
			 * folder-mates than from the group's own wall (the container's 16px side
			 * padding), which reads as scattered items rather than one cluster, and —
			 * measured on the real-vault group in `groupPacking.test.ts` — left half
			 * the group interior empty (fill 0.51). 20 is the first value on this
			 * slider's 5px grid at or above that 16px interior gutter, so the interior
			 * rhythm is uniform without members ever crowding tighter than the wall
			 * inset. Fill 0.51 -> 0.59; the packing ALGORITHM had no headroom left
			 * (elk rectpacking already lands within ~5% of an optimal skyline packer
			 * on these shapes — spacing, not placement, was the wasted area).
			 *
			 * WHY-NOT migrate installs that already persisted 40: deliberately not done
			 * — the plugin is pre-release and a saved value is a user choice we do not
			 * overwrite. Existing installs (including the maintainer's own, which
			 * matters when re-testing layout) keep 40 until "Restore force layout
			 * defaults".
			 */
			elkNodeSpacingPx: { default: 40, min: 10, max: 120, step: 5 },
			/**
			 * UI "Edge clearance" (advanced) — px clearance the obstacle-avoiding
			 * edge router keeps around EVERY box (libavoid `shapeBufferDistance`,
			 * applied at `edgeRouting.ts`). Perpendicular to the route: it is how
			 * far a routed edge stays off a box it passes.
			 *
			 * Default 11 is MEASURED, not derived (edge-routing__06 sweep). It
			 * replaces the old view constant `EDGE_ROUTING_SHAPE_BUFFER_PX = 17`
			 * (half the paired-edge bow curvature) — a tie that nothing in the
			 * routing geometry justified and that landed 1-2px INSIDE the
			 * degeneracy the max below describes: at 17 a 400-scene corpus at
			 * realistic group degree produced 40 non-facing attachments, against
			 * 22-26 at every value from 14 down, and dense-fixture detour improved
			 * monotonically as the clearance shrank (max 1.342 → 1.188).
			 * 11 sits mid-band, clear of both bounds.
			 *
			 * `[6, 14]`: below 6 the clearance drops under the arrowhead's own
			 * half-width (`ARROWHEAD_HALF_WIDTH_PX`), so a head drawn on a route
			 * could sit inside a box the route itself cleared; above ~14 (the
			 * folder-group side padding, `GROUP_SIDE_PADDING_PX = 16`, minus
			 * measurement margin) a group member's clearance escapes the group
			 * border and seals the group's own boundary pins, which is exactly
			 * the wrap-around pathology this ticket fixes. Both bounds are
			 * asserted against these two view constants in `edgeRouting.test.ts`,
			 * so the whole REACHABLE range is degeneracy-free — not just the
			 * default. Deliberate consequence: the old 17px spacing is no longer
			 * reachable (it is the pathology).
			 */
			edgeRoutingClearancePx: { default: 11, min: 6, max: 14, step: 1 },
		},
	},
	nodeExclusion: {
		/** Exclusion ships OFF with no patterns — an additive, opt-in feature. */
		enabled: { default: false },
		patterns: { default: [] },
	},
};
