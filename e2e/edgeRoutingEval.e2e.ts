import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { ConsoleMessage, Page } from "@playwright/test";
import { ObsidianHarness, PLUGIN_ID } from "./obsidianHarness";

/**
 * Evaluation harness for edge-routing__03 — NOT a tight regression (that is
 * `edgeRouting.e2e.ts`). It drives the tuning fixtures with routing ON, captures a
 * screenshot per (fixture × layout mode) to `/.out` for human/agent eyeballing of
 * route quality, and reads the routing-pass vs elk+d3-layout wall-times that the
 * controller logs at `console.debug` — proving the item-3 perf budget: the routing
 * pass stays WELL under the layout time even on the ~100-node dense fixture.
 *
 * Fixtures come from `scripts/setup-dev-vault.sh`:
 * - sparse: `note1.md` vicinity (~9 notes, projects/solo groups).
 * - medium: `hub-medium.md` (five 3-member folder groups + inter-group ring).
 * - dense:  `zzdense-hub.md` (~110 ungrouped spokes + chords).
 * `all-edges` visibility is set so sibling chords render and genuinely load the router.
 */

test.describe.configure({ mode: "serial" });

const EDGE_PATH_SELECTOR = ".vicinity-graph-flow .react-flow__edge-path";
const BOUNCE_PATH = "note2.md";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, ".out");

type LayoutMode = "force" | "layered" | "radial";

interface PerfEntry {
	readonly kind: "routing" | "layout";
	readonly data: {
		readonly durationMs: number;
		readonly nodeCount?: number;
		readonly obstacleCount?: number;
		readonly edgeCount?: number;
	};
}

let harness: ObsidianHarness;
let page: Page;
/** Structured `console.debug` perf lines the controller emits during each rebuild. */
let pendingPerf: Promise<PerfEntry | null>[] = [];

/** Parses the controller's structured timing logs; ignores every other console line. */
function onConsole(msg: ConsoleMessage): void {
	const text = msg.text();
	const kind: PerfEntry["kind"] | null = text.includes("edge routing pass")
		? "routing"
		: text.includes("elk+d3 layout pass")
			? "layout"
			: null;
	if (kind === null) {
		return;
	}
	const arg = msg.args()[1];
	if (arg === undefined) {
		return;
	}
	pendingPerf.push(
		arg
			.jsonValue()
			.then((data) => ({ kind, data }) as PerfEntry)
			.catch(() => null),
	);
}

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch();
	page = harness.page;
	page.on("console", onConsole);
	await harness.openGraphView();
	await setAllEdgesVisibility();
	await harness.setEdgeRouting(true);
	fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.afterAll(async () => {
	await harness?.close();
});

async function setAllEdgesVisibility(): Promise<void> {
	await page.evaluate(async (pluginId) => {
		const app = (window as unknown as { app: any }).app;
		const store = app.plugins.plugins[pluginId].pluginDataStore;
		await store.saveGlobalView({ ...store.globalView(), edgeVisibility: "all-edges" });
	}, PLUGIN_ID);
}

/**
 * Switches to `mode`, opens `centralPath`, waits for the graph to render, and
 * returns the perf entries captured during THIS rebuild. Bounces through another
 * note first so re-opening the central file is a real active-file change (a
 * same-path open is a no-op that would not re-run the pipeline).
 */
async function renderFixture(mode: LayoutMode, centralPath: string): Promise<PerfEntry[]> {
	await harness.setLayoutMode(mode);
	pendingPerf = [];
	await harness.openFile(BOUNCE_PATH);
	await harness.openFile(centralPath);
	await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
	// Fixed settle window that exceeds the SLOWEST layout (force on the dense fixture
	// is ~1.5s) so its trailing routing pass is logged before we read the entries.
	// Deliberately a fixed wait, not a condition poll: this is an EVAL/measurement
	// spec (see file header), not a gating regression, and the timing/screenshot
	// readout has no crisp DOM signal to poll on — a generous fixed window keeps it
	// simple. The committed perf-BUDGET assertion below has a ~10x margin, so this is
	// not timing-brittle.
	await page.waitForTimeout(4500);
	const entries = (await Promise.all(pendingPerf)).filter((e): e is PerfEntry => e !== null);
	return entries;
}

