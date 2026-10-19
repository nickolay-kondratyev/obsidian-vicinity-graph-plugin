import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";
import type { E2eObsidianApp } from "./obsidianInternals";
import { nodeChip } from "./nodeChips";

/**
 * The hover SIDE RAIL, against a real Obsidian: a note's hover chips (global pin,
 * local pin, gear) sit OUTSIDE the node, in one column down its right side, and an
 * invisible hover zone spanning node + column keeps them revealed while the pointer
 * travels from the node to them. Asserted on a SMALL node (a title-only neighbour at
 * the shipped minimum size), where chips drawn on top of the node used to leave
 * little of it to click — and where the column runs past the node's bottom, which
 * is the longest trip the pointer has to make.
 *
 * What jsdom cannot see and this suite does: real layout (the column's position),
 * real `:hover` (the zone holding the reveal on the way), and real hit-testing (a
 * click on the zone's margin swallowed, a chip click reaching the chip).
 *
 * SERIAL and order-dependent: each test states the GIVEN it inherits.
 */

test.describe.configure({ mode: "serial" });

/** `rail_`-prefixed basenames: link resolution is basename-first, so these never hit dev-vault notes. */
const SCENARIO_FIXTURES: Record<string, string> = {
	"rail_hub.md": "Side-rail MAIN — links out to [[rail_leaf]].\n",
	"rail_leaf.md": "Leaf.\n",
};

const HUB = "rail_hub.md";
const LEAF = "rail_leaf.md";

/** Interpolation steps for a pointer trip — enough intermediate moves that a gap in the hover area would be crossed. */
const POINTER_TRAVEL_STEPS = 12;
/** How far past the node a pointer must go to be "well outside" the hover zone (zone pad is 8px, chips 20px). */
const WELL_OUTSIDE_PX = 120;
/** A point just right of the column — inside the zone's right margin, but on no chip. */
const ZONE_MARGIN_PROBE_PX = 4;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, ".out");
const SCREENSHOT_PATH = path.join(OUT_DIR, "node-chip-side-rail-hovered.png");
/** Breathing room around the node + column in the screenshot. */
const SCREENSHOT_MARGIN_PX = 40;

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

function noteNode(notePath: string): Locator {
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${notePath}"]`);
}

function actionsColumn(notePath: string): Locator {
	return noteNode(notePath).locator("xpath=..").locator(".vicinity-graph-node-actions");
}

/** The LOWEST chip of a regular node's column (global pin, local pin, gear). */
function leafGear(): Locator {
	return nodeChip(noteNode(LEAF), "button.vicinity-graph-gear-button");
}

