import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { PluginDataStore } from "./PluginDataStore";
import type { PluginDataPort } from "./storagePorts";

/** In-memory data.json port; `saved` mirrors what Obsidian would hold on disk. */
class FakePluginDataPort implements PluginDataPort {
	saved: unknown = null;

	async loadData(): Promise<unknown> {
		return this.saved;
	}

	async saveData(data: unknown): Promise<void> {
		// Deep copy: catches accidental reliance on shared object identity.
		this.saved = JSON.parse(JSON.stringify(data));
	}
}

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
		await (await initializedStore(port)).saveGlobalDepths({ outgoingDepth: 4, incomingDepth: 2 });
		const reloaded = await initializedStore(port);
		expect(reloaded.globalDepths()).toEqual({ outgoingDepth: 4, incomingDepth: 2 });
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
