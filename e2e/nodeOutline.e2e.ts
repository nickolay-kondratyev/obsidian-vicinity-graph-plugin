import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";
import type { E2eObsidianApp, E2eOpenState, E2eWorkspace, E2eWorkspaceLeaf } from "./obsidianInternals";

/**
 * The `window`-scoped scratch space the navigation spies write to. Typed here (types
 * erase, so referencing it inside a `page.evaluate` callback is legal) so the spy
 * wrappers narrow the recorded originals back to real function types instead of `any`.
 */
interface NavigationSpyStore {
	__vgLinktexts?: string[];
	__vgLeafOpens?: string[];
	__vgOriginalOpenLinkText?: E2eWorkspace["openLinkText"];
	__vgOriginalLeafOpenFile?: E2eWorkspaceLeaf["openFile"];
}

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
 * Every assertion targets the MAIN node — which since ticket
 * nid_k2pa8khm6ugozmhkd6nlbdrq6_e is LOAD-BEARING, not just convenient: under the
 * default Auto preference the outline is a CENTRAL's affordance, so re-pointing
 * any case here at a peripheral note would assert on a node that renders no
 * outline at all. The fixture's eleven depth-2 headings
 * size it to maxPx (160px) under content-fit sizing, comfortably above the 104px
 * threshold that reveals the outline at all. (Centrals no longer bypass sizing —
 * their prominence FLOOR alone would not clear that threshold, so the fixture's
 * outline is what keeps this deterministic.)
 *
 * Serial by design: ONE Obsidian instance for the whole file. E1–E5 share the
 * MAIN node `beforeAll` established; every case that needs a DIFFERENT one
 * establishes it ITSELF via {@link showNoteWithRefitGraph}, never by inheriting
 * whatever the previous case left active. That rule exists because it was once
 * broken: E7 inherited its rebuild trigger and went permanently red the moment a
 * case was inserted above it. Insert a case here ⇒ re-run the WHOLE file
 * (`--grep` removes exactly the neighbours that would expose the coupling).
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
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
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

