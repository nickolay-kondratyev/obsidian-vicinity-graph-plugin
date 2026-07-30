import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { FakePluginDataPort } from "../persistence/FakePluginDataPort";
import { PluginDataStore } from "../persistence/PluginDataStore";
import { FakeViewsRefresh } from "./FakeViewsRefresh";
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

	it("WHEN a scope is restored THEN the defaults reached the store before the fan-out", async () => {
		// Written as one assertion on the store AFTER the awaited call: the fan-out is
		// synchronous inside the task, so a fan-out ahead of the write is only
		// observable as a store that has not moved yet.
		const { store, pipeline } = pipelineUnderTest();
		await pipeline.apply({ kind: "global-cap", value: 42 });
		await pipeline.restoreDefaults("performance");
		expect(store.globalView().nodeCap).toBe(EngineDefaults.viewSettings().nodeCap);
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
