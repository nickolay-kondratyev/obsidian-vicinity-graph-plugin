import type { Vault } from "obsidian";
import type { NoteCreationPort, VaultFilePort } from "./obsidianPorts";

/**
 * Adapts Obsidian's `Vault` to the plugin's one write seam,
 * {@link NoteCreationPort}. Thin by construction — the create-child-note flow's
 * logic (folder resolution, untitled dedupe, open, failure notice) lives in the
 * unit-tested `ChildNoteCreator`; this only reaches the two `Vault` calls that
 * need `obsidian` at runtime, so it is covered by the e2e suite like every other
 * `Obsidian*` adapter here.
 */
export class ObsidianNoteCreation implements NoteCreationPort {
	constructor(private readonly vault: Vault) {}

	create(path: string, content: string): Promise<VaultFilePort> {
		return this.vault.create(path, content);
	}

	folderExists(folder: string): boolean {
		return this.vault.getFolderByPath(folder) !== null;
	}
}
