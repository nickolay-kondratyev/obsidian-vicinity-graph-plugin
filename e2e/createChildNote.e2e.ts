import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";
import type { E2eObsidianApp } from "./obsidianInternals";

/**
 * Create-child-note hover chip, end-to-end through the real UI (ticket
 * `nid_rt0dyx6chv7fxae4k7q85f53l_e`). The MAIN is a FOLDER NOTE (`Jon/Jon.md`,
 * inside-style) whose folder exists, so it wears the bottom-right chip. Clicking
 * it must:
 *   1. create an empty `Jon/Untitled.md` INSIDE the owned folder, and
 *   2. open it as the active file, so the graph re-centres on it as the new MAIN.
 *
 * View-layer DOM behaviour, so it belongs in the e2e suite (jsdom cannot render a
 * real `<ReactFlow>` node's hover reveal against Obsidian's own theme CSS). A
 * descriptive frontmatter `title` widens the node so the hover chip sits clear of
 * the node's edge, the same sizing caveat `localPinScenario.e2e.ts` documents.
 */

test.describe.configure({ mode: "serial" });

const FIXTURES: Record<string, string> = {
	// `Jon/Jon.md` is the INSIDE-style folder note of the existing `Jon/` folder; it
	// links to a child so the graph has a neighbor to render around the main.
	"Jon/Jon.md": "---\ntitle: Jon folder note\n---\nFolder note — links to [[child]].\n",
	"Jon/child.md": "---\ntitle: Jon child\n---\nA child of the Jon folder.\n",
};

const MAIN = "Jon/Jon.md";
const EXPECTED_CHILD = "Jon/Untitled.md";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: FIXTURES });
	page = harness.page;
	await harness.openFile(MAIN);
	await harness.openGraphView();
	await harness.remountGraphView();
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string): Locator {
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
}

/** True when a vault file exists at `path` (live, through the real app). */
function fileExists(path: string): Promise<boolean> {
	return page.evaluate((target) => {
		const app = (window as unknown as { app: E2eObsidianApp }).app;
		return app.vault.getAbstractFileByPath(target) !== null;
	}, path);
}

/** The active file's vault path, or null. */
function activeFilePath(): Promise<string | null> {
	return page.evaluate(() => {
		const app = (window as unknown as { app: E2eObsidianApp }).app;
		return app.workspace.getActiveFile()?.path ?? null;
	});
}

test("the MAIN folder note shows the chip; clicking it creates and opens an empty child inside the folder", async () => {
	// GIVEN the folder note as MAIN, the chip is present ONLY there (a folder note whose
	// folder exists), never on the plain child neighbor.
	await expect(noteNode(MAIN)).toHaveAttribute("data-tier", "main");
	await noteNode(MAIN).hover();
	await expect(noteNode(MAIN).locator(".vicinity-graph-child-note-button")).toHaveCount(1);
	await expect(noteNode("Jon/child.md").locator(".vicinity-graph-child-note-button")).toHaveCount(0);

	// The child does not exist yet.
	expect(await fileExists(EXPECTED_CHILD)).toBe(false);

	// WHEN the chip is clicked.
	await noteNode(MAIN).locator(".vicinity-graph-child-note-button").click();

	// THEN an empty `Jon/Untitled.md` was created inside the owned folder AND opened.
	await expect.poll(() => fileExists(EXPECTED_CHILD)).toBe(true);
	await expect.poll(() => activeFilePath()).toBe(EXPECTED_CHILD);

	// AND the graph re-centres on the new note as MAIN via the active-file path.
	await expect(noteNode(EXPECTED_CHILD)).toHaveAttribute("data-tier", "main");
});
