import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { EngineDefaults } from "../src/engine";
import { plusNText } from "../src/view/badgeText";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Recursive folder grouping e2e (real Obsidian on a copy of `.dev-vault` plus the
 * nested fixtures below). Flat grouping was replaced wholesale by recursive
 * grouping (plan ticket nid_xko67wo2z4awg5gdrm1xx1chz_e, signed-off D1–D5); the
 * unit layer covers `deriveFolderGroups` exhaustively, so this file locks the
 * pieces only a rendered Obsidian can prove: a nested box drawn INSIDE its parent
 * box, a lone note falling up into an ancestor group, LCA edge collapse onto boxes
 * (vs a same-container member-to-member edge), the `+N` badge crediting the
 * nearest RENDERED ancestor, and the "Full folder path" setting flipping a
 * collapsed-chain label.
 *
 * Serial by design: ONE Obsidian instance for the whole file, opened on a ROOT
 * MAIN note (`ng-main.md`) whose whole vicinity is these fixtures. MAIN itself
 * stays at the vault ROOT (ungrouped), matching the repo rule that keeps the
 * pointer-interaction anchor out of any group box — though the interactions here
 * are DOM/geometry assertions and a toolbar toggle, never a canvas pointer click.
 */

test.describe.configure({ mode: "serial" });

/**
 * Multi-level fixture, all reachable from `ng-main` at outgoing depth 2:
 *
 *   db/            (group: 2 direct members x1,x2 + nested db/sql)
 *     x1,x2
 *     sql/         (group nested in db: members s1,s2 + the fallen-in lone note)
 *       s1,s2
 *       deep/lone1 (folder `deep` too small to group → falls into db/sql)
 *   wiki/lang/en/  (collapsed chain: only en survives, label "en" / "wiki/lang/en")
 *     e1,e2
 *
 * Links (basename-resolved): ng-main → every member; s1 → s2 (same-container),
 * s1 → lone1 (discovers the depth-2 lone note), x1 → s1 (crosses the db→db/sql
 * boundary). Only WALKED links become edges, hence outgoing depth 2.
 */
const NESTED_FIXTURES: Record<string, string> = {
	"ng-main.md": "Main links [[s1]] [[s2]] [[x1]] [[x2]] [[e1]] [[e2]].\n",
	"db/x1.md": "x1 links across the boundary to [[s1]].\n",
	"db/x2.md": "x2 has no outgoing links.\n",
	"db/sql/s1.md": "s1 links its sibling [[s2]] and the deep note [[lone1]].\n",
	"db/sql/s2.md": "s2 has no outgoing links.\n",
	"db/sql/deep/lone1.md": "lone1 is the only note in db/sql/deep.\n",
	"wiki/lang/en/e1.md": "e1 has no outgoing links.\n",
	"wiki/lang/en/e2.md": "e2 has no outgoing links.\n",
};

const MAIN_PATH = "ng-main.md";
/** A vault note to bounce through so re-opening MAIN is a real active-file change (same-path is a no-op). */
const BOUNCE_PATH = "note1.md";

/**
 * Outgoing depth 2 so `s1 → s2`, `s1 → lone1` and `x1 → s1` are WALKED (and so
 * `lone1` is discovered). Folder-note hierarchy channels are OFF (the fixtures
 * carry no folder notes; 0 keeps the graph a pure link graph). Backlinks stay at
 * the shipped opt-in 0 — MAIN reaches every member through outgoing links.
 */
const NESTED_DEPTHS = {
	...EngineDefaults.depthSettings(),
	linkDepthOut: 2,
	descendantDepth: 0,
	ancestorDepth: 0,
};

/** ng-main (central, exempt) + s1,s2,x1,x2,e1,e2 (depth 1) + lone1 (depth 2). */
const FULL_NODE_COUNT = 8;
/** Cap that keeps every depth-1 node and cuts exactly the single depth-2 note (lone1). */
const CAP_HIDING_LONE = FULL_NODE_COUNT - 2; // 6 non-central survivors, lone1 dropped

