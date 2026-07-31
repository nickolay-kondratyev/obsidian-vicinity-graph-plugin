import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { EngineDefaults } from "../src/engine";
import { ObsidianHarness } from "./obsidianHarness";

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
 * Chords are sibling links between depth-1 neighbours, and ONLY walked links become
 * edges — so the fixture is driven at outgoing depth 2, where the BFS expands each
 * ring node once more and genuinely walks the chords. The ring is closed (every ring
 * link stays inside the fixture), so the second hop adds edges without adding nodes.
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
 * It shares this file's outgoing-depth-2 driving for the SAME reason the ring does:
 * its cluster links are sibling links between depth-1 neighbours, so only the second
 * hop walks them — and without them walked there is no clustering force and no crowd.
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

/**
 * Depths both fixtures here run at: the second outgoing hop is what walks the ring's
 * diameter chords AND the `facing/` neighbours' cluster links (see the file header).
 */
const WALK_SIBLINGS_DEPTHS = {
	...EngineDefaults.depthSettings(),
	linkDepthOut: 2,
	embedDepthOut: 2,
	linkDepthIn: 1,
};

/** `facing` fixture (scripts/setup-dev-vault.sh): a folder-group box crowded from one side. */
const FACING_HUB_PATH = "facing/hub-facing.md";
const FACING_GROUP_FOLDER = "facing";

/**
 * How close (px) an endpoint must sit to a border to count as ATTACHED to it.
 * A tolerance, not a layout constant: routed endpoints land on the border by
 * construction, so this only absorbs sub-pixel transform/rounding error. It stays
 * far below the box's smallest dimension, so it can never blur one side into another.
 */
const BORDER_HIT_TOL_PX = 6;

/**
 * Non-vacuity floor. The fixture puts 12 separate cross-boundary edges on the box,
 * so "no edge attaches on a border its neighbour is not past" would pass trivially if
 * the selectors broke and we saw ZERO terminals. Deliberately loose (not 12): it must catch a dead
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
	// Depth 2 outgoing so the sibling chords (which can cross the hub) are WALKED,
	// and therefore render and load the router. See the file header.
	await harness.saveGlobalDepths(WALK_SIBLINGS_DEPTHS);
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

/** Where each rendered group-box edge endpoint lands on the `facing` box, per counterpart. */
interface FacingAttachmentReport {
	readonly terminalCount: number;
	/**
	 * Terminals on a border their OWN counterpart node does not sit outside of, as
	 * `counterpart:side@x,y` for a readable failure.
	 */
	readonly wrongSideTerminals: readonly string[];
}

/**
 * Reads, from the live DOM, which border of the `facing/` group box each edge
 * INCIDENT ON THAT BOX terminates on, and whether that border is the one facing the
 * edge's own counterpart node.
 *
 * Endpoints come from `getPointAtLength` + `getScreenCTM` because the rendered `d`
 * is in the flow's transformed coordinate space — the group box's client rect is not.
 */
function readFacingAttachment(): Promise<FacingAttachmentReport> {
	return page.evaluate(
		({ folder, tol }) => {
			const group = document.querySelector(`.vicinity-graph-group[data-folder="${folder}"]`);
			if (group === null) {
				throw new Error(`facing group box not rendered: folder=[${folder}]`);
			}
			const box = group.getBoundingClientRect();
			// The flow node id of the box, READ from the DOM rather than reconstructed from
			// the folder name, so this spec does not encode the `folder-group:` id scheme.
			const groupId = group.closest(".react-flow__node")?.getAttribute("data-id") ?? null;
			if (groupId === null) {
				throw new Error(`facing group box has no flow node id: folder=[${folder}]`);
			}

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

			/**
			 * The other end of an edge incident on the box, or `null` for an edge that does
			 * not touch it at all (the fixture's intra-group member→hub edges). Matched on
			 * the WHOLE endpoint id rather than splitting on `->`, so a path containing the
			 * separator could not mis-split.
			 */
			const counterpartIdOf = (edgeId: string): string | null => {
				if (edgeId.startsWith(`${groupId}->`)) {
					return edgeId.slice(groupId.length + 2);
				}
				if (edgeId.endsWith(`->${groupId}`)) {
					return edgeId.slice(0, edgeId.length - groupId.length - 2);
				}
				return null;
			};

			/** True when `counterpart`'s CENTRE lies outside the box border it attached to. */
			const facesFrom = (side: string, counterpart: DOMRect): boolean => {
				const cx = counterpart.left + counterpart.width / 2;
				const cy = counterpart.top + counterpart.height / 2;
				switch (side) {
					case "left":
						return cx < box.left;
					case "right":
						return cx > box.right;
					case "top":
						return cy < box.top;
					default:
						return cy > box.bottom;
				}
			};

			const wrongSideTerminals: string[] = [];
			let terminalCount = 0;
			const edges = document.querySelectorAll<SVGGElement>(".vicinity-graph-flow .react-flow__edge");
			for (const edge of Array.from(edges)) {
				const counterpartId = counterpartIdOf(edge.getAttribute("data-id") ?? "");
				if (counterpartId === null) {
					continue;
				}
				const counterpart = document.querySelector(`.react-flow__node[data-id="${counterpartId}"]`);
				if (counterpart === null) {
					throw new Error(`edge counterpart node not rendered: id=[${counterpartId}]`);
				}
				const counterpartRect = counterpart.getBoundingClientRect();
				const path = edge.querySelector<SVGPathElement>(".react-flow__edge-path");
				const ctm = path?.getScreenCTM() ?? null;
				if (path === null || ctm === null) {
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
					if (!facesFrom(side, counterpartRect)) {
						wrongSideTerminals.push(`${counterpartId}:${side}@${Math.round(x)},${Math.round(y)}`);
					}
				}
			}
			return { terminalCount, wrongSideTerminals };
		},
		{ folder: FACING_GROUP_FOLDER, tol: BORDER_HIT_TOL_PX },
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
 * The property, asserted PER EDGE: each of the 12 edges terminates on a border of the
 * `facing/` box that its OWN counterpart node sits outside of — so an edge may never
 * wrap round to the far border, nor onto a flank the counterpart is not actually past.
 *
 * WHY-NOT the earlier form ("every edge attaches on the ONE side the neighbour centroid
 * lies off"): it is unachievable by construction and was red from the day it landed
 * (ticket nid_uv3al1mhaxmz37ooiit15iq0w_e). Even with the crowd formed, individual
 * neighbours legitimately settle past a FLANKING border (measured: 3 of 12 sit ~180px
 * off the left border while the centroid is above), and attaching those on the flank is
 * the CORRECT routing result — the old assertion scored it as a wrap-around. The
 * per-edge form keeps the full strictness against the real pathology (a terminal on a
 * border its counterpart is not past) without asserting a geometry the fixture cannot have.
 */
test("WHEN a folder group is crowded from one side THEN every edge attaches on a border its own neighbour sits past", async () => {
	// Depth 2 outgoing so the neighbours' cluster links are WALKED and the crowd forms
	// at all — see the file header. (The ring test above already set this; restated so
	// this test does not depend on execution order.)
	await harness.saveGlobalDepths(WALK_SIBLINGS_DEPTHS);
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
		report.wrongSideTerminals,
		`edges attached on a border their neighbour is not past: terminals=[${report.terminalCount}]`,
	).toEqual([]);
});
