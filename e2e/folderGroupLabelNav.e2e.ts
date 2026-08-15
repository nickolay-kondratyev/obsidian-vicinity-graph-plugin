import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { EngineDefaults } from "../src/engine";
import type { E2eObsidianApp } from "./obsidianInternals";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Clickable folder-group label e2e (ticket `nid_2pobjyfp5zgspx283bfukaugn_e`):
 * real Obsidian proves the two ends the unit layer cannot — a label whose folder
 * has a folder-note candidate NAVIGATES there on a real pointer click (the
 * candidate being a note the graph never discovered, R3), and a candidate-less
 * label is INERT (no affordance class, a click changes nothing). The candidate
 * LIST is unit-tested in `FolderNotes.test.ts`; the 0/1/many click dispatch in
 * `FolderGroupNode.component.test.tsx`.
 *
 * Serial by design: ONE Obsidian instance opened on `fgl-main.md`, whose whole
 * vicinity is these fixtures. The INERT test runs FIRST — the navigating test
 * re-centres MAIN and is therefore last.
 */

test.describe.configure({ mode: "serial" });

/**
 * Two 2-member groups reachable from `fgl-main` at outgoing depth 1:
 *
 *   withnote/  (group; SIBLING folder note `withnote.md` exists but is NOT
 *              linked from anything, so it is never a graph node — R3)
 *   nonote/    (group; no folder-note candidate at all — the inert label)
 */
const LABEL_FIXTURES: Record<string, string> = {
	"fgl-main.md": "Main links [[w1]] [[w2]] [[n1]] [[n2]].\n",
	"withnote/w1.md": "w1 has no outgoing links.\n",
	"withnote/w2.md": "w2 has no outgoing links.\n",
	"withnote.md": "The folder note of withnote/ — undiscovered by the graph.\n",
	"nonote/n1.md": "n1 has no outgoing links.\n",
	"nonote/n2.md": "n2 has no outgoing links.\n",
};

const MAIN_PATH = "fgl-main.md";
const FOLDER_NOTE_PATH = "withnote.md";

/**
 * Outgoing depth 1 reaches every member. Folder-note hierarchy channels are OFF
 * (descendant/ancestor 0) so `withnote.md` stays UNDISCOVERED — the click must
 * work for a candidate that is not a rendered node (R3).
 */
const LABEL_DEPTHS = {
	...EngineDefaults.depthSettings(),
	linkDepthOut: 1,
	descendantDepth: 0,
	ancestorDepth: 0,
};

/** fgl-main (central) + w1,w2,n1,n2. */
const FULL_NODE_COUNT = 5;

const NAVIGABLE_LABEL_CLASS = "vicinity-graph-group__label--navigable";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: LABEL_FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	await harness.saveGlobalDepths(LABEL_DEPTHS);
	await harness.openFile(MAIN_PATH);
	await expect(noteNode(MAIN_PATH)).toHaveAttribute("data-tier", "main");
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(FULL_NODE_COUNT);
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string): Locator {
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
}

function groupLabel(folder: string): Locator {
	return page.locator(`.vicinity-graph-group[data-folder="${folder}"] .vicinity-graph-group__label`);
}

const activeFilePath = () =>
	page.evaluate(() => (window as unknown as { app: E2eObsidianApp }).app.workspace.getActiveFile()?.path);

// --- (1) no candidates: the label is inert ----------------------------------

test("a group whose folder has no folder-note candidate keeps an inert label", async () => {
	const label = groupLabel("nonote");
	await expect(label).toHaveText("nonote");
	// No affordance: the navigable modifier (pointer cursor + hover accent) is absent…
	await expect(label).not.toHaveClass(new RegExp(NAVIGABLE_LABEL_CLASS));
	// …and a real click changes nothing: MAIN stays put and no note opens.
	await label.click();
	await expect(noteNode(MAIN_PATH)).toHaveAttribute("data-tier", "main");
	await expect.poll(activeFilePath).toBe(MAIN_PATH);
});

// --- (2) one candidate: the label navigates to an UNDISCOVERED note ----------

test("clicking a group label with one candidate opens that folder note and re-centres the graph on it", async () => {
	// The candidate is NOT a rendered node — navigation must not require discovery (R3).
	await expect(noteNode(FOLDER_NOTE_PATH)).toHaveCount(0);
	const label = groupLabel("withnote");
	await expect(label).toHaveClass(new RegExp(NAVIGABLE_LABEL_CLASS));
	await harness.remountGraphView(); // refit so the label is physically clickable
	await groupLabel("withnote").click();
	// The folder note opened in the current tab and the graph rebuilt around it.
	await expect.poll(activeFilePath).toBe(FOLDER_NOTE_PATH);
	await expect(noteNode(FOLDER_NOTE_PATH)).toHaveAttribute("data-tier", "main");
});
