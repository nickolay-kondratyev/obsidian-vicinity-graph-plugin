import type { NodeChange, NodeDimensionChange } from "@xyflow/react";
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

/** The node context menu's "back to computed size" entry (title + lucide icon id + educational sub-line). */
export interface ResetSizeAction {
	readonly title: string;
	readonly iconId: string;
	/**
	 * The muted sub-line the menu renders under the title. "Custom size" (a box
	 * set by dragging the node's edges) is not a term the UI names anywhere else,
	 * so the entry has to teach it: what the reset does, and — since the entry
	 * only ever appears once such a size exists — implicitly when it shows.
	 */
	readonly description: string;
}

const RESET_SIZE_ACTION: ResetSizeAction = {
	title: "Reset size",
	iconId: "undo-2",
	description: "Clears the custom size you set by dragging; the note returns to its computed size.",
};

/**
 * The reset affordance is offered ONLY while a size override exists — on a
 * node already at its computed size the entry could change nothing, and a
 * menu item that sometimes does nothing violates POLS.
 */
export function planResetSizeAction(hasSizeOverride: boolean): ResetSizeAction | null {
	return hasSizeOverride ? RESET_SIZE_ACTION : null;
}

/** React Flow's class on every `NodeResizeControl` root — the grips' ONE DOM name. */
const RESIZE_GRIP_SELECTOR = ".react-flow__resize-control";

/**
 * The only bit of a DOM node this predicate needs. Narrower than `Element` on
 * purpose: it keeps the rule unit-testable without a DOM environment.
 */
interface ClosestQueryable {
	closest(selector: string): unknown;
}

/**
 * Whether a mouse event originated on one of a node's resize grips rather than
 * on the node's body. The grips ride the React Flow node WRAPPER, so their
 * events bubble into every node-level handler; a press that never MOVED is not
 * suppressed by the drag layer either (d3-drag only swallows the click once the
 * pointer has moved), so without this a mis-grabbed handle reads as a plain
 * node click.
 */
export function startedOnResizeGrip(event: { readonly target: EventTarget | null }): boolean {
	const { target } = event;
	// Duck-checked rather than `instanceof Element` so the rule is unit-testable
	// with a stub instead of a whole DOM environment.
	if (target === null || !("closest" in target)) {
		return false;
	}
	return (target as ClosestQueryable).closest(RESIZE_GRIP_SELECTOR) !== null;
}

/**
 * Whether a React Flow node change is one this CONTROLLED, read-only graph
 * solicited and must fold back into controller-owned local node state — i.e. a
 * resize GESTURE moving a box. React Flow emits `dimensions` changes from TWO
 * sources that share a `type` but not an origin:
 *
 *  - a `NodeResizer` drag — carries a `resizing` flag (`true` mid-drag, `false`
 *    on release). This is the ONE change this graph asked for, and the only one
 *    whose live box must ride the view's narrow resize overlay until the
 *    commit-on-release rebuild republishes it (see `VicinityGraphFlow`'s
 *    `applyResizeOverlay` and the `GuardedWriteOutcome` "screen-ahead" note in
 *    CLAUDE.md).
 *  - React Flow's own ResizeObserver RE-MEASURING a node it already rendered — a
 *    plain `{type:'dimensions', dimensions}` with NO `resizing` flag.
 *
 * Feeding the SECOND kind into node state is the bug behind ticket
 * nid_c78k90su87jrzigxvfjv5t95g_e, and its residual nid_1s77g4wx33uj8b380d1oph1d6_e:
 * a ResizeObserver callback that measured a node's PRE-repaint DOM feeds the OLD box
 * straight back in, and while the view still kept a standing local `nodes` mirror
 * that reverted box stranded BELOW the published snapshot with no way to re-converge
 * — a whole refreshOpenViews() fan-out (every settings / pin / size-override write)
 * silently swallowed until some unrelated event rebuilt the pane. The view now
 * derives its nodes straight from the snapshot and holds only the gesture overlay, so
 * ignoring re-measurements here is what keeps a stale box from ever re-entering. A
 * gesture carries `resizing`; a re-measurement never does, so that flag's PRESENCE is
 * the source discriminator.
 */
export function isResizeGestureChange(change: NodeChange): change is NodeDimensionChange {
	return change.type === "dimensions" && change.resizing !== undefined;
}
