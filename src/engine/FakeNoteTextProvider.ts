import type { NoteTextProvider } from "./NoteTextProvider";
import type { VaultPath } from "./types";

/** In-memory {@link NoteTextProvider}: path → text; an unlisted path reads as `null`, like a missing file. */
export class FakeNoteTextProvider implements NoteTextProvider {
	readonly requestedPaths: VaultPath[] = [];
	private readonly texts: ReadonlyMap<string, string>;

	constructor(texts: Readonly<Record<string, string>> = {}) {
		this.texts = new Map(Object.entries(texts));
	}

	noteTextOf(path: VaultPath): Promise<string | null> {
		this.requestedPaths.push(path);
		return Promise.resolve(this.texts.get(path) ?? null);
	}
}
