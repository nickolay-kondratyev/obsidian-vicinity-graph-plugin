/**
 * HOW a reference points at its target — the vault-generic distinction between a
 * plain link and an EMBED that renders the target inline.
 *
 * Lives in `shared/` rather than `engine/` because the two syntax matchers
 * ({@link Wikilinks}, {@link MarkdownInlineLinks}) must name the kind they
 * harvest, and `shared/` is the layer BELOW the engine (the engine imports
 * shared, never the reverse). The engine re-exports it as part of its public API,
 * so it is still the engine's domain vocabulary — it just cannot be the engine's
 * file. Deliberately says nothing about Obsidian, markdown or canvas: an embed is
 * an embed however it was written.
 */

/** Every link kind, in no significant order — the completeness source for `Record<LinkKind, …>`. */
export const LINK_KINDS = ["link", "embed"] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

/** The `!` that turns `[[x]]` into `![[x]]` and `[a](x)` into `![a](x)`. */
const EMBED_MARKER = "!";

/** One link harvested out of markdown text: WHERE it points, and HOW. */
export interface HarvestedLink {
	/** Link TEXT, ready for Obsidian's own resolution — never a resolved path. */
	readonly linkText: string;
	readonly kind: LinkKind;
}

export class LinkKinds {
	/**
	 * The kind an embed marker denotes. Takes the matcher's CAPTURED marker
	 * (`"!"` or `""`) rather than the whole match, so the caller never re-implements
	 * "does this start with a bang".
	 */
	static ofEmbedMarker(marker: string): LinkKind {
		return marker === EMBED_MARKER ? "embed" : "link";
	}
}
