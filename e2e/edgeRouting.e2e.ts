import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ObsidianHarness, PLUGIN_ID } from "./obsidianHarness";

/**
 * Visual-smoke e2e for edge routing (ticket edge-routing__02): with the
 * `edgeRouting` setting ON, an edge whose straight line would cross another node
 * must render as a multi-segment routed polyline (obstacle-avoiding), and OFF it
 * stays a single straight/curved segment.
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
 * radial star, which has no crossings). Both tests run under `all-edges` (set once
 * in `beforeAll`) so the crossing chords are present in BOTH: the ONLY variable
 * between them is the routing toggle. That makes the OFF assertion a real guard —
 * "0 bends even with crossings present" — not the trivial pass a no-crossing star
 * would give.
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
	// Both tests share the crossing-chord graph so routing is the only variable.
	await setAllEdgesVisibility();
	// Routing now ships ON by default (edge-routing__03); pin it OFF here so the
	// first test's "0 bends" baseline is deterministic and not the shipped default.
	await harness.setEdgeRouting(false);
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

test("WHEN routing is OFF THEN every edge stays straight even though crossing chords are present", async () => {
	// Wait for the graph to settle: the beforeAll visibility + routing-OFF writes
	// each drive a rebuild that can transiently detach edges, so read a stable
	// non-empty edge set before asserting (avoids a load-dependent 0-edge race).
	await expect.poll(async () => (await edgePathData()).length).toBeGreaterThan(0);
	// Crossing diameter chords ARE rendered here (all-edges), yet with routing OFF
	// none should detour: straight edges have exactly one `L`, paired bows none.
	expect(bentEdgeCount(await edgePathData())).toBe(0);
});

test("WHEN routing is ON THEN at least one edge bends around a node, and a screenshot is captured", async () => {
	await harness.setEdgeRouting(true);
	// A settings change alone does not rebuild; bounce the active file to force a
	// full re-run of the pipeline (route computation happens during publish).
	await harness.openFile(BOUNCE_PATH);
	await harness.openFile(HUB_PATH);
	await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();

	await expect.poll(async () => bentEdgeCount(await edgePathData())).toBeGreaterThan(0);

	fs.mkdirSync(OUT_DIR, { recursive: true });
	await page.locator(".vicinity-graph-flow").screenshot({ path: SCREENSHOT_PATH });
});

/** True when every rendered edge path is well-formed (starts with a moveto, no NaN coords). */
function allPathsWellFormed(pathData: readonly string[]): boolean {
	return pathData.length > 0 && pathData.every((d) => d.startsWith("M") && !d.includes("NaN"));
}

/** Switches layout + routing ON, re-opens the hub, and returns once edges render. */
async function renderHubUnder(mode: "layered" | "radial"): Promise<void> {
	await harness.setEdgeRouting(true);
	await harness.setLayoutMode(mode);
	await harness.openFile(BOUNCE_PATH);
	await harness.openFile(HUB_PATH);
	await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
	await expect.poll(async () => allPathsWellFormed(await edgePathData())).toBe(true);
}

/**
 * The routing pass is layout-agnostic (it consumes only post-layout absolute
 * positions), so it routes in `force` and `layered` — item 1. `layered` pulls the
 * hub among the rows it links, so a diameter chord still meets the hub: a genuine
 * obstacle to detour around (not a fake assertion).
 */
test("WHEN routing is ON under layered layout THEN edges are well-formed and at least one detours around a node", async () => {
	await renderHubUnder("layered");
	await expect.poll(async () => bentEdgeCount(await edgePathData())).toBeGreaterThan(0);
});

/**
 * `radial` is deliberately EXCLUDED from routing (human decision, edge-routing__03):
 * ring placement makes spokes near-straight, so routing there only adds visibility-
 * graph cost for no visual gain and is gated off in the controller. So routing ON
 * under radial must yield ZERO bends — this asserts the GATE, not a regression.
 */
test("WHEN routing is ON under radial layout THEN NO edge bends (routing gated off for radial)", async () => {
	await renderHubUnder("radial");
	await expect.poll(async () => bentEdgeCount(await edgePathData())).toBe(0);
});
