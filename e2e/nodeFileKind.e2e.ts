import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * CANVAS vs NOTE at a glance, against a real Obsidian: a `.canvas` node carries the
 * canvas glyph before its title, a markdown note carries none. The fixture is the
 * exact ambiguity the marker exists for — a note and a canvas sharing ONE basename,
 * so their titles are identical and only the marker tells them apart.
 *
 * What jsdom cannot see and this suite does: the glyph Obsidian's `setIcon` really
 * draws, and that the marker never pushes a short title onto a second line (the
 * node width estimate budgets the glyph).
 *
 * SERIAL: every test reads the one graph opened in `beforeAll`.
 */

test.describe.configure({ mode: "serial" });

/** `kind_`-prefixed basenames: link resolution is basename-first, so these never hit dev-vault notes. */
const HUB = "kind_hub.md";
const TWIN_NOTE = "kind_plan.md";
const TWIN_CANVAS = "kind_plan.canvas";

const SCENARIO_FIXTURES: Record<string, string> = {
	[HUB]: "File-kind MAIN — links the note [[kind_plan]] and the canvas [[kind_plan.canvas]].\n",
	[TWIN_NOTE]: "A note sharing its basename with a canvas.\n",
	[TWIN_CANVAS]: JSON.stringify({
		nodes: [{ id: "t1", type: "text", text: "A canvas sharing its basename with a note.", x: 0, y: 0, width: 300, height: 100 }],
		edges: [],
	}),
};

/** The marker element — the one hook the CSS and this suite share. */
const KIND_ICON_SELECTOR = ".vicinity-graph-node__kind-icon";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, ".out");
const SCREENSHOT_PATH = path.join(OUT_DIR, "node-file-kind-canvas-vs-note.png");
const CANVAS_MAIN_DARK_SCREENSHOT_PATH = path.join(OUT_DIR, "node-file-kind-canvas-main-dark.png");

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: SCENARIO_FIXTURES });
	page = harness.page;
	await harness.openFile(HUB);
	await harness.openGraphView();
	await expect(noteNode(TWIN_CANVAS)).toBeVisible();
	await expect(noteNode(TWIN_NOTE)).toBeVisible();
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(notePath: string): Locator {
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${notePath}"]`);
}

function titleOf(notePath: string): Locator {
	return noteNode(notePath).locator(".vicinity-graph-node__title");
}

test("WHEN the graph shows a note and a canvas THEN a screenshot is captured for human review", async () => {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	await page.locator(".vicinity-graph-flow").screenshot({ path: SCREENSHOT_PATH });
	expect(fs.existsSync(SCREENSHOT_PATH)).toBe(true);
});

test("WHEN a canvas is in the graph THEN its title carries the canvas glyph", async () => {
	await expect(titleOf(TWIN_CANVAS).locator(`${KIND_ICON_SELECTOR} svg.lucide-layout-dashboard`)).toHaveCount(1);
});

test("WHEN a markdown note is in the graph THEN its title carries no file-kind marker", async () => {
	await expect(titleOf(TWIN_NOTE).locator(KIND_ICON_SELECTOR)).toHaveCount(0);
});

test("WHEN a canvas has a short title THEN the glyph keeps it on ONE line", async () => {
	const lineHeightPx = await titleOf(TWIN_CANVAS).evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
	const box = await titleOf(TWIN_CANVAS).boundingBox();
	expect(box?.height).toBeLessThan(2 * lineHeightPx);
});

test("WHEN a canvas is the MAIN in the dark theme THEN a screenshot is captured for human review", async () => {
	// LAST on purpose: it re-centres the graph on the canvas and flips the theme,
	// which every test above must not inherit.
	await harness.setTheme("dark");
	await harness.openFile(TWIN_CANVAS);
	await expect(noteNode(TWIN_CANVAS)).toHaveAttribute("data-tier", "main");
	await page.locator(".vicinity-graph-flow").screenshot({ path: CANVAS_MAIN_DARK_SCREENSHOT_PATH });
	expect(fs.existsSync(CANVAS_MAIN_DARK_SCREENSHOT_PATH)).toBe(true);
});
