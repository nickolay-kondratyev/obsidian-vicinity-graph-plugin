import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Per-node CONTENT override e2e (ticket nid_9hx6okamx3yt0rg9iad2f4151_e): the
 * hover gear at a node's top-right opens a small menu whose Content row
 * [Inherit | Title only | Outline | Image] overrides that ONE doc globally.
 * Asserted end-to-end, against a REAL Obsidian:
 * - the gear opens a native menu offering every content choice;
 * - choosing a value persists it as the docid-keyed override AND flips the node's
 *   rendered `data-preview` (a data-only refresh — the box does not relayout);
 * - Inherit REMOVES the stored entry (never stores a value) and the node returns
 *   to the global preference;
 * - the override applies from ANY central (global by docid, like a pin).
 *
 * The target is outline-only (a heading, no image): under the shipped `auto`
 * default an ordinary neighbour shows neither region, so Inherit reads
 * `data-preview="none"` and an Outline override reads `data-preview="outline"` —
 * a change visible in the DOM without needing a binary image fixture.
 *
 * SERIAL and order-dependent: each test builds on the state above it.
 */

test.describe.configure({ mode: "serial" });

/**
 * The target carries a seeded `id` so the override's docid is deterministic for
 * the store assertions (an id-less note would first get frontmatter written —
 * real behavior, but non-deterministic here).
 */
const SCENARIO_FIXTURES: Record<string, string> = {
	"co_hub.md": "Content MAIN — links out to [[co_target]].\n",
	"co_target.md": "---\nid: docid_contenttarget_e\n---\n## Section\n\nThe node whose content is overridden.\n",
	"co_other.md": "Second MAIN — also links out to [[co_target]].\n",
};

const HUB = "co_hub.md";
const OTHER_MAIN = "co_other.md";
const TARGET = "co_target.md";
const TARGET_DOCID = "docid_contenttarget_e";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: SCENARIO_FIXTURES });
	page = harness.page;
	await harness.openFile(HUB);
	await harness.openGraphView();
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string): Locator {
	return page.locator(`.vicinity-graph-node[data-path="${path}"]`);
}

/**
 * Opens the gear menu for a node: hover to reveal the chip, then click it.
 *
 * Wrapped in `toPass` because the reveal is a two-part CSS state: the gear is
 * `pointer-events: none` until its node is `:hover`ed, and `click()`'s hit-test
 * only passes while the cursor still sits over the node. A trailing debounced
 * rebuild's `fitView` can nudge the node out from under the fixed-coordinate
 * cursor BETWEEN the hover and the click — dropping `:hover`, re-hiding the gear,
 * and stalling the click (the mouse won't move again until actionability passes).
 * Re-hovering each attempt re-establishes `:hover` at the node's CURRENT position;
 * `toPass` stops at the first successful click, so the menu opens exactly once.
 */
async function openGearMenu(path: string): Promise<void> {
	await expect(async () => {
		await noteNode(path).hover();
		await noteNode(path).locator("button.vicinity-graph-gear-button").click({ timeout: 2_000 });
	}).toPass();
}

/** Opens the gear menu and chooses one content option by its label. */
async function chooseContent(path: string, label: string): Promise<void> {
	await openGearMenu(path);
	await page.locator(".menu .menu-item", { hasText: label }).click();
}

async function storedContent(): Promise<string | undefined> {
	return (await harness.readNodeOverrides())[TARGET_DOCID]?.content;
}

async function targetPreview(): Promise<string | null> {
	return noteNode(TARGET).getAttribute("data-preview");
}

test("WHEN the gear is clicked THEN it opens a menu offering every content choice", async () => {
	await openGearMenu(TARGET);
	for (const label of ["Inherit", "Title only", "Outline", "Image"]) {
		await expect(page.locator(".menu .menu-item", { hasText: label })).toBeVisible();
	}
	await page.keyboard.press("Escape");
});

test("WHEN Outline is chosen THEN it persists as the doc's content override and the node renders its outline", async () => {
	await chooseContent(TARGET, "Outline");
	await expect.poll(storedContent).toBe("outline");
	await expect.poll(targetPreview).toBe("outline");
});

test("WHEN Title only is chosen THEN it persists that value (the choice this ticket added) and the node shows neither region", async () => {
	await chooseContent(TARGET, "Title only");
	await expect.poll(storedContent).toBe("title-only");
	await expect.poll(targetPreview).toBe("none");
});

test("WHEN Inherit is chosen THEN the stored entry is REMOVED and the node returns to the global preference", async () => {
	await chooseContent(TARGET, "Inherit");
	await expect.poll(async () => (await harness.readNodeOverrides())[TARGET_DOCID]).toBeUndefined();
	// Back to the global `auto`: an ordinary neighbour with only an outline shows nothing.
	await expect.poll(targetPreview).toBe("none");
});

test("WHEN the central switches to another note THEN a chosen override still applies (global by docid)", async () => {
	await chooseContent(TARGET, "Outline");
	await expect.poll(storedContent).toBe("outline");
	await harness.openFile(OTHER_MAIN);
	await expect(noteNode(OTHER_MAIN)).toHaveAttribute("data-tier", "main");
	await expect.poll(targetPreview).toBe("outline");
});
