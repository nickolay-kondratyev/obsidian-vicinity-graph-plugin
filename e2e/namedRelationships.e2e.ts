import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Release-time e2e for named-relationship RENDERING (ticket
 * nid_wnagjm2j144u0jsgixpcmmpar_e): the view surface only a real Obsidian can
 * observe — the eager named-relationships index parsing raw markdown, the label
 * drawn in React Flow's EdgeLabelRenderer overlay, and the flyout's markdown
 * seam. Two source notes, all root-level so each renders as a plain node with a
 * passthrough edge (no folder-group collapse).
 *
 * `rel-src` asserts TWO relations onto `rel-dst` — a bare `supports` and a
 * bracketed `refutes … but not strongly` qualifier — so the edge draws both
 * names plus a ×2 count badge (each relation also rides the plain-link channel).
 * `relnote-src` uses the rel-note form `[[approves]]:: [[relnote-dst]]`, whose
 * flyout label LINKS to the rel note.
 *
 * Relation labels and the count badge render into React Flow's SHARED
 * EdgeLabelRenderer overlay (not the edge's own <g>), so they are matched
 * globally — safe because each opened main's vicinity holds exactly one named
 * edge.
 *
 * Serial by design: ONE Obsidian instance reused across the edge, badge and
 * flyout assertions.
 */

test.describe.configure({ mode: "serial" });

const REL_SRC_PATH = "rel-src.md";
const REL_NOTE_SRC_PATH = "relnote-src.md";
const NAMED_EDGE_ID = "rel-src.md->rel-dst.md";
const REL_NOTE_EDGE_ID = "relnote-src.md->relnote-dst.md";

const NAMED_FIXTURES: Record<string, string> = {
	// Two relations onto ONE target: the bare form and the bracketed qualifier
	// form. Both also ride the plain-link channel, so the edge count is 2.
	"rel-src.md": "Alpha supports:: [[rel-dst]] and [refutes:: [[rel-dst]] but not strongly].\n",
	"rel-dst.md": "The disputed target.\n",
	// Rel-note form: the relationship name IS a note, so the flyout links to it.
	"relnote-src.md": "Beta [[approves]]:: [[relnote-dst]] here.\n",
	"relnote-dst.md": "The approved target.\n",
	"approves.md": "The approval relationship note.\n",
};

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: NAMED_FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	await harness.openFile(REL_SRC_PATH);
	await expect(page.locator(`.vicinity-graph-node[data-vicinity-path="${REL_SRC_PATH}"]`)).toHaveAttribute(
		"data-tier",
		"main",
	);
});

test.afterAll(async () => {
	await harness?.close();
});

function drawer(): Locator {
	return page.locator(".vicinity-graph-link-preview-drawer");
}

/**
 * Clicks the MIDPOINT of the edge's rendered path with a real pointer — the same
 * on-path resolution linkPreview.e2e uses (a routed polyline's bbox centre can
 * sit off the stroke). `getScreenCTM` folds in React Flow's pan/zoom transform.
 */
async function clickEdgePath(edgeId: string): Promise<void> {
	const edgePath = page.locator(
		`.vicinity-graph-flow .react-flow__edge[data-id="${edgeId}"] .react-flow__edge-path`,
	);
	const point = await edgePath.evaluate((el) => {
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

test("a named edge draws its relation names on the canvas, qualifier included", async () => {
	// Both names render as stacked relation labels; the qualifier marks the target
	// position with [X] rather than repeating the note title.
	await expect(page.locator(".vicinity-graph-edge__relation")).toHaveText([
		"supports",
		"refutes [X] but not strongly",
	]);
});

test("the multiplicity count badge coexists with the relation labels", async () => {
	await expect(page.locator(".vicinity-graph-edge__count-badge")).toHaveText(["×2"]);
});

test("clicking a named edge opens the flyout with a Relationships breakdown", async () => {
	await clickEdgePath(NAMED_EDGE_ID);

	await expect(drawer()).toBeVisible();
	const relationSection = drawer().getByRole("region", { name: "Relationships" });
	await expect(relationSection.locator(".vicinity-graph-link-preview__relation")).toHaveText([
		"supports",
		"refutes [X] but not strongly",
	]);
	await drawer().locator("button.vicinity-graph-link-preview-drawer__close").click();
	await expect(drawer()).toHaveCount(0);
});

test("a rel-note relation renders a flyout link to its rel note", async () => {
	await harness.openFile(REL_NOTE_SRC_PATH);
	await expect(page.locator(`.vicinity-graph-node[data-vicinity-path="${REL_NOTE_SRC_PATH}"]`)).toHaveAttribute(
		"data-tier",
		"main",
	);

	await clickEdgePath(REL_NOTE_EDGE_ID);

	await expect(drawer()).toBeVisible();
	// The rel-note name is a real internal link resolving to the rel note file.
	const relNoteLink = drawer().locator("a.vicinity-graph-link-preview__relation-name", { hasText: "approves" });
	await expect(relNoteLink).toHaveAttribute("data-href", "approves.md");
});
