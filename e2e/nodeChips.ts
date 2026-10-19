import type { Locator } from "@playwright/test";

/**
 * A note node's hover chip (pin, local pin, gear, create child note).
 *
 * Lives here rather than in a spec because every chip-clicking spec needs it, and
 * the chips' DOM home is not where a spec would look: they sit in the side rail —
 * OUTSIDE the `.vicinity-graph-node` box (which clips its content), as a SIBLING of
 * it inside React Flow's node wrapper. So a chip is reached through the node's
 * parent (the wrapper), never under the node itself.
 *
 * `chipSelector` carries its leading dot (`".vicinity-graph-pin-button"`) so
 * `selectorGuard.test.ts` can still check the class is rendered.
 */
export function nodeChip(noteNode: Locator, chipSelector: string): Locator {
	return noteNode.locator("xpath=..").locator(`.vicinity-graph-node-actions ${chipSelector}`);
}
