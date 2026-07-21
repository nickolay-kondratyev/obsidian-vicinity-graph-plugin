import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { asFolderPath } from "../src/engine";
import { hiddenOverlayText, linkCountBadgeText, orphanBreakdownTitle, plusNText } from "../src/view/badgeText";
import { attachmentGroupLabel } from "../src/view/attachmentIcons";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Release-time e2e: real Obsidian on a copy of `.dev-vault` (+ e2e-only
 * `crowd/` fixtures), asserting rendered DOM state per the Phase B selector
 * contract. Badge copy is imported from `badgeText.ts`/`attachmentIcons.ts`
 * instead of re-typed, so copy changes cannot silently diverge from the tests.
 *
 * Serial by design: ONE Obsidian instance is launched for the whole file and
 * later tests build on earlier navigation state.
 */

test.describe.configure({ mode: "serial" });

// Fixture-derived expectations (see scripts/setup-dev-vault.sh + harness crowd/ fixtures).
// Depths default to 1 outgoing / 1 incoming, edge visibility "walked-from-center".
const ALPHA_PATH = "projects/alpha.md";
const ALPHA_FM_TITLE = "Project Alpha (fm title)";
/** alpha-focused vicinity: alpha (MAIN) + beta (out+in) + note1 (out). */
const ALPHA_NODE_COUNT = 3;
/** alpha→note1 (collapsed ×2), alpha→beta, beta→alpha. */
const ALPHA_EDGE_COUNT = 3;
const ALPHA_TO_NOTE1_LINK_COUNT = 2;

const NOTE1_PATH = "note1.md";
/** note1 + note2 + note3 + test.canvas + alpha + beta + gamma + crowd c1..c4. */
const NOTE1_NODE_COUNT = 11;
const GAMMA_PATH = "solo/gamma.md";
const GAMMA_TRIMMED_TITLE = "Gamma (solo, trimmed title)";

/** Truncation scenario: cap 2 keeps exactly crowd/c1+c2 (largest depth-1 neighbors). */
const TRUNCATION_NODE_CAP = 2;
const CROWD_HIDDEN_COUNT = 2; // c3, c4
const ORPHAN_BREAKDOWN = [
	{ folder: asFolderPath(""), hiddenCount: 3 }, // note2, note3, test.canvas
	{ folder: asFolderPath("projects"), hiddenCount: 2 }, // alpha, beta
	{ folder: asFolderPath("solo"), hiddenCount: 1 }, // gamma
] as const;
const ORPHAN_HIDDEN_TOTAL = 6;

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch();
	page = harness.page;
	await harness.openGraphView();
	await harness.openFile(ALPHA_PATH);
	await expect(noteNode(ALPHA_PATH)).toHaveAttribute("data-tier", "main");
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string) {
	return page.locator(`.vicinity-graph-node[data-path="${path}"]`);
}

function folderGroup(folder: string) {
	return page.locator(`.vicinity-graph-group[data-folder="${folder}"]`);
}

// --- alpha focused: tiers, titles, group, chips, edges ----------------------

test("renders the expected node count for the alpha vicinity", async () => {
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(ALPHA_NODE_COUNT);
});

test("exactly one MAIN-tier node, no pinned-central, rest regular", async () => {
	await expect(page.locator('.vicinity-graph-node[data-tier="main"]')).toHaveCount(1);
	await expect(page.locator('.vicinity-graph-node[data-tier="pinned-central"]')).toHaveCount(0);
	await expect(page.locator('.vicinity-graph-node[data-tier="regular"]')).toHaveCount(ALPHA_NODE_COUNT - 1);
});

test("node title comes from frontmatter when present", async () => {
	await expect(noteNode(ALPHA_PATH).locator(".vicinity-graph-node__title")).toHaveText(ALPHA_FM_TITLE);
});

