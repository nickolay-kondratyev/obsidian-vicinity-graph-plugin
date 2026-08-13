import { describe, expect, it } from "vitest";
import { FolderNotes } from "./FolderNotes";

/**
 * The folder-note convention, tested from paths alone. GIVEN a fixture vault of
 * paths, WHEN a folder/note is resolved, THEN the owner-locked precedence holds
 * (plan `nid_ri1d36t7hmhu0kr652wny1dmz_e`).
 */

describe("FolderNotes folder-note resolution", () => {
	it("WHEN a sibling `X.md` exists THEN it is the folder note of `X/`", () => {
		const notes = FolderNotes.fromPaths(["Jon.md", "Jon/child.md"]);
		expect(notes.folderNoteOf("Jon")).toBe("Jon.md");
	});

	it("WHEN an inside `X/X.md` exists THEN it is the folder note of `X/`", () => {
		const notes = FolderNotes.fromPaths(["Jon/Jon.md", "Jon/child.md"]);
		expect(notes.folderNoteOf("Jon")).toBe("Jon/Jon.md");
	});

	it("WHEN both `X.md` and `X/X.md` exist THEN inside wins", () => {
		const notes = FolderNotes.fromPaths(["Jon.md", "Jon/Jon.md", "Jon/child.md"]);
		expect(notes.folderNoteOf("Jon")).toBe("Jon/Jon.md");
	});

	it("WHEN only `.canvas` candidates exist THEN inside `.canvas` wins over sibling `.canvas`", () => {
		const notes = FolderNotes.fromPaths(["Jon.canvas", "Jon/Jon.canvas"]);
		expect(notes.folderNoteOf("Jon")).toBe("Jon/Jon.canvas");
	});

	it("WHEN a location holds both extensions THEN `.md` beats `.canvas`", () => {
		const notes = FolderNotes.fromPaths(["Jon/Jon.md", "Jon/Jon.canvas"]);
		expect(notes.folderNoteOf("Jon")).toBe("Jon/Jon.md");
	});

	it("WHEN no candidate exists THEN the folder has no folder note", () => {
		const notes = FolderNotes.fromPaths(["Jon/child.md"]);
		expect(notes.folderNoteOf("Jon")).toBeUndefined();
	});
});

describe("FolderNotes children", () => {
	it("WHEN a sibling folder note is asked for its children THEN it is the direct node-bearing files", () => {
		const notes = FolderNotes.fromPaths(["Jon.md", "Jon/a.md", "Jon/b.md"]);
		expect(notes.childNotesOf("Jon.md")).toEqual(["Jon/a.md", "Jon/b.md"]);
	});

	it("WHEN an inside folder note is asked for its children THEN it is never its own child", () => {
		const notes = FolderNotes.fromPaths(["Jon/Jon.md", "Jon/child.md"]);
		expect(notes.childNotesOf("Jon/Jon.md")).toEqual(["Jon/child.md"]);
	});

	it("WHEN a `.canvas` folder note owns a `.canvas` child THEN both participate", () => {
		const notes = FolderNotes.fromPaths(["Jon/Jon.canvas", "Jon/child.canvas"]);
		expect(notes.childNotesOf("Jon/Jon.canvas")).toEqual(["Jon/child.canvas"]);
	});

	it("WHEN a losing sibling (inside won) is asked for children THEN it has none (ordinary note)", () => {
		const notes = FolderNotes.fromPaths(["Jon.md", "Jon/Jon.md", "Jon/child.md"]);
		expect(notes.childNotesOf("Jon.md")).toEqual([]);
	});

	it("WHEN a folder note owns nested subfolder files THEN only the DIRECT files are children", () => {
		const notes = FolderNotes.fromPaths(["Jon.md", "Jon/direct.md", "Jon/sub/deep.md"]);
		expect(notes.childNotesOf("Jon.md")).toEqual(["Jon/direct.md"]);
	});

	it("WHEN an attachment sits in the folder THEN it is not a child (node-bearing only)", () => {
		const notes = FolderNotes.fromPaths(["Jon.md", "Jon/note.md", "Jon/pic.png"]);
		expect(notes.childNotesOf("Jon.md")).toEqual(["Jon/note.md"]);
	});

	it("WHEN a direct subfolder has an INSIDE-style folder note THEN it is bridged to level 1", () => {
		// note1.md (sibling folder note of note1/) has NO direct files; note1/other/
		// is a direct subfolder whose inside-style note lives one level deeper.
		const notes = FolderNotes.fromPaths(["note1.md", "note1/other/other.md"]);
		expect(notes.childNotesOf("note1.md")).toContain("note1/other/other.md");
	});

	it("WHEN a direct subfolder has a SIBLING-style folder note THEN it is not duplicated", () => {
		// `Jon/sub.md` is the sibling folder note of `Jon/sub/` and already a direct
		// file of `Jon/`; the bridge must not add it a second time.
		const notes = FolderNotes.fromPaths(["Jon.md", "Jon/sub.md", "Jon/sub/leaf.md"]);
		expect(notes.childNotesOf("Jon.md")).toEqual(["Jon/sub.md"]);
	});

	it("WHEN a direct subfolder has NO folder note THEN it is not bridged", () => {
		const notes = FolderNotes.fromPaths(["Jon.md", "Jon/plain/hidden.md"]);
		expect(notes.childNotesOf("Jon.md")).toEqual([]);
	});

	it("WHEN a subfolder's inside note is bridged THEN its own files stay one level deeper", () => {
		const notes = FolderNotes.fromPaths(["note1.md", "note1/other/other.md", "note1/other/deep.md"]);
		expect(notes.childNotesOf("note1.md")).toEqual(["note1/other/other.md"]);
		expect(notes.childNotesOf("note1/other/other.md")).toEqual(["note1/other/deep.md"]);
	});
});

