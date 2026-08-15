import { describe, expect, it } from "vitest";
import { NODE_OVERRIDE_HARD_MAX_PX, NODE_OVERRIDE_HARD_MIN_PX } from "../engine";
import { FakeUserNotices } from "../view/FakeUserNotices";
import { FakeVaultFsPort } from "./FakeVaultFsPort";
import { PerDocStore } from "./PerDocStore";
import { VaultFileStore } from "./VaultFileStore";

const ROOT = ".plugin_data/vicinity_graph";
const FIXED_INSTANT = Date.UTC(2026, 7, 10, 9, 0, 0);
const fixedClock = (): number => FIXED_INSTANT;

function storeOver(fs: FakeVaultFsPort, notice?: FakeUserNotices): PerDocStore {
	return new PerDocStore(new VaultFileStore(ROOT, fs, fixedClock, notice));
}

/** A store re-created over the SAME disk and warmed — the restart round-trip. */
async function reloaded(fs: FakeVaultFsPort): Promise<PerDocStore> {
	const store = storeOver(fs);
	await store.warm();
	return store;
}

function filePath(docid: string): string {
	return `${ROOT}/per_file/${docid}.json`;
}

const SIZE_CHANGE = { field: "sizePx", value: { widthPx: 320, heightPx: 180 } } as const;
const CONTENT_CHANGE = { field: "content", value: "outline" } as const;

describe("PerDocStore node overrides", () => {
	it("WHEN an override field is saved THEN a reloaded store reads it back from disk (round-trip)", async () => {
		const fs = new FakeVaultFsPort();
		await storeOver(fs).saveNodeOverrideField("docid_a_e", SIZE_CHANGE);
		expect((await reloaded(fs)).nodeOverrides()).toEqual({ docid_a_e: { sizePx: { widthPx: 320, heightPx: 180 } } });
	});

	it("WHEN the other field is saved THEN the stored one SURVIVES (the store merges, callers never do)", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveNodeOverrideField("docid_a_e", SIZE_CHANGE);
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		expect(store.nodeOverrides()).toEqual({
			docid_a_e: { sizePx: { widthPx: 320, heightPx: 180 }, content: "outline" },
		});
	});

	it("WHEN the same field is saved again THEN the newer value replaces it", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		await store.saveNodeOverrideField("docid_a_e", { field: "content", value: "image" });
		expect(store.nodeOverrides()).toEqual({ docid_a_e: { content: "image" } });
	});

	it("WHEN a field is cleared THEN the entry keeps ONLY the fields that were not named", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveNodeOverrideField("docid_a_e", SIZE_CHANGE);
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		await store.clearNodeOverrideField("docid_a_e", "sizePx");
		expect(store.nodeOverrides()).toEqual({ docid_a_e: { content: "outline" } });
	});

	it("WHEN the LAST field is cleared THEN the record's file is deleted (reset = no orphan)", async () => {
		const fs = new FakeVaultFsPort();
		const store = storeOver(fs);
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		await store.clearNodeOverrideField("docid_a_e", "content");
		expect([store.nodeOverrides(), fs.files.has(filePath("docid_a_e"))]).toEqual([{}, false]);
	});

	it("WHEN a field that was never set is cleared THEN no file is written at all", async () => {
		const fs = new FakeVaultFsPort();
		await storeOver(fs).clearNodeOverrideField("docid_a_e", "sizePx");
		expect(fs.files.has(filePath("docid_a_e"))).toBe(false);
	});

	it("WHEN a saved pixel box exceeds the hard sanity bounds THEN it is stored clamped into them", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveNodeOverrideField("docid_a_e", { field: "sizePx", value: { widthPx: 999999, heightPx: 1 } });
		expect(store.nodeOverrides()).toEqual({
			docid_a_e: { sizePx: { widthPx: NODE_OVERRIDE_HARD_MAX_PX, heightPx: NODE_OVERRIDE_HARD_MIN_PX } },
		});
	});

	it("WHEN a saved pixel box is not finite THEN it is REFUSED and no file is written", async () => {
		const fs = new FakeVaultFsPort();
		const store = storeOver(fs);
		await store.saveNodeOverrideField("docid_a_e", { field: "sizePx", value: { widthPx: NaN, heightPx: 200 } });
		expect([store.nodeOverrides(), fs.files.has(filePath("docid_a_e"))]).toEqual([{}, false]);
	});

	it("WHEN a non-finite box is saved over a stored one THEN the stored box SURVIVES", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveNodeOverrideField("docid_a_e", SIZE_CHANGE);
		await store.saveNodeOverrideField("docid_a_e", {
			field: "sizePx",
			value: { widthPx: Number.POSITIVE_INFINITY, heightPx: 200 },
		});
		expect(store.nodeOverrides()).toEqual({ docid_a_e: { sizePx: { widthPx: 320, heightPx: 180 } } });
	});
});

