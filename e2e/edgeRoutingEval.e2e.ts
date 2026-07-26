import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { ConsoleMessage, Page } from "@playwright/test";
import { ObsidianHarness, PLUGIN_ID } from "./obsidianHarness";

/**
 * Evaluation harness for edge routing — NOT a tight regression (that is
 * `edgeRouting.e2e.ts`). It drives the tuning fixtures with routing ON, captures a
 * screenshot per fixture to `/.out` for human/agent eyeballing of route quality, and
 * reads the routing-pass vs elk+d3-layout wall-times AND the route-quality detour
 * ratios that the controller logs at `console.debug` — proving the perf budget (the
 * routing pass stays WELL under the layout time even on the ~100-node dense fixture)
 * and giving route-quality tuning (e.g. the libavoid shape buffer) a numeric baseline.
 *
 * Fixtures come from `scripts/setup-dev-vault.sh`:
 * - sparse: `note1.md` vicinity (~9 notes, projects/solo groups).
 * - medium: `hub-medium.md` (five 3-member folder groups + inter-group ring).
 * - dense:  `zzdense-hub.md` (~110 ungrouped spokes + chords).
 * - facing: `facing/hub-facing.md` (a 5-member folder-group box approached by 12
 *   SEPARATE edges from one clustered side — the only fixture that can show the
 *   group facing-side attachment symptom; the others never crowd a group side).
 * `all-edges` visibility is set so sibling chords render and genuinely load the router.
 */

test.describe.configure({ mode: "serial" });

const EDGE_PATH_SELECTOR = ".vicinity-graph-flow .react-flow__edge-path";
const BOUNCE_PATH = "note2.md";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, ".out");

/** Detour ratios are raw floats (1.2843901…); trim them so the eval lines stay scannable. */
const DETOUR_RATIO_DIGITS = 3;

/** The dev-vault canvas in the `sparse` fixture's vicinity. See {@link ensureCanvasFixtureIsIndexed}. */
const CANVAS_FIXTURE_PATH = "test.canvas";
/** Generous bound on Obsidian re-indexing ONE touched file (measured: sub-second). */
const CANVAS_INDEX_TIMEOUT_MS = 20_000;

/** How often the settle poll re-reads the captured-log count. */
const SETTLE_POLL_INTERVAL_MS = 250;
/** No new routing/layout log for this long ⇒ the rebuild burst for this fixture is over. */
const SETTLE_QUIET_MS = 1_500;
/** Upper bound on the whole settle (slowest observed burst: dense, ~2s of logs). */
const SETTLE_TIMEOUT_MS = 30_000;
/** `renderFixture` bounces first, so the fixture's own graph is the SECOND one laid out. */
const LAYOUTS_PER_FIXTURE_RENDER = 2;

interface PerfEntry {
	readonly kind: "routing" | "layout";
	readonly data: {
		readonly durationMs: number;
		readonly nodeCount?: number;
		readonly obstacleCount?: number;
		readonly edgeCount?: number;
		readonly maxDetourRatio?: number;
		readonly meanDetourRatio?: number;
	};
}

