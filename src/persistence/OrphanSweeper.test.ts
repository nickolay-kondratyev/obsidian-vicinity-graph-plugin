import { describe, expect, it } from "vitest";
import { FakeDocIdPort } from "../adapters/FakeDocIdPort";
import { FakeObsidianPorts } from "../adapters/FakeObsidianPorts";
import { DocDataMutations } from "./DocDataMutations";
import { DocDataStore } from "./DocDataStore";
import { FakeFileStorage } from "./FakeFileStorage";
import { FakePluginDataPort } from "./FakePluginDataPort";
import { OrphanSweeper } from "./OrphanSweeper";
import { PathDocIdMap } from "./PathDocIdMap";
import { PERSISTED_SHAPE_VERSION } from "./persistedShapes";
import { PluginDataStore } from "./PluginDataStore";

const DIR = "plugins/vicinity-graph/doc-data";
/** > the sweeper's internal batch size of 20, so the warm phase must yield at least once. */
const LIVE_NOTE_COUNT = 25;
/** A file this plugin never wrote (unsafe stem: dots + space) — sync tools drop these next to ours. */
const FOREIGN_FILE_PATH = `${DIR}/docid_note0_e.sync-conflict copy.json`;

/**
 * One vault snapshot exercising every orphan kind at once:
 * - 25 live notes with docids (docid_note0_e ...), one id-less note,
 * - doc-data for a live doc (with one live + one dangling centralDepths entry),
 * - doc-data for a vanished doc, a live pin and a stale pin,
 * - a foreign json in doc-data/ (unsafe stem — e.g. a sync-conflict artifact).
 */
async function sweptFixture() {
	const files = Array.from({ length: LIVE_NOTE_COUNT }, (_, i) => ({ path: `note${i}.md` }));
	const docids = Object.fromEntries(files.map((file, i) => [file.path, `docid_note${i}_e`]));
	const ports = new FakeObsidianPorts({ files: [...files, { path: "idless.md" }, { path: "img.png" }] });
	const docIdPort = new FakeDocIdPort(docids);

	const storage = new FakeFileStorage();
	await storage.mkdir(DIR);
	storage.seedFile(
		`${DIR}/docid_note0_e.json`,
		JSON.stringify({
			version: PERSISTED_SHAPE_VERSION,
			depths: { outgoingDepth: 2 },
			centralDepths: { docid_note1_e: { incomingDepth: 1 }, docid_dangling_e: { incomingDepth: 3 } },
		}),
	);
	storage.seedFile(
		`${DIR}/docid_vanished_e.json`,
		JSON.stringify({ version: PERSISTED_SHAPE_VERSION, depths: { outgoingDepth: 1 } }),
	);
	storage.seedFile(FOREIGN_FILE_PATH, "{}");
	const docDataStore = new DocDataStore(storage, DIR);

	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();
	await pluginDataStore.addPin("docid_note1_e", 100);
	await pluginDataStore.addPin("docid_stale_e", 200);

	const pathDocIdMap = new PathDocIdMap();
	let yields = 0;
	const sweeper = new OrphanSweeper(ports.vault, docIdPort, pathDocIdMap, pluginDataStore, docDataStore, async () => {
		yields += 1;
	});
	const summary = await sweeper.run();
	return { docIdPort, storage, docDataStore, pluginDataStore, pathDocIdMap, yieldCount: () => yields, summary };
}