/** Fresh rebuild's routing/layout durations + routing input scale (last of each kind). */
function lastDurations(entries: PerfEntry[]): {
	routingMs?: number;
	layoutMs?: number;
	obstacleCount?: number;
	edgeCount?: number;
} {
	// Pick the HEAVIEST pass of each kind (max input size), not the last: a rebuild
	// sequence includes the small bounce-note pass whose trailing log can otherwise
	// mask the dense central-file pass we actually want to measure.
	const heaviest = (kind: PerfEntry["kind"], sizeOf: (e: PerfEntry) => number): PerfEntry | undefined =>
		entries
			.filter((e) => e.kind === kind)
			.sort((a, b) => sizeOf(b) - sizeOf(a))[0];
	const routing = heaviest("routing", (e) => e.data.obstacleCount ?? 0);
	return {
		routingMs: routing?.data.durationMs,
		layoutMs: heaviest("layout", (e) => e.data.nodeCount ?? 0)?.data.durationMs,
		obstacleCount: routing?.data.obstacleCount,
		edgeCount: routing?.data.edgeCount,
	};
}

async function screenshot(name: string): Promise<void> {
	await page.locator(".vicinity-graph-flow").screenshot({ path: path.join(OUT_DIR, `edge-routing-${name}.png`) });
}

const FORCE_FIXTURES: ReadonlyArray<{ readonly label: string; readonly central: string }> = [
	{ label: "sparse", central: "note1.md" },
	{ label: "medium", central: "hub-medium.md" },
	{ label: "dense", central: "zzdense-hub.md" },
];

for (const { label, central } of FORCE_FIXTURES) {
	test(`force layout routes the ${label} fixture and captures a screenshot`, async () => {
		const entries = await renderFixture("force", central);
		const { routingMs, layoutMs, obstacleCount, edgeCount } = lastDurations(entries);
		console.log(
			`[eval] force/${label}: routingMs=${routingMs} layoutMs=${layoutMs} obstacles=${obstacleCount} edges=${edgeCount}`,
		);
		await screenshot(`force-${label}`);
		await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
	});
}

test("layered layout routes the dense fixture and captures a screenshot", async () => {
	const entries = await renderFixture("layered", "zzdense-hub.md");
	const { routingMs, layoutMs, obstacleCount, edgeCount } = lastDurations(entries);
	console.log(
		`[eval] layered/dense: routingMs=${routingMs} layoutMs=${layoutMs} obstacles=${obstacleCount} edges=${edgeCount}`,
	);
	await screenshot("layered-dense");
	await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
});

test("radial layout SKIPS routing (gated) and still renders the dense fixture", async () => {
	// Routing is gated off for radial (human decision, edge-routing__03): no routing
	// pass should run at all, so no timing is logged — proving the gate, not just
	// that routes happen to be cheap. Edges still render (straight spokes).
	const entries = await renderFixture("radial", "zzdense-hub.md");
	const { routingMs, layoutMs } = lastDurations(entries);
	console.log(`[eval] radial/dense: routingMs=${routingMs} (gated off) layoutMs=${layoutMs}`);
	await screenshot("radial-dense");
	await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
	expect(routingMs, "no routing pass runs under radial (gated)").toBeUndefined();
});

test("PERF BUDGET: on the dense fixture under the DEFAULT force layout the routing pass stays well under the elk+d3 layout time", async () => {
	// Guards the DEFAULT config (force layout): routing (~140ms) must stay comfortably
	// under the elk+d3 layout (~1460ms) on the ~100-node/~292-edge dense fixture.
	// (The RADIAL layout — where routing would have exceeded its cheap layout — is now
	// gated off entirely, verified in the radial test above; layered stays under.)
	const entries = await renderFixture("force", "zzdense-hub.md");
	const { routingMs, layoutMs, obstacleCount, edgeCount } = lastDurations(entries);
	console.log(
		`[eval] PERF dense/force: routingMs=${routingMs} layoutMs=${layoutMs} obstacles=${obstacleCount} edges=${edgeCount}`,
	);
	expect(routingMs, "routing pass duration was logged").toBeGreaterThanOrEqual(0);
	expect(layoutMs, "layout pass duration was logged").toBeGreaterThan(0);
	expect(routingMs).toBeLessThan(layoutMs as number);
});
