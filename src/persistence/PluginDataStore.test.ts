import { describe, expect, it } from "vitest";
import { EngineDefaults, NODE_OVERRIDE_HARD_MAX_PX, NODE_OVERRIDE_HARD_MIN_PX } from "../engine";
import { FakePluginDataPort } from "./FakePluginDataPort";
import { PluginDataStore } from "./PluginDataStore";
import type { PluginDataPort } from "./storagePorts";

async function initializedStore(port: PluginDataPort = new FakePluginDataPort()): Promise<PluginDataStore> {
	const store = new PluginDataStore(port);
	await store.init();
	return store;
}

describe("PluginDataStore", () => {
	it("WHEN initialized on a fresh install THEN engine defaults are served", async () => {
		const store = await initializedStore();
		expect(store.globalView()).toEqual(EngineDefaults.viewSettings());
	});

	it("WHEN settings are saved THEN a re-initialized store reads them back (round-trip)", async () => {
		const port = new FakePluginDataPort();
		const savedDepths = {
			...EngineDefaults.depthSettings(),
			linkDepthOut: 4,
			embedDepthOut: 4,
			linkDepthIn: 2,
			pinnedLinkDepthOut: 3,
		};
		await (await initializedStore(port)).saveGlobalDepths(savedDepths);
		const reloaded = await initializedStore(port);
		expect(reloaded.globalDepths()).toEqual(savedDepths);
	});

	it("WHEN a fresh install is read THEN node exclusion defaults to disabled with no patterns", async () => {
		const store = await initializedStore();
		expect(store.nodeExclusion()).toEqual({ enabled: false, patterns: [] });
	});

	it("WHEN node exclusion is saved THEN a re-initialized store reads it back (round-trip)", async () => {
		const port = new FakePluginDataPort();
		await (await initializedStore(port)).saveNodeExclusion({ enabled: true, patterns: ["^rel/"] });
		expect((await initializedStore(port)).nodeExclusion()).toEqual({ enabled: true, patterns: ["^rel/"] });
	});

	it("WHEN a pin is added THEN it round-trips with its timestamp", async () => {
		const port = new FakePluginDataPort();
		await (await initializedStore(port)).addPin("docid_a_e", 1234);
		expect((await initializedStore(port)).pins()).toEqual([{ docid: "docid_a_e", pinTimestamp: 1234 }]);
	});

	it("WHEN the same doc is pinned again THEN the timestamp refreshes without duplicating", async () => {
		const store = await initializedStore();
		await store.addPin("docid_a_e", 1);
		await store.addPin("docid_a_e", 99);
		expect(store.pins()).toEqual([{ docid: "docid_a_e", pinTimestamp: 99 }]);
	});

	it("WHEN pins are removed THEN only the named docids disappear", async () => {
		const store = await initializedStore();
		await store.addPin("docid_a_e", 1);
		await store.addPin("docid_b_e", 2);
		await store.removePins(["docid_a_e"]);
		expect(store.pins()).toEqual([{ docid: "docid_b_e", pinTimestamp: 2 }]);
	});

	it("WHEN asked about a pinned doc THEN hasPin reports it", async () => {
		const store = await initializedStore();
		await store.addPin("docid_a_e", 1);
		expect([store.hasPin("docid_a_e"), store.hasPin("docid_b_e")]).toEqual([true, false]);
	});
});

describe("PluginDataStore node overrides", () => {
	it("WHEN an override is saved THEN it round-trips through the port", async () => {
		const port = new FakePluginDataPort();
		await (
			await initializedStore(port)
		).saveNodeOverride("docid_a_e", { sizePx: { widthPx: 320, heightPx: 180 }, content: "outline" });
		expect((await initializedStore(port)).nodeOverrides()).toEqual({
			docid_a_e: { sizePx: { widthPx: 320, heightPx: 180 }, content: "outline" },
		});
	});

	it("WHEN an override is saved again THEN it replaces the doc's entry wholesale", async () => {
		const store = await initializedStore();
		await store.saveNodeOverride("docid_a_e", { sizePx: { widthPx: 320, heightPx: 180 }, content: "outline" });
		await store.saveNodeOverride("docid_a_e", { content: "image" });
		expect(store.nodeOverrides()).toEqual({ docid_a_e: { content: "image" } });
	});

	it("WHEN an override with neither field is saved THEN the entry is deleted (reset = no orphan)", async () => {
		const store = await initializedStore();
		await store.saveNodeOverride("docid_a_e", { content: "image" });
		await store.saveNodeOverride("docid_a_e", {});
		expect(store.nodeOverrides()).toEqual({});
	});

	it("WHEN a saved pixel box exceeds the hard sanity bounds THEN it is stored clamped into them", async () => {
		const store = await initializedStore();
		await store.saveNodeOverride("docid_a_e", { sizePx: { widthPx: 999999, heightPx: 1 } });
		expect(store.nodeOverrides()).toEqual({
			docid_a_e: { sizePx: { widthPx: NODE_OVERRIDE_HARD_MAX_PX, heightPx: NODE_OVERRIDE_HARD_MIN_PX } },
		});
	});

	it("WHEN overrides are removed THEN only the named docids disappear", async () => {
		const store = await initializedStore();
		await store.saveNodeOverride("docid_a_e", { content: "image" });
		await store.saveNodeOverride("docid_b_e", { content: "outline" });
		await store.removeNodeOverrides(["docid_a_e"]);
		expect(store.nodeOverrides()).toEqual({ docid_b_e: { content: "outline" } });
	});
});