describe("PerDocStore local pins", () => {
	it("WHEN a local pin is added THEN a reloaded store reads it back under its MAIN (round-trip)", async () => {
		const fs = new FakeVaultFsPort();
		await storeOver(fs).addLocalPin("docid_main_e", "docid_target_e", 1234);
		expect((await reloaded(fs)).localPins("docid_main_e")).toEqual([{ docid: "docid_target_e", pinTimestamp: 1234 }]);
	});

	it("WHEN a main has no local pins THEN the read is empty", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.warm();
		expect(store.localPins("docid_main_e")).toEqual([]);
	});

	it("WHEN the same target is re-pinned under a main THEN the timestamp refreshes without duplicating", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.addLocalPin("docid_main_e", "docid_target_e", 1);
		await store.addLocalPin("docid_main_e", "docid_target_e", 99);
		expect(store.localPins("docid_main_e")).toEqual([{ docid: "docid_target_e", pinTimestamp: 99 }]);
	});

	it("WHEN a target is locally pinned under two DIFFERENT mains THEN each main's own file keeps its entry", async () => {
		const fs = new FakeVaultFsPort();
		const store = storeOver(fs);
		await store.addLocalPin("docid_main_a_e", "docid_target_e", 1);
		await store.addLocalPin("docid_main_b_e", "docid_target_e", 2);
		const back = await reloaded(fs);
		expect([back.localPins("docid_main_a_e"), back.localPins("docid_main_b_e")]).toEqual([
			[{ docid: "docid_target_e", pinTimestamp: 1 }],
			[{ docid: "docid_target_e", pinTimestamp: 2 }],
		]);
	});

	it("WHEN some targets are removed from a main THEN only the named ones disappear", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.addLocalPin("docid_main_e", "docid_x_e", 1);
		await store.addLocalPin("docid_main_e", "docid_y_e", 2);
		await store.removeLocalPins("docid_main_e", ["docid_x_e"]);
		expect(store.localPins("docid_main_e")).toEqual([{ docid: "docid_y_e", pinTimestamp: 2 }]);
	});

	it("WHEN a main's LAST target is removed THEN its file is deleted (no empty record persists)", async () => {
		const fs = new FakeVaultFsPort();
		const store = storeOver(fs);
		await store.addLocalPin("docid_main_e", "docid_x_e", 1);
		await store.removeLocalPins("docid_main_e", ["docid_x_e"]);
		expect(fs.files.has(filePath("docid_main_e"))).toBe(false);
	});

	it("WHEN a target that was never pinned is removed THEN no file is written at all", async () => {
		const fs = new FakeVaultFsPort();
		await storeOver(fs).removeLocalPins("docid_main_e", ["docid_ghost_e"]);
		expect(fs.files.has(filePath("docid_main_e"))).toBe(false);
	});
});

describe("PerDocStore — subject + main-context in ONE file per docid", () => {
	it("WHEN a doc has BOTH an override and localPins-as-main THEN both round-trip from its single file", async () => {
		const fs = new FakeVaultFsPort();
		const store = storeOver(fs);
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		await store.addLocalPin("docid_a_e", "docid_target_e", 7);
		const back = await reloaded(fs);
		expect([back.nodeOverrides()["docid_a_e"], back.localPins("docid_a_e")]).toEqual([
			{ content: "outline" },
			[{ docid: "docid_target_e", pinTimestamp: 7 }],
		]);
	});
});

describe("PerDocStore.forgetDocs", () => {
	it("WHEN a doc with an override is forgotten THEN its file is deleted", async () => {
		const fs = new FakeVaultFsPort();
		const store = storeOver(fs);
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		await store.forgetDocs(["docid_a_e"]);
		expect([store.nodeOverrides(), fs.files.has(filePath("docid_a_e"))]).toEqual([{}, false]);
	});

	it("WHEN a local-pin MAIN key is forgotten THEN its whole file disappears", async () => {
		const fs = new FakeVaultFsPort();
		const store = storeOver(fs);
		await store.addLocalPin("docid_main_e", "docid_target_e", 1);
		await store.forgetDocs(["docid_main_e"]);
		expect([store.localPins("docid_main_e"), fs.files.has(filePath("docid_main_e"))]).toEqual([[], false]);
	});

	it("WHEN a local-pin TARGET is forgotten THEN it is pruned from every OTHER main's file (reverse index)", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.addLocalPin("docid_main_a_e", "docid_target_e", 1);
		await store.addLocalPin("docid_main_b_e", "docid_target_e", 2);
		await store.addLocalPin("docid_main_b_e", "docid_keep_e", 3);
		await store.forgetDocs(["docid_target_e"]);
		expect([store.localPins("docid_main_a_e"), store.localPins("docid_main_b_e")]).toEqual([
			[],
			[{ docid: "docid_keep_e", pinTimestamp: 3 }],
		]);
	});

	it("WHEN a forgotten target was a main's ONLY local pin THEN that main's file is deleted whole", async () => {
		const fs = new FakeVaultFsPort();
		const store = storeOver(fs);
		await store.addLocalPin("docid_main_e", "docid_target_e", 1);
		await store.forgetDocs(["docid_target_e"]);
		expect(fs.files.has(filePath("docid_main_e"))).toBe(false);
	});
});