/** The surviving collapsed-chain group: `wiki` and `wiki/lang` collapse onto `en`. */
const COLLAPSED_CHAIN_FOLDER = "wiki/lang/en";
const COLLAPSED_CHAIN_LEAF = "en";
const GROUP_LABEL_FULL_PATH_NAME = "Full folder path";
const EDGE_DEPTH_INTO_GROUPS_NAME = "Edge depth into groups";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: NESTED_FIXTURES });
	page = harness.page;
	await harness.openGraphView();
	await harness.saveGlobalDepths(NESTED_DEPTHS);
	await harness.openFile(MAIN_PATH);
	await expect(noteNode(MAIN_PATH)).toHaveAttribute("data-tier", "main");
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(FULL_NODE_COUNT);
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string): Locator {
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
}

function folderGroup(folder: string): Locator {
	return page.locator(`.vicinity-graph-group[data-folder="${folder}"]`);
}

function flowEdge(id: string): Locator {
	return page.locator(`.vicinity-graph-flow .react-flow__edge[data-id="${id}"]`);
}

/**
 * A rendered box "contains" another when the inner box sits within the outer's
 * screen rectangle. React Flow renders subflow children as separate absolutely
 * positioned nodes (never DOM descendants), so containment is the only honest
 * signal that a box nests inside another. `SLOP_PX` absorbs sub-pixel transform
 * rounding without ever blurring one box into a sibling.
 */
const SLOP_PX = 4;
async function expectRenderedInside(inner: Locator, outer: Locator): Promise<void> {
	const innerBox = await inner.boundingBox();
	const outerBox = await outer.boundingBox();
	expect(innerBox, "inner box must be rendered").not.toBeNull();
	expect(outerBox, "outer box must be rendered").not.toBeNull();
	if (innerBox === null || outerBox === null) return;
	expect(innerBox.x).toBeGreaterThanOrEqual(outerBox.x - SLOP_PX);
	expect(innerBox.y).toBeGreaterThanOrEqual(outerBox.y - SLOP_PX);
	expect(innerBox.x + innerBox.width).toBeLessThanOrEqual(outerBox.x + outerBox.width + SLOP_PX);
	expect(innerBox.y + innerBox.height).toBeLessThanOrEqual(outerBox.y + outerBox.height + SLOP_PX);
}

/**
 * Flips the global "Full folder path" label toggle through the in-graph controls
 * PANEL — the real user gesture and the same write pipeline the settings tab uses,
 * which fans out a rebuild on its own. The panel is a native `<details>` and EVERY
 * section inside it is its OWN `<details>` (only the depth section opens by
 * default), so reveal the toolbar AND every nested section before reaching the
 * Grouping toggle — a closed `<details>` display:none's its content, which a role
 * locator (hidden-excluding) would never find. The native checkbox is then driven
 * with an evaluate-level `.click()`, bypassing the pill overlay Obsidian stretches
 * over the input exactly as the sibling depth-stepper e2e does. A boolean toggle is
 * not debounced, so settling is the rendered label itself — asserted with a
 * web-first `toHaveText`, never a sleep.
 */
async function setGroupLabelFullPath(on: boolean): Promise<void> {
	const toolbar = page.locator(".vicinity-graph-toolbar");
	await toolbar.evaluate((root) => {
		(root as HTMLDetailsElement).open = true;
		root.querySelectorAll("details").forEach((section) => {
			(section as HTMLDetailsElement).open = true;
		});
	});
	const toggle = page.getByRole("checkbox", { name: GROUP_LABEL_FULL_PATH_NAME, exact: true });
	if ((await toggle.isChecked()) !== on) {
		await toggle.evaluate((el) => (el as HTMLInputElement).click());
	}
	await expect(toggle).toBeChecked({ checked: on });
	await toolbar.evaluate((root) => {
		(root as HTMLDetailsElement).open = false;
	});
}

// --- (1) a nested box renders inside its parent box -------------------------

test("a subfolder group renders as a box nested inside its ancestor group box", async () => {
	await expect(folderGroup("db")).toHaveCount(1);
	await expect(folderGroup("db/sql")).toHaveCount(1);
	// db/sql draws INSIDE db; db's own direct member draws inside db too.
	await expectRenderedInside(folderGroup("db/sql"), folderGroup("db"));
	await expectRenderedInside(noteNode("db/x1.md"), folderGroup("db"));
	// The nested box carries its LEAF label by default (the setting is off).
	await expect(folderGroup("db/sql").locator(".vicinity-graph-group__label")).toHaveText("sql");
});

