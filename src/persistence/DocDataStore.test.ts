import { describe, expect, it } from "vitest";
import { DocDataMutations } from "./DocDataMutations";
import { DocDataStore } from "./DocDataStore";
import { DOC_DATA_DIR_NAME } from "./docDataDirName";
import { FakeFileStorage } from "./FakeFileStorage";
import { PERSISTED_SHAPE_VERSION } from "./persistedShapes";

const DIR = `.obsidian/plugins/vicinity-graph/${DOC_DATA_DIR_NAME}`;

function storeOverFakeStorage(): { store: DocDataStore; storage: FakeFileStorage } {
	const storage = new FakeFileStorage();
	return { store: new DocDataStore(storage, DIR), storage };
}

describe("DocDataStore round-trips", () => {
	it("WHEN a doc has no file THEN load yields null (inherit everything)", async () => {
		const { store } = storeOverFakeStorage();
		expect(await store.load("docid_a_e")).toBeNull();
	});

	it("WHEN a field is set THEN load round-trips it from its own file", async () => {
		const { store } = storeOverFakeStorage();
		await store.update("docid_a_e", (doc) => DocDataMutations.setDepthField(doc, "outgoingDepth", 3));
		expect(await store.load("docid_a_e")).toEqual({
			version: PERSISTED_SHAPE_VERSION,
			depths: { outgoingDepth: 3 },
		});
	});

	it("WHEN doc A is updated THEN doc B's file is untouched (one file per doc)", async () => {
		const { store, storage } = storeOverFakeStorage();
		await store.update("docid_b_e", (doc) => DocDataMutations.setViewField(doc, "nodeCap", 10));
		const untouched = await storage.read(`${DIR}/docid_b_e.json`);
		await store.update("docid_a_e", (doc) => DocDataMutations.setDepthField(doc, "outgoingDepth", 3));
		expect(await storage.read(`${DIR}/docid_b_e.json`)).toBe(untouched);
	});

	it("WHEN the file content is malformed THEN load degrades to null (never throws)", async () => {
		const { store, storage } = storeOverFakeStorage();
		storage.seedFile(`${DIR}/docid_a_e.json`, "{ not json");
		expect(await store.load("docid_a_e")).toBeNull();
	});
});

describe("DocDataStore emptiness handling", () => {
	it("WHEN the last field reverts to inherit THEN the doc file is deleted (absence = inherit)", async () => {
		const { store, storage } = storeOverFakeStorage();
		await store.update("docid_a_e", (doc) => DocDataMutations.setDepthField(doc, "outgoingDepth", 3));
		await store.update("docid_a_e", (doc) => DocDataMutations.setDepthField(doc, "outgoingDepth", undefined));
		expect(storage.fileCount()).toBe(0);
	});
});

describe("DocDataStore.listDocIds", () => {
	it("WHEN the doc-data dir does not exist yet THEN there are no docids", async () => {
		const { store } = storeOverFakeStorage();
		expect(await store.listDocIds()).toEqual([]);
	});

	it("WHEN docs have files THEN their docids are listed (json extension stripped)", async () => {
		const { store } = storeOverFakeStorage();
		await store.update("docid_a_e", (doc) => DocDataMutations.setDepthField(doc, "outgoingDepth", 1));
		await store.update("docid_b_e", (doc) => DocDataMutations.setViewField(doc, "nodeCap", 10));
		expect([...(await store.listDocIds())].sort()).toEqual(["docid_a_e", "docid_b_e"]);
	});

	it("WHEN a foreign json's stem is not a filename-safe docid THEN it is not listed (this store never wrote it)", async () => {
		const { store, storage } = storeOverFakeStorage();
		await store.update("docid_a_e", (doc) => DocDataMutations.setDepthField(doc, "outgoingDepth", 1));
		storage.seedFile(`${DIR}/docid_a_e.sync-conflict copy.json`, "{}");
		expect(await store.listDocIds()).toEqual(["docid_a_e"]);
	});
});

describe("DocDataStore safety re-assertion", () => {
	it("WHEN an unsafe docid reaches the store THEN it throws (programmer error, Q3 gate is upstream)", async () => {
		const { store } = storeOverFakeStorage();
		await expect(store.load("../escape")).rejects.toThrow(/refused by DocPersistEligibility/);
	});
});

describe("DocDataStore write serialization", () => {
	it("WHEN two field updates race on the same doc THEN both fields survive (serialized RMW)", async () => {
		const { store } = storeOverFakeStorage();
		await Promise.all([
			store.update("docid_a_e", (doc) => DocDataMutations.setDepthField(doc, "outgoingDepth", 2)),
			store.update("docid_a_e", (doc) => DocDataMutations.setDepthField(doc, "incomingDepth", 5)),
		]);
		expect((await store.load("docid_a_e"))?.depths).toEqual({ outgoingDepth: 2, incomingDepth: 5 });
	});
});
