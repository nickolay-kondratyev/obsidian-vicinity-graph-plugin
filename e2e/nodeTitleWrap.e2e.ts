import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Release-time e2e for the node-WIDTH label estimate: a short, single-word note
 * title must render on ONE line, never breaking a trailing glyph onto a second.
 *
 * This is the ticket `nid_vtizb5sqefquytcnfe1r73ybe_e` regression: linking a
 * note to a short target like `money` sized the node just too narrow, so the
 * rendered title wrapped as `mone` / `y`. The width comes from
 * `estimateNodeLabelWidthPx` (a pure char-count estimate) — but WHETHER the real
 * font then fits inside that box is a browser-layout fact no jsdom/vitest test
 * can observe, which is why it lives here and not in `graphIdentity.test.ts`.
 *
 * Self-contained fixtures (`extraFixtures`, isolated from the dev-vault graph),
 * so this cannot shift the node counts the other e2e suites assert on.
 */

const MAIN_PATH = "wrap-main.md";
/** The short single-word target under test — the exact `money` case from the ticket. */
const SHORT_TARGET_PATH = "money.md";
const SHORT_TARGET_TITLE = "money";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({
		extraFixtures: {
			[MAIN_PATH]: `Link to [[${SHORT_TARGET_TITLE}]].\n`,
			[SHORT_TARGET_PATH]: "Short.\n",
		},
	});
	page = harness.page;
	await harness.openFile(MAIN_PATH);
	await harness.openGraphView();
	await expect(noteNode(MAIN_PATH)).toHaveAttribute("data-tier", "main");
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string): Locator {
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
}

function titleOf(path: string): Locator {
	return noteNode(path).locator(".vicinity-graph-node__title");
}

/**
 * Rendered line count of a title element: its full content height (`scrollHeight`,
 * unclamped by `-webkit-line-clamp`) over one line's height. A snug-but-too-narrow
 * box wraps `money` to two lines; this reads that as 2.
 */
async function renderedTitleLineCount(title: Locator): Promise<number> {
	return title.evaluate((el) => {
		const lineHeightPx = parseFloat(getComputedStyle(el).lineHeight);
		return Math.round(el.scrollHeight / lineHeightPx);
	});
}

test("a short single-word title renders on one line, not broken onto a second", async () => {
	const title = titleOf(SHORT_TARGET_PATH);
	// Precondition: the target node exists and shows its whole title (no ellipsis,
	// no clipping) — so "one line" is measured against the full word.
	await expect(title).toHaveText(SHORT_TARGET_TITLE);

	expect(await renderedTitleLineCount(title)).toBe(1);
});

test("the same short title stays on one line as the MAIN node's bolder rendering", async () => {
	// The MAIN tier renders its title at `--font-semibold` (graph-view.css) —
	// wider glyphs against the SAME char-count width estimate, so the ticket's
	// wrap can recur there even when the regular-tier fit above holds.
	await harness.openFile(SHORT_TARGET_PATH);
	const title = titleOf(SHORT_TARGET_PATH);
	await expect(noteNode(SHORT_TARGET_PATH)).toHaveAttribute("data-tier", "main");
	await expect(title).toHaveText(SHORT_TARGET_TITLE);

	expect(await renderedTitleLineCount(title)).toBe(1);
});
