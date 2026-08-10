import { describe, expect, it } from "vitest";
import { FakeDocIdPort } from "../adapters/FakeDocIdPort";
import { FakeObsidianPorts } from "../adapters/FakeObsidianPorts";
import { DocIdMapWarmer } from "./DocIdMapWarmer";
import { FakePluginDataPort } from "./FakePluginDataPort";
import { FakeVaultFsPort } from "./FakeVaultFsPort";
import { OrphanSweeper } from "./OrphanSweeper";
import { PathDocIdMap } from "./PathDocIdMap";
import { PerDocStore } from "./PerDocStore";
import { PluginDataStore } from "./PluginDataStore";
import { VaultFileStore } from "./VaultFileStore";

/** A fresh per-file store over in-memory disk — the home of overrides + local pins in the sweep. */
function newPerDocStore(): PerDocStore {
	return new PerDocStore(new VaultFileStore(".plugin_data/vicinity_graph", new FakeVaultFsPort(), () => 0));
}

/** > the scanner's internal batch size of 20, so the warm phase must yield at least once. */
const LIVE_NOTE_COUNT = 25;

/**
 * One vault snapshot exercising the orphan rule: 25 live notes with docids
 * (docid_note0_e ...), one id-less note, one live pin and one stale pin, one
 * live node override and one stale one.
 */
async function sweptFixture() {
	const files = Array.from({ length: LIVE_NOTE_COUNT }, (_, i) => ({ path: `note${i}.md` }));
	const docids = Object.fromEntries(files.map((file, i) => [file.path, `docid_note${i}_e`]));
	const ports = new FakeObsidianPorts({ files: [...files, { path: "idless.md" }, { path: "img.png" }] });
	const docIdPort = new FakeDocIdPort(docids);

	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();
	await pluginDataStore.addPin("docid_note1_e", 100);
	await pluginDataStore.addPin("docid_stale_e", 200);
	const perDocStore = newPerDocStore();
	await perDocStore.saveNodeOverrideField("docid_note2_e", { field: "content", value: "image" });
	await perDocStore.saveNodeOverrideField("docid_gone_e", {
		field: "sizePx",
		value: { widthPx: 300, heightPx: 200 },
	});
	// A local pin under a LIVE main whose TARGET vanished, plus one whose MAIN key
	// vanished — both are orphans the sweep must reach through forgetDocs.
	await perDocStore.addLocalPin("docid_note3_e", "docid_localtargetgone_e", 300);
	await perDocStore.addLocalPin("docid_localmaingone_e", "docid_note4_e", 400);

	const pathDocIdMap = new PathDocIdMap();
	let yields = 0;
	const sweeper = new OrphanSweeper(
		new DocIdMapWarmer(ports.vault, docIdPort, pathDocIdMap, async () => {
			yields += 1;
		}),
		pathDocIdMap,
		pluginDataStore,
		perDocStore,
	);
	const summary = await sweeper.run();
	return { docIdPort, pluginDataStore, perDocStore, pathDocIdMap, yieldCount: () => yields, summary };
}

describe("OrphanSweeper", () => {
	it("WHEN a pinned doc vanished THEN exactly that pin is removed", async () => {
		const { pluginDataStore } = await sweptFixture();
		expect(pluginDataStore.pins().map((pin) => pin.docid)).toEqual(["docid_note1_e"]);
	});

	it("WHEN an overridden doc vanished THEN exactly that override is removed", async () => {
		const { perDocStore } = await sweptFixture();
		expect(Object.keys(perDocStore.nodeOverrides())).toEqual(["docid_note2_e"]);
	});

	it("WHEN the sweep warms up THEN the path→docid map answers for visited docs", async () => {
		const { pathDocIdMap } = await sweptFixture();
		expect(pathDocIdMap.getDocId("note7.md")).toBe("docid_note7_e");
	});

	it("WHEN the sweep runs THEN it never creates ids (getDocId only — read path)", async () => {
		const { docIdPort } = await sweptFixture();
		expect(docIdPort.ensureCalls).toBe(0);
	});

	it("WHEN the vault exceeds one batch THEN the sweep yields the main thread between batches", async () => {
		const { yieldCount } = await sweptFixture();
		expect(yieldCount()).toBeGreaterThan(0);
	});

	it("WHEN a local-pin TARGET vanished THEN it is pruned but the live main survives", async () => {
		const { perDocStore } = await sweptFixture();
		expect(perDocStore.localPins("docid_note3_e")).toEqual([]);
	});

	it("WHEN a local-pin MAIN key vanished THEN its whole entry is dropped", async () => {
		const { perDocStore } = await sweptFixture();
		expect(perDocStore.localPins("docid_localmaingone_e")).toEqual([]);
	});

	it("WHEN the sweep completes THEN its summary counts exactly what was removed", async () => {
		const { summary } = await sweptFixture();
		// docid_stale_e; docid_gone_e; two stale local-pin docids (target + main key).
		expect(summary).toEqual({ pinsRemoved: 1, overridesRemoved: 1, localPinsRemoved: 2, everyFileRead: true });
	});
});

/**
 * Race regression (review F1): while the chunked warm-up is still yielding, the
 * user creates AND pins a brand-new doc — absent from the `getFiles()` snapshot
 * taken at warm-up start. Every real write intent maps the docid
 * (PersistenceServices.withPersistableIdentity), so the sweep must re-verify
 * against the map before dropping anything.
 */
