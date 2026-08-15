import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";
import type { E2eObsidianApp } from "./obsidianInternals";

/**
 * Repro spec for ticket `nid_156zg4bvhjc7nnl0gwut20bvs_e`: with the vicinity
 * graph open in the sidebar, typing Space inside a CORE CANVAS text node must
 * insert a space.
 *
 * WHY this can break at all: React Flow registers window/document-level
 * keydown handlers for its default key bindings (`panActivationKeyCode:
 * 'Space'`, `selectionKeyCode: 'Shift'`, `deleteKeyCode: 'Backspace'`,
 * zoom/multi-select modifiers) and calls `event.preventDefault()` on a match —
 * for the WHOLE app, not just the graph pane, for as long as the vicinity view
 * is mounted. This spec types into a real canvas card and asserts the space
 * survives, so a future React Flow upgrade or prop change that re-grabs a key
 * goes red here instead of silently eating keystrokes app-wide.
 */

test.describe.configure({ mode: "serial" });

const FIXTURE_FOLDER = "space-key";
const NOTE_PATH = `${FIXTURE_FOLDER}/note.md`;
const TARGET_PATH = `${FIXTURE_FOLDER}/target.md`;
const CANVAS_PATH = `${FIXTURE_FOLDER}/board.canvas`;

const EXTRA_FIXTURES: Record<string, string> = {
	[NOTE_PATH]: "Links to [[target]].\n",
	[TARGET_PATH]: "Linked from note, so note's vicinity is non-empty.\n",
	[CANVAS_PATH]: JSON.stringify({ nodes: [], edges: [] }),
};

/** What gets typed into the canvas card — the space in the middle is the assertion. */
const TYPED_TEXT = "hello world";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: EXTRA_FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	// Faithful ticket repro: the graph must be RENDERING a vicinity (not the
	// empty state) when the user moves on to the canvas.
	await harness.openFile(NOTE_PATH);
	await expect(page.locator(".vicinity-graph-node").first()).toBeVisible();
});

test.afterAll(async () => {
	await harness?.close();
});

test("WHEN typing into a canvas text node while the vicinity view is open THEN Space inserts a space", async () => {
	await harness.openFile(CANVAS_PATH);
	await expect(page.locator(".workspace-leaf.mod-active .canvas-wrapper")).toBeVisible();

	// Create the card through the canvas view's own API (the double-click
	// gesture is what a user does, but it lands on zoom-dependent pixels; the
	// API call is the same code path minus the pointer math).
	await page.evaluate(() => {
		const app = (window as unknown as { app: E2eObsidianApp }).app;
		const leaf = app.workspace.getLeavesOfType("canvas")[0];
		if (leaf === undefined) {
			throw new Error("e2e: no canvas leaf open");
		}
		leaf.view.canvas.createTextNode({ pos: { x: 0, y: 0 }, size: { width: 250, height: 120 }, text: "", focus: true, save: true });
	});

	// The card's markdown editor renders inside a CONTROLLED IFRAME — the very
	// thing that makes this bug possible: Obsidian forwards its keystrokes to
	// the MAIN document (so app hotkeys work), where the forwarded event's
	// target is not a contenteditable and React Flow's input-field exemption
	// does not apply.
	const editor = page.frameLocator(".canvas-node iframe").locator(".cm-content");
	await expect(editor).toBeVisible();
	await editor.click();

	await page.keyboard.type(TYPED_TEXT);

	// Space swallowed ⇒ "helloworld"; this asserts the space survived.
	await expect(editor).toContainText(TYPED_TEXT);
});
