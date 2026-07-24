import type { OutlineEntry } from "../engine";

/**
 * Turns the flat, document-ordered outline the mapping layer produces into the
 * nesting the DOM renders (CLARIFICATION Q8: hierarchy is carried by real list
 * nesting, not an indentation ladder).
 *
 * The flat array is the stable contract with `flowMapping`; this shape is the
 * outline UI's own business, which is what lets the UI be reworked without
 * touching the mapping layer.
 */

export interface OutlineTreeNode {
	readonly entry: OutlineEntry;
	readonly children: readonly OutlineTreeNode[];
}

/** Built mutably, handed out as the readonly view above — no structural sharing games. */
interface MutableTreeNode {
	readonly entry: OutlineEntry;
	readonly children: MutableTreeNode[];
}

/**
 * Real notes are not well-formed trees, so the rules are stated rather than
 * assumed: a deeper entry attaches to the nearest SHALLOWER open ancestor
 * (skipped levels create NO filler nodes), and an entry with no shallower
 * ancestor is a ROOT. Document order is preserved everywhere.
 */
export function buildOutlineTree(entries: readonly OutlineEntry[]): readonly OutlineTreeNode[] {
	const roots: MutableTreeNode[] = [];
	// Ancestors of the entry being placed, shallowest first.
	const openAncestors: MutableTreeNode[] = [];
	for (const entry of entries) {
		while (lastLevel(openAncestors) >= entry.level) {
			openAncestors.pop();
		}
		const node: MutableTreeNode = { entry, children: [] };
		const parent = openAncestors[openAncestors.length - 1];
		if (parent === undefined) {
			roots.push(node);
		} else {
			parent.children.push(node);
		}
		openAncestors.push(node);
	}
	return roots;
}

/** The deepest open ancestor's level, or 0 when there is none (no heading level is ≤ 0). */
function lastLevel(openAncestors: readonly MutableTreeNode[]): number {
	return openAncestors[openAncestors.length - 1]?.entry.level ?? 0;
}
