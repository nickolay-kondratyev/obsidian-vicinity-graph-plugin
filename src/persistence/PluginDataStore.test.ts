import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { FakeUserNotices } from "../view/FakeUserNotices";
import { FakePluginDataPort } from "./FakePluginDataPort";
import { INIT_LOAD_ATTEMPTS, PluginDataStore } from "./PluginDataStore";
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

/**
 * A scripted port for the init read-failure seam. Obsidian's `Plugin.loadData`
 * (Vault.readJson, verified byte-identical in the shipped 1.12.4 AND 1.12.7
 * bundles) answers three ways: parsed JSON on success, `null` when data.json
 * does not exist (ENOENT — a genuine first run), and `undefined` when the read
 * or parse FAILED (transient fs error, torn read) — with the file left intact
 * on disk. Treating that `undefined` like a first run is the restart-time
 * stale-controls bug (ticket nid_ghaeps3siekw0oe17mr4xpmad_e): defaults in
 * memory, the user's real settings still on disk, and no later event to reload.
 */
class ScriptedPluginDataPort implements PluginDataPort {
	loadCalls = 0;

	/** Each entry is one loadData outcome, in order; the LAST entry repeats forever. */
	constructor(private readonly outcomes: readonly (() => Promise<unknown>)[]) {}

	async loadData(): Promise<unknown> {
		const outcome = this.outcomes[Math.min(this.loadCalls, this.outcomes.length - 1)];
		this.loadCalls += 1;
		if (outcome === undefined) {
			throw new Error("ScriptedPluginDataPort: no outcomes scripted");
		}
		return outcome();
	}

	async saveData(): Promise<void> {}
}

const READ_FAILED = async (): Promise<unknown> => undefined;
const READ_REJECTED = async (): Promise<unknown> => {
	throw new Error("EMFILE: too many open files");
};
const NO_FILE = async (): Promise<unknown> => null;

/** A stored data.json whose depth is off the default, so defaults can never masquerade. */
function storedDataWithDepthIn(linkDepthIn: number): () => Promise<unknown> {
	return async () => ({
		version: 2,
		globalDepths: { ...EngineDefaults.depthSettings(), linkDepthIn },
	});
}

/** No real waiting in tests: retries settle on the microtask queue. */
const IMMEDIATE_SLEEP = async (): Promise<void> => {};

describe("PluginDataStore.init read-failure resilience", () => {
	it("WHEN the first read fails (undefined) and a retry succeeds THEN the persisted settings are served", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED, storedDataWithDepthIn(2)]);
		const store = new PluginDataStore(port, undefined, IMMEDIATE_SLEEP);
		await store.init();
		expect(store.globalDepths().linkDepthIn).toBe(2);
	});

	it("WHEN the first read rejects and a retry succeeds THEN the persisted settings are served", async () => {
		const port = new ScriptedPluginDataPort([READ_REJECTED, storedDataWithDepthIn(3)]);
		const store = new PluginDataStore(port, undefined, IMMEDIATE_SLEEP);
		await store.init();
		expect(store.globalDepths().linkDepthIn).toBe(3);
	});

	it("WHEN every read attempt fails THEN defaults are served (never a throw out of init)", async () => {
		const store = new PluginDataStore(new ScriptedPluginDataPort([READ_FAILED]), undefined, IMMEDIATE_SLEEP);
		await store.init();
		expect(store.globalDepths()).toEqual(EngineDefaults.depthSettings());
	});

	it("WHEN every read attempt fails THEN the user is told exactly once", async () => {
		const notices = new FakeUserNotices();
		const store = new PluginDataStore(new ScriptedPluginDataPort([READ_FAILED]), notices, IMMEDIATE_SLEEP);
		await store.init();
		expect(notices.messages).toHaveLength(1);
	});

	it("WHEN every read attempt fails THEN exactly the declared attempt budget is spent", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED]);
		await new PluginDataStore(port, undefined, IMMEDIATE_SLEEP).init();
		expect(port.loadCalls).toBe(INIT_LOAD_ATTEMPTS);
	});

	it("WHEN data.json does not exist (null — a genuine first run) THEN no retry is spent", async () => {
		const port = new ScriptedPluginDataPort([NO_FILE]);
		await new PluginDataStore(port, undefined, IMMEDIATE_SLEEP).init();
		expect(port.loadCalls).toBe(1);
	});

	it("WHEN a read succeeds after a failure THEN the user is not told anything", async () => {
		const notices = new FakeUserNotices();
		const port = new ScriptedPluginDataPort([READ_FAILED, storedDataWithDepthIn(2)]);
		await new PluginDataStore(port, notices, IMMEDIATE_SLEEP).init();
		expect(notices.messages).toEqual([]);
	});
});
