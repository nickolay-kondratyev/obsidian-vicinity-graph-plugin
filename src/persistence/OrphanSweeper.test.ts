import { describe, expect, it } from "vitest";
import { FakeDocIdPort } from "../adapters/FakeDocIdPort";
import { FakeObsidianPorts } from "../adapters/FakeObsidianPorts";
import { DocDataStore } from "./DocDataStore";
import { FakeFileStorage } from "./FakeFileStorage";
import { FakePluginDataPort } from "./FakePluginDataPort";
import { OrphanSweeper } from "./OrphanSweeper";
import { PathDocIdMap } from "./PathDocIdMap";
import { PERSISTED_SHAPE_VERSION } from "./persistedShapes";
import { PluginDataStore } from "./PluginDataStore";

const DIR = "plugins/obsidian-neighborhood-graph/doc-data";
/** > the sweeper's internal batch size of 20, so the warm phase must yield at least once. */
const LIVE_NOTE_COUNT = 25;

/**
 * One vault snapshot exercising every orphan kind at once:
 * - 25 live notes with docids (docid_note0_e ...), one id-less note,
 * - doc-data for a live doc (with one live + one dangling centralDepths entry),
 * - doc-data for a vanished doc, a live pin and a stale pin.
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
	await sweeper.run();
	return { docIdPort, storage, docDataStore, pluginDataStore, pathDocIdMap, yieldCount: () => yields };
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
});
