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

});

const SIZE_CHANGE = { field: "sizePx", value: { widthPx: 320, heightPx: 180 } } as const;
const CONTENT_CHANGE = { field: "content", value: "outline" } as const;

describe("PluginDataStore node overrides", () => {
	it("WHEN an override field is saved THEN it round-trips through the port", async () => {
		const port = new FakePluginDataPort();
		await (await initializedStore(port)).saveNodeOverrideField("docid_a_e", SIZE_CHANGE);
		expect((await initializedStore(port)).nodeOverrides()).toEqual({
			docid_a_e: { sizePx: { widthPx: 320, heightPx: 180 } },
		});
	});

	it("WHEN the other field is saved THEN the stored one SURVIVES (the store merges, callers never do)", async () => {
		const store = await initializedStore();
		await store.saveNodeOverrideField("docid_a_e", SIZE_CHANGE);
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		expect(store.nodeOverrides()).toEqual({
			docid_a_e: { sizePx: { widthPx: 320, heightPx: 180 }, content: "outline" },
		});
	});

	it("WHEN the same field is saved again THEN the newer value replaces it", async () => {
		const store = await initializedStore();
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		await store.saveNodeOverrideField("docid_a_e", { field: "content", value: "image" });
		expect(store.nodeOverrides()).toEqual({ docid_a_e: { content: "image" } });
	});

	it("WHEN one field is cleared THEN the other one stays", async () => {
		const store = await initializedStore();
		await store.saveNodeOverrideField("docid_a_e", SIZE_CHANGE);
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		await store.clearNodeOverrideField("docid_a_e", "content");
		expect(store.nodeOverrides()).toEqual({ docid_a_e: { sizePx: { widthPx: 320, heightPx: 180 } } });
	});

	it("WHEN the LAST field is cleared THEN the whole entry is deleted (reset = no orphan)", async () => {
		const store = await initializedStore();
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		await store.clearNodeOverrideField("docid_a_e", "content");
		expect(store.nodeOverrides()).toEqual({});
	});

	it("WHEN a field that was never set is cleared THEN nothing is written at all", async () => {
		const port = new FakePluginDataPort();
		await (await initializedStore(port)).clearNodeOverrideField("docid_a_e", "sizePx");
		expect(port.saved).toBeNull();
	});

	it("WHEN a saved pixel box exceeds the hard sanity bounds THEN it is stored clamped into them", async () => {
		const store = await initializedStore();
		await store.saveNodeOverrideField("docid_a_e", { field: "sizePx", value: { widthPx: 999999, heightPx: 1 } });
		expect(store.nodeOverrides()).toEqual({
			docid_a_e: { sizePx: { widthPx: NODE_OVERRIDE_HARD_MAX_PX, heightPx: NODE_OVERRIDE_HARD_MIN_PX } },
		});
	});
});

/** Deleting a doc is not unpinning it — every docid-keyed map drops the doc at once. */
describe("PluginDataStore.forgetDocs", () => {
	it("WHEN a doc is forgotten THEN both its pin and its override disappear", async () => {
		const store = await initializedStore();
		await store.addPin("docid_a_e", 1);
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		await store.forgetDocs(["docid_a_e"]);
		expect([store.pins(), store.nodeOverrides()]).toEqual([[], {}]);
	});

	it("WHEN a doc is forgotten THEN other docs keep their entries", async () => {
		const store = await initializedStore();
		await store.addPin("docid_b_e", 2);
		await store.saveNodeOverrideField("docid_b_e", CONTENT_CHANGE);
		await store.forgetDocs(["docid_a_e"]);
		expect([store.pins(), store.nodeOverrides()]).toEqual([
			[{ docid: "docid_b_e", pinTimestamp: 2 }],
			{ docid_b_e: { content: "outline" } },
		]);
	});

	it("WHEN a doc nothing was persisted about is forgotten THEN data.json is not rewritten", async () => {
		const port = new FakePluginDataPort();
		await (await initializedStore(port)).forgetDocs(["docid_untracked_e"]);
		expect(port.saved).toBeNull();
	});
});
