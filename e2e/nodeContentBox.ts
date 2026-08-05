import type { Locator } from "@playwright/test";

/**
 * A node's CONTENT-box height — the ONE height `graph-view.css`'s density
 * `@container (min-height: …)` queries actually measure, and therefore the only
 * height comparable to the engine's `*_CONTENT_BOX_PX` constants.
 *
 * Lives here rather than in a spec because more than one spec asserts a fixture
 * sits on a given rung, and `clientHeight` — the obvious reach — is the PADDING
 * box: comparing it to a content-box constant is off by the node's padding, and
 * off in the direction that quietly passes today and misfires once nodes change.
 */
export async function nodeContentBoxHeightPx(node: Locator): Promise<number> {
	return node.evaluate((el) => {
		const style = getComputedStyle(el);
		return el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
	});
}