interface ScreenBox {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

async function screenBox(locator: Locator, subject: string): Promise<ScreenBox> {
	const box = await locator.boundingBox();
	if (box === null) {
		throw new Error(`${subject} has no bounding box`);
	}
	return box;
}

const centreOf = (box: ScreenBox) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** The chip's computed opacity — the reveal itself (the hidden chip is still laid out). */
async function opacityOf(locator: Locator): Promise<string> {
	return locator.evaluate((el) => getComputedStyle(el).opacity);
}

const activeFilePath = () =>
	page.evaluate(() => (window as unknown as { app: E2eObsidianApp }).app.workspace.getActiveFile()?.path);

/** Puts the pointer on the leaf node's centre, revealing its rail. */
async function hoverLeafCentre(): Promise<void> {
	const node = centreOf(await screenBox(noteNode(LEAF), "the leaf node"));
	await page.mouse.move(node.x, node.y);
	await expect.poll(() => opacityOf(leafGear())).toBe("1");
}

/** Walks the pointer from the leaf's centre to the gear's centre in small steps, like a hand would. */
async function travelToLeafGear(): Promise<void> {
	await hoverLeafCentre();
	const gear = centreOf(await screenBox(leafGear(), "the leaf's gear chip"));
	await page.mouse.move(gear.x, gear.y, { steps: POINTER_TRAVEL_STEPS });
}

test("WHEN a small node is hovered THEN its chip column sits right of the node's right edge", async () => {
	await hoverLeafCentre();
	const node = await screenBox(noteNode(LEAF), "the leaf node");
	const column = await screenBox(actionsColumn(LEAF), "the leaf's chip column");
	expect(column.x).toBeGreaterThan(node.x + node.width);
});

test("WHEN a small node is hovered THEN its column runs past the node's bottom (the longest pointer trip)", async () => {
	// The GIVEN the travel test below relies on: the lowest chip is BELOW the node,
	// so reaching it means leaving the node box entirely.
	await hoverLeafCentre();
	const node = await screenBox(noteNode(LEAF), "the leaf node");
	const gear = await screenBox(leafGear(), "the leaf's gear chip");
	expect(gear.y + gear.height).toBeGreaterThan(node.y + node.height);
});

test("WHEN the pointer travels from the node to its LOWEST chip THEN that chip stays revealed", async () => {
	await travelToLeafGear();
	expect(await opacityOf(leafGear())).toBe("1");
});

test("WHEN the rail is revealed THEN a screenshot of it is captured for human review", async () => {
	await travelToLeafGear();
	const node = await screenBox(noteNode(LEAF), "the leaf node");
	const column = await screenBox(actionsColumn(LEAF), "the leaf's chip column");
	fs.mkdirSync(OUT_DIR, { recursive: true });
	await page.screenshot({
		path: SCREENSHOT_PATH,
		clip: {
			x: node.x - SCREENSHOT_MARGIN_PX,
			y: node.y - SCREENSHOT_MARGIN_PX,
			width: column.x + column.width - node.x + 2 * SCREENSHOT_MARGIN_PX,
			height: Math.max(node.height, column.y + column.height - node.y) + 2 * SCREENSHOT_MARGIN_PX,
		},
	});
	expect(fs.existsSync(SCREENSHOT_PATH)).toBe(true);
});

test("WHEN the zone's margin beside the column is clicked THEN the note is NOT opened", async () => {
	await travelToLeafGear();
	const column = await screenBox(actionsColumn(LEAF), "the leaf's chip column");
	const before = await activeFilePath();
	await page.mouse.move(column.x + column.width + ZONE_MARGIN_PROBE_PX, column.y + column.height / 2, {
		steps: POINTER_TRAVEL_STEPS,
	});
	await page.mouse.down();
	await page.mouse.up();
	// A click that DID reach the node would focus it: re-centre the graph on the leaf
	// (its tier flips to MAIN) and open it. The forced refresh drains the rebuild
	// queue, so a focus that did happen shows up (same settle as nodeResize.e2e.ts).
	await harness.refreshOpenViews();
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");
	expect(await activeFilePath()).toBe(before);
});

test("WHEN the pointer moves well outside the zone THEN the chips hide again", async () => {
	await travelToLeafGear();
	const column = await screenBox(actionsColumn(LEAF), "the leaf's chip column");
	await page.mouse.move(column.x + column.width + WELL_OUTSIDE_PX, column.y + column.height + WELL_OUTSIDE_PX, {
		steps: POINTER_TRAVEL_STEPS,
	});
	await expect.poll(() => opacityOf(leafGear())).toBe("0");
});

// LAST on purpose: it leaves the gear menu open, and nothing after it has to
// dismiss it (an Escape right after the menu appears proved racy).
test("WHEN the pointer travels to the lowest chip and clicks it THEN it does its job (the gear opens its menu)", async () => {
	await travelToLeafGear();
	// mouse.down/up at the CURRENT position, not locator.click(): click() would move
	// the pointer itself and so would not prove the travelled path kept the reveal.
	await page.mouse.down();
	await page.mouse.up();
	await expect(page.locator(".menu .menu-item").first()).toBeVisible();
});
