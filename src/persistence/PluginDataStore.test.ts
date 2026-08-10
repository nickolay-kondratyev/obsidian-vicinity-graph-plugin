import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
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

/**
 * Deleting a doc is not unpinning it. `data.json`'s only docid-keyed map is now
 * the GLOBAL pinned set — the per-doc/per-main maps moved to the per-file store,
 * so this store's `forgetDocs` prunes only pins (the two stores together are the
 * conceptual choke point; see PerDocStore.test.ts for the per-file half).
 */
describe("PluginDataStore.forgetDocs", () => {
	it("WHEN a pinned doc is forgotten THEN its pin disappears", async () => {
		const store = await initializedStore();
		await store.addPin("docid_a_e", 1);
		await store.forgetDocs(["docid_a_e"]);
		expect(store.pins()).toEqual([]);
	});

	it("WHEN a doc is forgotten THEN other docs keep their pins", async () => {
		const store = await initializedStore();
		await store.addPin("docid_b_e", 2);
		await store.forgetDocs(["docid_a_e"]);
		expect(store.pins()).toEqual([{ docid: "docid_b_e", pinTimestamp: 2 }]);
	});

	it("WHEN a doc nothing was pinned about is forgotten THEN data.json is not rewritten", async () => {
		const port = new FakePluginDataPort();
		await (await initializedStore(port)).forgetDocs(["docid_untracked_e"]);
		expect(port.saved).toBeNull();
	});
});