describe("FolderNotes parent walk", () => {
	it("WHEN a child note is asked for its parent THEN it is the containing folder's note", () => {
		const notes = FolderNotes.fromPaths(["Jon.md", "Jon/child.md"]);
		expect(notes.parentNoteOf("Jon/child.md")).toBe("Jon.md");
	});

	it("WHEN a root-level folder note is asked for its parent THEN there is none", () => {
		const notes = FolderNotes.fromPaths(["Jon.md", "Jon/child.md"]);
		expect(notes.parentNoteOf("Jon.md")).toBeUndefined();
	});

	it("WHEN a sibling-style chain is walked THEN each hop is one folder level up", () => {
		const notes = FolderNotes.fromPaths(["A.md", "A/B.md", "A/B/leaf.md"]);
		expect(notes.parentNoteOf("A/B/leaf.md")).toBe("A/B.md");
		expect(notes.parentNoteOf("A/B.md")).toBe("A.md");
		expect(notes.parentNoteOf("A.md")).toBeUndefined();
	});

	it("WHEN an inside-style folder note is asked for its parent THEN it is the parent folder's note", () => {
		const notes = FolderNotes.fromPaths(["A/A.md", "A/B/B.md", "A/B/leaf.md"]);
		expect(notes.parentNoteOf("A/B/B.md")).toBe("A/A.md");
	});

	it("WHEN sibling-root + inside-leaf (the descendants scenario) THEN the ancestor hop already works", () => {
		// The mirror of the descendants bridge: note1/other/other.md's parent is the
		// sibling-root note1.md — proving parentNoteOf and childNotesOf are symmetric.
		const notes = FolderNotes.fromPaths(["note1.md", "note1/other/other.md"]);
		expect(notes.parentNoteOf("note1/other/other.md")).toBe("note1.md");
	});

	it("WHEN the folder above has no folder note THEN the ancestor walk stops at the gap", () => {
		// `A/` has no folder note, so `A/B.md` (folder note of `A/B/`) has no parent.
		const notes = FolderNotes.fromPaths(["A/B.md", "A/B/leaf.md"]);
		expect(notes.parentNoteOf("A/B/leaf.md")).toBe("A/B.md");
		expect(notes.parentNoteOf("A/B.md")).toBeUndefined();
	});
});
