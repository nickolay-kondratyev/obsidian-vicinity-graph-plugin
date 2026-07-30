import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { FakePluginDataPort } from "../persistence/FakePluginDataPort";
import { PluginDataStore } from "../persistence/PluginDataStore";
import { FakeViewsRefresh } from "./FakeViewsRefresh";
import type { DebounceScheduler } from "./settingsDebounce";
import { DebouncedSettingsWrites } from "./settingsDebounce";
import { SettingsWritePipeline } from "./settingsWritePipeline";

/**
 * The pipeline is where "one write path" is actually enforced, so this is where
 * the two subsystem defects it was extracted to kill are pinned:
 *
 * - **Sibling-field clobbering.** Two edits made before the next rebuild must both
 *   survive. They only can if the merge base is read INSIDE the serialised slot;
 *   the panel used to spread its edit over the snapshot it had rendered from.
 * - **"Is the store quiet yet".** A caller that rebuilds controls must be able to
 *   wait for writes queued WHILE its own task ran ({@link SettingsWritePipeline.drain}).
 *
 * Collaborators are the real `PluginDataStore` over its in-memory fake — no
 * obsidian runtime, and the assertions read the store, not a spy.
 */

const OPEN_VIEW_IDS: readonly string[] = ["view-a", "view-b"];

function pipelineUnderTest() {
	const port = new FakePluginDataPort();
	const store = new PluginDataStore(port);
	const viewsRefresh = new FakeViewsRefresh(OPEN_VIEW_IDS);
	const pipeline = new SettingsWritePipeline(store, viewsRefresh);
	return { store, viewsRefresh, pipeline };
}

describe("SettingsWritePipeline fresh-read merge base", () => {
	it("WHEN two sizing numbers are edited before either write is awaited THEN the second keeps the first's value", async () => {
		const { store, pipeline } = pipelineUnderTest();
		const first = pipeline.apply({ kind: "global-sizing-number", field: "minPx", value: 30 });
		const second = pipeline.apply({ kind: "global-sizing-number", field: "maxPx", value: 300 });
		await Promise.all([first, second]);
		expect(store.globalView().sizing.minPx).toBe(30);
	});

	it("WHEN two sizing numbers are edited before either write is awaited THEN the second's own value lands", async () => {
		const { store, pipeline } = pipelineUnderTest();
		const first = pipeline.apply({ kind: "global-sizing-number", field: "minPx", value: 30 });
		const second = pipeline.apply({ kind: "global-sizing-number", field: "maxPx", value: 300 });
		await Promise.all([first, second]);
		expect(store.globalView().sizing.maxPx).toBe(300);
	});

	it("WHEN a metric weight is edited right after a metric was disabled THEN the disable is not reverted", async () => {
		const { store, pipeline } = pipelineUnderTest();
		const disable = pipeline.apply({ kind: "global-sizing-metric-enabled", metric: "backlink-count", enabled: false });
		const weight = pipeline.apply({ kind: "global-sizing-metric-weight", metric: "outlink-count", weight: 3 });
		await Promise.all([disable, weight]);
		expect(store.globalView().sizing.metrics["backlink-count"].enabled).toBe(false);
	});

	it("WHEN two force-layout sliders are dragged before either write is awaited THEN both values land", async () => {
		const { store, pipeline } = pipelineUnderTest();
		const linkGapPx = EngineDefaults.forceLayoutSettings().linkGapPx + 5;
		const first = pipeline.apply({ kind: "global-force-layout-field", field: "linkGapPx", value: linkGapPx });
		const second = pipeline.apply({ kind: "global-force-layout-field", field: "collidePaddingPx", value: 5 });
		await Promise.all([first, second]);
		expect(store.globalView().forceLayout).toMatchObject({ linkGapPx, collidePaddingPx: 5 });
	});

	it("WHEN exclusion is toggled off before an in-flight pattern edit is awaited THEN the patterns survive", async () => {
		const { store, pipeline } = pipelineUnderTest();
		const patterns = pipeline.apply({ kind: "global-exclusion-patterns", patterns: ["^archive/"] });
		const enabled = pipeline.apply({ kind: "global-exclusion-enabled", enabled: true });
		await Promise.all([patterns, enabled]);
		expect(store.nodeExclusion()).toEqual({ enabled: true, patterns: ["^archive/"] });
	});
});

