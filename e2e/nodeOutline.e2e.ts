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
/** The STRIPPED label of the fixture's markdown-carrying heading (`## Status of [[outline-cover]] **today**`). */
const MARKDOWN_HEADING_LABEL = "Status of outline-cover today";
/** A marker present in that heading's RAW text and absent from its label — see the raw-heading test. */
const RAW_ONLY_MARKER = "**today**";
/** Largest node size, in px, that still lands in the 72–104px band (attachments shown, outline hidden). */
const BELOW_OUTLINE_THRESHOLD_PX = 96;
/** The density band that shows the attachment strip but NOT the outline (graph-view.css). */
const ATTACHMENTS_ONLY_BAND_PX = { min: 72, belowMax: 104 };
/** One wheel notch's worth of scroll — far less than the list's overflow, so any movement is proof. */
const WHEEL_SCROLL_PX = 120;
/** Fractional layout px only: anything larger is real dead space, not rounding. */
const MAX_SUB_PIXEL_SLACK_PX = 1;

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
	await restoreNavigationSpies();
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
	// Visibility, not just markup: the reveal at the 104px threshold and the base
	// `display: none` live in different stylesheets, and `toHaveText` reads
	// textContent — which a hidden outline would satisfy just as well.
	await expect(outlineOf(OUTLINE_NOTE_PATH)).toBeVisible();

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
 * Records BOTH navigation paths the plugin can take, delegating to the real
 * implementations so the click still opens the note:
 *
 * - `workspace.openLinkText` — the heading-targeted open an outline entry makes.
 *   We assert OUR side of that documented contract; whether Obsidian then scrolls
 *   the editor or flashes the heading is Obsidian's contract, covered by the
 *   manual dev-vault check in the step-9 commit.
 * - `WorkspaceLeaf.prototype.openFile` — how the NODE-level click handler opens a
 *   note (at its top, with no open state). An outline click that failed to
 *   `stopPropagation` would show up here as an extra heading-less open.
 *
 * Each wrapper is installed at most once — re-wrapping would make one click
 * record twice — while the logs are cleared on every call, so each test asserts
 * on its own click. {@link restoreNavigationSpies} puts the originals back.
 */
async function recordNavigationFromNow(): Promise<void> {
	await page.evaluate(() => {
		const app = (window as unknown as { app: any }).app;
		const store = window as unknown as {
			__vgLinktexts?: string[];
			__vgLeafOpens?: string[];
			__vgOriginalOpenLinkText?: unknown;
			__vgOriginalLeafOpenFile?: unknown;
		};
		store.__vgLinktexts = [];
		store.__vgLeafOpens = [];
		if (store.__vgOriginalOpenLinkText === undefined) {
			const originalOpenLinkText = app.workspace.openLinkText.bind(app.workspace);
			store.__vgOriginalOpenLinkText = originalOpenLinkText;
			app.workspace.openLinkText = (linktext: string, sourcePath: string, newLeaf?: unknown) => {
				store.__vgLinktexts?.push(linktext);
				return originalOpenLinkText(linktext, sourcePath, newLeaf);
			};
		}
		if (store.__vgOriginalLeafOpenFile === undefined) {
			// Prototype-level: leaves are created per navigation, so wrapping one
			// instance would miss the very call we are looking for.
			const leafPrototype = Object.getPrototypeOf(app.workspace.getLeaf(false));
			const originalOpenFile = leafPrototype.openFile;
			store.__vgOriginalLeafOpenFile = originalOpenFile;
			leafPrototype.openFile = function (file: any, openState?: any) {
				// `#` + the subpath Obsidian derived, or nothing at all for a plain
				// "open this note" — which is exactly what distinguishes the two paths.
				store.__vgLeafOpens?.push(`${file?.path ?? "?"}${openState?.eState?.subpath ?? ""}`);
				return originalOpenFile.call(this, file, openState);
			};
		}
	});
}

async function restoreNavigationSpies(): Promise<void> {
	await page.evaluate(() => {
		const app = (window as unknown as { app: any }).app;
		const store = window as unknown as { __vgOriginalOpenLinkText?: any; __vgOriginalLeafOpenFile?: any };
		if (store.__vgOriginalOpenLinkText !== undefined) {
			app.workspace.openLinkText = store.__vgOriginalOpenLinkText;
			store.__vgOriginalOpenLinkText = undefined;
		}
		if (store.__vgOriginalLeafOpenFile !== undefined) {
			Object.getPrototypeOf(app.workspace.getLeaf(false)).openFile = store.__vgOriginalLeafOpenFile;
			store.__vgOriginalLeafOpenFile = undefined;
		}
	});
}

const recordedLinktexts = () => page.evaluate(() => (window as unknown as { __vgLinktexts: string[] }).__vgLinktexts);
const recordedLeafOpens = () => page.evaluate(() => (window as unknown as { __vgLeafOpens: string[] }).__vgLeafOpens);

test("clicking an outline entry asks Obsidian to open that note at that heading", async () => {
	await recordNavigationFromNow();
	await entriesOf(OUTLINE_NOTE_PATH).filter({ hasText: CLICKED_HEADING }).first().click();

	await expect.poll(recordedLinktexts).toEqual([`${OUTLINE_NOTE_PATH}#${CLICKED_HEADING}`]);
});