test("root-folder note carries no breadcrumb", async () => {
	await expect(noteNode(NOTE1_PATH).locator(".vicinity-graph-node__breadcrumb")).toHaveCount(0);
});

test("projects folder renders as a group with its label and no truncation badge", async () => {
	await expect(folderGroup("projects")).toHaveCount(1);
	await expect(folderGroup("projects").locator(".vicinity-graph-group__label")).toHaveText("projects");
	await expect(folderGroup("projects").locator(".vicinity-graph-group__badge")).toHaveCount(0);
});

test("attachment icon strip shows one counted chip per extension", async () => {
	const chips = noteNode(ALPHA_PATH).locator("button.vicinity-graph-attachment");
	await expect(chips).toHaveCount(3);
	// alpha embeds pic.jpg (the vault moved from pic.png to a real photo fixture).
	for (const extension of ["jpg", "pdf", "csv"]) {
		const chip = noteNode(ALPHA_PATH).locator(`button.vicinity-graph-attachment[data-extension="${extension}"]`);
		await expect(chip).toHaveAttribute("aria-label", attachmentGroupLabel(extension, 1));
		await expect(chip.locator(".vicinity-graph-attachment__count")).toHaveText("1");
	}
});

test("duplicate links collapse into one edge with a ×2 count badge", async () => {
	const badge = page.locator(".vicinity-graph-edge__count-badge");
	await expect(badge).toHaveCount(1); // single-link edges carry NO badge
	await expect(badge).toHaveText(linkCountBadgeText(ALPHA_TO_NOTE1_LINK_COUNT) ?? "");
	await expect(badge).toHaveAttribute("data-count", String(ALPHA_TO_NOTE1_LINK_COUNT));
});

test("every edge carries a self-drawn arrowhead, one per edge", async () => {
	await expect(page.locator(".vicinity-graph-flow .react-flow__edge-path")).toHaveCount(ALPHA_EDGE_COUNT);
	await expect(page.locator(".vicinity-graph-flow .vicinity-graph-edge__arrowhead")).toHaveCount(ALPHA_EDGE_COUNT);
});

test("no corner overlay badge when nothing is truncated", async () => {
	await expect(page.locator(".vicinity-graph-overlay-badge")).toHaveCount(0);
});

// --- note1 focused: thumbnail, breadcrumb, groups ---------------------------

test("switching the active file re-renders the graph around note1", async () => {
	await harness.openFile(NOTE1_PATH);
	await expect(noteNode(NOTE1_PATH)).toHaveAttribute("data-tier", "main");
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(NOTE1_NODE_COUNT);
});

