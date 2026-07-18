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
