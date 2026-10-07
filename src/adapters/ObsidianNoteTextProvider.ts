import type { NoteTextProvider, VaultPath } from "../engine";
import { FileKinds } from "../shared/FileKinds";
import { CanvasFallbackParser } from "./CanvasFallbackParser";
import type { VaultPort } from "./obsidianPorts";

/** Between two canvas text cards — a paragraph break, so the cards read as separate passages. */
const CANVAS_CARD_SEPARATOR = "\n\n";

/**
 * {@link NoteTextProvider} over the vault (task 3/4 `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`):
 * a markdown note's raw content via `cachedRead`, a canvas's text cards via the
 * one canvas parser. Anything else — or a path no file answers — reads as `null`.
 */
export class ObsidianNoteTextProvider implements NoteTextProvider {
	constructor(private readonly vault: VaultPort) {}

	async noteTextOf(path: VaultPath): Promise<string | null> {
		const file = this.vault.getFileByPath(path);
		if (file === null || !FileKinds.isNodeBearingPath(path)) {
			return null;
		}
		const raw = await this.readOrNull(file);
		if (raw === null || FileKinds.isMarkdownPath(path)) {
			return raw;
		}
		return CanvasFallbackParser.textCardsOf(path, raw).join(CANVAS_CARD_SEPARATOR);
	}

	/** A read that fails (file vanished mid-read) is "no text" — the port never rejects. */
	private async readOrNull(file: Parameters<VaultPort["cachedRead"]>[0]): Promise<string | null> {
		try {
			return await this.vault.cachedRead(file);
		} catch {
			return null;
		}
	}
}
