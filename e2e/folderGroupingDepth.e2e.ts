import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { EngineDefaults } from "../src/engine";
import { SETTINGS_SPEC } from "../src/engine";
import { FolderGroupingDepthSlider } from "../src/view/settingsRowAccessors";
import { SettingsRowNames, settingsRowsFor } from "../src/view/settingsRows";
import { ObsidianHarness } from "./obsidianHarness";
import { SettingsTabPage } from "./settingsTabPage";

/**
 * "Folder grouping depth" slider — RENDERED behavior e2e (plan ticket
 * nid_yyugpoh3gv8ip24cizvgrs4w4_e, part 4/4, ticket
 * nid_ovayqcmi0vlmzyju40tdxw3sd_e). The unit layer proves the depth-cap merge in
 * `deriveFolderGroups` exhaustively; this file locks what only a real Obsidian
 * can: the slider gesture reaching the write pipeline, the rebuilt canvas
 * showing exactly N nested box levels, and — the human-added Q1 requirement —
 * that at depth 0 the edges previously COLLAPSED onto group boxes come back as
 * individual note-to-note edges (asserted by edge id, i.e. endpoints, not just
 * box absence).
 *
 * Serial by design: ONE Obsidian instance, opened on a ROOT MAIN note
 * (`fgd-main.md`) whose whole vicinity is these fixtures, and each test hands
 * the slider's current value to the next. MAIN stays at the vault ROOT
 * (ungrouped), matching the repo rule for the pointer-interaction anchor.
 *
 * No sleeps anywhere: a slider write is NOT debounced (only TYPED fields ride
 * `DebouncedSettingsWrites` / `SettingsWriteWindow`), so settling is the store
 * poll plus the rebuilt canvas itself, asserted web-first — the exact pattern
 * of `nestedGrouping.e2e.ts` test (6).
 */

test.describe.configure({ mode: "serial" });

/**
 * Three RENDERED group-nesting levels, all reachable from `fgd-main` at
 * outgoing depth 2:
 *
 *   a/        (level 1: direct members fga1,fga2,fgx1 + nested a/b)
 *     fga1,fga2,fgx1
 *     b/      (level 2: direct members fgb1,fgb2 + nested a/b/c)
 *       fgb1,fgb2
 *       c/    (level 3: members fgc1,fgc2)
 *         fgc1,fgc2
 *
 * Every folder holds ≥ 2 direct note members, so no single-child chain
 * collapses — each folder is its OWN rendered level, which is what makes the
 * depth cap's "rendered levels" semantics visible. Links: fgd-main → every
 * member (walked at depth 1), fgx1 → fgc1 (walked at depth 2; the
 * boundary-crossing probe edge that must collapse/uncollapse as the depth
 * changes). Basenames carry the `fg` prefix because wiki links here resolve by
 * BASENAME across the whole `.dev-vault` copy — a bare `c1` resolves to the
 * pre-existing `crowd/c1.md`, silently swapping the fixture out of its folder.
 */
const DEPTH_FIXTURES: Record<string, string> = {
	"fgd-main.md": "Main links [[fga1]] [[fga2]] [[fgx1]] [[fgb1]] [[fgb2]] [[fgc1]] [[fgc2]].\n",
	"a/fga1.md": "fga1 has no outgoing links.\n",
	"a/fga2.md": "fga2 has no outgoing links.\n",
	"a/fgx1.md": "fgx1 links across two group boundaries to [[fgc1]].\n",
	"a/b/fgb1.md": "fgb1 has no outgoing links.\n",
	"a/b/fgb2.md": "fgb2 has no outgoing links.\n",
	"a/b/c/fgc1.md": "fgc1 has no outgoing links.\n",
	"a/b/c/fgc2.md": "fgc2 has no outgoing links.\n",
};

const MAIN_PATH = "fgd-main.md";

/** Outgoing depth 2 so the x1 → c1 crossing link is WALKED. Hierarchy channels off: pure link graph. */
const DEPTHS = {
	...EngineDefaults.depthSettings(),
	linkDepthOut: 2,
	descendantDepth: 0,
	ancestorDepth: 0,
};

/** fgd-main (central) + a1,a2,x1,b1,b2,c1,c2 — every fixture note, at every grouping depth. */
const FULL_NODE_COUNT = 8;

