import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { FolderNoteIndex } from "./FolderNoteIndex";
import type { VaultFilePort, VaultPort } from "./obsidianPorts";

/**
 * BDD coverage of the folder-note ADAPTER. The convention itself (precedence,
 * children, ancestors) is exhaustively tested in `src/shared/FolderNotes.test.ts`;
 * here we prove the adapter builds from `vault.getFiles()` PATHS, delegates the
 * rule faithfully, and — the adapter's own responsibility — re-resolves after a
 * create/delete/rename once {@link FolderNoteIndex.markStale} fires.
 */

/**
 * A mutable in-memory {@link VaultPort} exposing ONLY what the index reads
 * (`getFiles().path`); its path set can change between builds so invalidation is
 * observable. `getFileByPath`/`cachedRead` are unused by the index but satisfy
 * the port.
 */
class MutableFakeVault implements VaultPort {
	private paths: string[];

	constructor(initialPaths: readonly string[]) {
		this.paths = [...initialPaths];
	}

	setPaths(paths: readonly string[]): void {
		this.paths = [...paths];
	}

	getFiles(): VaultFilePort[] {
		return this.paths.map((path) => ({
			path,
			extension: VaultPathFacts.extensionOf(path),
			stat: { mtime: 0, size: 0 },
			parent: { path: VaultPathFacts.folderOf(path) || "/" },
		}));
	}

	getFileByPath(path: string): VaultFilePort | null {
		return this.getFiles().find((file) => file.path === path) ?? null;
	}

	cachedRead(): Promise<string> {
		return Promise.resolve("");
	}
}

function indexOver(paths: readonly string[]): FolderNoteIndex {
	return new FolderNoteIndex(new MutableFakeVault(paths));
}

describe("FolderNoteIndex children", () => {
	it("WHEN a sibling `X.md` folder note is asked for children THEN its folder's direct notes come back", () => {
		const index = indexOver(["Jon.md", "Jon/a.md", "Jon/b.md"]);
		expect(index.childNotesOf(asVaultPath("Jon.md"))).toEqual([asVaultPath("Jon/a.md"), asVaultPath("Jon/b.md")]);
	});

	it("WHEN an inside `X/X.md` folder note is asked for children THEN itself is excluded", () => {
		const index = indexOver(["Jon/Jon.md", "Jon/a.md"]);
		expect(index.childNotesOf(asVaultPath("Jon/Jon.md"))).toEqual([asVaultPath("Jon/a.md")]);
	});

	it("WHEN both `X.md` and `X/X.md` exist THEN inside wins and the sibling owns nothing", () => {
		const index = indexOver(["Jon.md", "Jon/Jon.md", "Jon/a.md"]);
		// The inside note took folder `Jon`, so the sibling `Jon.md` is a plain note.
		expect(index.childNotesOf(asVaultPath("Jon.md"))).toEqual([]);
	});

	it("WHEN a canvas is the only folder-note candidate THEN it owns the folder's children", () => {
		const index = indexOver(["Jon/Jon.canvas", "Jon/a.md"]);
		expect(index.childNotesOf(asVaultPath("Jon/Jon.canvas"))).toEqual([asVaultPath("Jon/a.md")]);
	});

	it("WHEN a location holds both extensions THEN `.md` beats `.canvas` and the canvas owns nothing", () => {
		const index = indexOver(["Jon/Jon.md", "Jon/Jon.canvas", "Jon/a.md"]);
		expect(index.childNotesOf(asVaultPath("Jon/Jon.canvas"))).toEqual([]);
	});
});

describe("FolderNoteIndex folder-note candidates", () => {
	it("WHEN a folder holds several existing candidates THEN they come back branded, in precedence order", () => {
		const index = indexOver(["Jon/Jon.canvas", "Jon.md", "Jon/a.md"]);
		expect(index.folderNoteCandidatesOf(asFolderPath("Jon"))).toEqual([
			asVaultPath("Jon/Jon.canvas"),
			asVaultPath("Jon.md"),
		]);
	});

	it("WHEN a candidate is CREATED and the index is marked stale THEN the list re-resolves", () => {
		const vault = new MutableFakeVault(["Jon/a.md"]);
		const index = new FolderNoteIndex(vault);
		expect(index.folderNoteCandidatesOf(asFolderPath("Jon"))).toEqual([]);

		vault.setPaths(["Jon.md", "Jon/a.md"]);
		index.markStale();

		expect(index.folderNoteCandidatesOf(asFolderPath("Jon"))).toEqual([asVaultPath("Jon.md")]);
	});
});