/** One rebuild's headline numbers: cost (ms), routing input scale, and route quality. */
interface EvalMetrics {
	readonly routingMs?: number;
	readonly layoutMs?: number;
	readonly obstacleCount?: number;
	readonly edgeCount?: number;
	readonly maxDetourRatio?: number;
	readonly meanDetourRatio?: number;
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
	await ensureCanvasFixtureIsIndexed();
	await setAllEdgesVisibility();
	fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.afterAll(async () => {
	await harness?.close();
});

/**
 * Precondition for a DETERMINISTIC `sparse` readout: get `test.canvas` into Obsidian's
 * link index before anything is measured.
 *
 * WHY: the plugin re-detects its canvas link source on every rebuild from
 * `metadataCache.resolvedLinks` (`src/adapters/ObsidianLinkProvider.create` →
 * `CanvasCapabilityDetector`), and the two regimes disagree about ONE edge — the
 * wikilink inside the canvas's TEXT node (`test.canvas → note2.md`), which core
 * indexing reports and `CanvasFallbackParser` deliberately skips. So an unindexed
 * canvas silently turns the sparse row into 10-or-11 noise.
 *
 * WHY-NOT just wait for the key: measured over 8 launches, Obsidian's boot sweep indexed
 * this canvas in only half of them, and in the misses it NEVER did — polling 60s past a
 * fully settled 165-key index still found no `.canvas` key. Re-writing the file is what
 * makes the index take it (2/2 on misses), so the wait below is a genuine condition on
 * observed state rather than a hopeful sleep.
 *
 * The plugin-side regime split is a product question tracked in its own ticket
 * (`nid_s676x55uojmtcwh9t4l9mc6zl_e`); this helper only pins the MEASUREMENT to the
 * settled, fully-indexed state.
 */
async function ensureCanvasFixtureIsIndexed(): Promise<void> {
	await page.evaluate(async (canvasPath) => {
		const app = (window as unknown as { app: any }).app;
		if (Object.keys(app.metadataCache.resolvedLinks).includes(canvasPath)) {
			return;
		}
		const file = app.vault.getAbstractFileByPath(canvasPath);
		if (file === null) {
			throw new Error(`Canvas fixture missing from the e2e vault: path=[${canvasPath}]`);
		}
		// A trailing newline is a no-op for the canvas JSON but IS a real content change,
		// so Obsidian re-reads the file and indexes its links.
		await app.vault.modify(file, `${await app.vault.read(file)}\n`);
	}, CANVAS_FIXTURE_PATH);
	await page.waitForFunction(
		(canvasPath) =>
			Object.keys((window as unknown as { app: any }).app.metadataCache.resolvedLinks).includes(canvasPath),
		CANVAS_FIXTURE_PATH,
		{ timeout: CANVAS_INDEX_TIMEOUT_MS },
	);
}

async function setAllEdgesVisibility(): Promise<void> {
	await page.evaluate(async (pluginId) => {
		const app = (window as unknown as { app: any }).app;
		const store = app.plugins.plugins[pluginId].pluginDataStore;
		await store.saveGlobalView({ ...store.globalView(), edgeVisibility: "all-edges" });
	}, PLUGIN_ID);
}

/**
 * Opens `centralPath`, waits for the graph to render, and returns the perf entries
 * captured during THIS rebuild. Bounces through another note first so re-opening the
 * central file is a real active-file change (a same-path open is a no-op that would
 * not re-run the pipeline).
 */
async function renderFixture(centralPath: string): Promise<PerfEntry[]> {
	pendingPerf = [];
	await harness.openFile(BOUNCE_PATH);
	await harness.openFile(centralPath);
	await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
	await waitForRebuildBurstToSettle();
	const entries = (await Promise.all(pendingPerf)).filter((e): e is PerfEntry => e !== null);
	return entries;
}

/**
 * Condition-driven settle, replacing a fixed sleep: opening a note fires several rebuilds
 * (the immediate `file-open` one, then the 500ms-debounced `metadataCache "resolved"` one),
 * each logging a layout and a routing pass, and the LAST of them is the settled graph.
 *
 * Two conditions, both required:
 * 1. the CENTRAL fixture's own pass has been logged — {@link renderFixture} bounces first,
 *    so its graph is the SECOND one laid out. Quiescence alone is not enough: the dense
 *    fixture's elk layout takes ~1.5s, and the silence while it runs looks exactly like
 *    the end of the burst (observed: the dense row reporting the 3-obstacle bounce pass).
 * 2. no further pass for {@link SETTLE_QUIET_MS}, so a trailing debounced rebuild is in.
 */
async function waitForRebuildBurstToSettle(): Promise<void> {
	const deadline = Date.now() + SETTLE_TIMEOUT_MS;
	let seenCount = -1;
	let unchangedSince = Date.now();
	while (Date.now() < deadline) {
		const captured = (await Promise.all(pendingPerf)).filter((e): e is PerfEntry => e !== null);
		const centralFixtureLaidOut =
			captured.filter((entry) => entry.kind === "layout").length >= LAYOUTS_PER_FIXTURE_RENDER;
		if (captured.length !== seenCount) {
			seenCount = captured.length;
			unchangedSince = Date.now();
		} else if (centralFixtureLaidOut && Date.now() - unchangedSince >= SETTLE_QUIET_MS) {
			return;
		}
		await new Promise((tick) => setTimeout(tick, SETTLE_POLL_INTERVAL_MS));
	}
	throw new Error(`Rebuild logs never settled: passesCaptured=[${pendingPerf.length}]`);
}

/**
 * The passes at the maximum input size, in log order — the HEAVIEST pass of a kind, not
 * the last: a rebuild sequence includes the small bounce-note pass whose trailing log
 * would otherwise mask the dense central-file pass we actually want to measure.
 */
function heaviestPasses(
	entries: readonly PerfEntry[],
	kind: PerfEntry["kind"],
	sizeOf: (entry: PerfEntry) => number,
): readonly PerfEntry[] {
	const ofKind = entries.filter((entry) => entry.kind === kind);
	const maxSize = Math.max(...ofKind.map(sizeOf), 0);
	return ofKind.filter((entry) => sizeOf(entry) === maxSize);
}

/** The SETTLED pass at the maximum input size: later passes supersede earlier ones. */
function lastOf(passes: readonly PerfEntry[]): PerfEntry | undefined {
	return passes[passes.length - 1];
}

/** Settled rebuild's routing/layout durations + routing input scale and detour ratios. */
function settledMetrics(entries: PerfEntry[]): EvalMetrics {
	const routingPasses = heaviestPasses(entries, "routing", (entry) => entry.data.obstacleCount ?? 0);
	// Same-sized passes reporting DIFFERENT edge counts mean the graph was still changing,
	// so any single one of them is an arbitrary readout. Fail loudly rather than let a
	// stable-sort accident decide which number gets published (the 10-vs-11 flake).
	const edgeCounts = new Set(routingPasses.map((entry) => entry.data.edgeCount));
	if (edgeCounts.size > 1) {
		throw new Error(
			"Routing passes at the same obstacle count disagree on edgeCount, so the readout would be " +
				`arbitrary: obstacles=[${routingPasses[0]?.data.obstacleCount}] edgeCounts=[${[...edgeCounts].join(", ")}]`,
		);
	}
	const routing = lastOf(routingPasses);
	return {
		routingMs: routing?.data.durationMs,
		layoutMs: lastOf(heaviestPasses(entries, "layout", (entry) => entry.data.nodeCount ?? 0))?.data.durationMs,
		obstacleCount: routing?.data.obstacleCount,
		edgeCount: routing?.data.edgeCount,
		// Same settled routing entry, so cost and quality always describe ONE pass.
		maxDetourRatio: routing?.data.maxDetourRatio,
		meanDetourRatio: routing?.data.meanDetourRatio,
	};
}

/** One shared `[eval]` readout so every fixture's line stays directly comparable. */
function formatMetrics(metrics: EvalMetrics): string {
	const ratio = (value: number | undefined): string =>
		value === undefined ? "undefined" : value.toFixed(DETOUR_RATIO_DIGITS);
	return [
		`routingMs=${metrics.routingMs}`,
		`layoutMs=${metrics.layoutMs}`,
		`obstacles=${metrics.obstacleCount}`,
		`edges=${metrics.edgeCount}`,
		`maxDetourRatio=${ratio(metrics.maxDetourRatio)}`,
		`meanDetourRatio=${ratio(metrics.meanDetourRatio)}`,
	].join(" ");
}

async function screenshot(name: string): Promise<void> {
	await page.locator(".vicinity-graph-flow").screenshot({ path: path.join(OUT_DIR, `edge-routing-${name}.png`) });
}

const FORCE_FIXTURES: ReadonlyArray<{ readonly label: string; readonly central: string }> = [
	{ label: "sparse", central: "note1.md" },
	{ label: "medium", central: "hub-medium.md" },
	{ label: "dense", central: "zzdense-hub.md" },
	{ label: "facing", central: "facing/hub-facing.md" },
];

for (const { label, central } of FORCE_FIXTURES) {
	test(`force layout routes the ${label} fixture and captures a screenshot`, async () => {
		const entries = await renderFixture(central);
		const metrics = settledMetrics(entries);
		console.log(`[eval] force/${label}: ${formatMetrics(metrics)}`);
		await screenshot(`force-${label}`);
		await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
	});
}

test("PERF BUDGET: on the dense fixture the routing pass stays well under the elk+d3 layout time", async () => {
	// Force is the ONLY layout: routing (~140ms) must stay comfortably under the
	// elk+d3 layout (~1460ms) on the ~100-node/~292-edge dense fixture. Routing is
	// unconditional, so this budget covers every render the plugin performs.
	const entries = await renderFixture("zzdense-hub.md");
	const metrics = settledMetrics(entries);
	const { routingMs, layoutMs } = metrics;
	console.log(`[eval] PERF dense/force: ${formatMetrics(metrics)}`);
	expect(routingMs, "routing pass duration was logged").toBeGreaterThanOrEqual(0);
	expect(layoutMs, "layout pass duration was logged").toBeGreaterThan(0);
	expect(routingMs).toBeLessThan(layoutMs as number);
});
