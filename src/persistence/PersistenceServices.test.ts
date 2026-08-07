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

const CONTENT_CHANGE = { field: "content", value: "image" } as const;

describe("PersistenceServices.saveNodeOverrideField", () => {
	it("WHEN a doc with a docid gets an override THEN it persists under that docid", async () => {
		const { persistence, pluginDataStore } = await services(new FakeDocIdPort({ "a.md": "docid_a_e" }));
		await persistence.saveNodeOverrideField(fileAt("a.md"), {
			field: "sizePx",
			value: { widthPx: 320, heightPx: 180 },
		});
		expect(pluginDataStore.nodeOverrides()).toEqual({
			docid_a_e: { sizePx: { widthPx: 320, heightPx: 180 } },
		});
	});

	it("WHEN an id-less doc gets an override THEN an id is minted lazily (override = explicit write intent)", async () => {
		const { persistence } = await services(new FakeDocIdPort());
		expect(await persistence.saveNodeOverrideField(fileAt("new.md"), CONTENT_CHANGE)).toEqual({
			kind: "persistable",
			docid: "docid_minted1_e",
		});
	});

	it("WHEN a doc gets an override THEN the path→docid map learns it (write path fills the map)", async () => {
		const { persistence, pathDocIdMap } = await services(new FakeDocIdPort({ "a.md": "docid_a_e" }));
		await persistence.saveNodeOverrideField(fileAt("a.md"), CONTENT_CHANGE);
		expect(pathDocIdMap.getPath("docid_a_e")).toBe("a.md");
	});

	it("WHEN id-lib cannot identify the doc THEN the verdict is no-docid and nothing persists", async () => {
		const docIdPort = new FakeDocIdPort();
		docIdPort.markUnidentifiable("weird.md");
		const { persistence, pluginDataStore } = await services(docIdPort);
		const verdict = await persistence.saveNodeOverrideField(fileAt("weird.md"), CONTENT_CHANGE);
		expect([verdict, pluginDataStore.nodeOverrides()]).toEqual([
			{ kind: "not-persistable", reason: "no-docid" },
			{},
		]);
	});

	it("WHEN the doc carries an unsafe foreign docid THEN the verdict is unsafe-docid and nothing persists", async () => {
		const { persistence, pluginDataStore } = await services(new FakeDocIdPort({ "a.md": "../escape" }));
		const verdict = await persistence.saveNodeOverrideField(fileAt("a.md"), CONTENT_CHANGE);
		expect([verdict, pluginDataStore.nodeOverrides()]).toEqual([
			{ kind: "not-persistable", reason: "unsafe-docid" },
			{},
		]);
	});
});

describe("PersistenceServices.clearNodeOverrideField", () => {
	it("WHEN a doc's override field is cleared THEN its entry disappears", async () => {
		const { persistence, pluginDataStore } = await services(new FakeDocIdPort({ "a.md": "docid_a_e" }));
		await persistence.saveNodeOverrideField(fileAt("a.md"), CONTENT_CHANGE);
		await persistence.clearNodeOverrideField(fileAt("a.md"), "content");
		expect(pluginDataStore.nodeOverrides()).toEqual({});
	});

	it("WHEN an id-less doc's field is cleared THEN NO id is minted (clearing stores nothing)", async () => {
		const docIdPort = new FakeDocIdPort();
		const { persistence } = await services(docIdPort);
		await persistence.clearNodeOverrideField(fileAt("new.md"), "content");
		expect(docIdPort.ensureCalls).toBe(0);
	});
});

describe("PersistenceServices.localPinDoc", () => {
	it("WHEN both docs have docids THEN the local pin persists under MAIN keyed by TARGET with the clock's timestamp", async () => {
		const { persistence, pluginDataStore } = await services(
			new FakeDocIdPort({ "main.md": "docid_main_e", "target.md": "docid_target_e" }),
		);
		await persistence.localPinDoc(fileAt("main.md"), fileAt("target.md"));
		expect(pluginDataStore.localPins("docid_main_e")).toEqual([{ docid: "docid_target_e", pinTimestamp: FIXED_NOW }]);
	});

	it("WHEN both docs are id-less THEN ids are minted for BOTH (Q2: minting on MAIN is sanctioned)", async () => {
		const { persistence } = await services(new FakeDocIdPort());
		expect(await persistence.localPinDoc(fileAt("main.md"), fileAt("target.md"))).toEqual({
			kind: "persisted",
			mainDocid: "docid_minted2_e",
			targetDocid: "docid_minted1_e",
		});
	});

	it("WHEN both docs get pinned THEN the path→docid map learns BOTH (write path fills the map)", async () => {
		const { persistence, pathDocIdMap } = await services(
			new FakeDocIdPort({ "main.md": "docid_main_e", "target.md": "docid_target_e" }),
		);
		await persistence.localPinDoc(fileAt("main.md"), fileAt("target.md"));
		expect([pathDocIdMap.getPath("docid_main_e"), pathDocIdMap.getPath("docid_target_e")]).toEqual([
			"main.md",
			"target.md",
		]);
	});

	it("WHEN the TARGET cannot get an id THEN the refusal names the target and nothing persists", async () => {
		const docIdPort = new FakeDocIdPort({ "main.md": "docid_main_e" });
		docIdPort.markUnidentifiable("target.md");
		const { persistence, pluginDataStore } = await services(docIdPort);
		const verdict = await persistence.localPinDoc(fileAt("main.md"), fileAt("target.md"));
		expect([verdict, pluginDataStore.localPins("docid_main_e")]).toEqual([
			{ kind: "not-persistable", refusedDoc: "target", reason: "no-docid" },
			[],
		]);
	});

	it("WHEN the TARGET refuses THEN the MAIN note is never minted (no frontmatter write on a doomed pin)", async () => {
		const docIdPort = new FakeDocIdPort();
		docIdPort.markUnidentifiable("target.md");
		const { persistence } = await services(docIdPort);
		await persistence.localPinDoc(fileAt("main.md"), fileAt("target.md"));
		expect(docIdPort.ensureCalls).toBe(1);
	});

	it("WHEN the MAIN carries an unsafe foreign docid THEN the refusal names the main and nothing persists", async () => {
		const { persistence, pluginDataStore } = await services(
			new FakeDocIdPort({ "main.md": "../escape", "target.md": "docid_target_e" }),
		);
		const verdict = await persistence.localPinDoc(fileAt("main.md"), fileAt("target.md"));
		expect([verdict, pluginDataStore.localPins("../escape")]).toEqual([
			{ kind: "not-persistable", refusedDoc: "main", reason: "unsafe-docid" },
			[],
		]);
	});
});

describe("PersistenceServices.localUnpinDoc", () => {
	it("WHEN a local pin is removed THEN it disappears from the main's list", async () => {
		const { persistence, pluginDataStore } = await services(
			new FakeDocIdPort({ "main.md": "docid_main_e", "target.md": "docid_target_e" }),
		);
		await persistence.localPinDoc(fileAt("main.md"), fileAt("target.md"));
		await persistence.localUnpinDoc(fileAt("main.md"), "docid_target_e");
		expect(pluginDataStore.localPins("docid_main_e")).toEqual([]);
	});

	it("WHEN an id-less MAIN is locally unpinned THEN NO id is minted (clearing stores nothing)", async () => {
		const docIdPort = new FakeDocIdPort();
		const { persistence } = await services(docIdPort);
		await persistence.localUnpinDoc(fileAt("main.md"), "docid_target_e");
		expect(docIdPort.ensureCalls).toBe(0);
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