describe("FolderNoteIndex parent", () => {
	it("WHEN a plain member is asked for its parent THEN it is the containing folder's note", () => {
		const index = indexOver(["Jon.md", "Jon/a.md"]);
		expect(index.parentNoteOf(asVaultPath("Jon/a.md"))).toEqual(asVaultPath("Jon.md"));
	});

	it("WHEN a folder has no folder note THEN a member has no parent", () => {
		const index = indexOver(["Jon/a.md"]);
		expect(index.parentNoteOf(asVaultPath("Jon/a.md"))).toBeUndefined();
	});
});

describe("FolderNoteIndex invalidation", () => {
	it("WHEN a sibling folder note is CREATED and the index is marked stale THEN the child resolves", () => {
		const vault = new MutableFakeVault(["Jon/a.md"]);
		const index = new FolderNoteIndex(vault);
		expect(index.childNotesOf(asVaultPath("Jon.md"))).toEqual([]);

		vault.setPaths(["Jon.md", "Jon/a.md"]);
		index.markStale();

		expect(index.childNotesOf(asVaultPath("Jon.md"))).toEqual([asVaultPath("Jon/a.md")]);
	});

	it("WHEN the folder note is DELETED and the index is marked stale THEN the child loses its parent", () => {
		const vault = new MutableFakeVault(["Jon.md", "Jon/a.md"]);
		const index = new FolderNoteIndex(vault);
		expect(index.parentNoteOf(asVaultPath("Jon/a.md"))).toEqual(asVaultPath("Jon.md"));

		vault.setPaths(["Jon/a.md"]);
		index.markStale();

		expect(index.parentNoteOf(asVaultPath("Jon/a.md"))).toBeUndefined();
	});

	it("WHEN the folder note is RENAMED away from the convention and the index is marked stale THEN it stops owning the folder", () => {
		const vault = new MutableFakeVault(["Jon.md", "Jon/a.md"]);
		const index = new FolderNoteIndex(vault);
		expect(index.childNotesOf(asVaultPath("Jon.md"))).toEqual([asVaultPath("Jon/a.md")]);

		// Rename `Jon.md` → `NotJon.md`: no longer named after folder `Jon`.
		vault.setPaths(["NotJon.md", "Jon/a.md"]);
		index.markStale();

		expect(index.childNotesOf(asVaultPath("Jon.md"))).toEqual([]);
	});

	it("WHEN the FOLDER is renamed and the index is marked stale THEN the sibling note re-resolves to the new folder", () => {
		const vault = new MutableFakeVault(["Jon.md", "Jon/a.md"]);
		const index = new FolderNoteIndex(vault);
		expect(index.childNotesOf(asVaultPath("Jon.md"))).toEqual([asVaultPath("Jon/a.md")]);

		// Rename folder `Jon/` → `Kai/`: `Jon.md` now names nothing, `Kai/` has no note.
		vault.setPaths(["Jon.md", "Kai/a.md"]);
		index.markStale();

		expect(index.childNotesOf(asVaultPath("Jon.md"))).toEqual([]);
		expect(index.parentNoteOf(asVaultPath("Kai/a.md"))).toBeUndefined();
	});

	it("WHEN paths change but the index is NOT marked stale THEN the stale snapshot answers", () => {
		const vault = new MutableFakeVault(["Jon.md", "Jon/a.md"]);
		const index = new FolderNoteIndex(vault);
		expect(index.childNotesOf(asVaultPath("Jon.md"))).toEqual([asVaultPath("Jon/a.md")]);

		// A new child appears, but WITHOUT invalidation the warmed snapshot is authoritative.
		vault.setPaths(["Jon.md", "Jon/a.md", "Jon/b.md"]);

		expect(index.childNotesOf(asVaultPath("Jon.md"))).toEqual([asVaultPath("Jon/a.md")]);
	});
});
