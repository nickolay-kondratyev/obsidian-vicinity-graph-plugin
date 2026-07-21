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

/**
 * elk layout options, chosen with the step-05 compound (folder-group) future in
 * mind even though step-04 renders a flat graph:
 * - `layered` is elk's canonical algorithm that also honors hierarchical
 *   containment (force/stress handle containment worse) — CLARIFICATION Q1.
 * - `hierarchyHandling: INCLUDE_CHILDREN` makes the layout descend into child
 *   nodes, which is exactly what folder groups will need; on a flat graph it is
 *   a harmless no-op.
 */
export const ELK_LAYOUT_OPTIONS: Readonly<Record<string, string>> = {
	"elk.algorithm": "layered",
	"elk.direction": ELK_DIRECTION,
	"elk.hierarchyHandling": "INCLUDE_CHILDREN",
	"elk.layered.spacing.nodeNodeBetweenLayers": "80",
	"elk.spacing.nodeNode": "40",
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
