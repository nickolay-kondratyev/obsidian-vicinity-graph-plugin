import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Regression e2e for ticket nid_q3rscvfkznktgu1cqyybp54v1_e: renaming the note a
 * graph is centered on used to collapse the pane to "No vicinity graph for the
 * active file" — a rename fires `vault.on('rename')` but NEITHER `file-open` NOR
 * `active-leaf-change`, so the view kept building against the old (now missing)
 * path. The fix re-points MAIN at the new path and rebuilds. This drives the REAL
 * Obsidian rename API so the whole event wiring (view → controller → engine) is
 * exercised end to end — `npm test` cannot reach it (the rename listener lives on
 * the obsidian ItemView).
 */

test.describe.configure({ mode: "serial" });

const ALPHA_PATH = "projects/alpha.md";
const ALPHA_RENAMED_PATH = "projects/alpha-renamed.md";
/** alpha-focused vicinity: alpha (MAIN) + beta + note1 (mirrors vicinityGraph.e2e.ts). */
const ALPHA_NODE_COUNT = 3;

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch();
	page = harness.page;
	await harness.openGraphView();
	await harness.openFile(ALPHA_PATH);
	await expect(noteNode(ALPHA_PATH)).toHaveAttribute("data-tier", "main");
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string) {
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
}

test("renaming the active note re-centers the graph on the new path instead of emptying", async () => {
	await harness.renameFile(ALPHA_PATH, ALPHA_RENAMED_PATH);

	// The still-open note is the graph's MAIN under its NEW path…
	await expect(noteNode(ALPHA_RENAMED_PATH)).toHaveAttribute("data-tier", "main");
	// …the same vicinity is rendered (not the empty state), and the stale path is gone.
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(ALPHA_NODE_COUNT);
	await expect(page.locator(".vicinity-graph-empty")).toHaveCount(0);
	await expect(noteNode(ALPHA_PATH)).toHaveCount(0);
});
