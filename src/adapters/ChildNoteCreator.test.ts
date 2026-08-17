import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderPath, VaultPath } from "../engine";
import { asFolderPath } from "../engine";
import type { NoteOpenPort, OpenNoteOptions, UserNoticePort } from "../view/viewPorts";
import { ChildNoteCreator } from "./ChildNoteCreator";
import type { OwnedFolderLookup } from "./ChildNoteCreator";
import type { NoteCreationPort, VaultFilePort, VaultPort } from "./obsidianPorts";

/**
 * The create-child-note action (ticket nid_rt0dyx6chv7fxae4k7q85f53l_e), from
 * fakes alone — the folder-note rule and untitled dedupe are proven in
 * `FolderNotes.test.ts` / `ChildNoteNaming.test.ts`; this covers the flow the
 * creator owns: gate → dedupe against a live vault read → create empty → open,
 * with a one-notice failure policy.
 */

/** Owned-folder lookup that answers one main path. */
class FakeOwnedFolderLookup implements OwnedFolderLookup {
	constructor(private readonly owned: Record<string, string>) {}
	ownedFolderOf(path: VaultPath): FolderPath | undefined {
		const folder = this.owned[path];
		return folder === undefined ? undefined : asFolderPath(folder);
	}
}

/** Records creates; `existingFolders` decides folderExists; `rejectCreate` fails the write. */
class FakeNoteCreation implements NoteCreationPort {
	readonly created: string[] = [];
	rejectCreate = false;
	constructor(private readonly existingFolders: readonly string[]) {}
	create(path: string, _content: string): Promise<VaultFilePort> {
		if (this.rejectCreate) {
			return Promise.reject(new Error("disk full"));
		}
		this.created.push(path);
		return Promise.resolve({
			path,
			extension: "md",
			stat: { mtime: 0, size: 0 },
			parent: { path: path.slice(0, path.lastIndexOf("/")) },
		});
	}
	folderExists(folder: string): boolean {
		return this.existingFolders.includes(folder);
	}
}

/** Read-only vault whose `getFileByPath` reports membership in a taken-path set. */
function fakeVault(takenPaths: readonly string[]): VaultPort {
	const taken = new Set(takenPaths);
	return {
		getFileByPath: (path) => (taken.has(path) ? ({ path } as VaultFilePort) : null),
		getFiles: () => [],
		cachedRead: () => Promise.resolve(""),
	};
}

class RecordingOpen implements NoteOpenPort {
	readonly opened: { path: string; options: OpenNoteOptions }[] = [];
	openNote(path: string, options: OpenNoteOptions): void {
		this.opened.push({ path, options });
	}
}

class RecordingNotices implements UserNoticePort {
	readonly messages: string[] = [];
	show(message: string): void {
		this.messages.push(message);
	}
}

const MAIN = "Jon/Jon.md";

interface Harness {
	readonly creator: ChildNoteCreator;
	readonly creation: FakeNoteCreation;
	readonly open: RecordingOpen;
	readonly notices: RecordingNotices;
}

function harness(options: { owned?: string; existingFolders?: string[]; takenPaths?: string[] } = {}): Harness {
	const owned = options.owned ?? "Jon";
	const creation = new FakeNoteCreation(options.existingFolders ?? [owned]);
	const open = new RecordingOpen();
	const notices = new RecordingNotices();
	const creator = new ChildNoteCreator(
		new FakeOwnedFolderLookup({ [MAIN]: owned }),
		creation,
		fakeVault(options.takenPaths ?? []),
		open,
		notices,
	);
	return { creator, creation, open, notices };
}

describe("ChildNoteCreator", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("WHEN the main owns an EXISTING folder THEN it creates `<folder>/Untitled.md`", async () => {
		const h = harness();
		await h.creator.createChildNote(MAIN);
		expect(h.creation.created).toEqual(["Jon/Untitled.md"]);
	});

	it("WHEN `Untitled.md` is already taken THEN it dedupes against the live vault read", async () => {
		const h = harness({ takenPaths: ["Jon/Untitled.md"] });
		await h.creator.createChildNote(MAIN);
		expect(h.creation.created).toEqual(["Jon/Untitled 1.md"]);
	});

	it("WHEN the note is created THEN it opens in the CURRENT tab (becomes the new MAIN)", async () => {
		const h = harness();
		await h.creator.createChildNote(MAIN);
		expect(h.open.opened).toEqual([{ path: "Jon/Untitled.md", options: { newTab: false } }]);
	});

	it("WHEN the owned folder does NOT exist THEN nothing is created (never mint the folder)", async () => {
		const h = harness({ existingFolders: [] });
		await h.creator.createChildNote(MAIN);
		expect({ created: h.creation.created, opened: h.open.opened }).toEqual({ created: [], opened: [] });
	});

	it("WHEN the main owns NO folder THEN nothing is created", async () => {
		const h = harness({ owned: "Jon" });
		await h.creator.createChildNote("some/other-note.md");
		expect(h.creation.created).toEqual([]);
	});

	it("WHEN the create write fails THEN it shows ONE notice and never rethrows", async () => {
		const h = harness();
		h.creation.rejectCreate = true;
		await expect(h.creator.createChildNote(MAIN)).resolves.toBeUndefined();
		expect(h.notices.messages).toEqual(["Couldn't create the child note."]);
	});

	it("WHEN the create write fails THEN it never opens a note", async () => {
		const h = harness();
		h.creation.rejectCreate = true;
		await h.creator.createChildNote(MAIN);
		expect(h.open.opened).toEqual([]);
	});

	it("WHEN the OPEN throws after a successful create THEN no 'couldn't create' notice lies about it", async () => {
		// The failure notice guards the create alone — the note exists at this point,
		// so the open (a programming bug if it ever throws) surfaces loudly instead.
		const h = harness();
		vi.spyOn(h.open, "openNote").mockImplementation(() => {
			throw new Error("open exploded");
		});
		await expect(h.creator.createChildNote(MAIN)).rejects.toThrow("open exploded");
		expect(h.notices.messages).toEqual([]);
	});
});
