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
	| {
			readonly kind: "pin";
			readonly title: string;
			readonly chipLabel: string;
			readonly iconId: string;
			readonly chipIconId: string;
	  }
	| {
			readonly kind: "unpin";
			readonly title: string;
			readonly chipLabel: string;
			readonly iconId: string;
			readonly chipIconId: string;
	  };

/**
 * `iconId` vs `chipIconId` (ticket nid_s88z29iparzxrtxhh6ooqfvrz_e): the context
 * MENU entry is an ACTION, so its glyph flips with the state (`pin` ↔ `pin-off`).
 * The hover CHIP is a TOGGLE, so its glyph stays constant and the pinned state is
 * the pressed-in treatment instead (`aria-pressed`, styled in graph-view.css) — a
 * `pin-off` glyph on a pressed chip would read as "not pinned", the opposite of
 * the state it marks.
 *
 * `title` vs `chipLabel` (ticket nid_58tc5g45zwktin78593bi9jkr_e): same TOGGLE logic
 * applied to the accessible NAME. WAI-ARIA APG says an `aria-pressed` toggle keeps a
 * CONSTANT name (state lives in `aria-pressed`, not the name) — a pinned chip named
 * "Unpin from graph" announces "Unpin from graph, pressed", which reads as the UNPIN
 * action being engaged. So the chip's `aria-label` is the constant `chipLabel`
 * ("Pin to graph"), announcing "Pin to graph, pressed" = pinned. The `title` tooltip
 * still flips with the action ("Pin to graph" ↔ "Unpin from graph"): the visible hover
 * hint predicts the click, which is more useful to a sighted user and is a description,
 * not the name. The context MENU, being an action list, uses `title`, not `chipLabel`.
 */
export function planNodePinAction(isPinned: boolean): NodePinAction {
	return isPinned
		? { kind: "unpin", title: "Unpin from graph", chipLabel: "Pin to graph", iconId: "pin-off", chipIconId: "pin" }
		: { kind: "pin", title: "Pin to graph", chipLabel: "Pin to graph", iconId: "pin", chipIconId: "pin" };
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
			readonly chipLabel: string;
			readonly iconId: string;
			readonly chipIconId: string;
	  }
	| {
			readonly kind: "local-unpin";
			readonly title: string;
			readonly chipLabel: string;
			readonly iconId: string;
			readonly chipIconId: string;
	  };

/**
 * Same `iconId` (menu action) vs `chipIconId` (toggle) split as {@link planNodePinAction},
 * and the same `title` (flipping tooltip) vs `chipLabel` (constant `aria-pressed` name)
 * split — here the constant name is "Pin for this note".
 */
export function planNodeLocalPinAction(isLocallyPinned: boolean): NodeLocalPinAction {
	return isLocallyPinned
		? {
				kind: "local-unpin",
				title: "Unpin for this note",
				chipLabel: "Pin for this note",
				iconId: "map-pin-off",
				chipIconId: "map-pin",
		  }
		: {
				kind: "local-pin",
				title: "Pin for this note",
				chipLabel: "Pin for this note",
				iconId: "map-pin",
				chipIconId: "map-pin",
		  };
}
