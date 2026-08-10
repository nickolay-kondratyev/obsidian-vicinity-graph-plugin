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
/**
 * How the raw-bytes PROBE answers once loadData's retries exhaust (ticket
 * nid_08ripmsxon0r9ncn42lp623g1_e): the exact bytes on disk, `null` (absent or the
 * fs read failed), or a thrown error (the probe itself blew up). The store parses
 * the returned bytes to tell CORRUPT from transient.
 */
interface RawProbe {
	readRaw(): Promise<string | null>;
}

/** The default probe: no readable bytes ⇒ the store classifies as transient (its pre-existing behavior). */
const PROBE_UNREADABLE: RawProbe = { readRaw: async () => null };

class ScriptedPluginDataPort implements PluginDataPort {
	loadCalls = 0;
	saveCalls = 0;
	quarantineCalls = 0;
	/** The name a quarantine returns — asserted in the recovery notice. */
	readonly quarantineName = "data.json.corrupt-2026-08-10T20-09-55";

	/**
	 * @param outcomes each is one loadData outcome, in order; the LAST repeats forever.
	 * @param probe how the corruption probe answers after the retries exhaust (default: unreadable ⇒ transient).
	 */
	constructor(
		private readonly outcomes: readonly (() => Promise<unknown>)[],
		private readonly probe: RawProbe = PROBE_UNREADABLE,
	) {}

	async loadData(): Promise<unknown> {
		const outcome = this.outcomes[Math.min(this.loadCalls, this.outcomes.length - 1)];
		this.loadCalls += 1;
		if (outcome === undefined) {
			throw new Error("ScriptedPluginDataPort: no outcomes scripted");
		}
		return outcome();
	}

	async saveData(): Promise<void> {
		this.saveCalls += 1;
	}

	readRawData(): Promise<string | null> {
		return this.probe.readRaw();
	}

	async quarantineData(): Promise<string> {
		this.quarantineCalls += 1;
		return this.quarantineName;
	}
}

const READ_FAILED = async (): Promise<unknown> => undefined;
const READ_REJECTED = async (): Promise<unknown> => {
	throw new Error("EMFILE: too many open files");
};
const NO_FILE = async (): Promise<unknown> => null;

/** A probe that reads back UNPARSEABLE bytes — the signature of a corrupt data.json. */
const PROBE_CORRUPT_BYTES: RawProbe = { readRaw: async () => "{ this is not: json <<<<<<< HEAD" };
/** A probe that reads back VALID JSON — loadData hiccuped but the file is intact (transient). */
const PROBE_PARSEABLE_BYTES: RawProbe = { readRaw: async () => '{"version":2}' };
/** A probe that itself throws — the store cannot classify, so it treats it as transient. */
const PROBE_THROWS: RawProbe = {
	readRaw: async () => {
		throw new Error("EACCES: permission denied");
	},
};

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

/**
 * A session whose init NEVER read data.json holds defaults in memory while the
 * user's real file sits intact on disk. Every mutator persists the WHOLE
 * in-memory object, so allowing any write through would overwrite the user's
 * settings and pins with defaults — the data-loss half of ticket
 * nid_ghaeps3siekw0oe17mr4xpmad_e. Such a session must therefore REFUSE writes;
 * the rejection surfaces through the settings pipeline's / runGuarded's one
 * failure policy, so the user is told each time.
 */
describe("PluginDataStore degraded-session write protection", () => {
	/** Whether the store comes up degraded or healthy is the PORT's script, not this helper's. */
	async function initializedStoreOn(port: ScriptedPluginDataPort): Promise<PluginDataStore> {
		const store = new PluginDataStore(port, undefined, IMMEDIATE_SLEEP);
		await store.init();
		return store;
	}

	it("WHEN init exhausted every read attempt THEN a settings write rejects instead of overwriting the unread file", async () => {
		const store = await initializedStoreOn(new ScriptedPluginDataPort([READ_FAILED]));
		await expect(store.saveGlobalDepths({ ...EngineDefaults.depthSettings(), linkDepthIn: 4 })).rejects.toThrow();
	});

	it("WHEN init exhausted every read attempt THEN no write ever reaches the port", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED]);
		const store = await initializedStoreOn(port);
		await store.addPin("docid-1", 1).catch(() => undefined);
		expect(port.saveCalls).toBe(0);
	});

	it("WHEN init exhausted every read attempt THEN a refused write leaves memory on defaults (screen snaps back on the rebuild)", async () => {
		const store = await initializedStoreOn(new ScriptedPluginDataPort([READ_FAILED]));
		await store.saveGlobalDepths({ ...EngineDefaults.depthSettings(), linkDepthIn: 4 }).catch(() => undefined);
		expect(store.globalDepths()).toEqual(EngineDefaults.depthSettings());
	});

	it("WHEN a retry recovered the read THEN later writes persist normally", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED, storedDataWithDepthIn(2)]);
		const store = await initializedStoreOn(port);
		await store.saveGlobalDepths({ ...EngineDefaults.depthSettings(), linkDepthIn: 4 });
		expect(port.saveCalls).toBe(1);
	});
});