test("first embedded image renders as a thumbnail resolved to an app:// URL", async () => {
	const img = noteNode(NOTE1_PATH).locator(".vicinity-graph-node__thumbnail img");
	await expect(img).toHaveCount(1);
	await expect(img).toHaveAttribute("src", /^app:\/\//);
	// Single image ⇒ no "+N" extra-images badge.
	await expect(noteNode(NOTE1_PATH).locator(".vicinity-graph-node__thumbnail-badge")).toHaveCount(0);
});

test("singleton-folder note shows a folder breadcrumb and its trimmed frontmatter title", async () => {
	await expect(noteNode(GAMMA_PATH).locator(".vicinity-graph-node__breadcrumb")).toHaveText("solo/");
	await expect(noteNode(GAMMA_PATH).locator(".vicinity-graph-node__title")).toHaveText(
		`solo/${GAMMA_TRIMMED_TITLE}`,
	);
});

test("both multi-member folders render as groups", async () => {
	await expect(folderGroup("projects")).toHaveCount(1);
	await expect(folderGroup("crowd")).toHaveCount(1);
});

// --- theme: arrowheads must follow the theme's --text-faint -----------------

for (const theme of ["dark", "light"] as const) {
	test(`arrowheads fill with the ${theme}-theme --text-faint`, async () => {
		await harness.setTheme(theme);
		const colors = await page.evaluate(() => {
			const arrowhead = document.querySelector(".vicinity-graph-flow .vicinity-graph-edge__arrowhead");
			if (arrowhead === null) {
				throw new Error("e2e: no arrowhead polygon in the rendered graph");
			}
			// Probe element: resolves var(--text-faint) to the same computed rgb()
			// format the polygon's fill reports, so the strings compare exactly.
			const probe = document.createElement("div");
			probe.style.color = "var(--text-faint)";
			document.body.appendChild(probe);
			const themeTextFaint = getComputedStyle(probe).color;
			probe.remove();
			return { arrowheadFill: getComputedStyle(arrowhead).fill, themeTextFaint };
		});
		expect(colors.arrowheadFill).toBe(colors.themeTextFaint);
	});
}

// --- interactions: click opens note, ctrl/cmd-click opens a NEW tab ---------
//
// These exercise a REAL pointer click (the native open gesture is what's under
// test). They run on the ALPHA graph, NOT note1's: alpha has only 3 nodes, so
// each renders large enough that a click lands on the node BODY. In note1's
// 11-node fit every node shrinks to ~20px — smaller than the hover-reveal pin
// button (a 20px top-right chip that is pointer-interactive even while
// invisible), so a center click hits the pin (which stops propagation) instead
// of opening the note. Clicking a big node sidesteps that overlap.
// (The tiny-node pin overlap itself is tracked as a follow-up UX ticket.)

const activeFilePath = () =>
	page.evaluate(() => (window as unknown as { app: any }).app.workspace.getActiveFile()?.path);

test("clicking a node opens that note in the current tab", async () => {
	// Land on the alpha graph (big nodes) with alpha as the active/main note, so
	// clicking the note1 neighbor is an observable current-tab switch.
	await harness.openFile(ALPHA_PATH);
	await harness.remountGraphView(); // refit so the target node is physically clickable
	await noteNode(NOTE1_PATH).click();
	await expect.poll(activeFilePath).toBe(NOTE1_PATH);
});

test("ctrl/cmd-clicking a node opens the note in a NEW tab", async () => {
	await harness.openFile(ALPHA_PATH);
	await harness.remountGraphView();
	const markdownLeafCount = () =>
		page.evaluate(() => (window as unknown as { app: any }).app.workspace.getLeavesOfType("markdown").length);
	const leavesBefore = await markdownLeafCount();
	await noteNode(NOTE1_PATH).click({ modifiers: ["ControlOrMeta"] });
	await expect.poll(markdownLeafCount).toBe(leavesBefore + 1);
	await expect.poll(activeFilePath).toBe(NOTE1_PATH);
});

// --- truncation badges: group "+N" and corner "+N hidden" overlay -----------

// KEEP LAST (or reset the cap): mutates the global nodeCap and does not restore
// it, so any test appended after this one would see the truncated graph.
test("a low node cap surfaces the group badge and the corner overlay", async () => {
	await harness.setGlobalNodeCap(TRUNCATION_NODE_CAP);
	// The cap change alone does not rebuild; an active-file change does. Bounce
	// through alpha so re-opening note1 is a real change (same-path is a no-op).
	await harness.openFile(ALPHA_PATH);
	await harness.openFile(NOTE1_PATH);

	// Visible: note1 (central, cap-exempt) + crowd/c1 + crowd/c2 (largest depth-1 neighbors).
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(3);

	const crowdBadge = folderGroup("crowd").locator(".vicinity-graph-group__badge");
	await expect(crowdBadge).toHaveText(plusNText(CROWD_HIDDEN_COUNT));

	const overlay = page.locator(".vicinity-graph-overlay-badge");
	await expect(overlay).toHaveText(hiddenOverlayText(ORPHAN_HIDDEN_TOTAL));
	await expect(overlay).toHaveAttribute("title", orphanBreakdownTitle(ORPHAN_BREAKDOWN));
});
