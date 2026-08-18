import type { OutgoingReference, VaultPath } from "../engine";
import type { FrontmatterLinkPort } from "./obsidianPorts";

/**
 * Named relationships sourced from a note's FRONTMATTER link-valued fields
 * (feature `named-relationships`, ticket `nid_ibx7hmt6cvmjh5rydi2aiyab9_e`).
 *
 * `up: "[[parent]]"` means THIS_NOTE --up--> parent — the field KEY is the relation
 * name, verbatim. Obsidian's metadataCache already flattens link-valued frontmatter
 * into `cache.frontmatterLinks` (field key + link target), so — unlike inline
 * `::` statements — there is ZERO file reading and NO parsing: the
 * {@link import("./NamedRelationshipsIndex").NamedRelationshipsIndex} scan/parser
 * infrastructure is not needed here.
 *
 * This is simply a SECOND source of label-bearing {@link OutgoingReference}s feeding
 * the same `ObsidianLinkProvider` merge as `NamedRelationshipsIndex.namedReferences`:
 * a named link is STILL a link, so `OutgoingReferences.deduped` folds each field-key
 * label onto the very reference the plain frontmatter link already produced (the
 * either-budget union — same treatment as an inline statement).
 *
 * Scalar-valued frontmatter fields are attributes: they are not links, never land in
 * `frontmatterLinks`, and so are ignored by construction. List-valued fields
 * (`up: [ "[[a]]", "[[b]]" ]`) arrive as one entry per element, each keyed `up.N`;
 * the index suffix is stripped so every element shares the ONE relation name `up`.
 *
 * Pure adapter helper (no metadataCache handle of its own): the caller supplies the
 * live `frontmatterLinks` slice and the resolver, exactly as `ObsidianLinkProvider`
 * resolves every other link source.
 */
export class FrontmatterRelationships {
	/**
	 * The label-bearing outgoing references a note's frontmatter link fields
	 * contribute — one reference per (field entry, resolvable target), each carrying
	 * the field key as its relation name. `resolve` returns `undefined` for a
	 * dangling target, which is skipped (no plain cache edge either — the
	 * graceful-degradation rule: nothing appears, nothing dangles). NOT deduplicated:
	 * `ObsidianLinkProvider` merges these through `OutgoingReferences.deduped`.
	 */
	static namedReferences(
		frontmatterLinks: readonly FrontmatterLinkPort[] | undefined,
		resolve: (linkText: string) => VaultPath | undefined,
	): readonly OutgoingReference[] {
		const references: OutgoingReference[] = [];
		for (const { key, link } of frontmatterLinks ?? []) {
			const target = resolve(link);
			if (target === undefined) {
				continue;
			}
			references.push({
				target,
				// A frontmatter link is NEVER an embed (`ReferenceOrder` pins this).
				kind: "link",
				relations: [{ name: relationNameOf(key) }],
			});
		}
		return references;
	}
}

/** Obsidian suffixes a list field's flattened entries with `.<index>`; drop it. */
const LIST_INDEX_SUFFIX = /\.\d+$/;

/**
 * The relation name of a `frontmatterLinks` key: the key verbatim, with a trailing
 * numeric list-index segment removed (`up.0` ⇒ `up`, `up` ⇒ `up`). A non-numeric
 * dotted key (a nested object property) is left intact — only the flattening
 * suffix is stripped.
 */
export function relationNameOf(key: string): string {
	return key.replace(LIST_INDEX_SUFFIX, "");
}
