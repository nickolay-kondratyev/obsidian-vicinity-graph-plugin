import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { EngineDefaults } from "../src/engine";
import { GROUP_INTERIOR_LAYOUT } from "../src/view/constants";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Interior-layout SCREENSHOT evidence (ticket nid_7abfje1vus15rx9hzmpel9jin_e)
 * — an eval companion to `nestedGrouping.e2e.ts`, not a tight regression. It
 * renders one nested + edged vicinity (the sweep's chain / dense / hub link
 * shapes as three sibling subgroups under one parent box) in a REAL Obsidian
 * and captures the rendered flow to `.out/interior-<layout>-nested-edged.png`,
 * where `<layout>` is the BUILD's `GROUP_INTERIOR_LAYOUT` — so running the
 * suite on each side of that one-constant flip produces the rectpacking-vs-
 * force pair the owner's reserved visual pick (plan D5) is made on.
 *
 * The smoke assertions double as the flip's rendered safety net: whichever
 * interior ships, every fixture node renders and all three subgroup boxes
 * stay INSIDE the parent box (the box-refit invariant, here proven on screen).
 */

test.describe.configure({ mode: "serial" });

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, ".out");

const MEMBERS_PER_SHAPE = 8;

/**
 * il-main links EVERY member (basename-resolved), so at outgoing depth 2 each
 * member's own links are WALKED (only walked links become edges) — the same
 * discovery pattern `nestedGrouping.e2e.ts` proved. The root-level main→member
 * edges all collapse onto the one top-level `viz` box, leaving the interiors'
 * own link shapes as the visual signal.
 */
function fixtureNotes(): Record<string, string> {
	// `il`-prefixed basenames: link resolution is basename-first, so short names
	// like `c1` would resolve into the dev vault's own notes (crowd/c1.md ...).
	const notes: Record<string, string> = {};
	const chainLink = (tag: string, i: number): string => (i < MEMBERS_PER_SHAPE - 1 ? `[[${tag}${i + 1}]]` : "");
	for (let i = 0; i < MEMBERS_PER_SHAPE; i++) {
		notes[`viz/chain/ilc${i}.md`] = `chain member. ${chainLink("ilc", i)}\n`;
		const skip = i < MEMBERS_PER_SHAPE - 3 ? `[[ild${i + 3}]]` : "";
		notes[`viz/dense/ild${i}.md`] = `dense member. ${chainLink("ild", i)} ${skip}\n`;
		notes[`viz/hub/ilh${i}.md`] = i === 0 ? `hub. ${Array.from({ length: MEMBERS_PER_SHAPE - 1 }, (_, j) => `[[ilh${j + 1}]]`).join(" ")}\n` : "hub spoke.\n";
	}
	const everyMember = Object.keys(notes)
		.map((p) => `[[${path.basename(p, ".md")}]]`)
		.join(" ");
	notes["il-main.md"] = `Interior-layout eval main. ${everyMember}\n`;
	return notes;
}

const MAIN_PATH = "il-main.md";
/** il-main (central, exempt) + 3 shapes x MEMBERS_PER_SHAPE members. */
const FULL_NODE_COUNT = 1 + 3 * MEMBERS_PER_SHAPE;

const SHOT_DEPTHS = {
	...EngineDefaults.depthSettings(),
	linkDepthOut: 2,
	descendantDepth: 0,
	ancestorDepth: 0,
};

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: fixtureNotes() });
	page = harness.page;
	await harness.openGraphView();
	await harness.saveGlobalDepths(SHOT_DEPTHS);
	await harness.openFile(MAIN_PATH);
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(FULL_NODE_COUNT);
});

test.afterAll(async () => {
	await harness?.close();
});

function folderGroup(folder: string): Locator {
	return page.locator(`.vicinity-graph-group[data-folder="${folder}"]`);
}

/** See `nestedGrouping.e2e.ts`: containment of screen rects is the only honest nesting signal. */
const SLOP_PX = 4;
async function expectRenderedInside(inner: Locator, outer: Locator): Promise<void> {
	const innerBox = await inner.boundingBox();
	const outerBox = await outer.boundingBox();
	expect(innerBox, "inner box must be rendered").not.toBeNull();
	expect(outerBox, "outer box must be rendered").not.toBeNull();
	if (innerBox === null || outerBox === null) return;
	expect(innerBox.x).toBeGreaterThanOrEqual(outerBox.x - SLOP_PX);
	expect(innerBox.y).toBeGreaterThanOrEqual(outerBox.y - SLOP_PX);
	expect(innerBox.x + innerBox.width).toBeLessThanOrEqual(outerBox.x + outerBox.width + SLOP_PX);
	expect(innerBox.y + innerBox.height).toBeLessThanOrEqual(outerBox.y + outerBox.height + SLOP_PX);
}

/**
 * The rebuild is async (elk + d3 + routing, then a fitView): "settled" means
 * the parent box's screen rect stops moving between two consecutive polls.
 */
async function settleLayout(): Promise<void> {
	const STABLE_POLL_MS = 500;
	await expect
		.poll(
			async () => {
				const before = await folderGroup("viz").boundingBox();
				await page.waitForTimeout(STABLE_POLL_MS);
				const after = await folderGroup("viz").boundingBox();
				return JSON.stringify(before) === JSON.stringify(after) && before !== null;
			},
			{ timeout: 30_000 },
		)
		.toBe(true);
}

test(`renders the nested+edged fixture and captures .out/interior-${GROUP_INTERIOR_LAYOUT}-nested-edged.png`, async () => {
	await settleLayout();
	for (const shape of ["chain", "dense", "hub"]) {
		await expectRenderedInside(folderGroup(`viz/${shape}`), folderGroup("viz"));
	}
	await page
		.locator(".vicinity-graph-flow")
		.screenshot({ path: path.join(OUT_DIR, `interior-${GROUP_INTERIOR_LAYOUT}-nested-edged.png`) });
});
