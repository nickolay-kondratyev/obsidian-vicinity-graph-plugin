import type { VaultPath } from "./types";

/**
 * A note's text for the AI relationship namer (task 3/4
 * `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`) — an engine-defined port because reading it
 * is async file I/O (`vault.cachedRead`). Implemented by
 * `adapters/ObsidianNoteTextProvider.ts`; tests use {@link FakeNoteTextProvider}.
 */
export interface NoteTextProvider {
	/**
	 * The full text of a note: a markdown note's raw content, a canvas's text cards.
	 * `null` when the path is no readable `.md` / `.canvas` file. Never rejects.
	 */
	noteTextOf(path: VaultPath): Promise<string | null>;
}
