import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { SHOW_TAGGED_NOTES_MENU_TITLE } from "../src/view/tagMenuChoice";
import { ObsidianHarness } from "./obsidianHarness";
import type { MarkdownViewMode } from "./obsidianHarness";

/**
 * The entry points INTO tag-filtered mode, end to end (tags-v1 decision 8, ticket
 * `nid_6qj8n7uc7zz126l3ix8czfymq_e`): what only a real Obsidian can prove — that
 * the right-click item shows up in Obsidian's OWN menus on each surface a tag
 * renders on, that the command's picker reaches the mode, and that a tag chip in
 * the graph switches the view. Which tag a right-click names is unit-tested
 * (`tagMenuChoice.test.ts`, `BodyHashtags.test.ts`); here each journey ends on the
 * graph showing exactly the tagged notes.
 *
 * Serial with its own Obsidian instance; every test starts back in note mode.
 * Fixtures are ROOT-level with an `ep_` prefix (wiki links resolve by basename).
 */

test.describe.configure({ mode: "serial" });

const TAG = "epentry";
const CHIP_TAG = "epchip";
const BODY_TAGGED = "ep_body.md";
const FRONTMATTER_TAGGED = "ep_front.md";
const UNTAGGED = "ep_untagged.md";

const FIXTURES: Record<string, string> = {
	[BODY_TAGGED]: `Tagged in the body: #${TAG} and #${CHIP_TAG}.\n`,
	[FRONTMATTER_TAGGED]: `---\ntags:\n  - ${TAG}\n---\nTagged in frontmatter. Links [[ep_body]].\n`,
	[UNTAGGED]: "Not tagged. Links [[ep_body]] and [[ep_front]].\n",
};

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: FIXTURES });
	page = harness.page;
	await harness.openFile(UNTAGGED);
	await harness.openGraphView();
});

test.afterAll(async () => {
	await harness?.close();
});

test.beforeEach(async () => {
	await harness.exitTagMode();
	await expect(modePill()).toContainText("Vicinity of");
});

function modePill(): Locator {
	return page.locator(".vicinity-graph-mode-pill");
}

/** The vault paths of every rendered note node, sorted (the graph's membership). */
async function renderedNotePaths(): Promise<string[]> {
	const paths = await page
		.locator(".vicinity-graph-node[data-vicinity-path]")
		.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-vicinity-path") ?? ""));
	return paths.sort();
}

async function expectGraphFilteredBy(tag: string, notes: readonly string[]): Promise<void> {
	await expect(modePill()).toContainText(`Tagged #${tag}`);
	await expect.poll(renderedNotePaths).toEqual([...notes].sort());
}

/** Obsidian's open context menu's item carrying our title. */
function showTaggedNotesItem(): Locator {
	return page.locator(".menu .menu-item", { hasText: SHOW_TAGGED_NOTES_MENU_TITLE });
}

/** The visible body hashtag `#tag` in the open editor (Live Preview and Source both render these spans). */
function editorHashtag(mode: MarkdownViewMode, tag: string): Locator {
	const view = mode === "source" ? ".markdown-source-view:not(.is-live-preview)" : ".markdown-source-view.is-live-preview";
	return page.locator(`${view} .cm-content .cm-hashtag-end`, { hasText: tag }).first();
}

for (const mode of ["live-preview", "source"] as const) {
	test(`WHEN a body #tag is right-clicked in ${mode} THEN 'show tagged notes' filters the graph by it`, async () => {
		await harness.openFileIn(BODY_TAGGED, mode);
		await editorHashtag(mode, TAG).click({ button: "right" });

		await showTaggedNotesItem().click();

		await expectGraphFilteredBy(TAG, [BODY_TAGGED, FRONTMATTER_TAGGED]);
	});
}

test("WHEN a tag is right-clicked in Reading view THEN 'show tagged notes' filters the graph by it", async () => {
	await harness.openFileIn(BODY_TAGGED, "reading");
	await page.locator(`.markdown-reading-view a.tag[href="#${TAG}"]`).click({ button: "right" });

	await showTaggedNotesItem().click();

	await expectGraphFilteredBy(TAG, [BODY_TAGGED, FRONTMATTER_TAGGED]);
});

test("WHEN a tags-property pill is right-clicked THEN the item joins Obsidian's own pill menu", async () => {
	await harness.openFileIn(FRONTMATTER_TAGGED, "live-preview");
	await page
		.locator(`.metadata-property[data-property-key="tags"] .multi-select-pill`, { hasText: TAG })
		.first()
		.click({ button: "right" });

	// ONE menu: ours rides Obsidian's (Edit / Copy / Remove), never a second one.
	await expect(page.locator(".menu")).toHaveCount(1);
	await showTaggedNotesItem().click();

	await expectGraphFilteredBy(TAG, [BODY_TAGGED, FRONTMATTER_TAGGED]);
});

test("WHEN a tag is right-clicked in the Tags pane THEN 'show tagged notes' filters the graph by it", async () => {
	await harness.openTagsPane();
	await page.locator(".tag-pane-tag", { hasText: TAG }).first().click({ button: "right" });

	await showTaggedNotesItem().click();

	await expectGraphFilteredBy(TAG, [BODY_TAGGED, FRONTMATTER_TAGGED]);
});

test("WHEN a tag is picked from the 'Show notes with tag…' command THEN the graph is filtered by it", async () => {
	await harness.executeCommand("vicinity-graph:show-notes-with-tag");
	await page.locator(".prompt-input").fill(CHIP_TAG);

	await page.locator(".prompt .suggestion-item", { hasText: `#${CHIP_TAG}` }).first().click();

	await expectGraphFilteredBy(CHIP_TAG, [BODY_TAGGED]);
});

test("WHEN a tag chip in the graph is clicked THEN the graph is filtered by that chip's tag", async () => {
	await harness.saveGlobalView({ groupingMode: "tags" });
	await harness.enterTagMode(TAG);
	await expectGraphFilteredBy(TAG, [BODY_TAGGED, FRONTMATTER_TAGGED]);

	await page.locator(`.vicinity-graph-tag-chip[data-tag="${CHIP_TAG}"]`).click();

	await expectGraphFilteredBy(CHIP_TAG, [BODY_TAGGED]);
});
