import { describe, expect, it } from "vitest";
import type { AiNamedRelationship, RelationshipName } from "../engine";
import { FakeUserNotices } from "../view/FakeUserNotices";
import { FakeVaultFsPort } from "./FakeVaultFsPort";
import type { RelationshipRecord } from "./relationshipRecord";
import { RelationshipStore } from "./RelationshipStore";
import { VaultFileStore } from "./VaultFileStore";

const ROOT = ".plugin_data/vicinity_graph";
const FIXED_INSTANT = Date.UTC(2026, 9, 6, 12, 0, 0);
const FIXED_ISO = new Date(FIXED_INSTANT).toISOString();
const fixedClock = (): number => FIXED_INSTANT;

const A = "docid_a_e";
const B = "docid_b_e";
const C = "docid_c_e";

const SUPPORTS = "supports" as RelationshipName;
const REFINES = "refines" as RelationshipName;

const AI_RECORD: RelationshipRecord = {
	name: "extends",
	origin: "ai",
	model: "gpt-6-luna",
	createdIso: "2026-10-01T00:00:00.000Z",
	updatedIso: "2026-10-01T00:00:00.000Z",
};

function storeOver(fs: FakeVaultFsPort, notice?: FakeUserNotices): RelationshipStore {
	return new RelationshipStore(new VaultFileStore(ROOT, fs, fixedClock, notice), fixedClock);
}

/** A store re-created over the SAME disk and warmed — the restart round-trip. */
async function reloaded(fs: FakeVaultFsPort, notice?: FakeUserNotices): Promise<RelationshipStore> {
	const store = storeOver(fs, notice);
	await store.warm();
	return store;
}

function filePath(from: string, to: string): string {
	return `${ROOT}/from_id/${from}/${to}.json`;
}

/** GIVEN a record already on disk (e.g. written by AI mode or another device). */
function seed(fs: FakeVaultFsPort, from: string, to: string, record: unknown): void {
	fs.files.set(filePath(from, to), JSON.stringify({ v1: record }));
}

describe("RelationshipStore — naming", () => {
	it("WHEN a pair is named THEN the store reads the manual name back", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveManualName(A, B, SUPPORTS);
		expect(store.relationshipFor(A, B)).toEqual({
			name: "supports",
			origin: "manual",
			createdIso: FIXED_ISO,
			updatedIso: FIXED_ISO,
		});
	});

	it("WHEN a pair is named THEN its file is written at from_id/<from>/<to>.json", async () => {
		const fs = new FakeVaultFsPort();
		await storeOver(fs).saveManualName(A, B, SUPPORTS);
		expect(fs.files.has(filePath(A, B))).toBe(true);
	});

	it("WHEN A → B is named THEN B → A has no relationship (directed)", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveManualName(A, B, SUPPORTS);
		expect(store.relationshipFor(B, A)).toBeUndefined();
	});

	it("WHEN a named pair is renamed THEN the new name replaces the old one", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveManualName(A, B, SUPPORTS);
		await store.saveManualName(A, B, REFINES);
		expect(store.relationshipFor(A, B)?.name).toBe("refines");
	});

	it("WHEN an AI name is renamed THEN it becomes manual", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, A, B, AI_RECORD);
		const store = await reloaded(fs);
		await store.saveManualName(A, B, REFINES);
		expect(store.relationshipFor(A, B)?.origin).toBe("manual");
	});
});

describe("RelationshipStore — clearing", () => {
	it("WHEN a manual name is cleared THEN its file is deleted", async () => {
		const fs = new FakeVaultFsPort();
		const store = storeOver(fs);
		await store.saveManualName(A, B, SUPPORTS);
		await store.clearName(A, B);
		expect(fs.files.has(filePath(A, B))).toBe(false);
	});

	it("WHEN a manual name is cleared THEN the pair has no relationship", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveManualName(A, B, SUPPORTS);
		await store.clearName(A, B);
		expect(store.relationshipFor(A, B)).toBeUndefined();
	});

	it("WHEN an AI name is cleared THEN a restarted store reads the dismissed marker", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, A, B, AI_RECORD);
		await (await reloaded(fs)).clearName(A, B);
		expect((await reloaded(fs)).relationshipFor(A, B)).toEqual({ ...AI_RECORD, name: null, updatedIso: FIXED_ISO });
	});

	it("WHEN a pair with nothing stored is cleared THEN nothing is written", async () => {
		const fs = new FakeVaultFsPort();
		await storeOver(fs).clearName(A, B);
		expect(fs.files.size).toBe(0);
	});
});

