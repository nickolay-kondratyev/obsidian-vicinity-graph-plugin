import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * LOCAL PINNING headline scenario, driven end-to-end through the real controls UI
 * (ticket `nid_6eust4js4l85s163nezeq3v3g_e`). A local pin pins a target ONLY in the
 * context of the current MAIN note; it makes the target a central (a root) while that
 * main is active and NEVER carries across mains. This spec exercises the whole claim:
 *
 * 1. locally pin a neighbor → it becomes a pinned central under this main;
 * 2. the DISCONNECTED case (owner decision 6): a locally-pinned note stays central
 *    even once the main no longer reaches it by any link — the pin alone keeps it in;
 * 3. switch MAIN away → the local pin does not apply, the target drops out;
 * 4. switch MAIN back → it is central again (the pin is scoped to this main, not lost);
 * 5. it survives a real Obsidian restart (the local-pin map is persisted in data.json).
 *
 * A sibling of `pinnedCentralScenario.e2e.ts` (which owns the GLOBAL pin lifecycle),
 * kept apart so each spec states ONE feature's claim. SERIAL and order-dependent by
 * design: each step inherits the GIVEN of the one above it.
 *
 * Fixtures are e2e-only, ROOT-level (no folder groups to intercept pointer events) and
 * SPARSE, so React Flow's mount `fitView` keeps every node large and clear of the
 * top-left controls panel — what makes the hover/pin gestures deterministic. Every note
 * that is ever PINNED (hub as the local-pin MAIN key, plus lp_a / lp_b as targets)
 * carries a seeded `id` (obsidian-id-lib's frontmatter key): a note can only be pinned
 * once it has a stable docid, and seeding models the normal steady state.
 *
 * Each also carries a DESCRIPTIVE frontmatter `title` — deliberately, not for show. Node
 * WIDTH hugs the title, and the LOCAL-pin chip is the LEFTMOST of three hover chips, so it
 * only sits INSIDE the node once the node is wide enough to hold all three (the narrow-node
 * clipping edge in docs-internal/tickets/ticket-pin-offset-centre-clearance.md). A bare
 * filename title like `lp_a` sizes the node so narrow that the chip's centre spills past the
 * node's left edge onto the pane, where a real click cannot land. The `[[lp_a]]` wikilinks
 * still resolve by FILENAME, so the titles change the rendered width only, never the graph.
 */

test.describe.configure({ mode: "serial" });

const SCENARIO_FIXTURES: Record<string, string> = {
	"lp_hub.md": "---\nid: docid_lphub_e\ntitle: Local pin hub\n---\nLocal-pin MAIN — links out to [[lp_a]].\n",
	"lp_a.md":
		"---\nid: docid_lpa_e\ntitle: Local pin target A\n---\nNeighbor + local-pin target — links out to [[lp_b]].\n",
	"lp_b.md": "---\nid: docid_lpb_e\ntitle: Local pin target B\n---\nTwo hops from the hub — reachable only via lp_a.\n",
	"lp_other.md": "Unrelated MAIN for the switch-away step (links nowhere near lp_a / lp_b).\n",
};

const HUB = "lp_hub.md";
const OTHER_MAIN = "lp_other.md";
/** Direct neighbor of the hub (depth 1) AND a local-pin target. */
const A = "lp_a.md";
/** Two hops from the hub (lp_a → lp_b): out of the hub's default depth-1 reach on its own. */
const B = "lp_b.md";

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

/** Reveals a node's hover-only LOCAL pin chip (distinct class from the global pin), then clicks it. */
async function clickLocalPin(path: string): Promise<void> {
	const node = noteNode(path);
	await node.hover();
	await node.locator(".vicinity-graph-local-pin-button").click();
}

test("a locally pinned neighbor becomes central, stays central once disconnected, and is scoped to its main", async () => {
	// GIVEN the hub as MAIN, refit so its nodes are physically clickable. lp_a is a
	// depth-1 neighbor (regular); lp_b — two hops out — is beyond the default reach.
	await harness.openFile(HUB);
	await harness.remountGraphView();
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");
	await expect(noteNode(A)).toHaveAttribute("data-tier", "regular");
	await expect(noteNode(B)).toHaveCount(0);

	// MAIN itself offers NO local pin (a note cannot be pinned under itself, decision Q4).
	await expect(noteNode(HUB).locator(".vicinity-graph-local-pin-button")).toHaveCount(0);

	// (1) Locally pin lp_a → it becomes a pinned central under this main. As a central it
	// now traverses at the pinned depth, pulling its own out-neighbor lp_b into view.
	await clickLocalPin(A);
	await expect(noteNode(A)).toHaveAttribute("data-tier", "pinned-central");
	await expect(noteNode(A).locator(".vicinity-graph-local-pin-button")).toHaveAttribute(
		"aria-label",
		"Unpin for this note",
	);
	await expect(noteNode(B)).toHaveCount(1);

	// (2) DISCONNECTED case (owner decision 6): locally pin lp_b too, then UNPIN lp_a. lp_a
	// falls back to a plain depth-1 neighbor, so the hub no longer reaches lp_b by ANY link
	// (it is two hops out). lp_b nonetheless stays central — the local pin alone keeps it in.
	await harness.remountGraphView(); // refit so lp_b is physically clickable
	await clickLocalPin(B);
	await expect(noteNode(B)).toHaveAttribute("data-tier", "pinned-central");
	await clickLocalPin(A);
	await expect(noteNode(A)).toHaveAttribute("data-tier", "regular");
	await expect(noteNode(B)).toHaveAttribute("data-tier", "pinned-central");

	// (3) Switch MAIN away → the local pin does not apply under lp_other, so lp_b (and lp_a)
	// drop out entirely: neither is linked from lp_other nor pinned under it.
	await harness.openFile(OTHER_MAIN);
	await expect(noteNode(OTHER_MAIN)).toHaveAttribute("data-tier", "main");
	await expect(noteNode(B)).toHaveCount(0);
	await expect(noteNode(A)).toHaveCount(0);

	// (4) Switch MAIN back to the hub → lp_b is central again: the pin was scoped to this
	// main all along, not lost when another note was active.
	await harness.openFile(HUB);
	await harness.remountGraphView();
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");
	await expect(noteNode(B)).toHaveAttribute("data-tier", "pinned-central");
});

test("a local pin survives a real Obsidian restart", async () => {
	// Booting Obsidian twice (initial + relaunch) exceeds the default per-test budget.
	test.setTimeout(200_000);

	// GIVEN lp_b locally pinned under the hub (from the test above), central right now.
	await expect(noteNode(B)).toHaveAttribute("data-tier", "pinned-central");

	harness = await harness.relaunch();
	page = harness.page;
	await harness.openFile(HUB);
	await harness.remountGraphView();
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");

	// The local-pin map is docid-KEYED (by main, valued by target), so its entry only
	// resolves through a warmed path↔docid map; the first build after a restart warms
	// what it needs on demand — a plain assertion, no polling out the orphan sweep.
	await expect(noteNode(B)).toHaveAttribute("data-tier", "pinned-central");
	await expect(noteNode(B).locator(".vicinity-graph-local-pin-button")).toHaveAttribute(
		"aria-label",
		"Unpin for this note",
	);
});
