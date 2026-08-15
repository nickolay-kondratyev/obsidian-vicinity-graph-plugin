import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { buttonChromeVsDeclared } from "./buttonChrome";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Release-time e2e for the link-preview drawer (edge click → occurrence rows,
 * ticket nid_gytdn8nwjno1737meyrdxjxoh_e). Two concerns only a real Obsidian can
 * observe:
 *
 * - The OPEN gesture: a real pointer click on a rendered edge path routes
 *   through React Flow's edge click handler into `openEdgePreview`.
 * - Button CHROME: the drawer's three `all: unset` buttons (close, row toggle,
 *   GO) fight Obsidian's app-wide `button:not(.clickable-icon)` rule (0,1,1),
 *   which silently beats a single-class reset (0,1,0). The prefixed override in
 *   link-preview.css (ticket nid_zine3xz9xp8a04vn8v0bezakz_e) is what wins that
 *   fight — asserted here via the probe pattern in `buttonChrome.ts`.
 *
 * Serial by design: ONE Obsidian instance; the chrome tests assert on the
 * drawer the first test opened.
 */

test.describe.configure({ mode: "serial" });

const ALPHA_PATH = "projects/alpha.md";
/**
 * alpha links [[note1]] twice and alpha is a `projects/` group member, so the
 * rendered edge is the group-collapsed `folder-group:projects->note1.md` (see
 * the cross-boundary test in vicinityGraph.e2e.ts). Its preview shows the
 * alpha→note1 pair: 2 occurrence rows, both with markdown context.
 */
const CLICKED_EDGE_ID = "folder-group:projects->note1.md";
const EXPECTED_OCCURRENCE_ROWS = 2;

/**
 * Own root-level fixtures for the EMBED case (ticket
 * nid_0dle910iia37t42t28dqndc5b_e): a note that EMBEDS a titled note. Root
 * level so the pair renders as two plain nodes (no folder group), and linked to
 * nothing else so the alpha vicinity every other test here uses is untouched.
 *
 * Only a real Obsidian can observe what this is about: its markdown renderer
 * expands `![[…]]` into the whole embedded note, which is what escaping the
 * embed (`shared/MarkdownEmbeds`) exists to prevent — the row shows the embed's
 * own raw wikilink text instead.
 */
const EMBEDDED_TITLE = "Embedded Title";
const EMBEDDED_BODY_LINE = "Embedded body prose that must never reach an occurrence row.";
/**
 * The markdown-style image embed case (ticket
 * nid_vvdc7lhh92122ght4m66t5d61_e): a note whose occurrence line ALSO carries a
 * `![alt](pic.png)` image embed. Only a real Obsidian expands that into an
 * `<img>` in the one-line row — the same blow-up the wikilink embed causes, and
 * the same escape (`shared/MarkdownEmbeds`) prevents it. The `[[…]]` wikilink is
 * what mints the edge; the image embed rides along in its context snippet.
 */
const MD_EMBED_MARKER_TEXT = "![chart](pictures/chart.png)";
const MD_EMBED_SOURCE_LINE = `Chart ${MD_EMBED_MARKER_TEXT} precedes [[md-embed-target]] on one line.`;
// The plain wikilink in that line stays a clickable link, so Obsidian shows its
// label (`md-embed-target`), not the raw `[[…]]` — while the image embed beside
// it shows raw. That contrast is exactly the acceptance criterion.
const MD_EMBED_RENDERED_ROW_TEXT = `Chart ${MD_EMBED_MARKER_TEXT} precedes md-embed-target on one line.`;
const EMBED_FIXTURES: Record<string, string> = {
	"embed-target.md": `---\ntitle: ${EMBEDDED_TITLE}\n---\n\n${EMBEDDED_BODY_LINE}\n`,
	"embed-source.md": "Source line embeds ![[embed-target]] inline.\n",
	"md-embed-target.md": "Plain target of the markdown-embed source.\n",
	"md-embed-source.md": `${MD_EMBED_SOURCE_LINE}\n`,
};
const EMBED_SOURCE_PATH = "embed-source.md";
const EMBED_EDGE_ID = "embed-source.md->embed-target.md";
const MD_EMBED_SOURCE_PATH = "md-embed-source.md";
const MD_EMBED_EDGE_ID = "md-embed-source.md->md-embed-target.md";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: EMBED_FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	await harness.openFile(ALPHA_PATH);
	await expect(page.locator(`.vicinity-graph-node[data-vicinity-path="${ALPHA_PATH}"]`)).toHaveAttribute("data-tier", "main");
});