/**
 * The read counterpart of forgetDocs, for THIS store: the read path warms exactly
 * these docids so a doc's override/localPins render on the first build after a
 * restart. Reports subject, local-pin main key AND target positions.
 */
describe("PerDocStore.keyedDocids", () => {
	it("WHEN a doc has only an override THEN it is reported", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.saveNodeOverrideField("docid_a_e", CONTENT_CHANGE);
		expect(store.keyedDocids()).toEqual(["docid_a_e"]);
	});

	it("WHEN a local pin exists THEN BOTH its main KEY and its target docid are reported", async () => {
		const store = storeOver(new FakeVaultFsPort());
		await store.addLocalPin("docid_main_e", "docid_target_e", 1);
		expect([...store.keyedDocids()].sort()).toEqual(["docid_main_e", "docid_target_e"]);
	});
});

describe("PerDocStore conflict quarantine (inherited from the primitive, asserted at the domain level)", () => {
	async function fixture() {
		const fs = new FakeVaultFsPort();
		// A valid record for one doc, and a merge-conflicted file for another.
		await storeOver(fs).saveNodeOverrideField("docid_good_e", CONTENT_CHANGE);
		await fs.write(filePath("docid_bad_e"), "<<<<<<< HEAD\n{ }\n=======\n{ }\n>>>>>>> other");
		const notices = new FakeUserNotices();
		const store = storeOver(fs, notices);
		await store.warm();
		return { fs, store, notices };
	}

	it("WHEN a doc's per-file file is merge-conflicted THEN that doc reads as absent (defaults)", async () => {
		const { store } = await fixture();
		expect(store.nodeOverrides()["docid_bad_e"]).toBeUndefined();
	});

	it("WHEN one doc's file is conflicted THEN other docs are unaffected", async () => {
		const { store } = await fixture();
		expect(store.nodeOverrides()["docid_good_e"]).toEqual({ content: "outline" });
	});

	it("WHEN a conflicted file is quarantined THEN it is set aside (renamed), not deleted", async () => {
		const { fs } = await fixture();
		expect(fs.files.has(filePath("docid_bad_e"))).toBe(false);
		expect([...fs.files.keys()].some((path) => path.includes("_malformed_"))).toBe(true);
	});

	it("WHEN a conflicted file is quarantined THEN the user is told once", async () => {
		const { notices } = await fixture();
		expect(notices.messages.length).toBe(1);
	});
});

describe("PerDocStore on a case-insensitive filesystem (KNOWN BUG, ticket nid_ij7rct3ysp6aqg18fwfw2ett3_e)", () => {
	/**
	 * {@link FakeVaultFsPort} with macOS/Windows-default path semantics
	 * approximated by lowercasing every path: two names differing only by case
	 * address the SAME physical file. (Real filesystems also PRESERVE the first
	 * writer's casing; either way the two records collide.)
	 */
	class CaseInsensitiveFakeVaultFsPort extends FakeVaultFsPort {
		override exists(path: string): Promise<boolean> {
			return super.exists(path.toLowerCase());
		}
		override read(path: string): Promise<string> {
			return super.read(path.toLowerCase());
		}
		override write(path: string, contents: string): Promise<void> {
			return super.write(path.toLowerCase(), contents);
		}
		override remove(path: string): Promise<void> {
			return super.remove(path.toLowerCase());
		}
		override rename(oldPath: string, newPath: string): Promise<void> {
			return super.rename(oldPath.toLowerCase(), newPath.toLowerCase());
		}
		override mkdir(path: string): Promise<void> {
			return super.mkdir(path.toLowerCase());
		}
		override list(dirPath: string): Promise<{ files: string[]; folders: string[] }> {
			return super.list(dirPath.toLowerCase());
		}
	}

	// KNOWN BUG — the per-file storage name IS the docid verbatim, and the
	// filename-safety rule (DocPersistEligibility) allows mixed case, so two
	// FOREIGN docids differing only by case (`id: MyNote` vs `id: mynote`) map
	// to the same physical file on a case-insensitive filesystem: the second
	// doc's record silently clobbers the first's, and after a restart one doc
	// has lost its state. Generated ids are immune (lowercase base36); the id
	// library's README explicitly warns consumers using ids as filenames.
	// Unskip (flip `it.skip` to `it`) when fixing.
	it.skip("WHEN two docids differ only by case THEN both records survive a restart", async () => {
		const fs = new CaseInsensitiveFakeVaultFsPort();
		const store = storeOver(fs);
		await store.saveNodeOverrideField("MyNote", { field: "content", value: "outline" });
		await store.saveNodeOverrideField("mynote", { field: "content", value: "image" });
		expect(Object.keys((await reloaded(fs)).nodeOverrides()).sort()).toEqual(["MyNote", "mynote"]);
	});
});
