import type { NodeSizeOverridePx } from "../engine";
import { NODE_OVERRIDE_HARD_MAX_PX, NODE_OVERRIDE_HARD_MIN_PX } from "../engine";

/**
 * Pure half of drag-to-resize (ticket nid_qjsj5mth2phdqctbm0vfx9elw_e):
 * the bounds the resize handles enforce DURING the drag, the commit mapping
 * from a released drag to the persisted override value, and the reset-menu
 * plan. `NoteNode` stays markup + these calls, so the logic is node-testable.
 */

/**
 * What the React Flow resize controls clamp the drag to, spread onto every
 * `NodeResizeControl`. The SAME hard sanity bounds `clampNodeSizeOverridePx`
 * applies on the store's write/load paths (Q3: an override may exceed the
 * global sizing dials, bounded only by these) — sourcing both from the one
 * engine constant is what keeps "what the handle allows" and "what the store
 * keeps" one rule.
 */
export const NODE_RESIZE_BOUNDS = {
	minWidth: NODE_OVERRIDE_HARD_MIN_PX,
	minHeight: NODE_OVERRIDE_HARD_MIN_PX,
	maxWidth: NODE_OVERRIDE_HARD_MAX_PX,
	maxHeight: NODE_OVERRIDE_HARD_MAX_PX,
} as const;

/**
 * The override a released resize drag commits. Rounded to whole pixels: the
 * drag reports fractional CSS pixels, and a stored `321.6328125` is noise in
 * `data.json` with no visible difference on screen.
 */
export function resizeEndToOverride(widthPx: number, heightPx: number): NodeSizeOverridePx {
	return { widthPx: Math.round(widthPx), heightPx: Math.round(heightPx) };
}

/** The node context menu's "back to computed size" entry (title + lucide icon id). */
export interface ResetSizeAction {
	readonly title: string;
	readonly iconId: string;
}

const RESET_SIZE_ACTION: ResetSizeAction = { title: "Reset size", iconId: "undo-2" };

/**
 * The reset affordance is offered ONLY while a size override exists — on a
 * node already at its computed size the entry could change nothing, and a
 * menu item that sometimes does nothing violates POLS.
 */
export function planResetSizeAction(hasSizeOverride: boolean): ResetSizeAction | null {
	return hasSizeOverride ? RESET_SIZE_ACTION : null;
}
