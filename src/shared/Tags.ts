/**
 * THE tag rules (tags-v1, ticket `nid_mr42m1k8cmyeusemmvmxuuaxb_e`): identity,
 * display, nesting. Every consumer — the adapter reporting a note's tags, tag
 * grouping, the tag filter — asks HERE, so "is this the same tag" and "is this
 * nested under that" are decided once.
 *
 * PURE by contract (see `VaultPathFacts`): no `obsidian` import. What Obsidian
 * reports as a note's tags is adapter knowledge (`adapters/ObsidianTags.ts`).
 */

/**
 * A tag's IDENTITY: no leading `#`, lower-cased — Obsidian treats `#Todo` and
 * `#todo` as one tag. Branded so a display name can never be compared as a key.
 */
export type TagKey = string & { readonly __brand: "TagKey" };

/** One tag: its identity plus the casing it was written in (no `#`). */
export interface Tag {
	readonly key: TagKey;
	/** Display name, casing as first written, without the `#`. */
	readonly name: string;
}

/** Obsidian's nested-tag separator (`#project/alpha`). */
const NESTING_SEPARATOR = "/";
const TAG_MARKER = "#";

export class Tags {
	/**
	 * A raw tag as Obsidian reports it (`#Todo` from the body, `Todo` from
	 * frontmatter) → a {@link Tag}; `undefined` when nothing is left after the `#`.
	 */
	static parse(raw: string): Tag | undefined {
		const trimmed = raw.trim();
		const name = trimmed.startsWith(TAG_MARKER) ? trimmed.slice(TAG_MARKER.length) : trimmed;
		if (name === "") {
			return undefined;
		}
		return { key: Tags.keyOfName(name), name };
	}

	/**
	 * Raw tags → distinct {@link Tag}s in first-seen order; the first casing wins.
	 * Does NOT add ancestors — that is {@link withAncestors}, a rule consumers call.
	 */
	static distinct(raws: Iterable<string>): readonly Tag[] {
		const byKey = new Map<TagKey, Tag>();
		for (const raw of raws) {
			const tag = Tags.parse(raw);
			if (tag !== undefined && !byKey.has(tag.key)) {
				byKey.set(tag.key, tag);
			}
		}
		return [...byKey.values()];
	}

	/**
	 * `tags` plus every ancestor of each nested tag (`a/b/c` ⇒ `a`, `a/b`, `a/b/c`),
	 * deduplicated, each ancestor placed before its first descendant. A note tagged
	 * `#project/alpha` counts as `#project` too, matching Obsidian's tag search. An
	 * added ancestor's display name is the prefix of the tag that implied it; a tag
	 * the note carries itself keeps its own casing when it comes first.
	 */
	static withAncestors(tags: readonly Tag[]): readonly Tag[] {
		const byKey = new Map<TagKey, Tag>();
		for (const tag of tags) {
			const segments = tag.name.split(NESTING_SEPARATOR);
			for (let length = 1; length <= segments.length; length++) {
				const name = length === segments.length ? tag.name : segments.slice(0, length).join(NESTING_SEPARATOR);
				const key = Tags.keyOfName(name);
				if (name !== "" && !byKey.has(key)) {
					byKey.set(key, length === segments.length ? tag : { key, name });
				}
			}
		}
		return [...byKey.values()];
	}

	/**
	 * True when `tag` IS `ancestor` or is nested anywhere below it — Obsidian's
	 * `tag:#project` semantics (matches `#project/alpha`, never `#projects`).
	 */
	static isSameOrNestedUnder(tag: TagKey, ancestor: TagKey): boolean {
		return tag === ancestor || tag.startsWith(ancestor + NESTING_SEPARATOR);
	}

	/** `toLowerCase`, not locale-aware: identity must not depend on the user's locale. */
	private static keyOfName(name: string): TagKey {
		return name.toLowerCase() as TagKey;
	}
}
