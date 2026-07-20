import type { NodeTier } from "./flowMapping";

/**
 * The pure pin/unpin decision (step-06 #6) shared by BOTH surfaces: the
 * hover-reveal button on the node AND the right-click context-menu entry. One
 * source of truth so the two never disagree on label/icon/applicability.
 *
 * - MAIN is never pinnable (`none`).
 * - A regular neighbor can be pinned.
 * - A pinned central can be unpinned.
 */
export type NodePinAction =
	| { readonly kind: "none" }
	| { readonly kind: "pin"; readonly title: string; readonly iconId: string }
	| { readonly kind: "unpin"; readonly title: string; readonly iconId: string };

export function planNodePinAction(tier: NodeTier): NodePinAction {
	switch (tier) {
		case "main":
			return { kind: "none" };
		case "regular":
			return { kind: "pin", title: "Pin to graph", iconId: "pin" };
		case "pinned-central":
			return { kind: "unpin", title: "Unpin from graph", iconId: "pin-off" };
	}
}
