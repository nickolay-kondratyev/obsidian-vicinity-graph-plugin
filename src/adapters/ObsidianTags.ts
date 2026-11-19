import type { CachedMetadataPort } from "./obsidianPorts";

/** Obsidian reads exactly this frontmatter key, case-insensitively — NOT the legacy singular `tag`. */
const FRONTMATTER_TAGS_KEY = /^tags$/i;
const TAG_MARKER = "#";

/**
 * What Obsidian reports as one note's tags — the adapter's reading of the
 * metadata cache, never a file read. Identity/nesting rules are NOT here; they
 * live in the pure `shared/Tags.ts` that consumers normalise through.
 *
 * WHY-NOT call `getAllTags` from `obsidian`: the package is types-only under
 * `npm test`, so the adapter could not be tested. Instead this MIRRORS
 * `getAllTags` + `parseFrontMatterTags` as shipped in 1.12.4 (floor) and 1.12.7
 * (pinned): the first frontmatter key matching `/^tags$/i` (a string or a list;
 * non-strings, blanks and entries containing a space dropped; `#` prefixed),
 * then every body hashtag occurrence. Re-check on an Obsidian bump.
 */
export class ObsidianTags {
	/** Raw tags (`#`-prefixed, duplicates and casing as reported), frontmatter first. */
	static rawTagsOf(cache: CachedMetadataPort | null): readonly string[] {
		if (cache === null) {
			return [];
		}
		return [
			...ObsidianTags.frontmatterTagsOf(cache.frontmatter),
			...(cache.tags ?? []).map((occurrence) => occurrence.tag),
		];
	}

	/** True for the frontmatter property Obsidian reads tags from (`tags`, any casing). */
	static isTagsPropertyKey(key: string): boolean {
		return FRONTMATTER_TAGS_KEY.test(key);
	}

	private static frontmatterTagsOf(frontmatter: CachedMetadataPort["frontmatter"]): readonly string[] {
		if (frontmatter === undefined) {
			return [];
		}
		const key = Object.keys(frontmatter).find((candidate) => FRONTMATTER_TAGS_KEY.test(candidate));
		const value = key === undefined ? undefined : frontmatter[key];
		const entries = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
		return entries
			.filter((entry): entry is string => typeof entry === "string")
			.map((entry) => entry.trim())
			.filter((entry) => entry !== "" && !entry.includes(" "))
			.map((entry) => (entry.startsWith(TAG_MARKER) ? entry : TAG_MARKER + entry));
	}
}
