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
	FrontmatterLinkSettings,
	NodeExclusionSettings,
	NodePreviewPreference,
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
	readonly namedDepthOut: BoundedNumberSpec;
	readonly namedDepthIn: BoundedNumberSpec;
	readonly descendantDepth: BoundedNumberSpec;
	readonly ancestorDepth: BoundedNumberSpec;
	readonly pinnedLinkDepthOut: BoundedNumberSpec;
	readonly pinnedEmbedDepthOut: BoundedNumberSpec;
	readonly pinnedLinkDepthIn: BoundedNumberSpec;
	readonly pinnedNamedDepthOut: BoundedNumberSpec;
	readonly pinnedNamedDepthIn: BoundedNumberSpec;
	readonly pinnedDescendantDepth: BoundedNumberSpec;
	readonly pinnedAncestorDepth: BoundedNumberSpec;
}

/**
 * The node-size CLAMPS. The metric-dial leaves (`metrics`, `metricWeight`,
 * `depthDecayK`) were removed with the dials themselves (node-sizing rethink,
 * decided 2026-08-03): default size is content-fit, bounded by `minPx`/`maxPx`,
 * with `minImageHeightPx` an extra floor for image nodes.
 */
export interface SizingSpec {
	readonly minPx: BoundedNumberSpec;
	readonly maxPx: BoundedNumberSpec;
	readonly minImageHeightPx: BoundedNumberSpec;
}

export type ForceLayoutSpec = Readonly<Record<keyof ForceLayoutSettings, BoundedNumberSpec>>;

export interface ViewSpec {
	readonly nodeCap: BoundedNumberSpec;
	readonly outlineMaxDepth: BoundedNumberSpec;
	readonly nodePreviewPreference: DefaultSpec<NodePreviewPreference>;
	readonly showCrossLinks: DefaultSpec<boolean>;
	readonly groupLabelFullPath: DefaultSpec<boolean>;
	readonly folderGroupingDepth: BoundedNumberSpec;
	readonly edgeDepthIntoGroups: BoundedNumberSpec;
	readonly sizing: SizingSpec;
	readonly forceLayout: ForceLayoutSpec;
}

export interface NodeExclusionSpec {
	readonly enabled: DefaultSpec<boolean>;
	readonly patterns: DefaultSpec<readonly string[]>;
}

export interface FrontmatterLinkSpec {
	readonly idRefFields: DefaultSpec<string>;
}

