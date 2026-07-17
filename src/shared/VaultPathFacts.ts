/**
 * Pure vault-path string facts, shared by the engine and the Obsidian adapters.
 *
 * PURE by contract: `src/shared/` is imported by the engine (import-guarded to
 * never touch `obsidian`/`obsidian-id-lib`/react), so nothing here may import
 * those either. Extracted when step-03 became the third path-parsing consumer
 * (step-02 iteration finding 4).
 */
export class VaultPathFacts {
	/** Lower-cased extension without the dot; "" when the basename has none. */
	static extensionOf(path: string): string {
		const basename = VaultPathFacts.basenameOf(path);
		const dotIndex = basename.lastIndexOf(".");
		return dotIndex < 0 ? "" : basename.slice(dotIndex + 1).toLowerCase();
	}

	/** Folder part of a vault path; "" for the vault root. */
	static folderOf(path: string): string {
		const slashIndex = path.lastIndexOf("/");
		return slashIndex < 0 ? "" : path.slice(0, slashIndex);
	}

	/** Basename without extension (display title). Dot-files keep their name. */
	static titleOf(path: string): string {
		const basename = VaultPathFacts.basenameOf(path);
		const dotIndex = basename.lastIndexOf(".");
		return dotIndex <= 0 ? basename : basename.slice(0, dotIndex);
	}

	private static basenameOf(path: string): string {
		return path.slice(path.lastIndexOf("/") + 1);
	}
}