describe("SettingsWritePipeline fan-out", () => {
	it("WHEN one interaction is applied THEN EVERY open view is refreshed", async () => {
		const { viewsRefresh, pipeline } = pipelineUnderTest();
		await pipeline.apply({ kind: "global-cap", value: 42 });
		expect(viewsRefresh.refreshedViewIds).toEqual([...OPEN_VIEW_IDS]);
	});

	it("WHEN a multi-command scope is restored THEN the views are refreshed ONCE, not once per command", async () => {
		const { viewsRefresh, pipeline } = pipelineUnderTest();
		await pipeline.restoreDefaults("all");
		expect(viewsRefresh.refreshedViewIds).toEqual([...OPEN_VIEW_IDS]);
	});

	it("WHEN a scope is restored THEN every command had already reached the store when the fan-out ran", async () => {
		// A real ORDERING assertion: the fan-out port reads the store AT fan-out time, so
		// a refresh that ran ahead of its own write would record the pre-write value and
		// every open view would repaint what was already on screen.
		const store = new PluginDataStore(new FakePluginDataPort());
		const capAtEachFanOut: number[] = [];
		const pipeline = new SettingsWritePipeline(store, {
			refreshAllViews: () => capAtEachFanOut.push(store.globalView().nodeCap),
		});
		await pipeline.apply({ kind: "global-cap", value: 42 });
		await pipeline.restoreDefaults("performance");
		expect(capAtEachFanOut).toEqual([42, EngineDefaults.viewSettings().nodeCap]);
	});
});

describe("SettingsWritePipeline drain", () => {
	it("WHEN a control is used WHILE a restore is running THEN draining waits for that later write", async () => {
		// The settings-tab reset bug in miniature: the redisplay may only read the
		// store once the chain is idle, or it rebuilds controls ahead of a write the
		// user has already asked for.
		const { store, pipeline } = pipelineUnderTest();
		const restore = pipeline.restoreDefaults("performance");
		// Enqueued while the restore is still in flight (it has not been awaited).
		void pipeline.apply({ kind: "global-cap", value: 7 });
		await restore;
		await pipeline.drain();
		expect(store.globalView().nodeCap).toBe(7);
	});
});

/**
 * The DEBOUNCED path, end to end, over the real pipeline and the real store — the
 * settings tab's typed fields are the only writers that go through a thunk, and the
 * thunk must write through the {@link SettingsWriter} it is handed. Two things are
 * only observable here: that a thunk's write actually reaches `data.json`, and that
 * draining from inside a serialised slot does not deadlock (a deadlock shows up as a
 * test that never resolves, hence the short timeout).
 *
 * `settingsDebounce.test.ts` owns WHEN a drain happens; this owns WHERE it lands.
 */
const DEBOUNCE_DELAY_MS = 400;
/** A drain that never resolves must fail in a second, not sit on vitest's default 5s. */
const DEADLOCK_TEST_TIMEOUT_MS = 1_000;
/** The window never fires on its own here: every test drives the drain with `flush()`. */
const NEVER_FIRING_SCHEDULER: DebounceScheduler = { schedule: () => 1, cancel: () => undefined };

describe("DebouncedSettingsWrites over the real pipeline", () => {
	it(
		"WHEN a debounced thunk is flushed THEN its write reaches the store through the pipeline",
		async () => {
			const { store, pipeline } = pipelineUnderTest();
			const debounced = new DebouncedSettingsWrites(DEBOUNCE_DELAY_MS, pipeline, NEVER_FIRING_SCHEDULER);
			debounced.schedule("Node cap", (writer) => writer.apply({ kind: "global-cap", value: 33 }));
			await debounced.flush();
			expect(store.globalView().nodeCap).toBe(33);
		},
		DEADLOCK_TEST_TIMEOUT_MS,
	);

	it(
		"WHEN two fields are typed in one window THEN both survive the drain (each plans over the previous)",
		async () => {
			// The sibling-clobbering bug on the DEBOUNCED path: the second thunk must plan
			// against the globals the first one just wrote, not against a captured snapshot.
			const { store, pipeline } = pipelineUnderTest();
			const debounced = new DebouncedSettingsWrites(DEBOUNCE_DELAY_MS, pipeline, NEVER_FIRING_SCHEDULER);
			debounced.schedule("Minimum node size (px)", (writer) =>
				writer.apply({ kind: "global-sizing-number", field: "minPx", value: 30 }),
			);
			debounced.schedule("Maximum node size (px)", (writer) =>
				writer.apply({ kind: "global-sizing-number", field: "maxPx", value: 300 }),
			);
			await debounced.flush();
			expect(store.globalView().sizing).toMatchObject({ minPx: 30, maxPx: 300 });
		},
		DEADLOCK_TEST_TIMEOUT_MS,
	);
});

describe("SettingsWritePipeline serialised tasks", () => {
	it("WHEN a task writes through the writer it was handed THEN the write lands", async () => {
		const { store, pipeline } = pipelineUnderTest();
		await pipeline.runSerialised((writer) => writer.apply({ kind: "global-cap", value: 11 }));
		expect(store.globalView().nodeCap).toBe(11);
	});

	it("WHEN a serialised task is enqueued behind an interaction THEN it runs after it", async () => {
		const { store, pipeline } = pipelineUnderTest();
		void pipeline.apply({ kind: "global-cap", value: 11 });
		await pipeline.runSerialised((writer) => writer.apply({ kind: "global-cap", value: 22 }));
		expect(store.globalView().nodeCap).toBe(22);
	});
});
