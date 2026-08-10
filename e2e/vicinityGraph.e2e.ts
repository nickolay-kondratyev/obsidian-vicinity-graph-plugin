import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { asFolderPath } from "../src/engine";
import { buttonChromeVsDeclared } from "./buttonChrome";
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

/** The second dev-vault canvas; sits at depth 2 from note1, so it joins no count above. */
const SECOND_CANVAS_PATH = "test2.canvas";
/** test2.canvas (MAIN) + note3 (file node) + note2 (text-node wikilink). */
const SECOND_CANVAS_NODE_COUNT = 3;
const GAMMA_TRIMMED_TITLE = "Gamma (solo, trimmed title)";

/** Truncation scenario: cap 2 keeps exactly crowd/c1+c2 (the path-order tiebreak — see CROWD_FIXTURES). */
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

test("the content zone's flex-grow pins the attachment strip to the node's bottom edge", async () => {
	const alpha = noteNode(ALPHA_PATH);
	// The note's own content (title + thumbnail) is the zone that grows to fill
	// the node — that grow is what replaced the strip's old `margin-top: auto`.
	await expect(alpha.locator(".vicinity-graph-node__content .vicinity-graph-node__title")).toHaveCount(1);
	// The attachment chips are SIBLINGS of that zone, never inside it — inside,
	// they would be consumed by the grow instead of sitting under it.
	await expect(alpha.locator(".vicinity-graph-node__content button.vicinity-graph-attachment")).toHaveCount(0);
	await expect(alpha.locator(".vicinity-graph-node__attachments")).toBeVisible();
	// The zone is otherwise a pure layout wrapper (it lost its only behavior when
	// the hover preview went away), so assert the layout itself, not just the
	// markup: measured against the node's own padding + border, the strip's
	// bottom must land ON the node's inner bottom edge. Without the grow the
	// strip would sit directly under the title with slack below it.
	const bottomSlackPx = await alpha.evaluate((node) => {
		const strip = node.querySelector<HTMLElement>(".vicinity-graph-node__attachments");
		if (strip === null) throw new Error("attachment strip missing");
		// Layout metrics, NOT getBoundingClientRect: React Flow scales nodes with
		// the pan/zoom transform, which would scale the rects but not the
		// computed padding, making a mixed comparison zoom-dependent.
		// `offsetTop` is measured from the node's padding edge (the node is
		// `position: relative`), and `clientHeight` is its padding-box height.
		const innerBottom = node.clientHeight - parseFloat(getComputedStyle(node).paddingBottom);
		return innerBottom - (strip.offsetTop + strip.offsetHeight);
	});
	expect(Math.abs(bottomSlackPx)).toBeLessThan(1); // sub-pixel: fractional layout rounding only
});

test("attachment chips keep their flat chip chrome, not Obsidian's raised-button chrome", async () => {
	const chip = noteNode(ALPHA_PATH).locator("button.vicinity-graph-attachment").first();
	const chrome = await buttonChromeVsDeclared(chip, {
		background: "var(--background-secondary)",
		boxShadow: "none",
	});
	expect(chrome.actual).toEqual(chrome.declared);
});

test("the pin button keeps its declared chip chrome, not Obsidian's raised-button chrome", async () => {
	const pin = noteNode(ALPHA_PATH).locator("button.vicinity-graph-pin-button");
	const chrome = await buttonChromeVsDeclared(pin, {
		background: "var(--background-primary)",
		boxShadow: "var(--shadow-s)",
	});
	expect(chrome.actual).toEqual(chrome.declared);
});

// The pin chip's two size rungs and the centre-clearance band that withholds it
// are covered in e2e/nodeResize.e2e.ts, where a stored size override renders the
// node at a chosen box through the REAL rebuild — and where the assertion is the
// invariant itself (the node still opens on click), not a computed style.

test("stepper buttons render flat inside their control pill, not as Obsidian buttons", async () => {
	// Computed style resolves regardless of the toolbar disclosure's open state.
	const stepperButton = page.locator("button.vicinity-graph-stepper__button").first();
	const chrome = await buttonChromeVsDeclared(stepperButton, {
		background: "transparent",
		boxShadow: "none",
	});
	expect(chrome.actual).toEqual(chrome.declared);
});

test("React Flow zoom controls keep their themed chrome, not Obsidian's raised-button chrome", async () => {
	// The library styles these via `.react-flow__controls-button` (0,1,0), which
	// loses to Obsidian's `button:not(.clickable-icon)` (0,1,1) without the
	// prefixed override in graph-view.css.
	const controlsButton = page.locator("button.react-flow__controls-button").first();
	const chrome = await buttonChromeVsDeclared(controlsButton, {
		background: "var(--background-primary)",
		boxShadow: "none",
	});
	expect(chrome.actual).toEqual(chrome.declared);
});

