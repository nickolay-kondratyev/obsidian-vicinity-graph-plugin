import type { FolderPath, VaultPath } from "../engine";
import { asFolderPath, asVaultPath } from "../engine";
import { FolderNotes } from "../shared/FolderNotes";
import type { VaultPort } from "./obsidianPorts";

/**
 * Cache-only folder-note index behind the folder-hierarchy feature (Hierarchy 2,
 * ticket `nid_bw8hltfj3nsyas03mpfmqn7mg_e`; plan `nid_ri1d36t7hmhu0kr652wny1dmz_e`).
 *
 * Built from vault PATHS ONLY — `vault.getFiles()`, NEVER a file read: the
 * folder-note convention is a pure function of the vault's path set, so this
 * adapter carries no resolution knowledge of its own and delegates EVERY answer
 * to the shared, import-guarded {@link FolderNotes} rule (no duplicated tie-break
 * knowledge across `src/shared/` and `src/adapters/`).
 *
 * Lifecycle mirrors {@link import("./FrontmatterIdIndex").FrontmatterIdIndex}'s
 * lazy warm: {@link ensureBuilt} builds the {@link FolderNotes} snapshot on the
 * first graph build and is a no-op afterwards, until {@link markStale} (fired by
 * vault create/delete/rename in `main.ts`) forces a rebuild on the next build.
 * Only PATH events matter — a folder note is chosen by path, so a body edit
 * (`metadataCache` 'changed') can never move it; a rename of the folder note or
 * of the folder re-resolves and IS a path event.
 */
export class FolderNoteIndex {
	/** The path-derived folder-note rule for the current vault snapshot; `null` until warmed. */
	private folderNotes: FolderNotes | null = null;

	constructor(private readonly vault: VaultPort) {}

	/**
	 * Invalidate the index so the next {@link ensureBuilt} rebuilds. Cheap and
	 * idempotent: many create/delete/rename events between two graph builds collapse
	 * to ONE rebuild on the next build.
	 */
	markStale(): void {
		this.folderNotes = null;
	}

	/**
	 * Build the {@link FolderNotes} snapshot if it is stale or never built.
	 * Synchronous — a pure walk of the vault's path list. Callers invoke it once per
	 * graph build (via `ObsidianLinkProvider.create`).
	 */
	ensureBuilt(): void {
		if (this.folderNotes !== null) {
			return;
		}
		this.folderNotes = FolderNotes.fromPaths(this.vault.getFiles().map((file) => file.path));
	}

	/**
	 * Folder-note CHILDREN of `path`: the node-bearing files directly inside the
	 * folder(s) `path` is the folder note of, minus `path` itself. Empty when `path`
	 * owns no folder. Read fresh through the warmed snapshot, like the id-ref paths.
	 */
	childNotesOf(path: VaultPath): readonly VaultPath[] {
		return this.snapshot().childNotesOf(path).map(asVaultPath);
	}

	/**
	 * EVERY existing folder-note candidate of `folder`, descending precedence (max
	 * 4; index 0 is the traversal winner) — the navigation targets behind a
	 * clickable folder-group label (ticket `nid_2pobjyfp5zgspx283bfukaugn_e`).
	 * Structurally satisfies the view's `FolderNoteCandidatesLookup`.
	 */
	folderNoteCandidatesOf(folder: FolderPath): readonly VaultPath[] {
		return this.snapshot().folderNoteCandidatesOf(folder).map(asVaultPath);
	}

	/**
	 * The folder `path` is the winning folder note of — where a NEW CHILD would be
	 * created (ticket `nid_rt0dyx6chv7fxae4k7q85f53l_e`), or `undefined` when `path`
	 * owns none. PATH truth only: this proves ownership, NOT that the folder exists as
	 * a vault directory (an empty owned folder is invisible to the path set); the chip
	 * predicate pairs it with a live `NoteCreationPort.folderExists` check.
	 */
	ownedFolderOf(path: VaultPath): FolderPath | undefined {
		const owned = this.snapshot().ownedFolderOf(path);
		return owned === undefined ? undefined : asFolderPath(owned);
	}

	/** Folder-note PARENT one hop UP from `path`, or `undefined` at the first folder-note gap. */
	parentNoteOf(path: VaultPath): VaultPath | undefined {
		const parent = this.snapshot().parentNoteOf(path);
		return parent === undefined ? undefined : asVaultPath(parent);
	}

	private snapshot(): FolderNotes {
		this.ensureBuilt();
		// ensureBuilt guarantees a non-null snapshot; the assertion keeps callers terse.
		return this.folderNotes as FolderNotes;
	}
}
