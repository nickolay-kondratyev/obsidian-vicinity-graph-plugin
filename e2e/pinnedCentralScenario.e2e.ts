import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Step-06 HEADLINE scenario (QA §10, goal-3/goal-4) driven end-to-end through the
 * real controls UI, in two parts:
 *
 * 1. the GLOBAL pin lifecycle as a human performs it — pin the MAIN central,
 *    switch MAIN away (it stays as a pinned central), unpin it;
 * 2. the PER-ROLE global depth dials (ticket `nid_ts4rx2pfo6o18verzk07z16g8_e`):
 *    the active-note "Links out" drives MAIN's reach, the "Pinned links out"
 *    dial drives every pinned central's reach — the depth tests below split
 *    that claim into its halves, so a failure names which root stopped
 *    honouring its dial. There are still no per-NOTE depth dials to test.
 *
 * SERIAL and order-dependent by design (see `test.describe.configure`): each test
 * states the GIVEN it inherits from the one above it and verifies it before acting.
 *
 * Fixtures are e2e-only, ROOT-level (no folder groups to intercept pointer events)
 * and deliberately SPARSE — `sc_hub` has a single outgoing chain — so React Flow's
 * mount `fitView` keeps every node large and clear of the top-left controls panel,
 * which is what makes the hover/pin gestures deterministic.
 */

test.describe.configure({ mode: "serial" });

/**
 * The MAIN hub and the pin target carry a seeded `id` (stable-ids-for-obsidian's
 * frontmatter key): a note can only be PINNED once it has a stable docid.
 * Seeding models the normal steady state (a note that already participates in
 * the graph), and avoids an id-minting frontmatter write on pin.
 *
 * The hub is deliberately BARE (no headings): an EMPTY MAIN central renders at
 * the central prominence floor, so `clickPin(HUB)` below is also the e2e proof
 * that the hover pin chip is usable on a default-sized central — ticket
 * `nid_tclb98q9hxhmcuonamvr4ig1f_e` raised that floor past the chip's full-size
 * rung and dropped the container gate that used to hide the chip outright.
 * Restore the headings and this spec stops covering that. (`sc_x` keeps its
 * outline: it doubles as the pinned-central DEPTH fixture below, and a node with
 * headings is the ordinary case there.)
 */
const SCENARIO_FIXTURES: Record<string, string> = {
	"sc_hub.md": "---\nid: docid_scenariohub_e\n---\nScenario MAIN — links out to [[sc_x]].\n",
	"sc_x.md": "---\nid: docid_scenariox_e\n---\nPinned-central fixture — links out to [[sc_x1]].\n\n# Alpha\n\n## Beta\n\n## Gamma\n",
	"sc_x1.md": "Chain hop 1 → [[sc_x2]].\n",
	"sc_x2.md": "Chain hop 2 → [[sc_x3]].\n",
	"sc_x3.md": "Chain leaf.\n",
	"sc_z.md": "Unrelated MAIN for the switch-away step.\n",
};

const HUB = "sc_hub.md";
const OTHER_MAIN = "sc_z.md";
const X = "sc_x.md";
/** Two hops out from the hub, one hop out from `sc_x` — reachable only above the default depth 1. */
const X1 = "sc_x1.md";
/** Three hops out from the hub, two from `sc_x`: ONLY a pinned `sc_x` at pinned depth 2 reaches it. */
const X2 = "sc_x2.md";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: SCENARIO_FIXTURES });
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

/** Reveals a node's hover-only pin button, then clicks it. */
async function clickPin(path: string): Promise<void> {
	const node = noteNode(path);
	await node.hover();
	await node.locator(".vicinity-graph-pin-button").click();
}

/** The panel's ACTIVE-note depth block (`:not` — the pinned block shares the base class). */
function depthSection(): Locator {
	return page.locator(".vicinity-graph-depth-controls:not(.vicinity-graph-depth-controls--pinned)");
}

/** The panel's PINNED-note depth block. */
function pinnedDepthSection(): Locator {
	return page.locator(".vicinity-graph-depth-controls--pinned");
}

function linksOutDepthValue(): Locator {
	return depthSection()
		.locator(".vicinity-graph-stepper")
		.filter({ hasText: "Links out" })
		.locator(".vicinity-graph-stepper__value");
}

/**
 * Opens the collapsed controls panel via the native `open` property — the exact
 * end-state a summary click produces. WHY-NOT click it: the panel is a React-Flow
 * overlay whose scrolling body unreliably intercepts hit-tests on nested chrome.
 * The controls under test (the stepper, the pin buttons) are still clicked for real.
 */
async function openToolbar(): Promise<void> {
	await page.locator(".vicinity-graph-toolbar").evaluate((el) => {
		(el as HTMLDetailsElement).open = true;
	});
}

/** Fires the stepper's real handler: in a headless window the panel can sit off-viewport. */
async function bumpLinksOutDepth(): Promise<void> {
	// `exact`: the pinned block's "Increase pinned links out" contains this name.
	await depthSection()
		.getByRole("button", { name: "Increase links out", exact: true })
		.evaluate((el) => (el as HTMLButtonElement).click());
}

/** Same real-handler firing, for the pinned block's own outgoing dial. */
async function bumpPinnedLinksOutDepth(): Promise<void> {
	await pinnedDepthSection()
		.getByRole("button", { name: "Increase pinned links out" })
		.evaluate((el) => (el as HTMLButtonElement).click());
}

