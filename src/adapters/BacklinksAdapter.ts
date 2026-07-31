import type { MetadataCachePort, VaultFilePort } from "./obsidianPorts";

/**
 * THE single place that touches the undocumented
 * `metadataCache.getBacklinksForFile` (HUMAN-approved, step-03 CLARIFICATION
 * Q1): one narrow cast, a runtime presence check, and shape-tolerant
 * extraction. Everything else in the codebase sees only `readonly string[] |
 * null`; `null` ⇒ the caller must use its resolvedLinks-inversion fallback.
 */
export class BacklinksAdapter {
	/** Presence check — evaluated once per provider build. */
	static isAvailable(metadataCache: MetadataCachePort): boolean {
		return typeof BacklinksAdapter.rawApiOf(metadataCache) === "function";
	}

	/** Linker source paths of `file`, or `null` when the API is absent. */
	static backlinkSourcePaths(metadataCache: MetadataCachePort, file: VaultFilePort): readonly string[] | null {
		const rawApi = BacklinksAdapter.rawApiOf(metadataCache);
		if (typeof rawApi !== "function") {
			return null;
		}
		return BacklinksAdapter.extractSourcePaths(rawApi.call(metadataCache, file));
	}

	/**
	 * Tolerates both known runtime shapes of the result's `data`: a Map-like
	 * (current builds) and a plain source-path→references record (older
	 * builds). Anything unrecognized yields `null` → fallback, never a throw.
	 */
	static extractSourcePaths(result: unknown): readonly string[] | null {
		const entries = BacklinksAdapter.dataEntriesOf(result);
		return entries === null ? null : entries.map(([sourcePath]) => sourcePath);
	}

	/**
	 * Per-source occurrence OFFSETS of `file`'s backlinks, or `null` when the
	 * API is absent (⇒ resolvedLinks-inversion fallback, whose occurrences have
	 * no positions). Same shape tolerance as {@link backlinkSourcePaths}; a
	 * reference whose position cannot be read contributes `null`, and a source
	 * whose reference LIST cannot be read contributes an empty array — the
	 * occurrence provider turns both into position-less occurrences.
	 */
	static backlinkOccurrenceOffsets(
		metadataCache: MetadataCachePort,
		file: VaultFilePort,
	): ReadonlyMap<string, readonly (number | null)[]> | null {
		const rawApi = BacklinksAdapter.rawApiOf(metadataCache);
		if (typeof rawApi !== "function") {
			return null;
		}
		return BacklinksAdapter.extractOccurrenceOffsets(rawApi.call(metadataCache, file));
	}

	/** Occurrence offsets per source path; `null` on unrecognized shapes, never a throw. */
	static extractOccurrenceOffsets(result: unknown): ReadonlyMap<string, readonly (number | null)[]> | null {
		const entries = BacklinksAdapter.dataEntriesOf(result);
		if (entries === null) {
			return null;
		}
		return new Map(
			entries.map(([sourcePath, references]) => [sourcePath, BacklinksAdapter.offsetsOf(references)]),
		);
	}

	/** The result's `data` as [sourcePath, rawReferences] entries, or `null` → fallback. */
	private static dataEntriesOf(result: unknown): readonly (readonly [string, unknown])[] | null {
		if (typeof result !== "object" || result === null) {
			return null;
		}
		const data = (result as { data?: unknown }).data;
		if (data instanceof Map) {
			return [...data.entries()].filter((entry): entry is [string, unknown] => typeof entry[0] === "string");
		}
		if (typeof data === "object" && data !== null) {
			return Object.entries(data);
		}
		return null;
	}

	/** Start offsets of one source's raw reference list; unreadable pieces degrade to null/empty. */
	private static offsetsOf(references: unknown): readonly (number | null)[] {
		if (!Array.isArray(references)) {
			return [];
		}
		return references.map((reference) => {
			const offset = (reference as { position?: { start?: { offset?: unknown } } })?.position?.start?.offset;
			return typeof offset === "number" ? offset : null;
		});
	}

	// The ONLY cast onto the undocumented API surface (CLARIFICATION Q1).
	private static rawApiOf(metadataCache: MetadataCachePort): unknown {
		return (metadataCache as { getBacklinksForFile?: unknown }).getBacklinksForFile;
	}
}