test("React Flow's interactivity lock button is not shipped — it has nothing to unlock here", async () => {
	// The lock toggles the STORE's nodesDraggable/nodesConnectable/elementsSelectable.
	// None of the three can reach this graph: dragging is off via the `nodesDraggable`
	// PROP (React Flow drills the prop, not the store, into every node wrapper),
	// nothing is wired to `onConnect`, and selection changes are filtered out in
	// `onNodesChange`. So the button only ever changed edge cursor styling and made
	// the (decorative) handles connectable again — ticket
	// nid_xvuptvuct2b9uget7oc2asyif_e. Zoom + fit-view stay.
	await expect(page.locator("button.react-flow__controls-interactive")).toHaveCount(0);
	await expect(page.locator("button.react-flow__controls-fitview")).toHaveCount(1);
	await expect(page.locator("button.react-flow__controls-zoomin")).toHaveCount(1);
});

test("the redraw control sits with the zoom buttons and re-renders the graph when pressed", async () => {
	// Ticket nid_cd9x8a7ltnht3vvxh13qcvlzr_e: a manual redraw next to +/- that
	// forces a fresh elk layout. It IS a `.react-flow__controls-button`, so it
	// shares the themed chrome asserted above; found by its accessible name.
	const redraw = page.locator("button.react-flow__controls-button[aria-label='Redraw graph']");
	await expect(redraw).toHaveCount(1);

	await redraw.click();

	// The forced relayout rebuilds and republishes the SAME alpha vicinity — the
	// graph stays whole (the click is not a no-op that blanks the pane).
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(ALPHA_NODE_COUNT);
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

test("cross-boundary member links collapse onto ONE edge anchored at the group box", async () => {
	// alpha is a `projects` group member; its link to root-level note1 collapses
	// from `projects/alpha.md->note1.md` onto `folder-group:projects->note1.md`.
	await expect(
		page.locator('.vicinity-graph-flow .react-flow__edge[data-id="folder-group:projects->note1.md"]'),
	).toHaveCount(1);
	await expect(
		page.locator('.vicinity-graph-flow .react-flow__edge[data-id="projects/alpha.md->note1.md"]'),
	).toHaveCount(0);
});

test("no corner overlay badge when nothing is truncated", async () => {
	await expect(page.locator(".vicinity-graph-overlay-badge")).toHaveCount(0);
});

// --- note1 focused: thumbnail, titles, groups -------------------------------

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

/**
 * The grayed `folder/` prefix on ungrouped nodes was REMOVED by design in
 * `998fdac` ("snug capped node width + remove folder prefix", 2026-07-23), which
 * also rewrote the authoritative `high-level-plan.md` sizing model — node width
 * now hugs the title alone. Folder identity comes from the group box label; the
 * old step-05 breadcrumb spec is superseded.
 *
 * Deliberately placed in the note1 section, whose vicinity contains
 * `solo/gamma.md` — an ungrouped note in a NON-root folder. That is the exact
 * shape the deleted `breadcrumbFolderOf(node, isGrouped)` rendered for (it
 * returned `undefined` only for grouped nodes and for vault-root nodes), so
 * gamma would carry a `solo/` breadcrumb if the removed code ever came back and
 * this assertion goes red. The alpha vicinity cannot serve here: alpha + beta
 * are grouped and note1 is at the vault root, so all three would have been
 * `undefined` even pre-`998fdac` — asserting there passes vacuously.
 *
 * Verified by mutation on 2026-07-26: temporarily re-rendering the breadcrumb
 * with the deleted `!isGrouped && folder !== root` condition turned THIS test red
 * (`Expected: 0, Received: 1` — gamma) while every alpha-section test stayed
 * green. The guard bites; the old placement would not have.
 */
test("no node renders a folder-prefix breadcrumb", async () => {
	await expect(page.locator(".vicinity-graph-node__breadcrumb")).toHaveCount(0);
});

/**
 * gamma is the singleton-folder fixture (`solo/` has one note, so it renders
 * ungrouped — groups need 2+ members). It used to be asserted as
 * `solo/<title>`; the `solo/` prefix went away with the breadcrumb removal
 * above, leaving the fixture's real point: its frontmatter title is padded
 * (`title: "  Gamma (solo, trimmed title)  "`) and must render trimmed.
 */
test("singleton-folder note shows its trimmed frontmatter title", async () => {
	await expect(noteNode(GAMMA_PATH).locator(".vicinity-graph-node__title")).toHaveText(GAMMA_TRIMMED_TITLE);
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
			// Color from a variable, not a literal: obsidianmd/no-static-styles-assignment
			// flags literal `.style` assignments; variable assignment is its sanctioned form.
			const probeColor = "var(--text-faint)";
			probe.style.color = probeColor;
			document.body.appendChild(probe);
			const themeTextFaint = getComputedStyle(probe).color;
			probe.remove();
			return { arrowheadFill: getComputedStyle(arrowhead).fill, themeTextFaint };
		});
		expect(colors.arrowheadFill).toBe(colors.themeTextFaint);
	});
}