/**
 * A `data.json` that loadData can never parse is CORRUPT, not transient (torn write,
 * sync conflict): retrying every session can't fix it, so the pre-recovery behavior
 * degraded the plugin forever behind a manual file delete. The raw probe tells the two
 * apart — bytes present but unparseable ⇒ corrupt ⇒ set the file aside (never delete)
 * and start fresh with writes ENABLED; anything else stays the transient
 * write-protection above (ticket nid_08ripmsxon0r9ncn42lp623g1_e, option a).
 */
describe("PluginDataStore.init corruption recovery", () => {
	async function initializedStoreOn(port: ScriptedPluginDataPort, notices?: FakeUserNotices): Promise<PluginDataStore> {
		const store = new PluginDataStore(port, notices, IMMEDIATE_SLEEP);
		await store.init();
		return store;
	}

	it("WHEN reads exhaust and the raw probe finds unparseable bytes THEN the file is quarantined once", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED], PROBE_CORRUPT_BYTES);
		await initializedStoreOn(port);
		expect(port.quarantineCalls).toBe(1);
	});

	it("WHEN a corrupt file is quarantined THEN the session starts fresh with writes ENABLED", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED], PROBE_CORRUPT_BYTES);
		const store = await initializedStoreOn(port);
		await store.saveGlobalDepths({ ...EngineDefaults.depthSettings(), linkDepthIn: 4 });
		expect(port.saveCalls).toBe(1);
	});

	it("WHEN a corrupt file is quarantined THEN defaults are served this session", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED], PROBE_CORRUPT_BYTES);
		const store = await initializedStoreOn(port);
		expect(store.globalDepths()).toEqual(EngineDefaults.depthSettings());
	});

	it("WHEN a corrupt file is quarantined THEN the user is told once, naming the set-aside file", async () => {
		const notices = new FakeUserNotices();
		const port = new ScriptedPluginDataPort([READ_FAILED], PROBE_CORRUPT_BYTES);
		await initializedStoreOn(port, notices);
		expect(notices.messages).toEqual([expect.stringContaining(port.quarantineName)]);
	});

	it("WHEN the probe reads PARSEABLE bytes (a transient, not corruption) THEN the file is NOT quarantined", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED], PROBE_PARSEABLE_BYTES);
		await initializedStoreOn(port);
		expect(port.quarantineCalls).toBe(0);
	});

	it("WHEN the probe reads PARSEABLE bytes THEN writes stay REFUSED (transient protection)", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED], PROBE_PARSEABLE_BYTES);
		const store = await initializedStoreOn(port);
		await store.saveGlobalDepths({ ...EngineDefaults.depthSettings(), linkDepthIn: 4 }).catch(() => undefined);
		expect(port.saveCalls).toBe(0);
	});

	it("WHEN the probe itself throws THEN the file is NOT quarantined (unclassifiable ⇒ transient)", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED], PROBE_THROWS);
		await initializedStoreOn(port);
		expect(port.quarantineCalls).toBe(0);
	});

	it("WHEN the probe itself throws THEN writes stay REFUSED (transient protection)", async () => {
		const port = new ScriptedPluginDataPort([READ_FAILED], PROBE_THROWS);
		const store = await initializedStoreOn(port);
		await store.saveGlobalDepths({ ...EngineDefaults.depthSettings(), linkDepthIn: 4 }).catch(() => undefined);
		expect(port.saveCalls).toBe(0);
	});
});
