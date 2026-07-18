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
		if (typeof result !== "object" || result === null) {
			return null;
		}
		const data = (result as { data?: unknown }).data;
		if (data instanceof Map) {
			return [...data.keys()].filter((key): key is string => typeof key === "string");
		}
		if (typeof data === "object" && data !== null) {
			return Object.keys(data);
		}
		return null;
	}

	// The ONLY cast onto the undocumented API surface (CLARIFICATION Q1).
	private static rawApiOf(metadataCache: MetadataCachePort): unknown {
		return (metadataCache as { getBacklinksForFile?: unknown }).getBacklinksForFile;
	}
}
