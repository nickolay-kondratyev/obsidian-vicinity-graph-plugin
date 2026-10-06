import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Named relationships on edges, task 1/4 (ticket nid_gk9h4jpa7di1al7och0rehd3h_e):
 * the key journeys only a real Obsidian can prove — its link cache supplies the
 * link POSITIONS the inline-field matcher reads (`improves:: [[x]]`), and its
 * folder-note hierarchy produces the `parent` default. Which name wins where is
 * unit-tested (`EdgeRelationships.test.ts`, `InlineFieldKeys.test.ts`).
 *
 * Own root-level fixtures, each folder holding ONE child so no folder group forms
 * (a group-collapsed edge carries no label by design). Hierarchy edges are only
 * walked from the ACTIVE note, so each journey opens its own MAIN.
 *
 * Serial by design: ONE Obsidian instance.
 */

test.describe.configure({ mode: "serial" });

const NAMED_SOURCE = "rel-source.md";
const NAMED_EDGE_ID = "rel-source.md->rel-target.md";

/** `rel-pa.md` is the folder note of `rel-pa/`; its child does not link back. */
const PARENT_MAIN = "rel-pa.md";
const PARENT_EDGE_ID = "rel-pa.md->rel-pa/kid.md";

/**
 * `rel-pb.md` is the folder note of `rel-pb/`; its child names its link BACK
 * (`rel:: [[rel-pb]]`), which hides the `parent` default. Incoming links are off
 * by default, so that link is no edge at all — the hiding still applies. The
 * folder note's own named link (`marks::`) is the signal that this build's names
 * have resolved, so the ABSENCE of `parent` is observed after the fact, not before.
 */
const HIDDEN_PARENT_MAIN = "rel-pb.md";
const HIDDEN_PARENT_EDGE_ID = "rel-pb.md->rel-pb/kid.md";
const HIDDEN_PARENT_SIGNAL_EDGE_ID = "rel-pb.md->rel-pb-other.md";

const FIXTURES: Record<string, string> = {
	"rel-source.md": "Intro line.\n\nimproves:: [[rel-target]]\n",
	"rel-target.md": "The improved note.\n",
	"rel-pa.md": "Folder note A.\n",
	"rel-pa/kid.md": "Child of A, no link back.\n",
	"rel-pb.md": "Folder note B.\n\nmarks:: [[rel-pb-other]]\n",
	"rel-pb/kid.md": "Child of B.\n\nrel:: [[rel-pb]]\n",
	"rel-pb-other.md": "Marked by B.\n",
};

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: FIXTURES });
	page = harness.page;
	await harness.openGraphView();
});

test.afterAll(async () => {
	await harness?.close();
});

async function openMain(path: string): Promise<void> {
	await harness.openFile(path);
	await expect(page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`)).toHaveAttribute("data-tier", "main");
}

function edgePath(edgeId: string): Locator {
	return page.locator(`.vicinity-graph-flow .react-flow__edge[data-id="${edgeId}"] .react-flow__edge-path`);
}

function edgeName(edgeId: string): Locator {
	return page.locator(`.vicinity-graph-edge__label[data-edge-id="${edgeId}"] .vicinity-graph-edge__relationship`);
}

/** Real pointer click ON the stroke (see linkPreview.e2e.ts for why not the bbox centre). */
async function clickEdgePath(edgeId: string): Promise<void> {
	const point = await edgePath(edgeId).evaluate((el) => {
		const path = el as unknown as SVGGeometryElement;
		const mid = path.getPointAtLength(path.getTotalLength() / 2);
		const ctm = path.getScreenCTM();
		if (ctm === null) {
			throw new Error("e2e: edge path has no screen CTM (detached from the rendered tree?)");
		}
		const screen = mid.matrixTransform(ctm);
		return { x: screen.x, y: screen.y };
	});
	await page.mouse.click(point.x, point.y);
}

test("a note's `improves:: [[x]]` names that edge on the graph", async () => {
	await openMain(NAMED_SOURCE);
	await expect(edgeName(NAMED_EDGE_ID)).toHaveText("improves");
});

test("the edge drawer shows the name as 'source —name→ target' with its origin", async () => {
	await clickEdgePath(NAMED_EDGE_ID);
	const relationships = page
		.locator(".vicinity-graph-link-preview-drawer")
		.getByRole("list", { name: "Relationships" });
	await expect(relationships).toContainText("rel-source —improves→ rel-target");
	await expect(relationships).toContainText("from note");
	await page.keyboard.press("Escape");
});

test("a folder note's edge to its child is named `parent`", async () => {
	await openMain(PARENT_MAIN);
	await expect(edgeName(PARENT_EDGE_ID)).toHaveText("parent");
});

test("a child naming its link to the folder note hides the `parent` name", async () => {
	await openMain(HIDDEN_PARENT_MAIN);
	await expect(edgeName(HIDDEN_PARENT_SIGNAL_EDGE_ID)).toHaveText("marks");
	await expect(edgePath(HIDDEN_PARENT_EDGE_ID)).toHaveCount(1);
	await expect(edgeName(HIDDEN_PARENT_EDGE_ID)).toHaveCount(0);
});