describe("OrphanSweeper", () => {
	it("WHEN a doc-data file's doc vanished THEN exactly that file is deleted", async () => {
		const { storage } = await sweptFixture();
		expect(await storage.exists(`${DIR}/docid_vanished_e.json`)).toBe(false);
	});

	it("WHEN a doc-data file's doc is alive THEN its file survives the sweep", async () => {
		const { storage } = await sweptFixture();
		expect(await storage.exists(`${DIR}/docid_note0_e.json`)).toBe(true);
	});

	it("WHEN a pinned doc vanished THEN exactly that pin is removed", async () => {
		const { pluginDataStore } = await sweptFixture();
		expect(pluginDataStore.pins().map((pin) => pin.docid)).toEqual(["docid_note1_e"]);
	});

	it("WHEN a centralDepths entry dangles THEN it is stripped while the live entry survives", async () => {
		const { docDataStore } = await sweptFixture();
		expect((await docDataStore.load("docid_note0_e"))?.centralDepths).toEqual({
			docid_note1_e: { incomingDepth: 1 },
		});
	});

	it("WHEN centralDepths entries are stripped THEN the owner's other fields are untouched", async () => {
		const { docDataStore } = await sweptFixture();
		expect((await docDataStore.load("docid_note0_e"))?.depths).toEqual({ outgoingDepth: 2 });
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

	it("WHEN a foreign json (unsafe stem) sits in doc-data THEN the sweep neither throws nor touches it", async () => {
		// The fixture's other asserts prove the sweep still COMPLETED despite the foreign file.
		const { storage } = await sweptFixture();
		expect(await storage.exists(FOREIGN_FILE_PATH)).toBe(true);
	});

	it("WHEN the sweep completes THEN its summary counts exactly what was removed", async () => {
		const { summary } = await sweptFixture();
		expect(summary).toEqual({
			docDataFilesRemoved: 1, // docid_vanished_e.json
			pinsRemoved: 1, // docid_stale_e
			centralEntriesRemoved: 1, // docid_dangling_e stripped from docid_note0_e
			ownersRewritten: 1, // docid_note0_e
		});
	});
});

/**
 * Race regression (review F1): while the chunked warm-up is still yielding,
 * the user creates AND pins a brand-new doc — absent from the `getFiles()`
 * snapshot taken at warm-up start. Every real write intent maps the docid
 * (PersistenceServices.withPersistableIdentity), so the sweep must re-verify
 * against the map before dropping anything.
 */
async function midSweepWriteFixture() {
	const files = Array.from({ length: LIVE_NOTE_COUNT }, (_, i) => ({ path: `note${i}.md` }));
	const docids = Object.fromEntries(files.map((file, i) => [file.path, `docid_note${i}_e`]));
	const ports = new FakeObsidianPorts({ files });
	const docIdPort = new FakeDocIdPort(docids);

	const storage = new FakeFileStorage();
	await storage.mkdir(DIR);
	// A live owner already references the soon-to-be-created doc as a central.
	storage.seedFile(
		`${DIR}/docid_note0_e.json`,
		JSON.stringify({ version: PERSISTED_SHAPE_VERSION, centralDepths: { docid_new_e: { incomingDepth: 2 } } }),
	);
	const docDataStore = new DocDataStore(storage, DIR);
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();

	const pathDocIdMap = new PathDocIdMap();
	let writeIntentSimulated = false;
	// GIVEN the first warm-up yield: the user pins a just-created doc. These are
	// exactly the effects of PersistenceServices.withPersistableIdentity + stores.
	const simulateWriteIntentOnFirstYield = async () => {
		if (writeIntentSimulated) {
			return;
		}
		writeIntentSimulated = true;
		pathDocIdMap.set("new-note.md", "docid_new_e");
		await pluginDataStore.addPin("docid_new_e", 300);
		await docDataStore.update("docid_new_e", (doc) => DocDataMutations.setDepthField(doc, "outgoingDepth", 1));
	};

	const sweeper = new OrphanSweeper(
		ports.vault,
		docIdPort,
		pathDocIdMap,
		pluginDataStore,
		docDataStore,
		simulateWriteIntentOnFirstYield,
	);
	await sweeper.run();
	return { storage, docDataStore, pluginDataStore };
}

describe("OrphanSweeper mid-sweep write race", () => {
	it("WHEN a doc is pinned during warm-up THEN its pin survives the sweep", async () => {
		const { pluginDataStore } = await midSweepWriteFixture();
		expect(pluginDataStore.pins().map((pin) => pin.docid)).toContain("docid_new_e");
	});

	it("WHEN a doc gains doc-data during warm-up THEN its file survives the sweep", async () => {
		const { storage } = await midSweepWriteFixture();
		expect(await storage.exists(`${DIR}/docid_new_e.json`)).toBe(true);
	});

	it("WHEN an owner's centralDepths references the just-created doc THEN the entry is not stripped", async () => {
		const { docDataStore } = await midSweepWriteFixture();
		expect((await docDataStore.load("docid_note0_e"))?.centralDepths).toEqual({
			docid_new_e: { incomingDepth: 2 },
		});
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
 * The warm-up chunks 500 eligible files in batches of SWEEP_BATCH_SIZE (20),
 * yielding after every FULL batch except the last (ChunkedWork's boundary rule):
 * boundaries at 20, 40, ... 480 → 24 yields from the warm phase alone. Later
 * chunked phases can only add more, so this is a safe lower bound.
 */
const MIN_WARM_PHASE_YIELDS = Math.floor((HUNDREDS_NOTE_COUNT - 1) / 20);

async function hundredsOfFilesSweep() {
	const files = Array.from({ length: HUNDREDS_NOTE_COUNT }, (_, i) => ({ path: `note${i}.md` }));
	const docids = Object.fromEntries(files.map((file, i) => [file.path, `docid_note${i}_e`]));
	const ports = new FakeObsidianPorts({ files });
	const docIdPort = new FakeDocIdPort(docids);

	const storage = new FakeFileStorage();
	await storage.mkdir(DIR);
	const docDataStore = new DocDataStore(storage, DIR);
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();

	const pathDocIdMap = new PathDocIdMap();
	let yields = 0;
	const sweeper = new OrphanSweeper(ports.vault, docIdPort, pathDocIdMap, pluginDataStore, docDataStore, async () => {
		yields += 1;
	});
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
		expect(summary).toEqual({
			docDataFilesRemoved: 0,
			pinsRemoved: 0,
			centralEntriesRemoved: 0,
			ownersRewritten: 0,
		});
	});
});
