/**
 * View-layer named constants. The engine keeps its own constants under an
 * import guard (`src/engine/constants.ts`); these are the view's and live here
 * so the pure view modules and the ItemView glue share one source.
 */

import { MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH } from "../engine";

// Depth-stepper bounds live in the engine's SETTINGS_SPEC (co-located with the
// depth defaults). Re-exported here so view modules keep importing them from the
// view constants barrel unchanged.
export { MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH };

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

/**
 * The root's elk algorithm id — the marker {@link GraphLayoutRunner} keys the
 * d3-force refinement on. The tunable spacing/force VALUES live on
 * `ViewSettings.forceLayout` (engine defaults, ticket-04 sliders); this file
 * keeps only the non-tunable structure.
 */
export const ELK_FORCE_ALGORITHM = "force";

/**
 * Root layout options. elk's `force` algorithm is only the SEED: it computes
 * folder-container dimensions and a rough untangled arrangement, then the
 * d3-force refinement (`d3ForceRefinement.ts`) packs the root-level boxes
 * tightly. `force` does not support `INCLUDE_CHILDREN`, so the root runs elk's
 * default `SEPARATE_CHILDREN` hierarchy handling: folder containers are laid out
 * internally first (see {@link elkGroupMemberOptions}), then the root arranges
 * the resulting fixed-size boxes. `nodeSpacingPx` comes from
 * `ViewSettings.forceLayout.elkNodeSpacingPx` (the "Group member spacing" knob
 * feeds the root seed too — one spacing concept across both elk passes).
 */
export function elkForceRootOptions(nodeSpacingPx: number): Readonly<Record<string, string>> {
	return {
		"elk.algorithm": ELK_FORCE_ALGORITHM,
		"elk.spacing.nodeNode": String(nodeSpacingPx),
	};
}

/**
 * Rect-collide (`forceRectCollide.ts`) relaxation passes per tick. 1 leaves
 * residual overlaps on dense hubs; 2 resolves them (same rationale as d3's own
 * advice to raise `forceCollide` iterations when overlap-freedom matters more
 * than speed). The ticket-03 prototype found 3 passes gained nothing.
 * Deliberately INTERNAL (no slider): overlap-resolution quality/perf, not
 * layout taste.
 */
export const D3_FORCE_COLLIDE_ITERATIONS = 2;

/**
 * Layout of the INSIDE of a folder-group container. The force root runs
 * `SEPARATE_CHILDREN`, laying out every container independently: members are
 * arranged with elk's proven layered algorithm, then the container is placed as
 * a fixed-size box by the root force/d3 pass. `nodeSpacingPx` is the "Group
 * member spacing" knob (`ViewSettings.forceLayout.elkNodeSpacingPx`).
 */
export function elkGroupMemberOptions(nodeSpacingPx: number): Readonly<Record<string, string>> {
	return {
		"elk.algorithm": "layered",
		"elk.direction": ELK_DIRECTION,
		"elk.spacing.nodeNode": String(nodeSpacingPx),
	};
}

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
 * Clamp a (possibly fractional / out-of-range) stepper input into
 * `[MIN_STEPPER_DEPTH, MAX_STEPPER_DEPTH]`, rounding to the nearest integer.
 * Used by every depth stepper and the settings-tab depth inputs.
 */
export function clampStepperDepth(value: number): number {
	return Math.min(MAX_STEPPER_DEPTH, Math.max(MIN_STEPPER_DEPTH, Math.round(value)));
}