// --- interactions: click focuses the node, ctrl/cmd-click opens a NEW tab ---
//
// These exercise a REAL pointer click (the native open gesture is what's under
// test). They run on the ALPHA graph, NOT note1's: alpha has only 3 nodes, so
// each renders at a comfortable size and the fitted zoom stays near 1, which
// keeps the click target physically large in a headless window. That the open
// click ALSO survives on the smallest nodes — where the hover-revealed pin chip
// shares the box with the node body — is asserted in e2e/nodeResize.e2e.ts
// (ticket nid_tclb98q9hxhmcuonamvr4ig1f_e), not here.

const activeFilePath = () =>
	page.evaluate(() => (window as unknown as { app: any }).app.workspace.getActiveFile()?.path);

const markdownLeafCount = () =>
	page.evaluate(() => (window as unknown as { app: any }).app.workspace.getLeavesOfType("markdown").length);

test("clicking a node makes it the graph's MAIN and shows its markdown in the current tab", async () => {
	// Land on the alpha graph (big nodes) with alpha as the active/main note, so
	// clicking the note1 neighbor is an observable graph re-center
	// (ticket nid_lfcyfbrggrusyv8xn1aroc7h1_e). The note opens in the SAME tab
	// (ticket nid_r5xy3vuw2kj1v75soe4ffwdjz_e) — never a new one.
	await harness.openFile(ALPHA_PATH);
	await harness.remountGraphView(); // refit so the target node is physically clickable
	const leavesBefore = await markdownLeafCount();
	await noteNode(NOTE1_PATH).click();
	await expect(noteNode(NOTE1_PATH)).toHaveAttribute("data-tier", "main");
	// The editor followed the focus — the clicked note's markdown is on screen…
	await expect.poll(activeFilePath).toBe(NOTE1_PATH);
	// …in the tab that was already open, keeping the tab count down.
	await expect.poll(markdownLeafCount).toBe(leavesBefore);
});

test("ctrl/cmd-clicking a node opens the note in a NEW tab", async () => {
	await harness.openFile(ALPHA_PATH);
	await harness.remountGraphView();
	const leavesBefore = await markdownLeafCount();
	await noteNode(NOTE1_PATH).click({ modifiers: ["ControlOrMeta"] });
	await expect.poll(markdownLeafCount).toBe(leavesBefore + 1);
	await expect.poll(activeFilePath).toBe(NOTE1_PATH);
});

// --- multi-canvas: the link regime is decided per canvas --------------------

/**
 * The partial-index guard. Obsidian indexes canvases ONE FILE AT A TIME, so across
 * runs this vault genuinely lands in all four combinations of (test.canvas indexed?,
 * test2.canvas indexed?) — measured while building this harness: a canvas made it
 * into `resolvedLinks` in only 4 of 8 launches, and never later in the misses.
 *
 * A provider that picked ONE link source for the whole vault would blank whichever
 * canvas sat on the wrong side of that split — with a vault-wide switch this
 * assertion goes red (1 node, no edges) in exactly the runs where test.canvas is
 * indexed and test2.canvas is not. Deciding per canvas is what makes it stable, so
 * the count below must hold on every run, not most of them.
 *
 * WHY-NOT rely on the sparse eval row instead: `.dev-vault` had a single canvas, so
 * no single-canvas fixture can observe this at all.
 */
test("a second, independently-indexed canvas still reports its own edges", async () => {
	await harness.openFile(SECOND_CANVAS_PATH);
	await expect(noteNode(SECOND_CANVAS_PATH)).toHaveAttribute("data-tier", "main");
	// Its file node (note3) AND its text-node wikilink (note2) — both regimes owe both.
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(SECOND_CANVAS_NODE_COUNT);
	await expect(noteNode("note3.md")).toHaveCount(1);
	await expect(noteNode("note2.md")).toHaveCount(1);
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

	// Visible: note1 (central, cap-exempt) + crowd/c1 + crowd/c2 (path-order tiebreak).
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(3);

	const crowdBadge = folderGroup("crowd").locator(".vicinity-graph-group__badge");
	await expect(crowdBadge).toHaveText(plusNText(CROWD_HIDDEN_COUNT));

	const overlay = page.locator(".vicinity-graph-overlay-badge");
	await expect(overlay).toHaveText(hiddenOverlayText(ORPHAN_HIDDEN_TOTAL));
	await expect(overlay).toHaveAttribute("title", orphanBreakdownTitle(ORPHAN_BREAKDOWN));
});
