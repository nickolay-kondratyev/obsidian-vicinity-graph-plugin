import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { ConsoleMessage, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

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
 * Outgoing depth 2 is set so sibling chords are WALKED (only walked links become
 * edges) and therefore genuinely load the router.
 */

test.describe.configure({ mode: "serial" });

const EDGE_PATH_SELECTOR = ".vicinity-graph-flow .react-flow__edge-path";
const BOUNCE_PATH = "note2.md";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO_ROOT, ".out");

/** Detour ratios are raw floats (1.2843901…); trim them so the eval lines stay scannable. */
const DETOUR_RATIO_DIGITS = 3;

/** How often the settle poll re-reads the captured-log count. */
const SETTLE_POLL_INTERVAL_MS = 250;
/** No new routing/layout log for this long ⇒ the rebuild burst for this fixture is over. */
const SETTLE_QUIET_MS = 1_500;
/** Upper bound on the whole settle (slowest observed burst: dense, ~2s of logs). */
const SETTLE_TIMEOUT_MS = 30_000;

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
	// Depth 2 outgoing so sibling chords are walked, render, and load the router.
	await harness.saveGlobalDepths({ linkDepthOut: 2, linkDepthIn: 1 });
	fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.afterAll(async () => {
	await harness?.close();
});

/**
 * Opens `centralPath`, waits for the graph to settle, and returns the metrics of the
 * settled rebuild — cross-checked against what is actually on screen. Bounces through
 * another note first so re-opening the central file is a real active-file change (a
 * same-path open is a no-op that would not re-run the pipeline).
 */
async function renderFixture(centralPath: string): Promise<EvalMetrics> {
	pendingPerf = [];
	await harness.openFile(BOUNCE_PATH);
	await harness.openFile(centralPath);
	await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
	await waitForRebuildBurstToSettle(centralPath);
	const entries = (await Promise.all(pendingPerf)).filter((e): e is PerfEntry => e !== null);
	const metrics = settledMetrics(entries);
	await assertMetricsDescribeRenderedGraph(metrics, centralPath);
	return metrics;
}

/** Layout passes in log order; the FIRST is the bounce note's. See {@link waitForRebuildBurstToSettle}. */
function layoutsOf(entries: readonly PerfEntry[]): readonly PerfEntry[] {
	return entries.filter((entry) => entry.kind === "layout");
}

/**
 * Condition-driven settle, replacing a fixed sleep: opening a note fires several rebuilds
 * (the immediate `file-open` one, then the 500ms-debounced `metadataCache "resolved"` one),
 * each logging a layout and a routing pass, and the LAST of them is the settled graph.
 *
 * Two conditions, both required:
 * 1. a layout STRICTLY LARGER than the first one has been logged. {@link renderFixture}
 *    bounces through `note2.md`, whose vicinity is the smallest graph in this spec, so a
 *    bigger layout can only be the central fixture's. WHY-NOT count layouts instead: the
 *    bounce open fires "several rebuilds" exactly as described above, so a fixed count is
 *    satisfiable by bounce passes alone. Quiescence alone is not enough either: the dense
 *    fixture's elk layout takes ~1.5s, and the silence while it runs looks exactly like the
 *    end of the burst (observed: the dense row reporting the 3-obstacle bounce pass).
 * 2. no further pass for {@link SETTLE_QUIET_MS}, so a trailing debounced rebuild is in.
 *
 * ASSUMES the central rebuild is STRUCTURAL, so elk actually runs and logs. When
 * `decideLayout` returns `reuse-layout` (`src/view/GraphViewController.ts`), the pass is
 * skipped and a different, unmatched line is logged — condition 1 could then never be met,
 * which is what the throw below spells out.
 */
async function waitForRebuildBurstToSettle(centralPath: string): Promise<void> {
	const deadline = Date.now() + SETTLE_TIMEOUT_MS;
	let seenCount = -1;
	let unchangedSince = Date.now();
	let captured: readonly PerfEntry[] = [];
	while (Date.now() < deadline) {
		captured = (await Promise.all(pendingPerf)).filter((e): e is PerfEntry => e !== null);
		const layouts = layoutsOf(captured);
		const bounceNodeCount = layouts[0]?.data.nodeCount ?? 0;
		const centralFixtureLaidOut = layouts.some((entry) => (entry.data.nodeCount ?? 0) > bounceNodeCount);
		if (captured.length !== seenCount) {
			seenCount = captured.length;
			unchangedSince = Date.now();
		} else if (centralFixtureLaidOut && Date.now() - unchangedSince >= SETTLE_QUIET_MS) {
			return;
		}
		await new Promise((tick) => setTimeout(tick, SETTLE_POLL_INTERVAL_MS));
	}
	const layoutSizes = layoutsOf(captured).map((entry) => entry.data.nodeCount);
	throw new Error(
		`Rebuild burst never settled for central=[${centralPath}]: expected an elk+d3 layout pass LARGER than ` +
			`the bounce note's, then ${SETTLE_QUIET_MS}ms of quiet. Saw capturedPasses=[${captured.length}] ` +
			`layoutNodeCounts=[${layoutSizes.join(", ")}].\n` +
			"If the layout list is empty or never grows past its first entry, the central rebuild probably took " +
			"GraphViewController's `reuse-layout` path (logged as 'structural diff skipped elk layout'), which " +
			"emits no pass for this settle to observe.",
	);
}

/**
 * The published pass must describe the graph that is actually ON SCREEN. Without this, a
 * mis-settled readout (the tiny bounce pass, or a half-warmed rebuild) would quietly print
 * a wrong `[eval]` row — the exact silent failure this spec exists to not have.
 */
async function assertMetricsDescribeRenderedGraph(metrics: EvalMetrics, centralPath: string): Promise<void> {
	const renderedEdgeCount = await page.locator(EDGE_PATH_SELECTOR).count();
	if (metrics.edgeCount !== renderedEdgeCount) {
		throw new Error(
			`Settled routing pass does not describe the rendered graph, so the readout would be wrong: ` +
				`central=[${centralPath}] reportedEdges=[${metrics.edgeCount}] renderedEdges=[${renderedEdgeCount}]`,
		);
	}
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
	// stable-sort accident decide which number gets published.
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
		const metrics = await renderFixture(central);
		console.log(`[eval] force/${label}: ${formatMetrics(metrics)}`);
		await screenshot(`force-${label}`);
		await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
	});
}

test("PERF BUDGET: on the dense fixture the routing pass stays well under the elk+d3 layout time", async () => {
	// Force is the ONLY layout: routing (~140ms) must stay comfortably under the
	// elk+d3 layout (~1460ms) on the ~100-node/~292-edge dense fixture. Routing is
	// unconditional, so this budget covers every render the plugin performs.
	const metrics = await renderFixture("zzdense-hub.md");
	const { routingMs, layoutMs } = metrics;
	console.log(`[eval] PERF dense/force: ${formatMetrics(metrics)}`);
	expect(routingMs, "routing pass duration was logged").toBeGreaterThanOrEqual(0);
	expect(layoutMs, "layout pass duration was logged").toBeGreaterThan(0);
	expect(routingMs).toBeLessThan(layoutMs as number);
});
