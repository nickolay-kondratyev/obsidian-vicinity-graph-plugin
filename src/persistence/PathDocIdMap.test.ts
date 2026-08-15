import { describe, expect, it } from "vitest";
import { PathDocIdMap } from "./PathDocIdMap";

describe("PathDocIdMap", () => {
	it("WHEN a pairing is set THEN it answers in both directions", () => {
		const map = new PathDocIdMap();
		map.set("notes/a.md", "docid_a_e");
		expect([map.getDocId("notes/a.md"), map.getPath("docid_a_e")]).toEqual(["docid_a_e", "notes/a.md"]);
	});

	it("WHEN an unknown path is asked THEN there is no docid", () => {
		expect(new PathDocIdMap().getDocId("ghost.md")).toBeUndefined();
	});

	it("WHEN a doc is renamed THEN its docid answers at the new path only", () => {
		const map = new PathDocIdMap();
		map.set("old.md", "docid_a_e");
		map.handleRename("old.md", "new.md");
		expect([map.getDocId("old.md"), map.getDocId("new.md"), map.getPath("docid_a_e")]).toEqual([
			undefined,
			"docid_a_e",
			"new.md",
		]);
	});

	it("WHEN an unmapped path is renamed THEN nothing changes (no phantom entries)", () => {
		const map = new PathDocIdMap();
		map.handleRename("ghost.md", "still-ghost.md");
		expect(map.getDocId("still-ghost.md")).toBeUndefined();
	});

	it("WHEN a mapped doc is deleted THEN its docid is returned as the cleanup key", () => {
		const map = new PathDocIdMap();
		map.set("a.md", "docid_a_e");
		expect(map.handleDelete("a.md")).toBe("docid_a_e");
	});

	it("WHEN a mapped doc is deleted THEN both directions forget it", () => {
		const map = new PathDocIdMap();
		map.set("a.md", "docid_a_e");
		map.handleDelete("a.md");
		expect([map.getDocId("a.md"), map.getPath("docid_a_e")]).toEqual([undefined, undefined]);
	});

	it("WHEN an unmapped path is deleted THEN there is no cleanup key (sweep is the backstop)", () => {
		expect(new PathDocIdMap().handleDelete("ghost.md")).toBeUndefined();
	});

	// Docids live in user-visible frontmatter, so "Make a copy" creates a SECOND
	// live file carrying the same docid (the id library honours existing ids
	// as-is). Surrendering the docid as a cleanup key when ONE twin is deleted
	// would let main.ts handleVaultDelete destroy the SURVIVOR's pin + per-file
	// record across both tiers (ticket nid_buurw8hp0yg2v1bwdhdyu7yrs_e) — so the
	// map withholds the key and leaves the ambiguity to the orphan sweep.
	it("WHEN a docid was seen at TWO live paths THEN deleting one twin yields no cleanup key", () => {
		const map = new PathDocIdMap();
		map.set("original.md", "docid_a_e");
		map.set("copy.md", "docid_a_e");
		expect(map.handleDelete("copy.md")).toBeUndefined();
	});

	it("WHEN a docid was seen at TWO live paths THEN deleting the OTHER twin also yields no cleanup key", () => {
		const map = new PathDocIdMap();
		map.set("original.md", "docid_a_e");
		map.set("copy.md", "docid_a_e");
		expect(map.handleDelete("original.md")).toBeUndefined();
	});

	it("WHEN a doc is renamed via handleRename THEN deleting it at the new path still yields the cleanup key", () => {
		const map = new PathDocIdMap();
		map.set("old.md", "docid_a_e");
		map.handleRename("old.md", "new.md");
		expect(map.handleDelete("new.md")).toBe("docid_a_e");
	});

	// A missed rename (set at a new path, no handleRename) is indistinguishable
	// from a duplicate twin at map level, so the key is withheld there too —
	// deliberate: the cost is a deferred cleanup (orphan sweep), never data loss.
	it("WHEN a docid re-appears at a different path via set THEN deleting it yields no cleanup key (sweep cleans up)", () => {
		const map = new PathDocIdMap();
		map.set("old.md", "docid_a_e");
		map.set("new.md", "docid_a_e");
		expect(map.handleDelete("new.md")).toBeUndefined();
	});

	it("WHEN a docid re-appears at a different path (missed rename) THEN the stale path forgets it", () => {
		const map = new PathDocIdMap();
		map.set("old.md", "docid_a_e");
		map.set("new.md", "docid_a_e");
		expect([map.getDocId("old.md"), map.getPath("docid_a_e")]).toEqual([undefined, "new.md"]);
	});

	it("WHEN a path re-appears with a different docid (delete+recreate) THEN the old docid is unmapped", () => {
		const map = new PathDocIdMap();
		map.set("a.md", "docid_old_e");
		map.set("a.md", "docid_new_e");
		expect([map.getPath("docid_old_e"), map.getDocId("a.md")]).toEqual([undefined, "docid_new_e"]);
	});
});
