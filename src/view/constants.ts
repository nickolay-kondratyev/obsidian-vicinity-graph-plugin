import type { LayoutMode } from "../engine";

/**
 * View-layer named constants. The engine keeps its own constants under an
 * import guard (`src/engine/constants.ts`); these are the view's and live here
 * so the pure view modules and the ItemView glue share one source.
 */

/**
 * Relayout trigger for a node that SURVIVED a rebuild (same id, same structure):
 * relayout only if its `sizePx` grew by more than this fraction. `1.0` = +100%
 * (doubled). Below the threshold we keep the existing layout and just refresh
 * node data, avoiding jarring position jumps on small size changes.
 */
export const SIZE_RELAYOUT_THRESHOLD = 1.0;

/**
 * Debounce for vault-driven rebuilds (metadata "resolved"). Collapses the burst
 * of resolve events that follows an edit into a single rebuild.
 */
export const REBUILD_DEBOUNCE_MS = 500;

/** Id of the synthetic elk root that contains every graph node. */
export const ELK_ROOT_ID = "root";

/**
 * Primary axis elk lays layers along. Kept as a constant (not inlined into the
 * options map) so it is trivially retargetable — the one knob most likely to be
 * exposed later. `DOWN` = classic top-to-bottom layered layout.
 */
export const ELK_DIRECTION = "DOWN";

/** Minimum gap between sibling nodes, shared by every elk algorithm we run. */
export const ELK_NODE_SPACING = "40";

/** Gap between consecutive layers of the layered algorithm. */
export const ELK_LAYER_SPACING = "80";

/**
 * Root options of the `layered` mode:
 * - `layered` is elk's canonical algorithm that also honors hierarchical
 *   containment (force/stress handle containment worse) — CLARIFICATION Q1.
 * - `hierarchyHandling: INCLUDE_CHILDREN` makes the layout descend into child
 *   nodes (folder groups); on a flat graph it is a harmless no-op.
 */
export const ELK_LAYERED_ROOT_OPTIONS: Readonly<Record<string, string>> = {
	"elk.algorithm": "layered",
	"elk.direction": ELK_DIRECTION,
	"elk.hierarchyHandling": "INCLUDE_CHILDREN",
	"elk.layered.spacing.nodeNodeBetweenLayers": ELK_LAYER_SPACING,
	"elk.spacing.nodeNode": ELK_NODE_SPACING,
};

/**
 * Root options of the hub-friendly modes (`radial` / `force`). Neither
 * algorithm supports `INCLUDE_CHILDREN`, so these run with elk's default
 * `SEPARATE_CHILDREN` hierarchy handling: folder containers are laid out
 * internally first (see {@link ELK_GROUP_MEMBER_OPTIONS}), then the root
 * algorithm arranges the resulting fixed-size boxes.
 */
export const ELK_RADIAL_ROOT_OPTIONS: Readonly<Record<string, string>> = {
	"elk.algorithm": "radial",
	"elk.spacing.nodeNode": ELK_NODE_SPACING,
};

/**
 * Under `force` mode elk's own force algorithm is only the SEED: it computes
 * container dimensions and a rough untangled arrangement, then the d3-force
 * refinement (`d3ForceRefinement.ts`) packs the root-level boxes tightly.
 */
export const ELK_FORCE_ROOT_OPTIONS: Readonly<Record<string, string>> = {
	"elk.algorithm": "force",
	"elk.spacing.nodeNode": ELK_NODE_SPACING,
};

// --- d3-force root refinement (`force` mode) ----------------------------------

/**
 * Repulsion between root-level boxes (d3 `forceManyBody` strength; negative =
 * repel). Deliberately moderate — collision + link distances do the packing,
 * the charge only untangles; a strong charge would re-create the radial
 * dispersion this mode exists to fix.
 */
export const D3_FORCE_CHARGE_STRENGTH = -300;

/** Free space kept along a link between the two endpoint boxes' collide circles. */
export const D3_FORCE_LINK_GAP_PX = 40;

/**
 * Padding added to each box's circumscribed-circle collide radius, so two
 * touching circles still leave a visible gap between the boxes inside them.
 */
export const D3_FORCE_COLLIDE_PADDING_PX = 20;

/**
 * Weak pull of every box toward the layout centre (d3 `forceX`/`forceY`
 * strength). Keeps weakly-connected satellites from drifting off; must stay
 * well below the link strength (~1) or the graph collapses onto the hub.
 */
export const D3_FORCE_CENTER_PULL_STRENGTH = 0.05;

/**
 * d3 `forceCollide` relaxation passes per tick. 1 leaves residual overlaps on
 * dense hubs; 2 resolves them (d3 docs recommend raising iterations when
 * overlap-freedom matters more than speed).
 */
export const D3_FORCE_COLLIDE_ITERATIONS = 2;

/** {@link LayoutMode} → root-level elk options. */
export const ELK_ROOT_OPTIONS_BY_MODE: Readonly<Record<LayoutMode, Readonly<Record<string, string>>>> = {
	layered: ELK_LAYERED_ROOT_OPTIONS,
	radial: ELK_RADIAL_ROOT_OPTIONS,
	force: ELK_FORCE_ROOT_OPTIONS,
};

/**
 * Layout of the INSIDE of a folder-group container under a radial/force root
 * (`SEPARATE_CHILDREN` lays out every container independently): members stay on
 * the proven layered arrangement regardless of the root mode. Under a layered
 * root this is NOT set — `INCLUDE_CHILDREN` handles the whole hierarchy.
 */
export const ELK_GROUP_MEMBER_OPTIONS: Readonly<Record<string, string>> = {
	"elk.algorithm": "layered",
	"elk.direction": ELK_DIRECTION,
	"elk.spacing.nodeNode": ELK_NODE_SPACING,
};

/**
 * Inner padding of folder-group containers (elk `ElkPadding` syntax). The
 * extra TOP padding reserves room for the group's folder-name label so member
 * nodes never render underneath it; the other sides give members breathing
 * room inside the container border.
 */
export const ELK_GROUP_PADDING = "[top=36.0,left=16.0,bottom=16.0,right=16.0]";

/**
 * React Flow zoom floor. RF's default (0.5) clamps `fitView` on dense graphs in
 * a narrow sidebar pane — the whole vicinity then CANNOT be brought into view
 * (and, with viewport culling, boundary nodes flicker in and out of the DOM).
 * A low floor lets fitView always show the full graph; users can zoom back in.
 */
export const GRAPH_MIN_ZOOM = 0.1;

/**
 * Depth-stepper input bounds (CLARIFICATION Q2). These are an AFFORDANCE limit
 * on the toolbar/settings inputs — the engine itself honors any depth; this is
 * the UI's clamp so a stepper cannot dial a nonsensical value.
 */
export const MIN_STEPPER_DEPTH = 0; // 0 = central only, no expansion that direction
export const MAX_STEPPER_DEPTH = 5;

/**
 * Clamp a (possibly fractional / out-of-range) stepper input into
 * `[MIN_STEPPER_DEPTH, MAX_STEPPER_DEPTH]`, rounding to the nearest integer.
 * Used by every depth stepper and the settings-tab depth inputs.
 */
export function clampStepperDepth(value: number): number {
	return Math.min(MAX_STEPPER_DEPTH, Math.max(MIN_STEPPER_DEPTH, Math.round(value)));
}