// --- (2) a lone note in a too-small subfolder falls into its ancestor group --

test("a lone note in db/sql/deep falls into the db/sql group (deep is not its own box)", async () => {
	// `db/sql/deep` has a single visible note, so it never becomes a group...
	await expect(folderGroup("db/sql/deep")).toHaveCount(0);
	// ...and its lone note renders inside the nearest qualifying ancestor, db/sql.
	await expectRenderedInside(noteNode("db/sql/deep/lone1.md"), folderGroup("db/sql"));
});

// --- (3) boundary-crossing edge collapses onto boxes; same-container stays ---

test("a same-container link stays a member-to-member edge", async () => {
	// s1 → s2: both are direct members of db/sql, so the edge is NOT collapsed.
	await expect(flowEdge("db/sql/s1.md->db/sql/s2.md")).toHaveCount(1);
});

test("a boundary-crossing link collapses onto the crossed group box", async () => {
	// x1 (a db member) → s1 (a db/sql member): their LCA container is db, so the
	// edge collapses onto db/sql's box rather than piercing its border.
	await expect(flowEdge("db/x1.md->folder-group:db/sql")).toHaveCount(1);
	// The raw member-to-member id is NOT what renders — it was projected onto the box.
	await expect(flowEdge("db/x1.md->db/sql/s1.md")).toHaveCount(0);
});

// --- (5) the group-label setting flips a collapsed-chain label ---------------

test("the collapsed chain wiki/lang/en renders as ONE group labelled by its leaf by default", async () => {
	await expect(folderGroup(COLLAPSED_CHAIN_FOLDER)).toHaveCount(1);
	// wiki and wiki/lang each hold exactly one child group, so they collapse away.
	await expect(folderGroup("wiki")).toHaveCount(0);
	await expect(folderGroup("wiki/lang")).toHaveCount(0);
	const label = folderGroup(COLLAPSED_CHAIN_FOLDER).locator(".vicinity-graph-group__label");
	await expect(label).toHaveText(COLLAPSED_CHAIN_LEAF);
	// The full folder path is always the tooltip, regardless of the label setting.
	await expect(label).toHaveAttribute("title", COLLAPSED_CHAIN_FOLDER);
});

test("turning ON Full folder path relabels the collapsed chain with its whole path", async () => {
	await setGroupLabelFullPath(true);
	const label = folderGroup(COLLAPSED_CHAIN_FOLDER).locator(".vicinity-graph-group__label");
	await expect(label).toHaveText(COLLAPSED_CHAIN_FOLDER);
	// A NON-collapsed group is unaffected — its chain path equals its leaf name.
	await expect(folderGroup("db").locator(".vicinity-graph-group__label")).toHaveText("db");
	// Restore the default so later tests read the shipped label behaviour.
	await setGroupLabelFullPath(false);
	await expect(label).toHaveText(COLLAPSED_CHAIN_LEAF);
});

// --- (6) "Edge depth into groups" lets an edge pierce into a group box -------

/**
 * Drives the global "Edge depth into groups" SLIDER through the in-graph controls
 * PANEL — the real user gesture, reaching the same write pipeline the settings tab
 * uses, which fans out a rebuild on its own. Reveals the toolbar and every nested
 * `<details>` first (only the depth section opens by default), exactly like
 * {@link setGroupLabelFullPath}. A range input is set through the native value
 * setter and an `input` event so React's `onChange` fires (a bare `.fill()` does not
 * drive a range thumb). A slider write is NOT debounced, so settling is the rebuilt
 * graph itself — asserted web-first by the caller, never a sleep.
 */
