import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { EngineDefaults } from "../src/engine";
import { GROUPING_MODE_OPTION_META } from "../src/view/groupingModeMeta";
import { GROUPING_MODE_ROW_LABEL } from "../src/view/settingsRows";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Tag grouping, end to end (tags-v1 ticket `nid_lmftfz11vvfwj382i4xmmoqgf_e`, use
 * case 1 of the epic). The unit layer proves the tag grouper, the choice point and
 * the toggle's write; this file locks the journey only a real Obsidian can: the
 * graph's top-right Folders | Tags toggle reaching the store, the rebuilt canvas
 * switching from folder boxes to the owner-example tag boxes, a leftover-tag chip on
 * a note, the choice surviving a plugin reload, and the flip back restoring folder
 * boxes. No look assertions (colours are CSS over theme variables).
 *
 * Serial by design: ONE Obsidian instance on a ROOT MAIN (`tg-main.md`) whose whole
 * vicinity is these fixtures; each test hands the stored mode to the next.
 */

test.describe.configure({ mode: "serial" });

/**
 * The owner's example (tags-v1 decision 1), spread over two folders so folder mode
 * draws boxes too. Basenames carry the `tg-` prefix because wiki links resolve by
 * BASENAME across the whole `.dev-vault` copy. Tags are inline: the metadata cache
 * indexes them like frontmatter tags.
 */
const FIXTURES: Record<string, string> = {
	"tg-main.md":
		"Main links [[tg-note1]] [[tg-note2]] [[tg-note3]] [[tg-note4]] [[tg-note5]] [[tg-note6]].\n",
	"tgfa/tg-note1.md": "note1 #follow-up #important\n",
	"tgfa/tg-note2.md": "note2 #follow-up #important #vital\n",
	"tgfa/tg-note3.md": "note3 #follow-up #important #vital\n",
	"tgfb/tg-note4.md": "note4 #vital\n",
	"tgfb/tg-note5.md": "note5 #vital\n",
	"tgfb/tg-note6.md": "note6 #visit\n",
};

const MAIN_PATH = "tg-main.md";
const NOTE6_PATH = "tgfb/tg-note6.md";

/** tg-main + six notes. */
const NODE_COUNT = 7;

/** Pure link graph: one hop out, no backlinks, no folder-note hierarchy. */
const DEPTHS = { ...EngineDefaults.depthSettings(), linkDepthOut: 1, linkDepthIn: 0, descendantDepth: 0, ancestorDepth: 0 };

/** The owner-example boxes, by their `data-tags` hook (label tag keys, sorted). */
const SHARED_BOX_TAGS = "follow-up important";
const VITAL_BOX_TAGS = "vital";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	await harness.saveGlobalDepths(DEPTHS);
	await openMain();
});

test.afterAll(async () => {
	await harness?.close();
});

async function openMain(): Promise<void> {
	await harness.openFile(MAIN_PATH);
	await expect(page.locator(`.vicinity-graph-node[data-vicinity-path="${MAIN_PATH}"]`)).toHaveAttribute("data-tier", "main");
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(NODE_COUNT);
}

/** The top-right toggle — scoped to the graph corner (the controls panel has the same pill). */
function cornerToggle(): Locator {
	return page.locator(".vicinity-graph-corner").getByRole("radiogroup", { name: GROUPING_MODE_ROW_LABEL });
}

function cornerOption(mode: "folders" | "tags"): Locator {
	return cornerToggle().getByRole("radio", { name: GROUPING_MODE_OPTION_META[mode].label, exact: true });
}

function tagBox(tagKeys: string): Locator {
	return page.locator(`.vicinity-graph-group[data-tags="${tagKeys}"]`);
}

function folderBoxes(): Locator {
	return page.locator(".vicinity-graph-group[data-folder]");
}

function tagBoxes(): Locator {
	return page.locator(".vicinity-graph-group[data-tags]");
}

function chipsOf(path: string): Locator {
	return page.locator(`.react-flow__node[data-id="${path}"] .vicinity-graph-tag-chip`);
}

/**
 * Every rendered node's FLOW-space placement (React Flow's own `transform` on the node
 * wrapper — independent of pan/zoom), keyed by node id. What "the exact folder layout"
 * means for the flip-back check.
 */
async function flowPlacements(): Promise<Record<string, string>> {
	return page.locator(".vicinity-graph-flow .react-flow__node").evaluateAll((elements) =>
		Object.fromEntries(elements.map((el) => [el.getAttribute("data-id") ?? "", (el as HTMLElement).style.transform])),
	);
}

/** The folder-mode placements captured on open, compared after the flip back. */
let folderModePlacements: Record<string, string> = {};

const storedMode = async (): Promise<string> => (await harness.readGlobalView()).groupingMode;

test("WHEN the graph opens THEN it groups by folders and the corner toggle says so", async () => {
	await expect(cornerOption("folders")).toBeChecked();
	await expect(folderBoxes()).not.toHaveCount(0);
	await expect(tagBoxes()).toHaveCount(0);
	folderModePlacements = await flowPlacements();
});

test("WHEN Tags is clicked in the corner THEN the setting persists and the owner-example tag boxes replace the folder boxes", async () => {
	// `.click()`, never `.check()`: the radio is controlled off the rebuilt snapshot.
	await cornerOption("tags").click();

	await expect.poll(storedMode).toBe("tags");
	await expect(tagBox(SHARED_BOX_TAGS)).toHaveCount(1);
	// One #vital box nested in the shared box (note2, note3) and one top-level (note4, note5).
	await expect(tagBox(VITAL_BOX_TAGS)).toHaveCount(2);
	await expect(folderBoxes()).toHaveCount(0);
});

test("WHEN grouped by tags THEN a note with a single unshared tag shows it as a chip", async () => {
	await expect(chipsOf(NOTE6_PATH)).toHaveText(["#visit"]);
});

test("WHEN the graph is tag-filtered while grouped by tags THEN the corner toggle and the mode pill both render", async () => {
	await harness.enterTagMode("#vital");

	await expect(page.locator(".vicinity-graph-mode-pill")).toContainText("Tagged #vital");
	await expect(cornerOption("tags")).toBeChecked();

	// Cleanup, not an assertion: hand the next test a note-mode view on the MAIN again.
	await page.locator(".vicinity-graph-mode-pill").getByRole("button", { name: "Back to active note" }).click();
	await expect(page.locator(`.vicinity-graph-node[data-vicinity-path="${MAIN_PATH}"]`)).toHaveAttribute("data-tier", "main");
});

test("WHEN the plugin restarts THEN the graph still groups by tags", async () => {
	await harness.reloadPlugin();
	await harness.remountGraphView();
	await openMain();

	await expect(cornerOption("tags")).toBeChecked();
	await expect(tagBox(SHARED_BOX_TAGS)).toHaveCount(1);
});

test("WHEN Folders is clicked in the corner THEN folder boxes come back and the tag boxes and chips go", async () => {
	await cornerOption("folders").click();

	await expect.poll(storedMode).toBe("folders");
	await expect(folderBoxes()).not.toHaveCount(0);
	await expect(tagBoxes()).toHaveCount(0);
	await expect(chipsOf(NOTE6_PATH)).toHaveCount(0);
});

test("WHEN flipped back to Folders THEN every node sits exactly where the folder layout first put it", async () => {
	await expect.poll(flowPlacements).toEqual(folderModePlacements);
});
