import type { App } from "obsidian";
import type { NoteNavigatorPort, OpenNoteOptions } from "./viewPorts";

/**
 * Adapts Obsidian's workspace/vault to the controller's narrow
 * {@link NoteNavigatorPort}, so {@link GraphViewController} stays obsidian-free
 * and node-testable. `getLeaf(false)` targets a main-area editor leaf (not the
 * sidebar hosting the graph), so a clicked node opens in the editor;
 * `getLeaf(true)` (ctrl/cmd-click, CLARIFICATION Q2) opens a new tab there.
 */
export class ObsidianNoteNavigator implements NoteNavigatorPort {
	constructor(private readonly app: App) {}

	activeFilePath(): string | null {
		return this.app.workspace.getActiveFile()?.path ?? null;
	}

	openNote(path: string, options?: OpenNoteOptions): void {
		const file = this.app.vault.getFileByPath(path);
		if (file === null) {
			return;
		}
		void this.app.workspace.getLeaf(options?.newTab === true).openFile(file);
	}
}
