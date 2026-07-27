import type { CanvasReference } from "./CanvasFallbackParser";
import { CanvasFallbackParser } from "./CanvasFallbackParser";
import type { VaultFilePort, VaultPort } from "./obsidianPorts";

interface CachedParse {
	readonly mtime: number;
	readonly references: readonly CanvasReference[];
}

/**
 * Mtime-keyed cache around {@link CanvasFallbackParser} (step-02 CLARIFICATION
 * Q2 pre-approved mitigation): the fallback path re-reads a canvas only when
 * its mtime changed. Plugin-owned and long-lived — provider builds come and go,
 * the cache persists across them.
 *
 * It caches PARSING (read + JSON + wikilink scan), never RESOLUTION: a
 * reference's target changes when OTHER files are renamed, which does not touch
 * this canvas's mtime, so resolution stays with the caller and runs fresh.
 */
export class CanvasParseCache {
	private readonly parsesByPath = new Map<string, CachedParse>();

	async referencesOf(vault: VaultPort, canvasFile: VaultFilePort): Promise<readonly CanvasReference[]> {
		const cached = this.parsesByPath.get(canvasFile.path);
		if (cached !== undefined && cached.mtime === canvasFile.stat.mtime) {
			return cached.references;
		}
		const references = CanvasFallbackParser.parseReferences(canvasFile.path, await vault.cachedRead(canvasFile));
		this.parsesByPath.set(canvasFile.path, { mtime: canvasFile.stat.mtime, references });
		return references;
	}

	/** Keep the cache honest across canvas deletes/renames (old path never revives). */
	evict(path: string): void {
		this.parsesByPath.delete(path);
	}
}