test("outline entries render as flat tree rows, not Obsidian buttons", async () => {
	// Obsidian's app-wide `button:not(.clickable-icon)` rule (specificity 0,1,1)
	// paints every plain button as a raised pill. A single-class reset (0,1,0)
	// silently LOSES that cascade fight — only a real Obsidian can observe it,
	// which is exactly how the outline shipped as "nested buttons" once.
	const entry = entriesOf(OUTLINE_NOTE_PATH).first();
	const chrome = await entry.evaluate((el) => {
		const style = getComputedStyle(el);
		return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow };
	});

	expect(chrome).toEqual({ backgroundColor: "rgba(0, 0, 0, 0)", boxShadow: "none" });
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
	page.evaluate(() => (window as unknown as { app: E2eObsidianApp }).app.workspace.getActiveFile()?.path);

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
		const app = (window as unknown as { app: E2eObsidianApp }).app;
		const store = window as unknown as NavigationSpyStore;
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
			const leafPrototype = Object.getPrototypeOf(app.workspace.getLeaf(false)) as Pick<E2eWorkspaceLeaf, "openFile">;
			const originalOpenFile = leafPrototype.openFile;
			store.__vgOriginalLeafOpenFile = originalOpenFile;
			leafPrototype.openFile = function (this: E2eWorkspaceLeaf, file, openState?: E2eOpenState) {
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
		const app = (window as unknown as { app: E2eObsidianApp }).app;
		const store = window as unknown as NavigationSpyStore;
		if (store.__vgOriginalOpenLinkText !== undefined) {
			app.workspace.openLinkText = store.__vgOriginalOpenLinkText;
			store.__vgOriginalOpenLinkText = undefined;
		}
		if (store.__vgOriginalLeafOpenFile !== undefined) {
			const leafPrototype = Object.getPrototypeOf(app.workspace.getLeaf(false)) as Pick<E2eWorkspaceLeaf, "openFile">;
			leafPrototype.openFile = store.__vgOriginalLeafOpenFile;
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

// --- E6: the image escape hatch (changes the MAIN note; E1–E5 must precede it) -

test("a note whose first image precedes its first heading shows the image, not an outline", async () => {
	await harness.openFile(OUTLINE_COVER_PATH);
	await expect(noteNode(OUTLINE_COVER_PATH)).toHaveAttribute("data-tier", "main");

	await expect(noteNode(OUTLINE_COVER_PATH)).toHaveAttribute("data-preview", "thumbnail");
	await expect(outlineOf(OUTLINE_COVER_PATH)).toHaveCount(0);
});

// --- E8: the Preview preference overrides document position -------------------
// Placed BEFORE E7 on purpose: E7 shrinks every node below the 104px threshold,
// so nothing appended after it can observe a rendered preview at all. E8.3
// restores the default, so E7 still runs under Auto as it always has.

/**
 * Makes `vaultPath` the MAIN node of a FRESHLY MOUNTED graph. Two reasons, both
 * load-bearing — do not inline it back into the cases:
 *
 * 1. **Explicit rebuild.** A store-only write (`setMaxNodeSizePx`) does not
 *    rebuild, and `openFile` on the ALREADY-active file is a no-op. Remounting
 *    rebuilds unconditionally, so a case never inherits its rebuild trigger from
 *    whichever case happened to run before it.
 * 2. **Re-fits the viewport.** React Flow culls off-screen nodes, `fitView` runs
 *    on MOUNT only, and in a small headless pane a late layout pass can push the
 *    MAIN node outside the viewport — where it is UNMOUNTED and no locator can
 *    see it (measured: present at mount, gone a few seconds later). Tracked in
 *    `docs-internal/tickets/ticket-e2e-headless-culling-unmounts-main-node.md`.
 *
 * Remounting is what a real user does by reopening the view.
 */
async function showNoteWithRefitGraph(vaultPath: string): Promise<void> {
	await harness.openFile(vaultPath);
	await harness.remountGraphView();
	await expect(noteNode(vaultPath)).toHaveAttribute("data-tier", "main");
}

test("with the Preview preference on Outline, an image-first note shows its outline instead", async () => {
	await showNoteWithRefitGraph(OUTLINE_COVER_PATH);
	// Precondition: E6's positional result, i.e. the thing the preference overrides.
	await expect(noteNode(OUTLINE_COVER_PATH)).toHaveAttribute("data-preview", "thumbnail");

	await harness.setNodePreviewPreference("outline");

	await expect(noteNode(OUTLINE_COVER_PATH)).toHaveAttribute("data-preview", "outline");
});

test("with the Preview preference on Image, an outline-first note shows its thumbnail instead", async () => {
	await showNoteWithRefitGraph(OUTLINE_NOTE_PATH);

	await harness.setNodePreviewPreference("image");

	await expect(noteNode(OUTLINE_NOTE_PATH)).toHaveAttribute("data-preview", "thumbnail");
});

test("with the Preview preference on Title only, a content-bearing note shows just its title", async () => {
	await showNoteWithRefitGraph(OUTLINE_NOTE_PATH);
	// Precondition (set explicitly, not inherited from a prior case): Outline gives
	// this note a preview region — the one Title only withholds — so an empty
	// content slot is the preference at work, not an empty note.
	await harness.setNodePreviewPreference("outline");
	await expect(noteNode(OUTLINE_NOTE_PATH)).toHaveAttribute("data-preview", "outline");

	await harness.setNodePreviewPreference("title-only");

	await expect(noteNode(OUTLINE_NOTE_PATH)).toHaveAttribute("data-preview", "none");
	await expect(outlineOf(OUTLINE_NOTE_PATH)).toHaveCount(0);
});

test("back on Auto, document position decides again", async () => {
	// Own your own MAIN node rather than inheriting E8.2's: an outline-bearing note
	// is what makes "position decides" observable at all.
	await showNoteWithRefitGraph(OUTLINE_NOTE_PATH);
	// Restores the shipped default IN the test body, not in afterAll: a flaky
	// failure here must not leave a dirty preference for the rest of the file.
	await harness.setNodePreviewPreference("auto");

	await expect(noteNode(OUTLINE_NOTE_PATH)).toHaveAttribute("data-preview", "outline");
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
	// A sizing write alone does not rebuild, so the new maxPx needs a rebuild to
	// take effect. Remount, rather than an active-file change: which file is active
	// here depends on whichever case ran last, and re-opening the already-active
	// one is a silent no-op.
	await showNoteWithRefitGraph(OUTLINE_NOTE_PATH);

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
