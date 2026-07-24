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

/**
 * Approximate average glyph advance (px) of the node-title font
 * (`--font-ui-smaller`, ~12–13px in Obsidian's default theme). Used to size a
 * node's width to fit its title on one line. Snug (not generous) because the
 * title CSS clamps to 4 lines: when a title needs more than
 * {@link NODE_MAX_LABEL_WIDTH_PX} the width pins to that cap and the overflow
 * wraps onto the next lines — the wrap, not width overshoot, is the safety net
 * against ellipsis. An estimate, not a measurement: the view stays pure (no
 * DOM), consistent with the node's "no JS measuring" model.
 */
export const NODE_TITLE_CHAR_WIDTH_PX = 7;

/** Horizontal chrome around the title text: node padding (both sides) + border. */
export const NODE_LABEL_HORIZONTAL_PADDING_PX = 20;

/**
 * Upper bound on the label-driven node width. Beyond this a title stops widening
 * the node and instead wraps onto the next lines the title CSS allows
 * (`-webkit-line-clamp: 4`). Set a bit above the 160px engine max HEIGHT so a
 * long title gets some horizontal room before wrapping, while the node stays a
 * readable, not-too-wide box.
 */
export const NODE_MAX_LABEL_WIDTH_PX = 250;

/**
 * Snug width (px) a note node needs to render its title on ONE line. Char-count
 * heuristic — see {@link NODE_TITLE_CHAR_WIDTH_PX}. Callers cap this at
 * {@link NODE_MAX_LABEL_WIDTH_PX} (a longer title wraps to 4 lines instead).
 */
export function estimateNodeLabelWidthPx(title: string): number {
	return Math.ceil(title.length * NODE_TITLE_CHAR_WIDTH_PX) + NODE_LABEL_HORIZONTAL_PADDING_PX;
}

/** Id of the synthetic elk root that contains every graph node. */
export const ELK_ROOT_ID = "root";

/**
 * Primary axis elk lays the folder-group members along (the layered pass inside
 * each container — see {@link ELK_GROUP_MEMBER_OPTIONS}). Kept as a constant (not
 * inlined) so it is trivially retargetable. `DOWN` = classic top-to-bottom rows.
 */
export const ELK_DIRECTION = "DOWN";

/** Minimum gap between sibling nodes, shared by every elk algorithm we run. */
export const ELK_NODE_SPACING = "40";

/**
 * Root layout options. elk's `force` algorithm is only the SEED: it computes
 * folder-container dimensions and a rough untangled arrangement, then the
 * d3-force refinement (`d3ForceRefinement.ts`) packs the root-level boxes
 * tightly. `force` does not support `INCLUDE_CHILDREN`, so the root runs elk's
 * default `SEPARATE_CHILDREN` hierarchy handling: folder containers are laid out
 * internally first (see {@link ELK_GROUP_MEMBER_OPTIONS}), then the root arranges
 * the resulting fixed-size boxes.
 */
export const ELK_FORCE_ROOT_OPTIONS: Readonly<Record<string, string>> = {
	"elk.algorithm": "force",
	"elk.spacing.nodeNode": ELK_NODE_SPACING,
};

// --- d3-force root refinement -------------------------------------------------

/**
 * Repulsion between root-level boxes (d3 `forceManyBody` strength; negative =
 * repel). Deliberately moderate — collision + link distances do the packing,
 * the charge only untangles; a strong charge would re-create the dispersion the
 * d3 refinement exists to fix.
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

/**
 * Layout of the INSIDE of a folder-group container. The force root runs
 * `SEPARATE_CHILDREN`, laying out every container independently: members are
 * arranged with elk's proven layered algorithm, then the container is placed as
 * a fixed-size box by the root force/d3 pass.
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
