import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ObsidianHarness, PLUGIN_ID } from "./obsidianHarness";

/**
 * Visual-smoke e2e for edge routing: obstacle-avoiding routing is always on, so an
 * edge whose straight line would cross another node must render as a multi-segment
 * routed polyline (obstacle-avoiding) rather than a single straight segment.
 *
 * Fixture: a hub (`er_c`) linked to a 6-node ring (`er1..er6`) that also carries
 * three "diameter" chords (er1↔er4, er2↔er5, er3↔er6). Force layout pulls the
 * hub to the ring's centroid (it links every ring node), so a diameter chord's
 * straight line passes through the hub — a guaranteed obstacle for the router to
 * detour around. The layout is deterministic (seeded LCG in d3ForceRefinement),
 * so once a detour occurs it is reproducible, not flaky.
 *
 * Chords are sibling links between depth-1 neighbours, so they only render under
 * the `all-edges` visibility mode (default `walked-from-center` shows just the
 * radial star, which has no crossings). `all-edges` is set once in `beforeAll` so
 * the crossing chords are present and genuinely load the router.
 *
 * Bend detector: a routed detour (>=3 waypoints) emits >=2 `L` commands in its
 * path `d`; a straight edge emits exactly one `L` and a paired bow emits none.
 * So ">=2 L commands" precisely flags a genuine obstacle-avoiding route without
 * depending on exact coordinates.
 */

test.describe.configure({ mode: "serial" });

const HUB_PATH = "erouting/er_c.md";
/** A vault note to bounce through so re-opening the hub is a real active-file change (same-path is a no-op). */
const BOUNCE_PATH = "note1.md";

/** Hub + ring-with-diameters fixture (see file header). Links resolve by basename. */
const ROUTING_FIXTURES: Record<string, string> = {
	"erouting/er_c.md": "Hub links [[er1]] [[er2]] [[er3]] [[er4]] [[er5]] [[er6]].\n",
	"erouting/er1.md": "er1 links [[er2]] and diameter [[er4]].\n",
	"erouting/er2.md": "er2 links [[er3]] and diameter [[er5]].\n",
	"erouting/er3.md": "er3 links [[er4]] and diameter [[er6]].\n",
	"erouting/er4.md": "er4 links [[er5]].\n",
	"erouting/er5.md": "er5 links [[er6]].\n",
	"erouting/er6.md": "er6 links [[er1]].\n",
};

const EDGE_PATH_SELECTOR = ".vicinity-graph-flow .react-flow__edge-path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, ".out");
const SCREENSHOT_PATH = path.join(OUT_DIR, "edge-routing-force.png");

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: ROUTING_FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	await setAllEdgesVisibility();
	await harness.openFile(HUB_PATH);
	await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
});

test.afterAll(async () => {
	await harness?.close();
});

/** All rendered edge-path `d` attributes. */
function edgePathData(): Promise<string[]> {
	return page.$$eval(EDGE_PATH_SELECTOR, (elements) =>
		elements.map((element) => element.getAttribute("d") ?? ""),
	);
}

/** Count of edges whose path is a multi-segment routed detour (>=2 `L` commands). */
function bentEdgeCount(pathData: readonly string[]): number {
	return pathData.filter((d) => (d.match(/L/g) ?? []).length >= 2).length;
}

/** Sets edge visibility to the induced-subgraph mode so sibling chords (which can cross the hub) render. */
async function setAllEdgesVisibility(): Promise<void> {
	await page.evaluate(async (pluginId) => {
		const app = (window as unknown as { app: any }).app;
		const store = app.plugins.plugins[pluginId].pluginDataStore;
		await store.saveGlobalView({ ...store.globalView(), edgeVisibility: "all-edges" });
	}, PLUGIN_ID);
}

test("WHEN routing runs THEN at least one edge bends around a node, and a screenshot is captured", async () => {
	// Bounce the active file to force a full re-run of the pipeline (route
	// computation happens during publish), then read a stable non-empty edge set.
	await harness.openFile(BOUNCE_PATH);
	await harness.openFile(HUB_PATH);
	await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();

	await expect.poll(async () => bentEdgeCount(await edgePathData())).toBeGreaterThan(0);

	fs.mkdirSync(OUT_DIR, { recursive: true });
	await page.locator(".vicinity-graph-flow").screenshot({ path: SCREENSHOT_PATH });
});
