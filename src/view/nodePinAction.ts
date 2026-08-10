/**
 * The pure pin/unpin decision (step-06 #6) shared by BOTH surfaces: the
 * hover-reveal button on the node AND the right-click context-menu entry. One
 * source of truth so the two never disagree on label/icon/applicability.
 *
 * Keyed on the node's pinned-doc FACT (not its styling tier): EVERY note node
 * toggles — an unpinned node (regular OR the MAIN central itself) can be
 * pinned, a pinned one (pinned-central OR a pinned MAIN) can be unpinned.
 * Pinning MAIN is how the human keeps the current central around before
 * navigating away (it starts rendering as a pinned central once another note
 * becomes MAIN).
 */
export type NodePinAction =
	| { readonly kind: "pin"; readonly title: string; readonly iconId: string; readonly chipIconId: string }
	| { readonly kind: "unpin"; readonly title: string; readonly iconId: string; readonly chipIconId: string };

/**
 * `iconId` vs `chipIconId` (ticket nid_s88z29iparzxrtxhh6ooqfvrz_e): the context
 * MENU entry is an ACTION, so its glyph flips with the state (`pin` ↔ `pin-off`).
 * The hover CHIP is a TOGGLE, so its glyph stays constant and the pinned state is
 * the pressed-in treatment instead (`aria-pressed`, styled in graph-view.css) — a
 * `pin-off` glyph on a pressed chip would read as "not pinned", the opposite of
 * the state it marks.
 */
export function planNodePinAction(isPinned: boolean): NodePinAction {
	return isPinned
		? { kind: "unpin", title: "Unpin from graph", iconId: "pin-off", chipIconId: "pin" }
		: { kind: "pin", title: "Pin to graph", iconId: "pin", chipIconId: "pin" };
}

/**
 * The LOCAL pin/unpin decision (LOCAL PINNING ticket) — the second, independent
 * toggle a node carries. A local pin holds ONLY while its main note is active, so
 * the copy says "for this note" (the active MAIN), distinct from the global pin's
 * "from graph". A distinct lucide glyph (`map-pin`) keeps the two controls apart
 * at a glance, so a node that is BOTH globally and locally pinned shows two clearly
 * different indicators.
 *
 * Keyed on {@link FlowNodeData.isLocallyPinned}, mirroring {@link planNodePinAction}
 * on the global flag — so a doc holding both pin kinds resolves each toggle
 * independently. NOT offered on the MAIN node itself (decision Q4): a note cannot be
 * locally pinned under itself, so the caller withholds this control there.
 */
export type NodeLocalPinAction =
	| {
			readonly kind: "local-pin";
			readonly title: string;
			readonly iconId: string;
			readonly chipIconId: string;
	  }
	| {
			readonly kind: "local-unpin";
			readonly title: string;
			readonly iconId: string;
			readonly chipIconId: string;
	  };

/** Same `iconId` (menu action) vs `chipIconId` (toggle) split as {@link planNodePinAction}. */
export function planNodeLocalPinAction(isLocallyPinned: boolean): NodeLocalPinAction {
	return isLocallyPinned
		? { kind: "local-unpin", title: "Unpin for this note", iconId: "map-pin-off", chipIconId: "map-pin" }
		: { kind: "local-pin", title: "Pin for this note", iconId: "map-pin", chipIconId: "map-pin" };
}