describe("RelationshipStore — warm-up after a restart", () => {
	it("WHEN the store restarts THEN a name saved before is read back from disk", async () => {
		const fs = new FakeVaultFsPort();
		await storeOver(fs).saveManualName(A, B, SUPPORTS);
		expect((await reloaded(fs)).relationshipFor(A, B)?.name).toBe("supports");
	});

	it("WHEN the store restarts THEN pairs under several from-dirs are all loaded", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, A, B, AI_RECORD);
		seed(fs, C, A, AI_RECORD);
		const store = await reloaded(fs);
		expect([store.relationshipFor(A, B)?.name, store.relationshipFor(C, A)?.name]).toEqual(["extends", "extends"]);
	});

	it("WHEN the store restarts THEN keyedDocids lists every from AND to docid once", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, A, B, AI_RECORD);
		seed(fs, A, C, AI_RECORD);
		seed(fs, C, A, AI_RECORD);
		expect([...(await reloaded(fs)).keyedDocids()].sort()).toEqual([A, B, C]);
	});

	it("WHEN a record has the wrong shape THEN that pair reads as unnamed", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, A, B, { name: "supports" });
		expect((await reloaded(fs)).relationshipFor(A, B)).toBeUndefined();
	});

	it("WHEN a file holds merge-conflict bytes THEN the pair reads as unnamed", async () => {
		const fs = new FakeVaultFsPort();
		fs.files.set(filePath(A, B), "<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> theirs");
		expect((await reloaded(fs, new FakeUserNotices())).relationshipFor(A, B)).toBeUndefined();
	});

	it("WHEN a file holds merge-conflict bytes THEN it is set aside, not deleted", async () => {
		const fs = new FakeVaultFsPort();
		fs.files.set(filePath(A, B), "<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> theirs");
		await reloaded(fs, new FakeUserNotices());
		expect([...fs.files.keys()].some((path) => path.startsWith(`${ROOT}/from_id/${A}/${B}_malformed_`))).toBe(true);
	});

	it("WHEN a file holds merge-conflict bytes THEN the user is told once", async () => {
		const fs = new FakeVaultFsPort();
		const notices = new FakeUserNotices();
		fs.files.set(filePath(A, B), "<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> theirs");
		await reloaded(fs, notices);
		expect(notices.messages).toHaveLength(1);
	});

	it("WHEN two callers warm at once THEN the store is loaded once and both see it", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, A, B, AI_RECORD);
		const store = storeOver(fs);
		await Promise.all([store.warm(), store.warm()]);
		expect(store.keyedDocids()).toHaveLength(2);
	});
});

describe("RelationshipStore — forgetDocs", () => {
	it("WHEN a doc is forgotten THEN every pair it names FROM is deleted", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, A, B, AI_RECORD);
		seed(fs, A, C, AI_RECORD);
		await (await reloaded(fs)).forgetDocs([A]);
		expect([fs.files.has(filePath(A, B)), fs.files.has(filePath(A, C))]).toEqual([false, false]);
	});

	it("WHEN a doc is forgotten THEN every pair naming it as TARGET is deleted", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, B, A, AI_RECORD);
		seed(fs, C, A, AI_RECORD);
		await (await reloaded(fs)).forgetDocs([A]);
		expect([fs.files.has(filePath(B, A)), fs.files.has(filePath(C, A))]).toEqual([false, false]);
	});

	it("WHEN a doc is forgotten THEN pairs between OTHER docs survive", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, B, C, AI_RECORD);
		seed(fs, B, A, AI_RECORD);
		await (await reloaded(fs)).forgetDocs([A]);
		expect(fs.files.has(filePath(B, C))).toBe(true);
	});

	it("WHEN a doc is forgotten THEN it no longer appears in keyedDocids", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, B, A, AI_RECORD);
		const store = await reloaded(fs);
		await store.forgetDocs([A]);
		expect(store.keyedDocids()).toEqual([]);
	});

	it("WHEN a name saved this session is forgotten THEN its target position is pruned too", async () => {
		const fs = new FakeVaultFsPort();
		const store = storeOver(fs);
		await store.saveManualName(B, A, SUPPORTS);
		await store.forgetDocs([A]);
		expect(store.relationshipFor(B, A)).toBeUndefined();
	});
});

describe("RelationshipStore — AI names", () => {
	const AI_NAMED: AiNamedRelationship = {
		name: "extends" as RelationshipName,
		model: "gpt-6-luna",
		effort: "medium",
		usage: { inputTokens: 10, outputTokens: 2 },
	};

	it("WHEN an unnamed pair gets an AI name THEN the store reads it back as origin ai", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveAiName(A, B, AI_NAMED);
		expect(store.relationshipFor(A, B)?.origin).toBe("ai");
	});

	it("WHEN an unnamed pair gets an AI name THEN the save reports it wrote", async () => {
		expect(await storeOver(new FakeVaultFsPort()).saveAiName(A, B, AI_NAMED)).toBe(true);
	});

	it("WHEN an AI name is saved THEN it survives a restart", async () => {
		const fs = new FakeVaultFsPort();
		await storeOver(fs).saveAiName(A, B, AI_NAMED);
		expect((await reloaded(fs)).relationshipFor(A, B)?.name).toBe("extends");
	});

	it("WHEN the pair has a manual name THEN an AI name does not replace it", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveManualName(A, B, SUPPORTS);
		await store.saveAiName(A, B, AI_NAMED);
		expect(store.relationshipFor(A, B)?.name).toBe("supports");
	});

	it("WHEN the pair's AI name was dismissed THEN a new AI name does not revive it", async () => {
		const fs = new FakeVaultFsPort();
		seed(fs, A, B, { ...AI_RECORD, name: null });
		const store = await reloaded(fs);
		expect(await store.saveAiName(A, B, AI_NAMED)).toBe(false);
	});

	it("WHEN only the reverse pair is named THEN the AI name is stored (directed)", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveManualName(B, A, SUPPORTS);
		expect(await store.saveAiName(A, B, AI_NAMED)).toBe(true);
	});
});
