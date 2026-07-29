import { describe, expect, it } from "vitest";
import { FakeDocIdPort } from "../adapters/FakeDocIdPort";
import type { VaultFilePort } from "../adapters/obsidianPorts";
import { EngineDefaults } from "../engine";
import { DocDataStore } from "./DocDataStore";
import { DOC_DATA_DIR_NAME } from "./docDataDirName";
import { FakeFileStorage } from "./FakeFileStorage";
import { FakePluginDataPort } from "./FakePluginDataPort";
import { PathDocIdMap } from "./PathDocIdMap";
import { PersistenceServices } from "./PersistenceServices";
import { PluginDataStore } from "./PluginDataStore";

const DIR = DOC_DATA_DIR_NAME;
const FIXED_NOW = 777;

function fileAt(path: string): VaultFilePort {
	return { path, extension: path.split(".").pop() ?? "", stat: { mtime: 0, size: 0 }, parent: { path: "/" } };
}

async function services(docIdPort: FakeDocIdPort) {
	const storage = new FakeFileStorage();
	const docDataStore = new DocDataStore(storage, DIR);
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();
	const pathDocIdMap = new PathDocIdMap();
	const persistence = new PersistenceServices(docIdPort, pluginDataStore, docDataStore, pathDocIdMap, () => FIXED_NOW);
	return { persistence, storage, docDataStore, pluginDataStore, pathDocIdMap };
}

describe("PersistenceServices.pinDoc", () => {
	it("WHEN a doc with a docid is pinned THEN the pin persists with the clock's timestamp", async () => {
		const { persistence, pluginDataStore } = await services(new FakeDocIdPort({ "a.md": "docid_a_e" }));
		await persistence.pinDoc(fileAt("a.md"));
		expect(pluginDataStore.pins()).toEqual([{ docid: "docid_a_e", pinTimestamp: FIXED_NOW }]);
	});

	it("WHEN a doc is pinned THEN the path→docid map learns it (write path fills the map)", async () => {
		const { persistence, pathDocIdMap } = await services(new FakeDocIdPort({ "a.md": "docid_a_e" }));
		await persistence.pinDoc(fileAt("a.md"));
		expect(pathDocIdMap.getPath("docid_a_e")).toBe("a.md");
	});

	it("WHEN an id-less doc is pinned THEN an id is minted (pin = explicit write intent)", async () => {
		const { persistence } = await services(new FakeDocIdPort());
		expect(await persistence.pinDoc(fileAt("new.md"))).toEqual({
			kind: "persistable",
			docid: "docid_minted1_e",
		});
	});

	it("WHEN id-lib cannot identify the doc THEN the verdict is no-docid and nothing is pinned", async () => {
		const docIdPort = new FakeDocIdPort();
		docIdPort.markUnidentifiable("weird.md");
		const { persistence, pluginDataStore } = await services(docIdPort);
		const verdict = await persistence.pinDoc(fileAt("weird.md"));
		expect([verdict, pluginDataStore.pins()]).toEqual([{ kind: "not-persistable", reason: "no-docid" }, []]);
	});

	it("WHEN the doc carries an unsafe foreign docid THEN the verdict is unsafe-docid and nothing is pinned", async () => {
		const { persistence, pluginDataStore } = await services(new FakeDocIdPort({ "a.md": "../escape" }));
		const verdict = await persistence.pinDoc(fileAt("a.md"));
		expect([verdict, pluginDataStore.pins()]).toEqual([
			{ kind: "not-persistable", reason: "unsafe-docid" },
			[],
		]);
	});
});

describe("PersistenceServices.unpinDoc", () => {
	it("WHEN a doc is unpinned THEN only its pin disappears (centralDepths traces are left to the sweep)", async () => {
		const { persistence, pluginDataStore } = await services(new FakeDocIdPort({ "a.md": "docid_a_e" }));
		await persistence.pinDoc(fileAt("a.md"));
		await persistence.unpinDoc("docid_a_e");
		expect(pluginDataStore.pins()).toEqual([]);
	});
});

describe("PersistenceServices per-doc settings", () => {
	it("WHEN a depth field is set THEN it round-trips through the doc's own file", async () => {
		const { persistence, docDataStore } = await services(new FakeDocIdPort({ "a.md": "docid_a_e" }));
		await persistence.setDocDepthField(fileAt("a.md"), "outgoingDepth", 4);
		expect((await docDataStore.load("docid_a_e"))?.depths).toEqual({ outgoingDepth: 4 });
	});

	it("WHEN a view field is set EQUAL to the global default THEN it is still written (pin-on-toggle)", async () => {
		const { persistence, docDataStore } = await services(new FakeDocIdPort({ "a.md": "docid_a_e" }));
		const defaultCap = EngineDefaults.viewSettings().nodeCap;
		await persistence.setDocViewField(fileAt("a.md"), "nodeCap", defaultCap);
		expect((await docDataStore.load("docid_a_e"))?.view).toEqual({ nodeCap: defaultCap });
	});

	it("WHEN a central's depth is adjusted under MAIN THEN it persists in MAIN's centralDepths", async () => {
		const { persistence, docDataStore } = await services(new FakeDocIdPort({ "main.md": "docid_main_e" }));
		await persistence.setCentralDepthField(fileAt("main.md"), "docid_pin_e", "incomingDepth", 1);
		expect((await docDataStore.load("docid_main_e"))?.centralDepths).toEqual({
			docid_pin_e: { incomingDepth: 1 },
		});
	});

	it("WHEN a setting is attempted on an unidentifiable doc THEN no doc-data file is created", async () => {
		const docIdPort = new FakeDocIdPort();
		docIdPort.markUnidentifiable("weird.md");
		const { persistence, storage } = await services(docIdPort);
		await persistence.setDocDepthField(fileAt("weird.md"), "outgoingDepth", 2);
		expect(storage.fileCount()).toBe(0);
	});
});