/** And for the pinned block's INCOMING dial (ships OPT-IN at depth 0). */
async function bumpPinnedLinksInDepth(): Promise<void> {
	await pinnedDepthSection()
		.getByRole("button", { name: "Increase pinned links in" })
		.evaluate((el) => (el as HTMLButtonElement).click());
}

function pinnedLinksInDepthValue(): Locator {
	return pinnedDepthSection()
		.locator(".vicinity-graph-stepper")
		.filter({ hasText: "Pinned links in" })
		.locator(".vicinity-graph-stepper__value");
}

test("the MAIN central itself can be pinned, survives switching MAIN, and can be unpinned", async () => {
	// Land on the hub as MAIN with a refit so its node is physically clickable.
	await harness.openFile(HUB);
	await harness.remountGraphView();
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");

	// Pin sc_x first: it keeps sc_hub in the graph (as sc_x's incoming depth-1 node)
	// after the hub is unpinned at the end, which is what makes the final tier flip —
	// rather than the node vanishing — the unpin proof.
	await clickPin(X);
	await expect(noteNode(X)).toHaveAttribute("data-tier", "pinned-central");

	// MAIN offers the pin gesture too (keep the current central around before navigating away).
	// The chip is an aria-pressed TOGGLE with a CONSTANT name; its state lives in
	// aria-pressed, and the flipping tooltip (title) is the visible hover hint.
	await expect(noteNode(HUB).locator(".vicinity-graph-pin-button")).toHaveAttribute("aria-label", "Pin to graph");
	await expect(noteNode(HUB).locator(".vicinity-graph-pin-button")).toHaveAttribute("aria-pressed", "false");
	await expect(noteNode(HUB).locator(".vicinity-graph-pin-button")).toHaveAttribute("title", "Pin to graph");
	await clickPin(HUB);
	// Still MAIN-tier (main styling wins) but the toggle flips to pressed.
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");
	await expect(noteNode(HUB).locator(".vicinity-graph-pin-button")).toHaveAttribute("aria-label", "Pin to graph");
	await expect(noteNode(HUB).locator(".vicinity-graph-pin-button")).toHaveAttribute("aria-pressed", "true");
	await expect(noteNode(HUB).locator(".vicinity-graph-pin-button")).toHaveAttribute("title", "Unpin from graph");

	// Switch MAIN away → the pinned ex-MAIN stays in the graph as a pinned central.
	await harness.openFile(OTHER_MAIN);
	await expect(noteNode(OTHER_MAIN)).toHaveAttribute("data-tier", "main");
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "pinned-central");

	// Unpin it from here → it loses central status. It stays VISIBLE as a plain
	// neighbor: sc_x is still pinned and sc_hub links to it, so the hub is sc_x's
	// incoming depth-1 node — the tier flip is the unpin proof. That incoming reach
	// ships OPT-IN (`pinnedLinkDepthIn` defaults to 0 — owner decision pinned in
	// src/engine/settingsProductDefaults.test.ts), so raise the pinned dial first;
	// without it the unpinned hub would VANISH instead of flipping tier.
	await openToolbar();
	await bumpPinnedLinksInDepth();
	await expect(pinnedLinksInDepthValue()).toHaveText("1");
	await harness.remountGraphView(); // refit so the hub node is physically clickable
	await clickPin(HUB);
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "regular");
});

test("WHEN the ACTIVE-note Links-out depth is raised THEN MAIN's own reach grows by a hop", async () => {
	// GIVEN sc_hub is MAIN with NOTHING pinned (the lifecycle test above leaves sc_x
	// pinned, so unpinning it is part of the GIVEN) at the shipped depth of 1: the
	// graph stops at sc_x, one hop out.
	await harness.openFile(HUB);
	await harness.remountGraphView();
	await clickPin(X);
	await expect(noteNode(X)).toHaveAttribute("data-tier", "regular");
	await expect(noteNode(X1)).toHaveCount(0);

	// WHEN the panel's outgoing stepper goes 1 → 2.
	await openToolbar();
	await bumpLinksOutDepth();
	await expect(linksOutDepthValue()).toHaveText("2");

	// THEN the second hop out from MAIN joins the graph.
	await expect(noteNode(X1)).toHaveCount(1);
});

test("WHEN a note is pinned THEN its reach follows the PINNED depth dial, not the active-note one", async () => {
	// GIVEN the ACTIVE "Links out" depth is 2 (previous test) and nothing is pinned, so
	// sc_x2 — THREE hops from MAIN — is out of reach.
	await expect(linksOutDepthValue()).toHaveText("2");
	await expect(noteNode(X2)).toHaveCount(0);

	// WHEN sc_x becomes a pinned central.
	await harness.remountGraphView(); // refit so the sc_x node is physically clickable
	await clickPin(X);
	await expect(noteNode(X)).toHaveAttribute("data-tier", "pinned-central");

	// THEN sc_x2 is STILL out of reach: the pinned dial sits at its default of 1, and
	// the active-note depth of 2 deliberately does not apply to a pinned root.
	await expect(noteNode(X2)).toHaveCount(0);

	// WHEN the pinned "Pinned links out" dial goes 1 → 2.
	await openToolbar();
	await bumpPinnedLinksOutDepth();

	// THEN sc_x2 joins the graph: only a root AT sc_x reaches it within 2 hops, so the
	// pinned central is traversing with the pinned dial.
	await expect(noteNode(X2)).toHaveCount(1);
});
