import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Release-time e2e for the in-node markdown outline. Everything here is DOM or
 * pointer behaviour that no vitest test can reach (this repo has no RTL/jsdom):
 * the nested markup, the container-query reveal, the hover-only scrollbar, and
 * the click that opens a note at a heading. The pure decisions behind them
 * (labels, tree shape, preview choice, open intent) are unit-tested.
 *
 * Fixtures come from `scripts/setup-dev-vault.sh` (outline-note / outline-cover)
 * and are deliberately self-contained, so they cannot shift the node counts the
 * other e2e suites assert on.
 *
 * Every assertion targets the MAIN node: centrals bypass sizing composition and
 * are always maxPx (160px), which is the only DETERMINISTIC way to be above the
 * 104px threshold that reveals the outline at all.
 *
 * Serial by design: ONE Obsidian instance for the whole file, and later tests
 * build on earlier navigation state.
 */

test.describe.configure({ mode: "serial" });

const OUTLINE_NOTE_PATH = "outline-note.md";
const OUTLINE_COVER_PATH = "outline-cover.md";
/** Not node-bearing, so opening it leaves the graph showing outline-note's vicinity. */
const NON_NODE_BEARING_PATH = "pic.jpg";

/** Depth-2 entries, in document order (see the fixture). */
const EXPECTED_ENTRY_LABELS = [
	"Overview",
	"Background",
	"Scope",
	"Method",
	"Status of outline-cover today",
	"Data collection",
	"Results",
	"Findings",
	"Limitations",
	"Discussion",
	"Conclusion",
];
/** Level 3 — dropped by the default outline depth of 2. */
const LEVEL_THREE_LABEL = "Deep detail one";
/** The RAW heading text of the entry the click tests use (plain prose: sanitising is a no-op). */
const CLICKED_HEADING = "Background";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch();
	page = harness.page;
	await harness.openFile(OUTLINE_NOTE_PATH);
	await harness.openGraphView();
	await expect(noteNode(OUTLINE_NOTE_PATH)).toHaveAttribute("data-tier", "main");
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string): Locator {
	return page.locator(`.vicinity-graph-node[data-path="${path}"]`);
}

function outlineOf(path: string): Locator {
	return noteNode(path).locator(".vicinity-graph-outline");
}

function entriesOf(path: string): Locator {
	return outlineOf(path).locator("button.vicinity-graph-outline__entry");
}

// --- E1: rendered content -----------------------------------------------------

test("the outline lists its headings as stripped labels in document order", async () => {
	await expect(entriesOf(OUTLINE_NOTE_PATH)).toHaveText(EXPECTED_ENTRY_LABELS);
});

test("heading hierarchy is real list nesting, not an indentation ladder", async () => {
	const nested = outlineOf(OUTLINE_NOTE_PATH).locator(
		".vicinity-graph-outline__list .vicinity-graph-outline__list",
	);
	await expect(nested.first().locator("button.vicinity-graph-outline__entry").first()).toHaveText("Background");
});

test("headings deeper than the default outline depth are not rendered", async () => {
	await expect(entriesOf(OUTLINE_NOTE_PATH).filter({ hasText: LEVEL_THREE_LABEL })).toHaveCount(0);
});

// --- E2 / E3: clicking an entry opens the note AT that heading -----------------

const activeFilePath = () =>
	page.evaluate(() => (window as unknown as { app: any }).app.workspace.getActiveFile()?.path);

/**
 * Records the linktexts the plugin hands to Obsidian, delegating to the real
 * implementation so the click still opens the note. We assert OUR side of the
 * documented `openLinkText` contract — whether Obsidian then scrolls the editor
 * or flashes the heading is Obsidian's contract, and is covered by the manual
 * dev-vault check in the step-9 commit.
 */
async function spyOnOpenLinkText(): Promise<void> {
	await page.evaluate(() => {
		const app = (window as unknown as { app: any }).app;
		const store = window as unknown as { __vgLinktexts?: string[] };
		store.__vgLinktexts = [];
		const original = app.workspace.openLinkText.bind(app.workspace);
		app.workspace.openLinkText = (linktext: string, sourcePath: string, newLeaf?: unknown) => {
			store.__vgLinktexts?.push(linktext);
			return original(linktext, sourcePath, newLeaf);
		};
	});
}

const recordedLinktexts = () => page.evaluate(() => (window as unknown as { __vgLinktexts: string[] }).__vgLinktexts);

test("clicking an outline entry asks Obsidian to open that note at that heading", async () => {
	await spyOnOpenLinkText();
	await entriesOf(OUTLINE_NOTE_PATH).filter({ hasText: CLICKED_HEADING }).first().click();

	await expect.poll(recordedLinktexts).toEqual([`${OUTLINE_NOTE_PATH}#${CLICKED_HEADING}`]);
});

test("clicking an outline entry makes that note the active file", async () => {
	// Move the active file OFF the note first, so "it became active" is a real
	// observation. `pic.jpg` is not node-bearing, so the graph keeps showing
	// outline-note's vicinity (no rebuild, no relayout, node stays clickable).
	await harness.openFile(NON_NODE_BEARING_PATH);
	await expect.poll(activeFilePath).toBe(NON_NODE_BEARING_PATH);

	await entriesOf(OUTLINE_NOTE_PATH).filter({ hasText: CLICKED_HEADING }).first().click();

	await expect.poll(activeFilePath).toBe(OUTLINE_NOTE_PATH);
});

// --- E4 / E5: overflow behaviour ----------------------------------------------

const scrollbarColorOf = (locator: Locator) =>
	locator.evaluate((el) => getComputedStyle(el).scrollbarColor);

test("the outline scrollbar is transparent until the node is hovered", async () => {
	const outline = outlineOf(OUTLINE_NOTE_PATH);
	// Park the pointer away from every node so the idle reading is genuinely idle.
	await page.mouse.move(0, 0);
	const idle = await scrollbarColorOf(outline);

	await noteNode(OUTLINE_NOTE_PATH).hover();

	expect(await scrollbarColorOf(outline)).not.toBe(idle);
});

test("the outline still scrolls while its scrollbar is hidden", async () => {
	const outline = outlineOf(OUTLINE_NOTE_PATH);
	await page.mouse.move(0, 0);
	// Precondition: without real overflow this test would pass vacuously.
	const overflow = await outline.evaluate((el) => ({
		scrollHeight: el.scrollHeight,
		clientHeight: el.clientHeight,
	}));
	expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);

	const scrolled = await outline.evaluate((el) => {
		el.scrollTop = el.scrollHeight;
		return el.scrollTop;
	});

	expect(scrolled).toBeGreaterThan(0);
});

// --- E6: the image escape hatch (KEEP LAST — it changes the MAIN note) --------

test("a note whose first image precedes its first heading shows the image, not an outline", async () => {
	await harness.openFile(OUTLINE_COVER_PATH);
	await expect(noteNode(OUTLINE_COVER_PATH)).toHaveAttribute("data-tier", "main");

	await expect(noteNode(OUTLINE_COVER_PATH)).toHaveAttribute("data-preview", "thumbnail");
	await expect(outlineOf(OUTLINE_COVER_PATH)).toHaveCount(0);
});
