import { describe, expect, it } from "vitest";
import { FakeDocIdPort } from "../adapters/FakeDocIdPort";
import type { VaultFilePort } from "../adapters/obsidianPorts";
import { FakePluginDataPort } from "./FakePluginDataPort";
import { PathDocIdMap } from "./PathDocIdMap";
import { PersistenceServices } from "./PersistenceServices";
import { PluginDataStore } from "./PluginDataStore";

const FIXED_NOW = 777;

function fileAt(path: string): VaultFilePort {
	return { path, extension: path.split(".").pop() ?? "", stat: { mtime: 0, size: 0 }, parent: { path: "/" } };
}

async function services(docIdPort: FakeDocIdPort) {
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();
	const pathDocIdMap = new PathDocIdMap();
	const persistence = new PersistenceServices(docIdPort, pluginDataStore, pathDocIdMap, () => FIXED_NOW);
	return { persistence, pluginDataStore, pathDocIdMap };
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
	it("WHEN a doc is unpinned THEN its pin disappears", async () => {
		const { persistence, pluginDataStore } = await services(new FakeDocIdPort({ "a.md": "docid_a_e" }));
		await persistence.pinDoc(fileAt("a.md"));
		await persistence.unpinDoc("docid_a_e");
		expect(pluginDataStore.pins()).toEqual([]);
	});
});
