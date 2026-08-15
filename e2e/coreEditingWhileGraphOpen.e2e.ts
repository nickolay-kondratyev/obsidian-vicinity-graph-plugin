import { expect, test } from "@playwright/test";
import type { FrameLocator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";
import type { E2eObsidianApp } from "./obsidianInternals";

/**
 * Broadens the single-case repro of `canvasSpaceKey.e2e.ts` (ticket
 * `nid_5f1o7z2iyis3sgbbpeu7j8oor_e`): with the vicinity graph mounted and
 * RENDERING a non-empty vicinity, CORE editing keystrokes must keep working
 * everywhere — not just Space in a canvas card.
 *
 * WHY this whole family can break at once: React Flow registers
 * window/document-level keydown handlers for its default key bindings
 * (`panActivationKeyCode: 'Space'`, `selectionKeyCode: 'Shift'`,
 * `deleteKeyCode: 'Backspace'`, zoom/multi-select modifiers) and
 * `preventDefault()`s a match for the WHOLE app for as long as the view is
 * mounted — its input-field exemption does NOT cover keystrokes Obsidian
 * forwards from controlled iframes (canvas cards). The fix nulls every binding
 * (`src/view/reactFlowKeyBindings.ts`); these specs assert the user-visible
 * consequence so a future RF upgrade or prop change that re-grabs a key goes red
 * here instead of silently eating keystrokes app-wide.
 *
 * Coverage beyond the Space repro:
 * - Canvas text node: Shift (capitals) + Space + Backspace all survive.
 * - Canvas node DELETION with Backspace AND Delete still works (RF's
 *   `deleteKeyCode` must not grab either) — including a node reached AFTER
 *   navigating to the canvas with the view already open (the original repro
 *   emphasised the navigation step).
 * - Markdown note editing in the MAIN pane: Space, Shift, Backspace.
 * - A generic guard: no window/document keydown listener `preventDefault()`s a
 *   plain typing / editing key while the view is mounted.
 */

test.describe.configure({ mode: "serial" });

const FIXTURE_FOLDER = "core-edit";
const NOTE_PATH = `${FIXTURE_FOLDER}/note.md`;
const TARGET_PATH = `${FIXTURE_FOLDER}/target.md`;
const CANVAS_PATH = `${FIXTURE_FOLDER}/board.canvas`;

const EXTRA_FIXTURES: Record<string, string> = {
	[NOTE_PATH]: "Links to [[target]].\n",
	[TARGET_PATH]: "Linked from note, so note's vicinity is non-empty.\n",
	[CANVAS_PATH]: JSON.stringify({ nodes: [], edges: [] }),
};

/**
 * Mixed-case + space + a word to erase: capitals exercise Shift
 * (`selectionKeyCode`), the middle space exercises `panActivationKeyCode`, and
 * the trailing word is what Backspace deletes.
 */
const TYPED_TEXT = "Hello World";
/** {@link TYPED_TEXT} with "World" and its leading space removed by 6 Backspaces. */
const TEXT_AFTER_BACKSPACES = "Hello";
const BACKSPACE_COUNT = "World ".length;

/** Editing keys RF binds by default — the generic guard's alphabet, plus a plain letter. */
const EDITING_KEYS: readonly { readonly key: string; readonly code: string }[] = [
	{ key: " ", code: "Space" },
	{ key: "Backspace", code: "Backspace" },
	{ key: "Delete", code: "Delete" },
	{ key: "Shift", code: "ShiftLeft" },
	{ key: "Control", code: "ControlLeft" },
	{ key: "Meta", code: "MetaLeft" },
	{ key: "a", code: "KeyA" },
];

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: EXTRA_FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	// Faithful ticket repro: the graph must be RENDERING a vicinity (not the
	// empty state) throughout — assert a real node is on screen.
	await harness.openFile(NOTE_PATH);
	await expect(page.locator(".vicinity-graph-node").first()).toBeVisible();
});

test.afterAll(async () => {
	await harness?.close();
});

/** Opens the canvas as the active file and waits for its wrapper to mount. */
async function openCanvas(): Promise<void> {
	await harness.openFile(CANVAS_PATH);
	await expect(page.locator(".workspace-leaf.mod-active .canvas-wrapper")).toBeVisible();
}

/**
 * Creates a canvas text node through the canvas view's own API (the double-click
 * gesture lands on zoom-dependent pixels; this is the same code path minus the
 * pointer math) and returns its id.
 */
async function createCanvasTextNode(options: { focus: boolean }): Promise<string> {
	return page.evaluate((focus) => {
		const app = (window as unknown as { app: E2eObsidianApp }).app;
		const leaf = app.workspace.getLeavesOfType("canvas")[0];
		if (leaf === undefined) {
			throw new Error("e2e: no canvas leaf open");
		}
		const node = leaf.view.canvas.createTextNode({ pos: { x: 0, y: 0 }, size: { width: 250, height: 120 }, text: "", focus, save: true });
		return node.id;
	}, options.focus);
}

/** Current node count of the (single) open canvas. */
async function canvasNodeCount(): Promise<number> {
	return page.evaluate(() => {
		const app = (window as unknown as { app: E2eObsidianApp }).app;
		const leaf = app.workspace.getLeavesOfType("canvas")[0];
		if (leaf === undefined) {
			throw new Error("e2e: no canvas leaf open");
		}
		return leaf.view.canvas.nodes.size;
	});
}

