import { stripHeadingForLink } from "obsidian";
import type { App } from "obsidian";
import type { NoteNavigatorPort, OpenNoteOptions } from "./viewPorts";

/**
 * Adapts Obsidian's workspace/vault to the controller's narrow
 * {@link NoteNavigatorPort}, so {@link GraphViewController} stays obsidian-free
 * and node-testable. `getLeaf(false)` targets a main-area editor leaf (not the
 * sidebar hosting the graph), so a clicked node opens in the editor;
 * `getLeaf(true)` (ctrl/cmd-click, CLARIFICATION Q2) opens a new tab there.
 *
 * Sanitising the raw heading into a link subpath happens HERE because it needs
 * `obsidian` at runtime; the module is therefore unit-untestable by construction
 * (as every `Obsidian*` adapter here is) and is covered by the e2e suite.
 */
export class ObsidianNoteNavigator implements NoteNavigatorPort {
	constructor(private readonly app: App) {}

	activeFilePath(): string | null {
		return this.app.workspace.getActiveFile()?.path ?? null;
	}

	openNote(path: string, options?: OpenNoteOptions): void {
		// The guard covers BOTH branches: `openLinkText` on a path with no file can
		// prompt Obsidian to CREATE a note, so a click on a stale graph node must
		// never reach it.
		const file = this.app.vault.getFileByPath(path);
		if (file === null) {
			return;
		}
		const newTab = options?.newTab === true;
		if (options?.line !== undefined) {
			// `eState.line` is the editor's 0-based scroll-to-line ephemeral state —
			// the same mechanism Obsidian's own search results use to jump to a match.
			void this.app.workspace.getLeaf(newTab).openFile(file, { eState: { line: options.line } });
			return;
		}
		if (options?.heading === undefined) {
			void this.app.workspace.getLeaf(newTab).openFile(file);
			return;
		}
		// `stripHeadingForLink` is Obsidian's own subpath sanitiser — the one behind
		// "copy link to heading" — so our link resolves exactly like a hand-written
		// [[Note#Heading]]. Duplicate heading text jumps to the FIRST match, which is
		// Obsidian's own behaviour for such links (documented in the README).
		void this.app.workspace.openLinkText(`${path}#${stripHeadingForLink(options.heading)}`, path, newTab);
	}

	openMarkdownLink(linktext: string, sourcePath: string): void {
		// No existence guard on purpose (contrast openNote): the linktext came from
		// REAL note content, so an unresolved target must behave exactly as it does
		// when clicked in that note's editor — Obsidian offers to create it.
		void this.app.workspace.openLinkText(linktext, sourcePath, false);
	}
}
