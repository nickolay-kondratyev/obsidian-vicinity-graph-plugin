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
 *
 * A SECOND fixture is asserted here — `facing/` from `scripts/setup-dev-vault.sh`,
 * a folder-group box approached by 12 separate edges from one clustered side. It
 * guards a different property (which BORDER of a group box an edge attaches to)
 * that no other automated check in the repo can see; see that test's docblock.
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

/** `facing` fixture (scripts/setup-dev-vault.sh): a folder-group box crowded from one side. */
const FACING_HUB_PATH = "facing/hub-facing.md";
const FACING_GROUP_FOLDER = "facing";
const FACING_NEIGHBOUR_PREFIX = "facing-near";

/**
 * How close (px) an endpoint must sit to a border to count as ATTACHED to it.
 * A tolerance, not a layout constant: routed endpoints land on the border by
 * construction, so this only absorbs sub-pixel transform/rounding error. It stays
 * far below the box's smallest dimension, so it can never blur one side into another.
 */
const BORDER_HIT_TOL_PX = 6;

/**
 * Non-vacuity floor. The fixture puts 12 separate cross-boundary edges on the box,
 * so "no edge attaches off the facing side" would pass trivially if the selectors
 * broke and we saw ZERO terminals. Deliberately loose (not 12): it must catch a dead
 * selector or vanished edges without failing on layout jitter or corner rounding.
 */
const MIN_FACING_BOX_TERMINALS = 8;

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

/** Where each rendered edge endpoint lands on the `facing` group box, and which side faces the neighbours. */
interface FacingAttachmentReport {
	readonly facingSide: string;
	readonly terminalCount: number;
	/** Terminals on a border OTHER than the facing one, as `side@x,y` for a readable failure. */
	readonly offFacingTerminals: readonly string[];
}

/**
 * Reads, from the live DOM, which border of the `facing/` group box each edge
 * terminates on, and derives which border the neighbours actually sit off.
 *
 * Endpoints come from `getPointAtLength` + `getScreenCTM` because the rendered `d`
 * is in the flow's transformed coordinate space — the group box's client rect is not.
 */
function readFacingAttachment(): Promise<FacingAttachmentReport> {
	return page.evaluate(
		({ folder, neighbourPrefix, tol }) => {
			const group = document.querySelector(`.vicinity-graph-group[data-folder="${folder}"]`);
			if (group === null) {
				throw new Error(`facing group box not rendered: folder=[${folder}]`);
			}
			const box = group.getBoundingClientRect();
			const neighbours = Array.from(
				document.querySelectorAll(`.vicinity-graph-node[data-path^="${neighbourPrefix}"]`),
			);
			if (neighbours.length === 0) {
				throw new Error(`no facing neighbours rendered: prefix=[${neighbourPrefix}]`);
			}
			// The facing side is DERIVED from where the neighbours actually settled
			// (dominant axis of centroid - box centre), never hardcoded: if the layout
			// ever parks the blob elsewhere, the assertion follows it instead of going
			// green against the wrong border.
			let sumX = 0;
			let sumY = 0;
			for (const neighbour of neighbours) {
				const rect = neighbour.getBoundingClientRect();
				sumX += rect.left + rect.width / 2;
				sumY += rect.top + rect.height / 2;
			}
			const dx = sumX / neighbours.length - (box.left + box.width / 2);
			const dy = sumY / neighbours.length - (box.top + box.height / 2);
			const facingSide =
				Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? "top" : "bottom") : dx < 0 ? "left" : "right";

			const sideOf = (x: number, y: number): string | null => {
				if (x < box.left - tol || x > box.right + tol || y < box.top - tol || y > box.bottom + tol) {
					return null;
				}
				// NEAREST border wins, rather than a first-match ladder: a corner point is
				// within tolerance of two borders, and a ladder would label it by rule order.
				const candidates = [
					{ side: "left", distance: Math.abs(x - box.left) },
					{ side: "right", distance: Math.abs(x - box.right) },
					{ side: "top", distance: Math.abs(y - box.top) },
					{ side: "bottom", distance: Math.abs(y - box.bottom) },
				];
				let nearest: { side: string; distance: number } | null = null;
				for (const candidate of candidates) {
					if (nearest === null || candidate.distance < nearest.distance) {
						nearest = candidate;
					}
				}
				return nearest !== null && nearest.distance <= tol ? nearest.side : null;
			};

			const offFacingTerminals: string[] = [];
			let terminalCount = 0;
			const paths = document.querySelectorAll<SVGPathElement>(".vicinity-graph-flow .react-flow__edge-path");
			for (const path of Array.from(paths)) {
				const ctm = path.getScreenCTM();
				if (ctm === null) {
					continue;
				}
				for (const length of [0, path.getTotalLength()]) {
					const point = path.getPointAtLength(length);
					const x = ctm.a * point.x + ctm.c * point.y + ctm.e;
					const y = ctm.b * point.x + ctm.d * point.y + ctm.f;
					const side = sideOf(x, y);
					if (side === null) {
						continue;
					}
					terminalCount += 1;
					if (side !== facingSide) {
						offFacingTerminals.push(`${side}@${Math.round(x)},${Math.round(y)}`);
					}
				}
			}
			return { facingSide, terminalCount, offFacingTerminals };
		},
		{ folder: FACING_GROUP_FOLDER, neighbourPrefix: FACING_NEIGHBOUR_PREFIX, tol: BORDER_HIT_TOL_PX },
	);
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

/**
 * WHY this test exists at all: it is the ONLY automated readout of facing-side
 * attachment anywhere in the suite. The `[eval]` detour ratios in
 * `edgeRoutingEval.e2e.ts` are provably blind to it — measured byte-identical
 * (1.079 / 1.014) between an arm that attached every edge on the facing side and one
 * that wrapped edges round to the far border — because detour ratio scores route
 * LENGTH, and a wrong-side attachment barely moves it. Without this assertion a
 * regression in boundary-pin selection sails through a fully green suite.
 *
 * The property: all 12 `facing-nearN` neighbours sit off ONE side of the `facing/`
 * group box, so every edge must terminate on THAT border — none may wrap around to
 * the far or flanking sides.
 */
test("WHEN a folder group is crowded from one side THEN no edge attaches on a border facing away from the neighbours", async () => {
	await harness.openFile(FACING_HUB_PATH);
	await expect(page.locator(`.vicinity-graph-group[data-folder="${FACING_GROUP_FOLDER}"]`)).toBeAttached();
	// Poll for READINESS only (terminals present), so the settle is condition-driven
	// rather than a magic sleep. The property itself is then asserted ONCE, on a single
	// coherent snapshot: polling the property would turn a genuine violation into an
	// unreadable timeout instead of naming the offending terminals.
	await expect
		.poll(async () => (await readFacingAttachment()).terminalCount, { timeout: 20_000 })
		.toBeGreaterThanOrEqual(MIN_FACING_BOX_TERMINALS);

	const report = await readFacingAttachment();
	expect(
		report.offFacingTerminals,
		`edges wrapped past the facing side: facingSide=[${report.facingSide}] terminals=[${report.terminalCount}]`,
	).toEqual([]);
});