/**
 * Selects the node with `id` through the canvas' OWN selection API — the same
 * `selectOnly` a click ultimately calls, minus the pointer math the pixel click
 * cannot land (a `.canvas-node-content-blocker` overlays the body). Then moves
 * keyboard focus to the canvas wrapper (OUT of any card iframe still holding it),
 * so the subsequent REAL Backspace/Delete reaches the canvas' keydown handler —
 * the exact path RF's `deleteKeyCode` would have hijacked window-wide.
 */
async function selectCanvasNodeForKeyboard(id: string): Promise<void> {
	await page.evaluate((nodeId) => {
		const app = (window as unknown as { app: E2eObsidianApp }).app;
		const leaf = app.workspace.getLeavesOfType("canvas")[0];
		if (leaf === undefined) {
			throw new Error("e2e: no canvas leaf open");
		}
		const canvasObj = leaf.view.canvas;
		const node = canvasObj.nodes.get(nodeId);
		if (!node) {
			throw new Error(`e2e: canvas node not found: id=[${nodeId}]`);
		}
		canvasObj.selectOnly(node);
		canvasObj.wrapperEl.focus();
	}, id);
}

/** Creates a node, selects it, deletes it with `key`, and asserts the count dropped by one. */
async function expectNodeDeletableWith(key: "Backspace" | "Delete"): Promise<void> {
	const before = await canvasNodeCount();
	const id = await createCanvasTextNode({ focus: false });
	await expect.poll(() => canvasNodeCount()).toBe(before + 1);

	await selectCanvasNodeForKeyboard(id);
	await page.keyboard.press(key);

	await expect.poll(() => canvasNodeCount()).toBe(before);
}

/**
 * The markdown editor inside the focused canvas card — a CONTROLLED IFRAME.
 * Obsidian forwards its keystrokes to the MAIN document (so app hotkeys work),
 * where the forwarded event's target is not a contenteditable and RF's
 * input-field exemption does not apply: the very condition that made the Space
 * bug possible.
 */
function focusedCardEditor(): FrameLocator {
	return page.frameLocator(".canvas-node.is-focused iframe, .canvas-node iframe");
}

test("WHEN typing into a canvas text node THEN Shift capitals and Space both survive", async () => {
	await openCanvas();
	await createCanvasTextNode({ focus: true });

	const editor = focusedCardEditor().locator(".cm-content");
	await expect(editor).toBeVisible();
	await editor.click();
	await page.keyboard.type(TYPED_TEXT);

	// Space swallowed ⇒ "HelloWorld"; a dropped Shift ⇒ lowercased. Exact match
	// asserts every keystroke landed.
	await expect(editor).toHaveText(TYPED_TEXT);
});

test("WHEN Backspacing in a canvas text node THEN the characters are deleted", async () => {
	// Continues from the previous card (serial): erase the trailing word.
	const editor = focusedCardEditor().locator(".cm-content");
	await editor.click();
	for (let i = 0; i < BACKSPACE_COUNT; i++) {
		await page.keyboard.press("Backspace");
	}

	await expect(editor).toHaveText(TEXT_AFTER_BACKSPACES);
});

test("WHEN a selected canvas node is Backspaced THEN it is deleted (RF deleteKeyCode must not grab it)", async () => {
	await expectNodeDeletableWith("Backspace");
});

test("WHEN a selected canvas node is Deleted THEN it is deleted (RF must not have grabbed Delete either)", async () => {
	await expectNodeDeletableWith("Delete");
});

test("WHEN editing a markdown note in the main pane THEN Space, Shift and Backspace all work", async () => {
	// Re-navigate to the note (the original repro emphasised NAVIGATING with the
	// view already open); it opens in a main-area leaf, graph stays mounted.
	await harness.openFile(NOTE_PATH);
	const editor = page.locator(".workspace-leaf.mod-active .markdown-source-view .cm-content");
	await expect(editor).toBeVisible();

	// Type onto a fresh trailing line so the assertion is independent of the
	// note's seeded body.
	await editor.click();
	await page.keyboard.press("Control+End");
	await page.keyboard.press("Enter");
	await page.keyboard.type(TYPED_TEXT);
	await expect(editor).toContainText(TYPED_TEXT);

	for (let i = 0; i < BACKSPACE_COUNT; i++) {
		await page.keyboard.press("Backspace");
	}
	await expect(editor).toContainText(TEXT_AFTER_BACKSPACES);
	await expect(editor).not.toContainText(TYPED_TEXT);
});

test("WHILE the view is mounted no window/document keydown handler preventDefaults a plain editing key", async () => {
	// The vicinity graph is still mounted (assert its canvas is present), so any
	// re-grabbed RF binding would be live right now.
	await expect(page.locator(".vicinity-graph-flow")).toBeAttached();

	const prevented = await page.evaluate((keys) => {
		const outcome: Record<string, boolean> = {};
		for (const { key, code } of keys) {
			// Dispatched on document.body so it bubbles to the document- and
			// window-level listeners RF installs; cancelable so a listener CAN
			// preventDefault it — the assertion is that none does.
			const event = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true });
			document.body.dispatchEvent(event);
			outcome[code] = event.defaultPrevented;
		}
		return outcome;
	}, EDITING_KEYS);

	const grabbed = Object.entries(prevented)
		.filter(([, wasPrevented]) => wasPrevented)
		.map(([code]) => code);
	expect(grabbed).toEqual([]);
});
