import type { FolderPath, VaultPath } from "../engine";
import { asVaultPath } from "../engine";
import { ChildNoteNaming } from "../shared/ChildNoteNaming";
import type { NoteOpenPort, UserNoticePort } from "../view/viewPorts";
import type { NoteCreationPort, VaultPort } from "./obsidianPorts";

/**
 * The folder a folder-note owns, from the warmed path-set index. Structurally
 * satisfied by {@link import("./FolderNoteIndex").FolderNoteIndex}; a port so
 * this creator is unit-tested with a fake and never re-derives the folder-note
 * rule (owner-locked in `src/shared/FolderNotes.ts`).
 */
export interface OwnedFolderLookup {
	ownedFolderOf(path: VaultPath): FolderPath | undefined;
}

/** Plain-language notice when the vault write fails — never a raw code (see failure policy below). */
const CHILD_NOTE_CREATE_FAILED_NOTICE = "Couldn't create the child note.";

/**
 * The create-child-note action behind the MAIN folder note's hover chip (ticket
 * `nid_rt0dyx6chv7fxae4k7q85f53l_e`): resolve the folder the main folder note
 * owns, dedupe an `Untitled` name against the vault READ FRESH at click time,
 * create the note EMPTY, and open it so the graph re-centres on it as the new
 * MAIN via the normal active-file-change path.
 *
 * Its own cohesive class (not folded into `ControlsActions`) because this is a
 * VAULT-CONTENT write, not a `data.json` write: it does NOT go through the
 * settings write pipeline / `runGuarded`. The whole failure policy is right
 * here — one {@link UserNoticePort} message, logged once, never rethrown to
 * React — so a failed create leaves the graph usable.
 */
export class ChildNoteCreator {
	constructor(
		private readonly folderNotes: OwnedFolderLookup,
		private readonly noteCreation: NoteCreationPort,
		/** Read-only vault, for the fresh existence check the untitled dedupe needs. */
		private readonly vault: VaultPort,
		private readonly open: NoteOpenPort,
		private readonly notices: UserNoticePort,
	) {}

	async createChildNote(mainPath: string): Promise<void> {
		const folder = this.folderNotes.ownedFolderOf(asVaultPath(mainPath));
		// The chip predicate already required an EXISTING owned folder; re-check both
		// halves in case state moved since the last build. A missing folder is left
		// untouched — never mint it (the out-of-scope note→folder-note conversion).
		if (folder === undefined || !this.noteCreation.folderExists(folder)) {
			return;
		}
		const childPath = ChildNoteNaming.untitledChildPath(
			folder,
			(candidate) => this.vault.getFileByPath(candidate) !== null,
		);
		// The failure notice guards the CREATE alone: once the write succeeded the
		// notice's copy would be a lie, so the open below stays outside the try —
		// unguarded, like every other openNote call in the view layer.
		let created;
		try {
			created = await this.noteCreation.create(childPath, "");
		} catch (error: unknown) {
			console.error("vicinity-graph: create child note failed", { childPath }, error);
			this.notices.show(CHILD_NOTE_CREATE_FAILED_NOTICE);
			return;
		}
		// Opening it makes it the active file → the graph re-centres on it as MAIN
		// (the vault `create` event already staled FolderNoteIndex). Current tab, not
		// a new one — the same as a plain node click.
		this.open.openNote(created.path, { newTab: false });
	}
}
