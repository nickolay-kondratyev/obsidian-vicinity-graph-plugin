import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Step-06 HEADLINE scenario (QA §10, goal-3/goal-4) driven end-to-end through the
 * real controls UI: the GLOBAL pin lifecycle as a human performs it — pin the
 * MAIN central, switch MAIN away (it stays as a pinned central), unpin it.
 *
 * TODO(PHASE 2 of nid_ez38gf1mrdgh5kxedzrdicwzl_e): re-add a spec covering the
 * global depth stepper driving MAIN *and* every pinned central. The per-MAIN-doc
 * depth spec that lived here covered behavior this ticket deleted.
 *
 * Fixtures are e2e-only, ROOT-level (no folder groups to intercept pointer events)
 * and deliberately SPARSE — `sc_hub` has a single outgoing chain — so React Flow's
 * mount `fitView` keeps every node large and clear of the top-left controls panel,
 * which is what makes the hover/pin gestures deterministic.
 */

test.describe.configure({ mode: "serial" });

/**
 * The MAIN hub and the pin target carry a seeded `id` (obsidian-id-lib's
 * frontmatter key): a note can only be PINNED once it has a stable docid.
 * Seeding models the normal steady state (a note that already participates in
 * the graph), and avoids an id-minting frontmatter write on pin.
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

/** Reveals a node's hover-only pin button, then clicks it. */
async function clickPin(path: string): Promise<void> {
	const node = noteNode(path);
	await node.hover();
	await node.locator(".vicinity-graph-pin-button").click();
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
	await expect(noteNode(HUB).locator(".vicinity-graph-pin-button")).toHaveAttribute("aria-label", "Pin to graph");
	await clickPin(HUB);
	// Still MAIN-tier (main styling wins) but the toggle flips to unpin.
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");
	await expect(noteNode(HUB).locator(".vicinity-graph-pin-button")).toHaveAttribute(
		"aria-label",
		"Unpin from graph",
	);

	// Switch MAIN away → the pinned ex-MAIN stays in the graph as a pinned central.
	await harness.openFile(OTHER_MAIN);
	await expect(noteNode(OTHER_MAIN)).toHaveAttribute("data-tier", "main");
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "pinned-central");

	// Unpin it from here → it loses central status. It stays VISIBLE as a plain
	// neighbor: sc_x is still pinned and sc_hub links to it, so the hub is sc_x's
	// incoming depth-1 node — the tier flip is the unpin proof.
	await harness.remountGraphView(); // refit so the hub node is physically clickable
	await clickPin(HUB);
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "regular");
});