test("the linktext is built from the RAW heading, not the stripped label", async () => {
	await recordNavigationFromNow();
	await entriesOf(OUTLINE_NOTE_PATH).filter({ hasText: MARKDOWN_HEADING_LABEL }).first().click();

	// `**today**` survives ONLY if the raw heading text was the key: the label the
	// entry displays has it stripped. Deliberately not an equality assertion —
	// the exact output is `stripHeadingForLink`'s business, not ours.
	await expect.poll(async () => (await recordedLinktexts()).join("")).toContain(RAW_ONLY_MARKER);
});

test("clicking an outline entry does not ALSO trigger the node-level open", async () => {
	await recordNavigationFromNow();
	await entriesOf(OUTLINE_NOTE_PATH).filter({ hasText: CLICKED_HEADING }).first().click();
	// Wait for the navigation to land before counting, so "nothing extra" is not
	// just "nothing yet".
	await expect.poll(recordedLinktexts).toHaveLength(1);

	// The node-level handler opens the note with NO subpath; if the entry's
	// stopPropagation stopped working, that open would land here (and after the
	// heading jump, undoing it).
	expect(await recordedLeafOpens()).toEqual([`${OUTLINE_NOTE_PATH}#${CLICKED_HEADING}`]);
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

test("the wheel scrolls the outline (not the canvas) while its scrollbar is hidden", async () => {
	const outline = outlineOf(OUTLINE_NOTE_PATH);
	// Precondition: without real overflow this test would pass vacuously.
	const overflow = await outline.evaluate((el) => {
		el.scrollTop = 0;
		return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
	});
	expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);

	// A REAL wheel over the list — the gesture the `nowheel` escape hatch exists
	// for. React Flow's zoom is a native d3-zoom listener on the pane, so without
	// `nowheel` this would zoom the canvas and leave scrollTop at 0.
	await outline.hover();
	await page.mouse.wheel(0, WHEEL_SCROLL_PX);

	await expect.poll(() => outline.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

// --- E6: the image escape hatch (KEEP LAST — it changes the MAIN note) --------

test("a note whose first image precedes its first heading shows the image, not an outline", async () => {
	await harness.openFile(OUTLINE_COVER_PATH);
	await expect(noteNode(OUTLINE_COVER_PATH)).toHaveAttribute("data-tier", "main");

	await expect(noteNode(OUTLINE_COVER_PATH)).toHaveAttribute("data-preview", "thumbnail");
	await expect(outlineOf(OUTLINE_COVER_PATH)).toHaveCount(0);
});

// --- E7: the outline's layout rule must not leak below its own threshold ------
// KEEP LAST: it shrinks every node for the rest of the file.

/**
 * Dead space, in px, between the bottom of the attachment strip and the node's
 * bottom padding edge. The strip is pinned there by the preview zone's
 * flex-grow, so a rule that switches that grow off unpins it — visibly, as a gap.
 */
const attachmentStripSlackPx = (path: string) =>
	noteNode(path).evaluate((node) => {
		const strip = node.querySelector<HTMLElement>(".vicinity-graph-node__attachments");
		if (strip === null) {
			return null;
		}
		const paddingBottom = Number.parseFloat(getComputedStyle(node).paddingBottom);
		// offsetTop and clientHeight share the node's padding-box origin, and both
		// are LAYOUT px — unaffected by React Flow's zoom transform.
		return node.clientHeight - paddingBottom - (strip.offsetTop + strip.offsetHeight);
	});

test("an outline-bearing node below the outline threshold still pins its attachment strip to the bottom", async () => {
	await harness.setMaxNodeSizePx(BELOW_OUTLINE_THRESHOLD_PX);
	// A sizing change alone does not rebuild; an active-file change does (the
	// current MAIN is outline-cover, so this is a real change).
	await harness.openFile(OUTLINE_NOTE_PATH);
	await expect(noteNode(OUTLINE_NOTE_PATH)).toHaveAttribute("data-tier", "main");

	// Preconditions: an outline-bearing node, in the band where the outline is
	// NOT rendered — exactly where a rule gated on `data-preview` but not on the
	// density threshold would still apply.
	await expect(noteNode(OUTLINE_NOTE_PATH)).toHaveAttribute("data-preview", "outline");
	await expect(outlineOf(OUTLINE_NOTE_PATH)).toBeHidden();
	const heightPx = await noteNode(OUTLINE_NOTE_PATH).evaluate((node) => (node as HTMLElement).offsetHeight);
	expect(heightPx).toBeGreaterThanOrEqual(ATTACHMENTS_ONLY_BAND_PX.min);
	expect(heightPx).toBeLessThan(ATTACHMENTS_ONLY_BAND_PX.belowMax);

	const slackPx = await attachmentStripSlackPx(OUTLINE_NOTE_PATH);
	// Precondition: the node HAS a strip to pin (the fixture embeds pic.jpg).
	expect(slackPx).not.toBeNull();

	expect(slackPx).toBeLessThanOrEqual(MAX_SUB_PIXEL_SLACK_PX);
});