async function setEdgeDepthIntoGroups(value: number): Promise<void> {
	const toolbar = page.locator(".vicinity-graph-toolbar");
	await toolbar.evaluate((root) => {
		(root as HTMLDetailsElement).open = true;
		root.querySelectorAll("details").forEach((section) => {
			(section as HTMLDetailsElement).open = true;
		});
	});
	const slider = page.getByRole("slider", { name: EDGE_DEPTH_INTO_GROUPS_NAME, exact: true });
	await slider.evaluate((el, next) => {
		const input = el as HTMLInputElement;
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
		setter?.call(input, String(next));
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}, value);
	await expect(slider).toHaveValue(String(value));
	await toolbar.evaluate((root) => {
		(root as HTMLDetailsElement).open = false;
	});
}

test("raising Edge depth into groups makes a crossing edge terminate at the inner NOTE inside the group", async () => {
	// Default (0): x1 (a db member) → s1 (a db/sql member) collapses onto the db/sql box.
	await expect(flowEdge("db/x1.md->folder-group:db/sql")).toHaveCount(1);
	await expect(flowEdge("db/x1.md->db/sql/s1.md")).toHaveCount(0);

	// Allowance 1: the s1 endpoint reaches one group deeper than db/sql's direct-child
	// projection — i.e. the true note s1 — so the edge now pierces the db/sql box and
	// ends at the note rendered INSIDE it. RENDER-ONLY: the group boxes are unmoved.
	await setEdgeDepthIntoGroups(1);
	await expect(flowEdge("db/x1.md->db/sql/s1.md")).toHaveCount(1);
	await expect(flowEdge("db/x1.md->folder-group:db/sql")).toHaveCount(0);
	// The pierced endpoint is a real note drawn inside the group box it now reaches into.
	await expectRenderedInside(noteNode("db/sql/s1.md"), folderGroup("db/sql"));

	// Restore the shipped default so later tests read the collapsed behaviour.
	await setEdgeDepthIntoGroups(0);
	await expect(flowEdge("db/x1.md->folder-group:db/sql")).toHaveCount(1);
});

// --- (7) a pierced edge avoids the inner squares and the title band ----------

/**
 * How many strictly-interior title/note points count as a violation. Zero: the
 * hierarchical router must keep EVERY sampled point of the pierced polyline off the
 * title band and off the sibling square. Sub-pixel transform rounding is absorbed by
 * the small pads inside {@link readPiercedEdgeAvoidance}, not by tolerating a hit.
 */
const MAX_INTERIOR_HITS = 0;

/** How densely the rendered pierced polyline is sampled when checking for interior hits. */
const PIERCE_SAMPLE_STEPS = 64;

interface PiercedEdgeAvoidance {
	readonly sampled: number;
	readonly titleBandHits: number;
	readonly siblingSquareHits: number;
}

/**
 * Samples the RENDERED pierced polyline (screen coordinates via `getPointAtLength` +
 * `getScreenCTM`, the same transform the facing-attachment reader uses) and counts how
 * many of its points land strictly inside the group's TITLE band (its label) or inside
 * a SIBLING note square that shares the pierced box. Both counts must be zero — the
 * end-to-end proof of decision D3 in a real Obsidian, complementing the deterministic
 * wasm-level geometry unit tests in `hierarchicalEdgeRouting.test.ts`.
 */
