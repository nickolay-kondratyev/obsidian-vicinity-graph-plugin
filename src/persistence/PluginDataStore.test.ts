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

describe("PluginDataStore local pins", () => {
	it("WHEN a local pin is added THEN it round-trips under its MAIN key with its timestamp", async () => {
		const port = new FakePluginDataPort();
		await (await initializedStore(port)).addLocalPin("docid_main_e", "docid_target_e", 1234);
		expect((await initializedStore(port)).localPins("docid_main_e")).toEqual([
			{ docid: "docid_target_e", pinTimestamp: 1234 },
		]);
	});

	it("WHEN a main has no local pins THEN the read is empty", async () => {
		const store = await initializedStore();
		expect(store.localPins("docid_main_e")).toEqual([]);
	});

	it("WHEN the same target is re-pinned under a main THEN the timestamp refreshes without duplicating", async () => {
		const store = await initializedStore();
		await store.addLocalPin("docid_main_e", "docid_target_e", 1);
		await store.addLocalPin("docid_main_e", "docid_target_e", 99);
		expect(store.localPins("docid_main_e")).toEqual([{ docid: "docid_target_e", pinTimestamp: 99 }]);
	});

	it("WHEN a target is locally pinned under two DIFFERENT mains THEN each main keeps its own entry", async () => {
		const store = await initializedStore();
		await store.addLocalPin("docid_main_a_e", "docid_target_e", 1);
		await store.addLocalPin("docid_main_b_e", "docid_target_e", 2);
		expect([store.localPins("docid_main_a_e"), store.localPins("docid_main_b_e")]).toEqual([
			[{ docid: "docid_target_e", pinTimestamp: 1 }],
			[{ docid: "docid_target_e", pinTimestamp: 2 }],
		]);
	});

	it("WHEN some targets are removed from a main THEN only the named ones disappear", async () => {
		const store = await initializedStore();
		await store.addLocalPin("docid_main_e", "docid_x_e", 1);
		await store.addLocalPin("docid_main_e", "docid_y_e", 2);
		await store.removeLocalPins("docid_main_e", ["docid_x_e"]);
		expect(store.localPins("docid_main_e")).toEqual([{ docid: "docid_y_e", pinTimestamp: 2 }]);
	});

	it("WHEN a main's LAST target is removed THEN the whole main key is dropped (no empty list persists)", async () => {
		const port = new FakePluginDataPort();
		const store = await initializedStore(port);
		await store.addLocalPin("docid_main_e", "docid_x_e", 1);
		await store.removeLocalPins("docid_main_e", ["docid_x_e"]);
		expect((await initializedStore(port)).localPins("docid_main_e")).toEqual([]);
	});

	it("WHEN a target that was never pinned is removed THEN nothing is written at all", async () => {
		const port = new FakePluginDataPort();
		await (await initializedStore(port)).removeLocalPins("docid_main_e", ["docid_ghost_e"]);
		expect(port.saved).toBeNull();
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

	it("WHEN a field is cleared THEN the entry keeps ONLY the fields that were not named", async () => {
		// Clearing rebuilds the entry, so it must copy-minus-one — never re-list
		// the fields it knows about (a field added to NodeOverride would vanish).
		const store = await initializedStore();
		await store.saveNodeOverrideField("docid_a_e", SIZE_CHANGE);
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		await store.clearNodeOverrideField("docid_a_e", "sizePx");
		expect(store.nodeOverrides()).toEqual({ docid_a_e: { content: "outline" } });
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

	it("WHEN a saved pixel box is not finite THEN it is REFUSED, not degraded to a bound", async () => {
		// Absence is what "no override" means, so an unmeasurable box has no
		// number to fall back to — inventing the hard minimum would persist a dot.
		const store = await initializedStore();
		await store.saveNodeOverrideField("docid_a_e", { field: "sizePx", value: { widthPx: NaN, heightPx: 200 } });
		expect(store.nodeOverrides()).toEqual({});
	});

	it("WHEN a non-finite box is saved over a stored one THEN the stored box SURVIVES", async () => {
		const store = await initializedStore();
		await store.saveNodeOverrideField("docid_a_e", SIZE_CHANGE);
		await store.saveNodeOverrideField("docid_a_e", {
			field: "sizePx",
			value: { widthPx: Number.POSITIVE_INFINITY, heightPx: 200 },
		});
		expect(store.nodeOverrides()).toEqual({ docid_a_e: { sizePx: { widthPx: 320, heightPx: 180 } } });
	});

	it("WHEN a refused box is the only write THEN data.json is not rewritten", async () => {
		const port = new FakePluginDataPort();
		const store = await initializedStore(port);
		await store.saveNodeOverrideField("docid_a_e", { field: "sizePx", value: { widthPx: NaN, heightPx: NaN } });
		expect(port.saved).toBeNull();
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

	it("WHEN a doc that is a local-pin MAIN key is forgotten THEN its whole main entry disappears", async () => {
		const store = await initializedStore();
		await store.addLocalPin("docid_main_e", "docid_target_e", 1);
		await store.forgetDocs(["docid_main_e"]);
		expect(store.localPins("docid_main_e")).toEqual([]);
	});

	it("WHEN a doc that is a local-pin TARGET is forgotten THEN it is pruned from every main's list", async () => {
		const store = await initializedStore();
		await store.addLocalPin("docid_main_a_e", "docid_target_e", 1);
		await store.addLocalPin("docid_main_b_e", "docid_target_e", 2);
		await store.addLocalPin("docid_main_b_e", "docid_keep_e", 3);
		await store.forgetDocs(["docid_target_e"]);
		expect([store.localPins("docid_main_a_e"), store.localPins("docid_main_b_e")]).toEqual([
			[],
			[{ docid: "docid_keep_e", pinTimestamp: 3 }],
		]);
	});

	it("WHEN a forgotten target was a main's ONLY local pin THEN that main key is dropped whole (no empty list)", async () => {
		const port = new FakePluginDataPort();
		const store = await initializedStore(port);
		await store.addLocalPin("docid_main_e", "docid_target_e", 1);
		await store.forgetDocs(["docid_target_e"]);
		expect((await initializedStore(port)).localPins("docid_main_e")).toEqual([]);
	});

	it("WHEN a doc appears as BOTH a global pin and a local-pin target THEN forgetting it clears both", async () => {
		const store = await initializedStore();
		await store.addPin("docid_dual_e", 1);
		await store.addLocalPin("docid_main_e", "docid_dual_e", 2);
		await store.forgetDocs(["docid_dual_e"]);
		expect([store.pins(), store.localPins("docid_main_e")]).toEqual([[], []]);
	});
});

/**
 * The READ counterpart of `forgetDocs`: the read path warms exactly these docids
 * (`DocIdMapWarmer`), so a third docid-keyed map is warmed by adding it HERE and
 * nowhere else — a warm list assembled by a caller would silently omit it, and an
 * unwarmed map is invisible on the first build after a restart.
 */
describe("PluginDataStore.docIdKeyedDocids", () => {
	it("WHEN a docid has state in BOTH docid-keyed maps THEN it is reported once", async () => {
		const store = await initializedStore();
		await store.addPin("docid_a_e", 1);
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		expect(store.docIdKeyedDocids()).toEqual(["docid_a_e"]);
	});

	it("WHEN a docid has state in ONLY the override map THEN it is still reported", async () => {
		const store = await initializedStore();
		await store.addPin("docid_a_e", 1);
		await store.saveNodeOverrideField("docid_b_e", CONTENT_CHANGE);
		expect(store.docIdKeyedDocids()).toEqual(["docid_a_e", "docid_b_e"]);
	});

	it("WHEN a local pin exists THEN BOTH its main KEY and its target docid are reported (both must resolve to render)", async () => {
		const store = await initializedStore();
		await store.addLocalPin("docid_main_e", "docid_target_e", 1);
		expect([...store.docIdKeyedDocids()].sort()).toEqual(["docid_main_e", "docid_target_e"]);
	});

	it("WHEN a docid is a global pin AND a local-pin main key THEN it is reported once", async () => {
		const store = await initializedStore();
		await store.addPin("docid_shared_e", 1);
		await store.addLocalPin("docid_shared_e", "docid_target_e", 2);
		expect([...store.docIdKeyedDocids()].sort()).toEqual(["docid_shared_e", "docid_target_e"]);
	});
});