/** The declared row — name, description and default read from the model, never retyped. */
const DEPTH_ROW = ((): { readonly name: string; readonly description: string } => {
	const [row] = settingsRowsFor("folder-grouping-depth");
	if (row === undefined || row.description === undefined) {
		throw new Error("the declared model has no described folder-grouping-depth row");
	}
	return { name: SettingsRowNames.sole(row), description: row.description };
})();

const DEPTH_DEFAULT = SETTINGS_SPEC.globalView.folderGroupingDepth.default;

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: DEPTH_FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	await harness.saveGlobalDepths(DEPTHS);
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

function folderGroup(folder: string): Locator {
	return page.locator(`.vicinity-graph-group[data-folder="${folder}"]`);
}

function flowEdge(id: string): Locator {
	return page.locator(`.vicinity-graph-flow .react-flow__edge[data-id="${id}"]`);
}

/** Every rendered edge whose id names a group box endpoint — depth 0 must show NONE. */
function groupBoundaryEdges(): Locator {
	return page.locator('.vicinity-graph-flow .react-flow__edge[data-id*="folder-group:"]');
}

/**
 * Containment assertion copied from `nestedGrouping.e2e.ts`: React Flow renders
 * subflow children as separate absolutely positioned nodes, so screen-rect
 * containment is the only honest nesting signal. `SLOP_PX` absorbs sub-pixel
 * transform rounding without blurring one box into a sibling.
 */
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
 * Drives the global "Folder grouping depth" SLIDER through the in-graph controls
 * PANEL — the real user gesture, reaching the same write pipeline the settings
 * tab uses, which fans out a rebuild on its own. Reveals the toolbar and every
 * nested `<details>` first (only the depth section opens by default; a closed
 * `<details>` display:none's its content). A range input is set through the
 * native value setter plus an `input` event so React's `onChange` fires (a bare
 * `.fill()` does not drive a range thumb) — the exact recipe of
 * `nestedGrouping.e2e.ts`'s `setEdgeDepthIntoGroups`. A slider write is NOT
 * debounced, so settling is the store poll below plus the rebuilt canvas the
 * caller asserts on — never a sleep.
 *
 * `depth` is the stored VALUE (a finite level or ∞); the slider itself moves in
 * POSITION space (its top stop is ∞), so the gesture drives {@link
 * FolderGroupingDepthSlider.positionOf} and the store must settle back on `depth`.
 */
async function setFolderGroupingDepth(depth: number): Promise<void> {
	const toolbar = page.locator(".vicinity-graph-toolbar");
	await toolbar.evaluate((root) => {
		(root as HTMLDetailsElement).open = true;
		root.querySelectorAll("details").forEach((section) => {
			(section as HTMLDetailsElement).open = true;
		});
	});
	const position = FolderGroupingDepthSlider.positionOf(depth);
	const slider = page.getByRole("slider", { name: DEPTH_ROW.name, exact: true });
	await slider.evaluate((el, next) => {
		const input = el as HTMLInputElement;
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
		setter?.call(input, String(next));
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}, position);
	await expect(slider).toHaveValue(String(position));
	// The write must land in the STORE, not just repaint — polled, never slept.
	await expect
		.poll(async () => (await harness.readGlobalView()).folderGroupingDepth, {
			message: "the folder grouping depth slider must persist, not just repaint",
		})
		.toBe(depth);
	await toolbar.evaluate((root) => {
		(root as HTMLDetailsElement).open = false;
	});
}

// --- (1) default depth: all three nested levels render, crossing edges collapse ---

test("at the default depth all three nested group levels render, one inside the next", async () => {
	await expect(folderGroup("a")).toHaveCount(1);
	await expect(folderGroup("a/b")).toHaveCount(1);
	await expect(folderGroup("a/b/c")).toHaveCount(1);
	await expectRenderedInside(folderGroup("a/b"), folderGroup("a"));
	await expectRenderedInside(folderGroup("a/b/c"), folderGroup("a/b"));
	await expectRenderedInside(noteNode("a/b/c/fgc1.md"), folderGroup("a/b/c"));
});

test("at the default depth boundary-crossing links collapse onto group boxes, not note-to-note edges", async () => {
	// x1 (a member) → c1 (a/b/c member): their LCA container is a, so the edge
	// collapses onto a's direct-child box on c1's path — a/b.
	await expect(flowEdge("a/fgx1.md->folder-group:a/b")).toHaveCount(1);
	await expect(flowEdge("a/fgx1.md->a/b/c/fgc1.md")).toHaveCount(0);
	// MAIN (root, ungrouped) → every member: all seven links collapse onto the
	// outermost box a, so no individual main → note edge into the group renders.
	await expect(flowEdge(`${MAIN_PATH}->folder-group:a`)).toHaveCount(1);
	await expect(flowEdge(`${MAIN_PATH}->a/fga1.md`)).toHaveCount(0);
});