function readPiercedEdgeAvoidance(
	edgeId: string,
	piercedFolder: string,
	siblingNotePath: string,
): Promise<PiercedEdgeAvoidance> {
	return page.evaluate(
		({ edgeId, piercedFolder, siblingNotePath, steps }) => {
			const edge = document.querySelector(`.vicinity-graph-flow .react-flow__edge[data-id="${edgeId}"]`);
			const path = edge?.querySelector<SVGPathElement>(".react-flow__edge-path") ?? null;
			const ctm = path?.getScreenCTM() ?? null;
			if (path === null || ctm === null) {
				throw new Error(`pierced edge not rendered: id=[${edgeId}]`);
			}
			const total = path.getTotalLength();
			const points: { x: number; y: number }[] = [];
			for (let i = 0; i <= steps; i += 1) {
				const raw = path.getPointAtLength((total * i) / steps);
				points.push({ x: ctm.a * raw.x + ctm.c * raw.y + ctm.e, y: ctm.b * raw.x + ctm.d * raw.y + ctm.f });
			}
			const rectOf = (selector: string): DOMRect => {
				const element = document.querySelector(selector);
				if (element === null) {
					throw new Error(`element not rendered: selector=[${selector}]`);
				}
				return element.getBoundingClientRect();
			};
			const titleRect = rectOf(`.vicinity-graph-group[data-folder="${piercedFolder}"] .vicinity-graph-group__label`);
			const siblingRect = rectOf(`.react-flow__node[data-id="${siblingNotePath}"]`);
			const strictlyInside = (p: { x: number; y: number }, r: DOMRect, pad: number): boolean =>
				p.x > r.left + pad && p.x < r.right - pad && p.y > r.top + pad && p.y < r.bottom - pad;
			return {
				sampled: points.length,
				titleBandHits: points.filter((p) => strictlyInside(p, titleRect, 0)).length,
				siblingSquareHits: points.filter((p) => strictlyInside(p, siblingRect, 1)).length,
			};
		},
		{ edgeId, piercedFolder, siblingNotePath, steps: PIERCE_SAMPLE_STEPS },
	);
}

test("a pierced edge routes around the group's title band and its sibling squares", async () => {
	// Allowance 1: x1 → s1 pierces the db/sql box (see test (6)). The hierarchical router
	// must reach the inner note s1 WITHOUT crossing the box's title band or its sibling
	// square s2 — both drawn inside db/sql.
	await setEdgeDepthIntoGroups(1);
	const piercedEdge = flowEdge("db/x1.md->db/sql/s1.md");
	await expect(piercedEdge).toHaveCount(1);
	// Settle on a coherent snapshot: poll only for the polyline being drawn, then assert
	// the avoidance property ONCE (polling the property would hide a real violation behind
	// an unreadable timeout).
	await expect
		.poll(async () => (await readPiercedEdgeAvoidance("db/x1.md->db/sql/s1.md", "db/sql", "db/sql/s2.md")).sampled, {
			timeout: 20_000,
		})
		.toBeGreaterThan(0);
	const avoidance = await readPiercedEdgeAvoidance("db/x1.md->db/sql/s1.md", "db/sql", "db/sql/s2.md");
	expect(avoidance.titleBandHits, "pierced polyline crossed the group's title band").toBeLessThanOrEqual(
		MAX_INTERIOR_HITS,
	);
	expect(avoidance.siblingSquareHits, "pierced polyline crossed a sibling note square").toBeLessThanOrEqual(
		MAX_INTERIOR_HITS,
	);

	// Restore the shipped default so later tests read the collapsed behaviour.
	await setEdgeDepthIntoGroups(0);
	await expect(flowEdge("db/x1.md->folder-group:db/sql")).toHaveCount(1);
});

// --- (4) +N badge on the nearest RENDERED ancestor group --------------------

// KEEP LAST: mutates the global node cap and does not restore it, so any test
// appended after this one would see the truncated graph.
test("a hidden note in a non-grouped subfolder credits its nearest rendered ancestor group's +N badge", async () => {
	await harness.setGlobalNodeCap(CAP_HIDING_LONE);
	// The cap change alone does not rebuild; bounce the active file so re-opening
	// MAIN is a real change (same-path is a no-op).
	await harness.openFile(BOUNCE_PATH);
	await harness.openFile(MAIN_PATH);

	// lone1 (the sole depth-2 note) is the deterministic cut; everything else survives.
	await expect(page.locator(".vicinity-graph-node")).toHaveCount(FULL_NODE_COUNT - 1);
	await expect(noteNode("db/sql/deep/lone1.md")).toHaveCount(0);

	// Its folder `db/sql/deep` renders no box, so the hidden count credits db/sql.
	await expect(folderGroup("db/sql").locator(".vicinity-graph-group__badge")).toHaveText(plusNText(1));
	// db is NOT credited — db/sql is the NEAREST rendered ancestor, not db.
	await expect(folderGroup("db").locator(".vicinity-graph-group__badge")).toHaveCount(0);
	// Every hidden note found a rendered ancestor, so there is no corner overlay.
	await expect(page.locator(".vicinity-graph-overlay-badge")).toHaveCount(0);
});