async function midSweepWriteFixture() {
	const files = Array.from({ length: LIVE_NOTE_COUNT }, (_, i) => ({ path: `note${i}.md` }));
	const docids = Object.fromEntries(files.map((file, i) => [file.path, `docid_note${i}_e`]));
	const ports = new FakeObsidianPorts({ files });
	const docIdPort = new FakeDocIdPort(docids);
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();

	const pathDocIdMap = new PathDocIdMap();
	let writeIntentSimulated = false;
	// GIVEN the first warm-up yield: the user pins a just-created doc. These are
	// exactly the effects of PersistenceServices.withPersistableIdentity + store.
	const simulateWriteIntentOnFirstYield = async () => {
		if (writeIntentSimulated) {
			return;
		}
		writeIntentSimulated = true;
		pathDocIdMap.set("new-note.md", "docid_new_e");
		await pluginDataStore.addPin("docid_new_e", 300);
	};

	const sweeper = new OrphanSweeper(
		new DocIdMapWarmer(ports.vault, docIdPort, pathDocIdMap, simulateWriteIntentOnFirstYield),
		pathDocIdMap,
		pluginDataStore,
		newPerDocStore(),
	);
	await sweeper.run();
	return { pluginDataStore };
}

describe("OrphanSweeper mid-sweep write race", () => {
	it("WHEN a doc is pinned during warm-up THEN its pin survives the sweep", async () => {
		const { pluginDataStore } = await midSweepWriteFixture();
		expect(pluginDataStore.pins().map((pin) => pin.docid)).toContain("docid_new_e");
	});
});

/**
 * Scale check (step-07 perf pass): a vault with HUNDREDS of eligible files must
 * not run the warm-up as one unbroken main-thread block. Asserted STRUCTURALLY
 * via the yield count (per CLARIFICATION — no wall-clock), so it stays robust
 * across machines. All notes are live and there is nothing stale, isolating the
 * chunk-yield behaviour from any deletion work.
 */
const HUNDREDS_NOTE_COUNT = 500;
/**
 * The warm-up chunks 500 eligible files in batches of the scanner's batch size (20),
 * yielding after every FULL batch except the last (ChunkedWork's boundary rule):
 * boundaries at 20, 40, ... 480 → 24 yields.
 */
const MIN_WARM_PHASE_YIELDS = Math.floor((HUNDREDS_NOTE_COUNT - 1) / 20);

async function hundredsOfFilesSweep() {
	const files = Array.from({ length: HUNDREDS_NOTE_COUNT }, (_, i) => ({ path: `note${i}.md` }));
	const docids = Object.fromEntries(files.map((file, i) => [file.path, `docid_note${i}_e`]));
	const ports = new FakeObsidianPorts({ files });
	const docIdPort = new FakeDocIdPort(docids);
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();

	const pathDocIdMap = new PathDocIdMap();
	let yields = 0;
	const sweeper = new OrphanSweeper(
		new DocIdMapWarmer(ports.vault, docIdPort, pathDocIdMap, async () => {
			yields += 1;
		}),
		pathDocIdMap,
		pluginDataStore,
		newPerDocStore(),
	);
	const summary = await sweeper.run();
	return { yieldCount: () => yields, summary };
}

describe("OrphanSweeper at hundreds-of-files scale", () => {
	it("WHEN the vault has hundreds of eligible files THEN the sweep yields the main thread many times (chunk-yield scales)", async () => {
		const { yieldCount } = await hundredsOfFilesSweep();
		expect(yieldCount()).toBeGreaterThanOrEqual(MIN_WARM_PHASE_YIELDS);
	});

	it("WHEN hundreds of files are all live THEN the sweep removes nothing", async () => {
		const { summary } = await hundredsOfFilesSweep();
		expect(summary).toEqual({ pinsRemoved: 0, overridesRemoved: 0, localPinsRemoved: 0, everyFileRead: true });
	});
});

/**
 * One note vanishes mid-scan (its read REJECTS). The scan must still finish and
 * warm the map — but the sweep DELETES, and a doc it could not read is not
 * evidence that the doc is gone, so this pass must drop nothing at all.
 */
async function sweepWithUnreadableFileFixture() {
	const files = Array.from({ length: LIVE_NOTE_COUNT }, (_, i) => ({ path: `note${i}.md` }));
	const docids = Object.fromEntries(files.map((file, i) => [file.path, `docid_note${i}_e`]));
	const ports = new FakeObsidianPorts({ files });
	const docIdPort = new FakeDocIdPort(docids);
	docIdPort.markUnreadable("note3.md");

	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();
	await pluginDataStore.addPin("docid_note1_e", 100);
	await pluginDataStore.addPin("docid_stale_e", 200);

	const pathDocIdMap = new PathDocIdMap();
	const sweeper = new OrphanSweeper(
		new DocIdMapWarmer(ports.vault, docIdPort, pathDocIdMap),
		pathDocIdMap,
		pluginDataStore,
		newPerDocStore(),
	);
	const summary = await sweeper.run();
	return { pluginDataStore, pathDocIdMap, summary };
}

describe("OrphanSweeper when a file cannot be read", () => {
	it("WHEN one file read fails THEN the sweep drops NOTHING (a doc it could not read is not a doc that is gone)", async () => {
		const { pluginDataStore } = await sweepWithUnreadableFileFixture();
		expect(pluginDataStore.pins().map((pin) => pin.docid)).toEqual(["docid_note1_e", "docid_stale_e"]);
	});

	it("WHEN one file read fails THEN the summary says the evidence was incomplete", async () => {
		const { summary } = await sweepWithUnreadableFileFixture();
		expect(summary).toEqual({ pinsRemoved: 0, overridesRemoved: 0, localPinsRemoved: 0, everyFileRead: false });
	});

	it("WHEN one file read fails THEN the map is still warmed by the same pass", async () => {
		const { pathDocIdMap } = await sweepWithUnreadableFileFixture();
		expect(pathDocIdMap.getDocId("note7.md")).toBe("docid_note7_e");
	});
});
