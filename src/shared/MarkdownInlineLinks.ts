/**
 * What a markdown-style inline link (`[label](note.md)`, `![alt](pic.png)`)
 * LOOKS LIKE, in one place — the sibling of {@link Wikilinks}, deliberately a
 * SEPARATE module because it is a different syntax with different rules
 * (percent-encoding, external URLs, titles) that happens to name the same kind
 * of thing.
 *
 * What comes out is LINK TEXT, ready for Obsidian's own resolution
 * (`getFirstLinkpathDest`) exactly like a wikilink target — that is what
 * Obsidian core does for these links, and sharing the one resolution path is
 * what keeps relative paths, folder notes and shortest-path targets agreeing
 * between the canvas link regimes (ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e`).
 * Path-shaped destinations therefore go to that resolver VERBATIM: real Obsidian
 * accepts `./x.md` and `../folder/x.md` as-is, measured by
 * `e2e/canvasMarkdownLinkIndexing.e2e.ts`, so no path normalisation belongs here.
 *
 * A small honest matcher, NOT a markdown parser (same spirit as
 * {@link Wikilinks}): one left-to-right pass, no code-span or escape analysis.
 * DELIBERATELY NOT HANDLED: links inside code spans/fences (harvested as if
 * they were real — ticket `nid_869bt9d9rlrbr8of1403dnmf3_e`), ESCAPED brackets
 * (`\[not a link\](x.md)` is harvested though core yields nothing), brackets
 * inside the label, and parentheses inside the destination — all rare enough
 * that recognising them is not worth a parser. The first two OVER-match (a
 * spurious edge), the last two UNDER-match (a missed edge).
 */

/**
 * `[label](destination)` and its embed form; capture group 1 is the raw
 * parenthetical (destination plus optional title). The label excludes brackets,
 * which is also what keeps this matcher off `[[wikilinks]]` and `![[embeds]]`.
 */
const INLINE_LINK_SOURCE = "!?\\[[^\\[\\]]*\\]\\(([^()]*)\\)";

/** An angle-bracket-wrapped destination — the markdown escape hatch for spaces. */
const ANGLE_WRAPPED_DESTINATION = /^<([^>]*)>/;

/** Ends a bare destination — CommonMark forbids unescaped spaces inside one. */
const DESTINATION_TERMINATOR = /\s/;

/**
 * What may legally follow a bare destination: whitespace then a title, opened by
 * `"`, `'` or `(`. Anything else means the "destination" simply contains a space
 * and is therefore no link at all.
 */
const TITLE_START = /^\s+["'(]/;

/** Ends the DOCUMENT part of a destination: a `#heading`/`#^block` subpath or a `?query`. */
const DOCUMENT_PART_TERMINATOR = /[#?]/;

/**
 * A destination pointing outside the vault: any URI scheme (`https:`, `mailto:`,
 * `obsidian:`, `file:`) or a protocol-relative `//host/…`.
 */
const EXTERNAL_DESTINATION = /^([a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/;

export class MarkdownInlineLinks {
	/**
	 * A FRESH global matcher each call — a `/g` regex carries mutable `lastIndex`,
	 * so a shared module-level instance would let one caller's scan position leak
	 * into another's.
	 */
	static globalPattern(): RegExp {
		return new RegExp(INLINE_LINK_SOURCE, "g");
	}

	/**
	 * The vault link TEXTS written in `text` as markdown-style inline links, in
	 * written order, duplicates kept (callers dedupe). Titles, subpaths and
	 * queries are stripped and percent-escapes decoded, because that is the shape
	 * Obsidian's link RESOLUTION accepts. Destinations that name no vault
	 * document — external URLs and empty ones — yield nothing.
	 */
	static linkTargetsOf(text: string): readonly string[] {
		const targets: string[] = [];
		for (const match of text.matchAll(MarkdownInlineLinks.globalPattern())) {
			const target = MarkdownInlineLinks.targetOf(match[1] ?? "");
			if (target !== "") {
				targets.push(target);
			}
		}
		return targets;
	}

	private static targetOf(parenthetical: string): string {
		const destination = MarkdownInlineLinks.destinationOf(parenthetical.trim());
		// ORDER MATTERS. The external verdict comes first: decoding first would turn
		// `note%3Aone.md` (a file whose name has a colon) into a `note:` "scheme" and
		// drop a real edge. Subpath stripping comes next for the same reason —
		// `%23` is a literal `#` in a filename, not a heading.
		if (EXTERNAL_DESTINATION.test(destination)) {
			return "";
		}
		return MarkdownInlineLinks.decoded(MarkdownInlineLinks.documentPartOf(destination)).trim();
	}

	/**
	 * The destination alone: angle brackets unwrapped, any trailing title dropped.
	 *
	 * A space that does NOT open a title means the destination itself contains an
	 * unencoded space, which CommonMark (and hence Obsidian) does not accept — so
	 * `[a](my note.md)` is not a link. Answering `""` rather than truncating to
	 * `my` matters: a vault may well hold a note named `my`, and an edge to the
	 * WRONG document is worse than a missing one.
	 */
	private static destinationOf(parenthetical: string): string {
		const angleWrapped = ANGLE_WRAPPED_DESTINATION.exec(parenthetical);
		if (angleWrapped !== null) {
			return angleWrapped[1] ?? "";
		}
		const terminator = parenthetical.search(DESTINATION_TERMINATOR);
		if (terminator === -1) {
			return parenthetical;
		}
		return TITLE_START.test(parenthetical.slice(terminator)) ? parenthetical.slice(0, terminator) : "";
	}

	private static documentPartOf(destination: string): string {
		const terminator = destination.search(DOCUMENT_PART_TERMINATOR);
		return terminator === -1 ? destination : destination.slice(0, terminator);
	}

	/**
	 * A malformed escape (`100%.md`) makes `decodeURIComponent` throw; the honest
	 * answer is then the text as written — it simply will not resolve — rather
	 * than silently dropping a link the user can see.
	 */
	private static decoded(destination: string): string {
		try {
			return decodeURIComponent(destination);
		} catch {
			return destination;
		}
	}
}
