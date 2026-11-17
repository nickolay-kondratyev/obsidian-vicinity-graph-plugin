import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { nodeChip } from "./nodeChips";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Tag-filtered graph mode, end to end against a real Obsidian (tags-v1 decisions
 * 9-12): the journey the unit suite cannot reach — the plugin's public
 * `enterTagMode`, the real metadata cache answering "which notes carry this tag",
 * the status pill's exit, and the mode riding the leaf's saved view state through
 * a restart.
 *
 * Serial with its own Obsidian instance: each test's GIVEN is the mode the
 * previous one left the view in (enter → stays → survives restart → exit).
 *
 * Fixtures are e2e-only and ROOT-level. The tag is carried three ways — a body
 * hashtag, a frontmatter tag, and a NESTED child tag — and one note links a
 * tagged note WITHOUT carrying the tag, so "tagged" and "linked" disagree.
 */

test.describe.configure({ mode: "serial" });

const TAG = "#tagmodetopic";
const HUB = "tm_hub.md";
const BODY_TAGGED = "tm_body.md";
const FRONTMATTER_TAGGED = "tm_front.md";
const NESTED_TAGGED = "tm_nested.md";
const UNTAGGED_LINKER = "tm_untagged.md";
const TAGGED_NOTES = [BODY_TAGGED, FRONTMATTER_TAGGED, NESTED_TAGGED];

const TAG_MODE_FIXTURES: Record<string, string> = {
	[HUB]: "Hub — not tagged. Links [[tm_body]] and [[tm_untagged]].\n",
	[BODY_TAGGED]: "Tagged in the body: #tagmodetopic. Links [[tm_front]].\n",
	[FRONTMATTER_TAGGED]: "---\ntags:\n  - tagmodetopic\n---\nTagged in frontmatter.\n",
	[NESTED_TAGGED]: "Carries the nested child tag #tagmodetopic/deep and links nothing.\n",
	[UNTAGGED_LINKER]: "Not tagged, but links [[tm_body]].\n",
};

/** Keeps the two tagged notes that link each other; the unlinked nested one is truncated. */
const MOST_LINKED_CAP = 2;
/** Back above the fixture's tagged-note count, so later tests see the whole tag. */
const UNCAPPED = 100;

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: TAG_MODE_FIXTURES });
	page = harness.page;
	await harness.openFile(HUB);
	await harness.openGraphView();
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string): Locator {
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
}

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

async function expectOnlyTaggedNotesRendered(): Promise<void> {
	await expect.poll(renderedNotePaths).toEqual([...TAGGED_NOTES].sort());
}

/** Stores the cap AND rebuilds the open views — a store write alone does not fan out. */
async function applyNodeCap(nodeCap: number): Promise<void> {
	await harness.setGlobalNodeCap(nodeCap);
	await harness.refreshOpenViews();
}

test("WHEN the graph follows a note THEN the status pill names that note", async () => {
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");

	await expect(modePill()).toContainText("Vicinity of tm_hub");
});

test("WHEN tag mode is entered THEN only the notes carrying the tag render", async () => {
	await harness.enterTagMode(TAG);

	await expectOnlyTaggedNotesRendered();
});

test("WHEN the graph is filtered by a tag THEN the status pill names the tag and the note count", async () => {
	await expect(modePill()).toContainText("Tagged #tagmodetopic · 3 notes");
});

test("WHEN the graph is filtered by a tag THEN a note offers no local pin (there is no main note to pin it under)", async () => {
	// Positive control first: the chip rail IS mounted (the global pin is there).
	await expect(nodeChip(noteNode(BODY_TAGGED), ".vicinity-graph-pin-button")).toHaveCount(1);

	await expect(nodeChip(noteNode(BODY_TAGGED), ".vicinity-graph-local-pin-button")).toHaveCount(0);
});

test("WHEN a tagged note is pinned from the tag graph THEN its pin reads as pinned", async () => {
	const node = noteNode(BODY_TAGGED);
	await node.hover();
	await nodeChip(node, ".vicinity-graph-pin-button").click();

	await expect(nodeChip(noteNode(BODY_TAGGED), ".vicinity-graph-pin-button")).toHaveAttribute("aria-pressed", "true");
});

test("WHEN a pinned tagged note is unpinned from the tag graph THEN its pin reads as unpinned again", async () => {
	const node = noteNode(BODY_TAGGED);
	await node.hover();
	await nodeChip(node, ".vicinity-graph-pin-button").click();

	await expect(nodeChip(noteNode(BODY_TAGGED), ".vicinity-graph-pin-button")).toHaveAttribute("aria-pressed", "false");
});

test("WHEN another note is opened in tag mode THEN the filter stays", async () => {
	await harness.openFile(UNTAGGED_LINKER);
	// A POSITIVE post-rebuild condition, not a sleep: capping the graph forces a
	// rebuild AFTER the open, and only a still-filtered view can answer it with the
	// two most-linked tagged notes (a view that followed the open would show the
	// untagged note's vicinity instead).
	await applyNodeCap(MOST_LINKED_CAP);

	await expect.poll(renderedNotePaths).toEqual([BODY_TAGGED, FRONTMATTER_TAGGED].sort());
});

test("WHEN the node cap hides tagged notes THEN the pill still counts every tagged note", async () => {
	await expect(modePill()).toContainText("Tagged #tagmodetopic · 3 notes");
	await applyNodeCap(UNCAPPED);
	await expectOnlyTaggedNotesRendered();
});

test("WHEN Obsidian restarts in tag mode THEN the view comes back filtered by the same tag", async () => {
	// Two Obsidian boots (initial + relaunch) exceed the default per-test budget.
	test.setTimeout(200_000);
	// Obsidian saves the layout on a debounce; wait for the mode to reach disk.
	await expect.poll(() => harness.readSavedWorkspaceLayout()).toContain("tagmodetopic");

	harness = await harness.relaunch();
	page = harness.page;
	await harness.openFile(HUB);
	// Reveals the restored view (never re-creates it — that would drop its state).
	await harness.openGraphView();

	await expectOnlyTaggedNotesRendered();
});

test("WHEN the pill's exit is pressed THEN the graph returns to the active note's vicinity", async () => {
	await modePill().getByRole("button", { name: "Back to active note" }).click();

	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");
});

test("WHEN tag mode was exited THEN the status pill names the active note again", async () => {
	await expect(modePill()).toContainText("Vicinity of tm_hub");
});
