import { CanvasFallbackParser } from "./CanvasFallbackParser";
import type { VaultFilePort, VaultPort } from "./obsidianPorts";

interface CachedParse {
	readonly mtime: number;
	readonly filePaths: readonly string[];
}

/**
 * Mtime-keyed cache around {@link CanvasFallbackParser} (step-02 CLARIFICATION
 * Q2 pre-approved mitigation): the fallback path re-reads a canvas only when
 * its mtime changed. Plugin-owned and long-lived — provider builds come and go,
 * the cache persists across them.
 */
export class CanvasParseCache {
	private readonly parsesByPath = new Map<string, CachedParse>();

	async filePathsOf(vault: VaultPort, canvasFile: VaultFilePort): Promise<readonly string[]> {
		const cached = this.parsesByPath.get(canvasFile.path);
		if (cached !== undefined && cached.mtime === canvasFile.stat.mtime) {
			return cached.filePaths;
		}
		const filePaths = CanvasFallbackParser.parseFilePaths(canvasFile.path, await vault.cachedRead(canvasFile));
		this.parsesByPath.set(canvasFile.path, { mtime: canvasFile.stat.mtime, filePaths });
		return filePaths;
	}

	/** Keep the cache honest across canvas deletes/renames (old path never revives). */
	evict(path: string): void {
		this.parsesByPath.delete(path);
	}
}