test.afterAll(async () => {
	await harness?.close();
});

function drawer(): Locator {
	return page.locator(".vicinity-graph-link-preview-drawer");
}

function rowToggles(): Locator {
	return page.locator("button.vicinity-graph-link-preview__row-toggle");
}

/**
 * Clicks the MIDPOINT of the edge's rendered path with a real pointer. A plain
 * locator click aims at the bounding-box CENTER, which for a routed polyline
 * (edge routing is always on) can sit off the stroke entirely — so resolve a
 * point ON the path and click there. `getScreenCTM` folds in React Flow's
 * pan/zoom transform, yielding CSS-pixel client coordinates for `page.mouse`.
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

test("clicking an edge opens the link-preview drawer with one occurrence row per link", async () => {
	await clickEdgePath(CLICKED_EDGE_ID);

	await expect(drawer()).toBeVisible();
	// Both alpha→note1 links have surrounding markdown, so both rows carry a
	// toggle and a GO button — the controls the chrome tests below assert on.
	await expect(rowToggles()).toHaveCount(EXPECTED_OCCURRENCE_ROWS);
	await expect(page.locator("button.vicinity-graph-link-preview__go")).toHaveCount(EXPECTED_OCCURRENCE_ROWS);
});

// --- button chrome: the three `all: unset` buttons must render FLAT ----------
// Each pairs with its link-preview.css block: no background, no shadow — not
// Obsidian's raised pill. The prefixed selector is load-bearing; drop it and
// these three go red while every unit test stays green.
//
// Verified by mutation on 2026-08-01: removing the drawer prefix from the
// close button's rule in link-preview.css turned its test below red
// (backgroundColor came back as the theme's raised-button color) while
// `npm test` stayed green. The guard bites.

test("the drawer close button keeps its flat icon-button chrome, not Obsidian's raised-button chrome", async () => {
	const close = drawer().locator("button.vicinity-graph-link-preview-drawer__close");
	const chrome = await buttonChromeVsDeclared(close, {
		background: "transparent",
		boxShadow: "none",
	});
	expect(chrome.actual).toEqual(chrome.declared);
});

test("occurrence row toggles render as flat rows, not Obsidian buttons", async () => {
	const chrome = await buttonChromeVsDeclared(rowToggles().first(), {
		background: "transparent",
		boxShadow: "none",
	});
	expect(chrome.actual).toEqual(chrome.declared);
});

test("the GO button keeps its flat icon-button chrome, not Obsidian's raised-button chrome", async () => {
	const go = page.locator("button.vicinity-graph-link-preview__go").first();
	const chrome = await buttonChromeVsDeclared(go, {
		background: "transparent",
		boxShadow: "none",
	});
	expect(chrome.actual).toEqual(chrome.declared);
});

// --- the unstyled close button is still a WORKING control --------------------

test("clicking the close button dismisses the drawer", async () => {
	await drawer().locator("button.vicinity-graph-link-preview-drawer__close").click();

	await expect(drawer()).toHaveCount(0);
});

// --- an EMBED occurrence renders as raw text, not as the embedded note -------

test("an embed occurrence shows its raw wikilink text and never the embedded note's body", async () => {
	await harness.openFile(EMBED_SOURCE_PATH);
	await expect(page.locator(`.vicinity-graph-node[data-vicinity-path="${EMBED_SOURCE_PATH}"]`)).toHaveAttribute(
		"data-tier",
		"main",
	);

	await clickEdgePath(EMBED_EDGE_ID);

	// The embed renders as its own raw text; the embedded body stays out of the row.
	await expect(rowToggles()).toHaveText(["Source line embeds ![[embed-target]] inline."]);
	await expect(drawer()).not.toContainText(EMBEDDED_BODY_LINE);
});

test("a markdown-style image embed in an occurrence shows its raw text and never an expanded image", async () => {
	await harness.openFile(MD_EMBED_SOURCE_PATH);
	await expect(page.locator(`.vicinity-graph-node[data-vicinity-path="${MD_EMBED_SOURCE_PATH}"]`)).toHaveAttribute(
		"data-tier",
		"main",
	);

	await clickEdgePath(MD_EMBED_EDGE_ID);

	// The `![alt](pic.png)` renders as its own raw text, so the row keeps its
	// height; without the escape Obsidian would drop an <img> into the one-line row.
	await expect(rowToggles()).toHaveText([MD_EMBED_RENDERED_ROW_TEXT]);
	await expect(drawer().locator("img")).toHaveCount(0);
});
