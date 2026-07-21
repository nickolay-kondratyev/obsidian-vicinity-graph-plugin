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
	| { readonly kind: "pin"; readonly title: string; readonly iconId: string }
	| { readonly kind: "unpin"; readonly title: string; readonly iconId: string };

export function planNodePinAction(isPinned: boolean): NodePinAction {
	return isPinned
		? { kind: "unpin", title: "Unpin from graph", iconId: "pin-off" }
		: { kind: "pin", title: "Pin to graph", iconId: "pin" };
}
