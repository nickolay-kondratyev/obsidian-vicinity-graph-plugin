import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Step-06 HEADLINE scenario (QA §10, goal-3/goal-4) driven end-to-end through the
 * real controls UI — the Q-A per-doc semantics the unit suite proves in the
 * abstract, exercised here as a human would:
 *   pin a central → raise ITS depth in the current MAIN's view → the extra hops
 *   render → switch MAIN away and back restores it exactly → the pinned node's OWN
 *   central depth is untouched.
 *
 * Fixtures are e2e-only, ROOT-level (no folder groups to intercept pointer events)
 * and deliberately SPARSE — `sc_hub` has a single outgoing chain — so React Flow's
 * mount `fitView` keeps every node large and clear of the top-left controls panel,
 * which is what makes the hover/pin gestures deterministic.
 */

test.describe.configure({ mode: "serial" });

/**
 * The MAIN hub and the pin target carry a seeded `id` (obsidian-id-lib's
 * frontmatter key): per-doc depth settings are only editable once a note has a
 * stable docid — a fresh, never-id-stamped note correctly shows DISABLED
 * steppers. Seeding models the normal steady state (a note that already
 * participates in the graph), and avoids an id-minting frontmatter write on pin.
 */
const SCENARIO_FIXTURES: Record<string, string> = {
	"sc_hub.md": "---\nid: docid_scenariohub_e\n---\nScenario MAIN — links out to [[sc_x]].\n",
	"sc_x.md": "---\nid: docid_scenariox_e\n---\nPinned-central fixture — links out to [[sc_x1]].\n",
	"sc_x1.md": "Chain hop 1 → [[sc_x2]].\n",
	"sc_x2.md": "Chain hop 2 → [[sc_x3]].\n",
	"sc_x3.md": "Chain leaf.\n",
	"sc_z.md": "Unrelated MAIN for the switch-away step.\n",
};

const HUB = "sc_hub.md";
const OTHER_MAIN = "sc_z.md";
const X = "sc_x.md";
const X1 = "sc_x1.md";
const X2 = "sc_x2.md";
const X3 = "sc_x3.md";

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
	return page.locator(`.vicinity-graph-node[data-path="${path}"]`);
}

function centralRow(kind: "main" | "pinned"): Locator {
	return page.locator(`.vicinity-graph-central[data-kind="${kind}"]`);
}

/** The value span of one central's directional depth stepper. */
function depthValue(kind: "main" | "pinned", direction: "Outgoing" | "Incoming"): Locator {
	return centralRow(kind)
		.locator(".vicinity-graph-stepper")
		.filter({ hasText: direction })
		.locator(".vicinity-graph-stepper__value");
}

/**
 * Fires a stepper button's real onClick (write → rebuild). WHY-NOT a pointer
 * click: the steppers live in a React-Flow overlay Panel with an internal-scroll
 * body; in a headless window its lower controls sit off-viewport/behind the
 * scroll body, so a real click is unreliable. Invoking the button's own click
 * exercises the identical control→persist→rebuild chain (the pixel-level
 * clickability of a tall panel is QA §16, a human/visual concern). The node pin
 * gesture below stays a REAL pointer click — that native feel IS under test here.
 */
async function bumpDepth(kind: "main" | "pinned", direction: "Outgoing" | "Incoming"): Promise<void> {
	await centralRow(kind)
		.getByRole("button", { name: `Increase ${direction.toLowerCase()} depth` })
		.evaluate((el) => (el as HTMLButtonElement).click());
}

function toolbar(): Locator {
	return page.locator(".vicinity-graph-toolbar");
}

function pinnedDisclosure(): Locator {
	return page.locator(".vicinity-graph-disclosure", {
		has: page.locator(".vicinity-graph-disclosure__summary", { hasText: "Pinned centrals" }),
	});
}

/**
 * Expands a native <details> via its `open` property — the exact end-state a
 * summary click produces. WHY-NOT click the summary: the controls panel is a
 * React-Flow overlay with an internal-scroll body, so a lower nested summary is
 * unreliably hit-test-intercepted by that body; the disclosure toggle is native
 * chrome, while the real controls under test (steppers) are still clicked for real.
 */
async function ensureOpen(details: Locator): Promise<void> {
	await details.evaluate((el) => {
		(el as HTMLDetailsElement).open = true;
	});
}

/** Reveals a node's hover-only pin button, then clicks it. */
async function clickPin(path: string): Promise<void> {
	const node = noteNode(path);
	await node.hover();
	await node.locator(".vicinity-graph-pin-button").click();
}

test("pinned-central depth is per-MAIN-doc: it adds hops, restores on return, and never touches the pin's own depth", async () => {
	// Refit so every fixture node is physically clickable.
	await harness.remountGraphView();
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");

	// Baseline: sc_x is a plain depth-1 neighbor; its outgoing hop sc_x1 is out of range.
	await expect(noteNode(X)).toHaveAttribute("data-tier", "regular");
	await expect(noteNode(X1)).toHaveCount(0);

	// Pin sc_x → it becomes a central and re-explores at the default depth 1, pulling sc_x1.
	await clickPin(X);
	await expect(noteNode(X)).toHaveAttribute("data-tier", "pinned-central");
	await expect(noteNode(X1)).toHaveCount(1);
	await expect(noteNode(X2)).toHaveCount(0);

	// Raise sc_x's depth (in sc_hub's view) to 3 → sc_x2 then sc_x3 come into range.
	await ensureOpen(toolbar());
	await ensureOpen(pinnedDisclosure());
	await bumpDepth("pinned", "Outgoing"); // 1 → 2
	await expect(noteNode(X2)).toHaveCount(1);
	// A rebuild re-renders the toolbar; re-assert the disclosure is open before the next click.
	await ensureOpen(pinnedDisclosure());
	await bumpDepth("pinned", "Outgoing"); // 2 → 3
	await expect(noteNode(X3)).toHaveCount(1);
	await expect(depthValue("pinned", "Outgoing")).toHaveText("3");

	// Switch MAIN to a note that lacks sc_hub's override → the depth-3 hop is gone.
	await harness.openFile(OTHER_MAIN);
	await expect(noteNode(OTHER_MAIN)).toHaveAttribute("data-tier", "main");
	await expect(noteNode(X3)).toHaveCount(0);

	// Back to sc_hub → the pinned-central + its depth-3 hops restore exactly.
	await harness.openFile(HUB);
	await harness.remountGraphView();
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");
	await expect(noteNode(X)).toHaveAttribute("data-tier", "pinned-central");
	await expect(noteNode(X3)).toHaveCount(1);

	// Open sc_x as its OWN MAIN → its own central depth is the untouched default 1:
	// sc_x1 (depth 1) renders, sc_x2 (depth 2) does not. The hub-scoped "3" never leaked.
	await harness.openFile(X);
	await harness.remountGraphView();
	await expect(noteNode(X)).toHaveAttribute("data-tier", "main");
	await ensureOpen(toolbar());
	await expect(depthValue("main", "Outgoing")).toHaveText("1");
	await expect(noteNode(X1)).toHaveCount(1);
	await expect(noteNode(X2)).toHaveCount(0);
});