export interface SettingsSpec {
	readonly globalDepths: DepthSpec;
	readonly globalView: ViewSpec;
	readonly nodeExclusion: NodeExclusionSpec;
	readonly frontmatterLinks: FrontmatterLinkSpec;
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
 * NOTE: only TOP-LEVEL keys are compared (a leaf-level guard has false-positived
 * before, when {@link SizingSpec} carried a shared-bounds leaf with no settings
 * counterpart).
 *
 * WHY-NOT a generic `assertTotal<A, B>()` helper for the idiom: it would make the
 * compiler report the helper's type parameters instead of the missing key name,
 * and naming the key IS the feature. For the same reason each family is asserted
 * ON ITS OWN rather than through one `Exclude<…> | Exclude<…> | Exclude<…>` union:
 * in the healthy state every constituent is `never`, so the union collapses to a
 * pile of duplicated `never`s (a typescript-eslint redundant/duplicate-constituent
 * report) while a real miss in one family reads no clearer than three assertions do.
 */
export const _assertEveryViewFieldSpecced: Exclude<keyof ViewSettings, keyof ViewSpec> extends never
	? true
	: Exclude<keyof ViewSettings, keyof ViewSpec> = true;
export const _assertEveryDepthFieldSpecced: Exclude<keyof DepthSettings, keyof DepthSpec> extends never
	? true
	: Exclude<keyof DepthSettings, keyof DepthSpec> = true;
export const _assertEveryExclusionFieldSpecced: Exclude<
	keyof NodeExclusionSettings,
	keyof NodeExclusionSpec
> extends never
	? true
	: Exclude<keyof NodeExclusionSettings, keyof NodeExclusionSpec> = true;
export const _assertEveryFrontmatterLinkFieldSpecced: Exclude<
	keyof FrontmatterLinkSettings,
	keyof FrontmatterLinkSpec
> extends never
	? true
	: Exclude<keyof FrontmatterLinkSettings, keyof FrontmatterLinkSpec> = true;

/** The reverse: a spec entry whose settings field was deleted (an orphan default). */
export const _assertNoOrphanViewSpecField: Exclude<keyof ViewSpec, keyof ViewSettings> extends never
	? true
	: Exclude<keyof ViewSpec, keyof ViewSettings> = true;
export const _assertNoOrphanDepthSpecField: Exclude<keyof DepthSpec, keyof DepthSettings> extends never
	? true
	: Exclude<keyof DepthSpec, keyof DepthSettings> = true;
export const _assertNoOrphanExclusionSpecField: Exclude<
	keyof NodeExclusionSpec,
	keyof NodeExclusionSettings
> extends never
	? true
	: Exclude<keyof NodeExclusionSpec, keyof NodeExclusionSettings> = true;
export const _assertNoOrphanFrontmatterLinkSpecField: Exclude<
	keyof FrontmatterLinkSpec,
	keyof FrontmatterLinkSettings
> extends never
	? true
	: Exclude<keyof FrontmatterLinkSpec, keyof FrontmatterLinkSettings> = true;

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

/**
 * Node pixel-size input bounds, shared by `minPx` and `maxPx`. These numbers
 * BECOME geometry: `sizePx` is a React-Flow node width/height and then a
 * libavoid obstacle rectangle, so the reachable range must stay inside what the
 * layout and the router can render. `min 1`: a 0/negative box is not a box (and
 * it is the floor both size inputs already shipped with). `max 400`: several
 * times the shipped `maxPx` default — one node past that fills a typical
 * vicinity pane and the graph stops being an overview.
 */
const NODE_SIZE_PX_BOUNDS = { min: 1, max: 400, step: 4 } as const;

// ---------------------------------------------------------------------------
// THE spec
// ---------------------------------------------------------------------------

export const SETTINGS_SPEC: SettingsSpec = {
	globalDepths: {
		/**
		 * Outgoing depth defaults mirror Obsidian's local-graph default of 1 hop.
		 * INCOMING (`linkDepthIn`) ships at 0 by owner decision — a central note's
		 * default vicinity is what it points at, not what points at it; backlinks
		 * are an opt-in reach the "Links in" dial turns on.
		 */
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
		/** OFF by default (owner decision): backlinks are opt-in — see `linkDepthOut`. */
		linkDepthIn: { default: 0, ...DEPTH_STEPPER_BOUNDS },
		/**
		 * Outgoing NAMED-relationship depth for the active note. Default `2` (human
		 * sign-off 2026-08-17): deeper than the plain 1-hop link default, because a
		 * system diagram drawn purely in named links must traverse several hops to be
		 * legible — the whole point of giving named relations their OWN budget (feature
		 * `named-relationships`, plan `nid_fg66tanwkoyq3cqs1wdxagn21_e`). A named link
		 * ALSO rides the plain channels (either-budget union); this budget only governs
		 * how far the NAMED walk reaches. `0` = off. Same bounds family as the other depths.
		 */
		namedDepthOut: { default: 2, ...DEPTH_STEPPER_BOUNDS },
		/** Incoming NAMED-relationship depth for the active note. Default `1` (human sign-off 2026-08-17). */
		namedDepthIn: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		/**
		 * Folder-note DESCENDANTS budget for the active note. Default `1` (owner
		 * decision, plan `nid_ri1d36t7hmhu0kr652wny1dmz_e`): a note that is a folder
		 * note shows its immediate children by default; `0` turns the reach off (the
		 * feature itself is always-on, the dial is the off switch). Same bounds family
		 * as the link/embed depths.
		 */
		descendantDepth: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		/** Folder-note ANCESTORS budget for the active note. Default `1` — see `descendantDepth`. */
		ancestorDepth: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		/**
		 * The pinned-note budgets DELIBERATELY EQUAL the active-note defaults above:
		 * before pinned notes had their own dials, every root traversed with the one
		 * global set — so at these defaults, pinning a note draws exactly the graph
		 * it always drew, and the split is invisible until someone moves a dial.
		 * `pinnedLinkDepthIn` therefore also ships at 0, matching `linkDepthIn`.
		 */
		pinnedLinkDepthOut: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		pinnedEmbedDepthOut: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		pinnedLinkDepthIn: { default: 0, ...DEPTH_STEPPER_BOUNDS },
		/**
		 * The pinned NAMED budgets follow the LINK-channel convention (pinned == active),
		 * NOT the hierarchy convention (pinned off): a named relationship IS a link
		 * relation ({@link import("./types").CHANNEL_RELATION}), so a pinned root spreads
		 * its named diagram exactly as far as the active note does (2/1). Engineering
		 * call for a signed-off-but-unspecified pinned default (ticket
		 * `nid_ufbtmywzbsyn2gwrx7bi0ww08_e`); a low-stakes value the named-depth rows
		 * ticket (`nid_fqdc55oifopcxxs4eb0w8q876_e`) can retune when it surfaces the dials.
		 */
		pinnedNamedDepthOut: { default: 2, ...DEPTH_STEPPER_BOUNDS },
		pinnedNamedDepthIn: { default: 1, ...DEPTH_STEPPER_BOUNDS },
		/**
		 * Folder-note descendants/ancestors budgets for PINNED roots. Default `0/0`
		 * (owner decision): a pinned note contributes its hierarchy only when the user
		 * dials it up — unlike the active note, whose 1/1 default shows the vicinity
		 * around what is on screen.
		 */
		pinnedDescendantDepth: { default: 0, ...DEPTH_STEPPER_BOUNDS },
		pinnedAncestorDepth: { default: 0, ...DEPTH_STEPPER_BOUNDS },
	},
	globalView: {
		/**
		 * Hard cap on non-central node count.
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
		 * {@link ViewSpec.nodePreviewPreference}'s job (under its `auto` default a
		 * central's document position decides, and a neighbour is not offered the
		 * outline at all).
		 */
		outlineMaxDepth: { default: 2, min: 1, max: 6, step: 1 },
		/**
		 * `auto` is the tier-aware default (ticket nid_k2pa8khm6ugozmhkd6nlbdrq6_e):
		 * a CENTRAL keeps the documented document-position rule (an image above the
		 * first heading wins the preview slot), an ordinary neighbour is offered its
		 * image or nothing. It is the default because the alternative — every note in
		 * the vicinity claiming the preview slot — floors the whole graph at the CSS
		 * reveal rung and erases size discrimination. `outline`/`image` are the opt-in
		 * overrides of BOTH rules, for the user who wants one kind everywhere.
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
		/**
		 * How a COLLAPSED folder chain (a run of single-child folders rendered as one
		 * group) is labelled. OFF (DEFAULT, signed-off decision A1 of plan
		 * `nid_xko67wo2z4awg5gdrm1xx1chz_e`): the leaf folder name alone (`C`) — the
		 * least chrome, matching a non-collapsed group, which always shows its folder
		 * name. ON: the full collapsed path (`A/B/C`), for when the intermediate
		 * folders carry meaning worth reading. A non-collapsed group is unaffected
		 * either way; this only changes what a COLLAPSED chain reads as.
		 */
		groupLabelFullPath: { default: false },
		/**
		 * Maximum RENDERED folder-group nesting levels (plan
		 * `nid_yyugpoh3gv8ip24cizvgrs4w4_e`, signed-off Q2). `0` turns folder
		 * grouping off entirely; the DEFAULT is genuine {@link Number.POSITIVE_INFINITY}
		 * — unlimited nesting, expressed as infinity itself rather than a large-number
		 * sentinel (ticket `nid_rndi5sulwrsx1aq0x4xqcskrb_e`). It is exactly the
		 * `deriveFolderGroups` "no cap" value (`UNLIMITED_GROUP_NESTING_DEPTH`), so the
		 * default graph groups to whatever depth a vault actually nests.
		 *
		 * `max 10` bounds only the FINITE portion of the slider: its track runs 0..10
		 * and then one ∞ stop past it (see `FolderGroupingDepthSlider`). A finite value
		 * beyond 10 (hand-edited JSON) clamps to 10; the distinct ∞ selection is what
		 * carries "unlimited". Whole levels, so `step 1`.
		 */
		folderGroupingDepth: { default: Number.POSITIVE_INFINITY, min: 0, max: 10, step: 1 },
		/**
		 * PER-ENDPOINT depth allowance for edges reaching INTO folder groups
		 * (plan `nid_6fkhyw97hjs84xb62z6tommhi_e`, human decision D4). `0` (DEFAULT)
		 * reproduces today's behavior — every group-crossing edge collapses onto the
		 * outermost group box — so the feature ships inert. `max 6`: folder nesting a
		 * legible vicinity ever shows deeper than a handful of levels is vanishingly
		 * rare, and each extra level the router must pierce is more interior geometry
		 * (the deep-edge routing lands in the dependent ticket); 6 is comfortably past
		 * any realistic reach while keeping the slider's range meaningful. Whole
		 * levels, so `step 1`.
		 */
		edgeDepthIntoGroups: { default: 0, min: 0, max: 6, step: 1 },
		/**
		 * The content-fit clamps (the only sizing dials — the metric dials were
		 * removed, node-sizing rethink 2026-08-03).
		 */
		sizing: {
			minPx: { default: 40, ...NODE_SIZE_PX_BOUNDS },
			maxPx: { default: 180, ...NODE_SIZE_PX_BOUNDS },
			/**
			 * The extra height floor for IMAGE nodes (thumbnail preview). Shares
			 * `minPx`/`maxPx`'s bounds — it is the same kind of px height and becomes
			 * geometry the same way. The default `180` sits ABOVE a thumbnail's
			 * natural content-fit floor (~122px, the CSS preview reveal rung), so it
			 * gives image nodes a taller preview by default (capped by `maxPx`);
			 * lowering it toward the fit floor does nothing a floor would.
			 */
			minImageHeightPx: { default: 180, ...NODE_SIZE_PX_BOUNDS },
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
			 * A factor of `1` reproduces d3's built-in `1 / min(degree)` bit-for-bit —
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
			 * applied once per pair, not per box. The shipped default was raised above
			 * the ticket-03 prototype's (`22bd5cb`), which packed boxes tighter than the
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
			 * The range: elk spacing separates node BOUNDARIES, so members can never
			 * overlap; the min keeps them readable, past the max the folder containers
			 * balloon. (The folder-name label is protected by the container's fixed top
			 * padding, not by this spacing.) The step holds the slider to a 5px grid.
			 *
			 * The default trades interior DENSITY against separation. Tighter fills more
			 * of the group interior — `groupPacking.test.ts` measures that fill ratio at
			 * whatever ships, and the packing ALGORITHM has no headroom left to give
			 * (elk rectpacking already lands within ~5% of an optimal skyline packer on
			 * these shapes, so spacing, not placement, is the wasted area). Looser reads
			 * as scattered items rather than one cluster once a member sits farther from
			 * its folder-mates than from the container's own side padding.
			 *
			 * WHY-NOT rewrite installs that persisted an older value when this moves:
			 * a saved value is a user choice we do not overwrite — it stands until
			 * "Restore force layout defaults".
			 */
			elkNodeSpacingPx: { default: 40, min: 10, max: 120, step: 5 },
			/**
			 * UI "Edge clearance" (advanced) — px clearance the obstacle-avoiding
			 * edge router keeps around EVERY box (libavoid `shapeBufferDistance`,
			 * applied at `edgeRouting.ts`). Perpendicular to the route: it is how
			 * far a routed edge stays off a box it passes.
			 *
			 * The default is MEASURED, not derived (edge-routing__06 sweep). It
			 * replaces the old view constant `EDGE_ROUTING_SHAPE_BUFFER_PX = 17`
			 * (half the paired-edge bow curvature) — a tie that nothing in the
			 * routing geometry justified and that landed 1-2px INSIDE the
			 * degeneracy the max below describes: at 17 a 400-scene corpus at
			 * realistic group degree produced 40 non-facing attachments, against
			 * 22-26 at every value from 14 down, and dense-fixture detour improved
			 * monotonically as the clearance shrank (max 1.342 → 1.188).
			 * The shipped value sits mid-band, clear of both bounds.
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
	frontmatterLinks: {
		/**
		 * DEFAULT EMPTY = frontmatter-id links OFF (locked human decision, ticket
		 * `nid_dthnhlzp0wzxqhcozj3f8ih5h_e`): no field is read as an id-ref until the
		 * user names one, so the feature costs nothing until opted into. A comma-separated
		 * field-name string, parsed by `parseIdRefFields`.
		 */
		idRefFields: { default: "" },
	},
};