// --- (2) intermediate depth 1: one rendered level, deeper notes fall up -------

test("at depth 1 only the level-1 box renders and deeper notes fall up into it", async () => {
	await setFolderGroupingDepth(1);
	await expect(folderGroup("a/b")).toHaveCount(0);
	await expect(folderGroup("a/b/c")).toHaveCount(0);
	await expect(folderGroup("a")).toHaveCount(1);
	// Every note survives the re-grouping; the deep ones now draw inside a's box.
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(FULL_NODE_COUNT);
	await expectRenderedInside(noteNode("a/b/fgb1.md"), folderGroup("a"));
	await expectRenderedInside(noteNode("a/b/c/fgc1.md"), folderGroup("a"));
});

test("at depth 1 edge collapse follows the NEW structure: the x1 → c1 link is now same-container, note-to-note", async () => {
	// x1 and c1 are both direct members of a's box now, so nothing collapses their edge.
	await expect(flowEdge("a/fgx1.md->a/b/c/fgc1.md")).toHaveCount(1);
	await expect(flowEdge("a/fgx1.md->folder-group:a/b")).toHaveCount(0);
	// MAIN's links still cross a's boundary, so they stay collapsed onto a's box.
	await expect(flowEdge(`${MAIN_PATH}->folder-group:a`)).toHaveCount(1);
});

// --- (3) depth 0: flat canvas, collapsed relationships restored as real edges ---

test("at depth 0 no group boxes render and every note is still on the canvas", async () => {
	await setFolderGroupingDepth(0);
	await expect(page.locator(".vicinity-graph-group")).toHaveCount(0);
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(FULL_NODE_COUNT);
});

test("at depth 0 the relationships previously collapsed into group-boundary arrows are individual note-to-note edges again", async () => {
	// The Q1 human-added requirement: endpoints, not just box absence. No edge
	// anywhere ends on a group box...
	await expect(groupBoundaryEdges()).toHaveCount(0);
	// ...the crossing probe link is a plain note-to-note edge...
	await expect(flowEdge("a/fgx1.md->a/b/c/fgc1.md")).toHaveCount(1);
	// ...and each of MAIN's seven links — ONE collapsed arrow before — is its own edge.
	for (const path of Object.keys(DEPTH_FIXTURES)) {
		if (path === MAIN_PATH) continue;
		await expect(flowEdge(`${MAIN_PATH}->${path}`)).toHaveCount(1);
	}
});

// --- (4) restoring the default brings the nested boxes back ------------------

test("restoring the default depth re-renders the nested boxes", async () => {
	await setFolderGroupingDepth(DEPTH_DEFAULT);
	await expect(folderGroup("a")).toHaveCount(1);
	await expect(folderGroup("a/b")).toHaveCount(1);
	await expect(folderGroup("a/b/c")).toHaveCount(1);
	await expect(flowEdge("a/fgx1.md->folder-group:a/b")).toHaveCount(1);
});

// --- (5) the description copy is present: panel tooltip and tab row ----------

test("the panel row carries the declared description as its native title tooltip", async () => {
	const toolbar = page.locator(".vicinity-graph-toolbar");
	await toolbar.evaluate((root) => {
		(root as HTMLDetailsElement).open = true;
		root.querySelectorAll("details").forEach((section) => {
			(section as HTMLDetailsElement).open = true;
		});
	});
	const row = page.locator(".vicinity-graph-slider-row", {
		has: page.getByRole("slider", { name: DEPTH_ROW.name, exact: true }),
	});
	await expect(row).toHaveAttribute("title", DEPTH_ROW.description);
	await toolbar.evaluate((root) => {
		(root as HTMLDetailsElement).open = false;
	});
});

// KEEP LAST: opens the settings modal and does not close it.
test("the settings tab row shows the declared description", async () => {
	const settingsTab = new SettingsTabPage(page);
	await settingsTab.open();
	await expect(settingsTab.rowHolding(DEPTH_ROW.name).locator(".setting-item-description")).toHaveText(
		DEPTH_ROW.description,
	);
});
