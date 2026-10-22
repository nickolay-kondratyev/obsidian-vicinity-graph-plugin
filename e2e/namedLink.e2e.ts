import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Release-time e2e for named links (ticket `nid_wu4gfieqps2uw9l8f4wab1abq_e`):
 * `name::[[target]]` in a REAL vault must surface as the relation text in the
 * edge's midpoint pill. Only a real Obsidian can prove the two halves meet — its
 * metadata cache reports the link offsets `EdgeRelationLabeler` reads the text at,
 * and React Flow's label overlay renders the pill.
 *
 * Own root-level fixtures, linked to nothing in the dev vault, so the alpha /
 * note1 vicinities every other spec asserts on keep their node and edge counts.
 */

test.describe.configure({ mode: "serial" });

const SOURCE_PATH = "named-link-source.md";
const GLUED_TARGET = "named-link-glued";
const SPACED_TARGET = "named-link-spaced";
/** The rule the ticket spells out: a space ends the name, so only `improves` survives. */
const NAMED_LINK_FIXTURES: Record<string, string> = {
	[SOURCE_PATH]: [
		`This note uses::[[${GLUED_TARGET}]] over the network.`,
		`It greatly improves::[[${SPACED_TARGET}]] as well.`,
		"",
	].join("\n"),
	[`${GLUED_TARGET}.md`]: "Target of the glued named link.\n",
	[`${SPACED_TARGET}.md`]: "Target of the space-split named link.\n",
};
const EXPECTED_RELATIONS = ["improves", "uses"];

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: NAMED_LINK_FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	await harness.openFile(SOURCE_PATH);
	await expect(page.locator(`.vicinity-graph-node[data-vicinity-path="${SOURCE_PATH}"]`)).toHaveAttribute(
		"data-tier",
		"main",
	);
});

test.afterAll(async () => {
	await harness?.close();
});

test("each named link renders its relation in the edge midpoint pill, with the space rule applied", async () => {
	const relations = page.locator(".vicinity-graph-edge__relation");
	await expect(relations).toHaveCount(EXPECTED_RELATIONS.length);
	expect((await relations.allTextContents()).sort()).toEqual(EXPECTED_RELATIONS);
});

test("a single named link shows no ×N count badge beside its relation", async () => {
	await expect(page.locator(".vicinity-graph-edge__count-badge")).toHaveCount(0);
});
