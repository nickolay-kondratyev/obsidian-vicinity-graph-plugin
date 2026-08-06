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
 * Callers that must skip CODE mask those regions first with
 * {@link MarkdownCodeRegions}. DELIBERATELY NOT HANDLED: ESCAPED brackets
 * (`\[not a link\](x.md)` is harvested though core yields nothing), brackets
 * inside the label, and parentheses inside the destination — all rare enough
 * that recognising them is not worth a parser. The first OVER-matches (a
 * spurious edge), the other two UNDER-match (a missed edge).
 */

import type { HarvestedLink } from "./LinkKind";
import { LinkKinds } from "./LinkKind";

/**
 * `[label](destination)` and its embed form. Capture group
 * {@link EMBED_MARKER_GROUP} is the embed marker (`"!"` or empty) and group
 * {@link PARENTHETICAL_GROUP} the raw parenthetical (destination plus optional
 * title). The label excludes brackets, which is also what keeps this matcher off
 * `[[wikilinks]]` and `![[embeds]]`. The marker is CAPTURED rather than merely
 * tolerated because `![a](x)` and `[a](x)` are different kinds of reference (see
 * {@link LinkKind}).
 *
 * Newlines are DELIBERATELY tolerated in both the label and the parenthetical —
 * unlike the wikilink matcher, and NOT a copy of its rule. Real Obsidian indexes
 * `[foo\nbar](x.md)` and `[x](\ny.md\n)`: CommonMark lets an inline link's label
 * and destination-parenthetical span a single line ending (observed by
 * `e2e/canvasMarkdownLinkIndexing.e2e.ts`). A BLANK line is the one exception — a
 * paragraph break ends the inline — and that is enforced past the regex by
 * {@link PARAGRAPH_BREAK} rather than by a newline-excluding class, which would
 * wrongly drop the legal single-newline links.
 */
const INLINE_LINK_SOURCE = "(!?)\\[[^\\[\\]]*\\]\\(([^()]*)\\)";

/**
 * A blank line inside a match: a line ending, only spaces/tabs, then another line
 * ending. CommonMark treats it as a paragraph break that ENDS the inline, so a
 * `[label](dest)` straddling one is not a link — real Obsidian indexes nothing
 * there (`blankLabel=false` in `e2e/canvasMarkdownLinkIndexing.e2e.ts`). A single
 * line ending is NOT a break, so `[^\S\n]*` (whitespace but not a second newline)
 * is what keeps this off the legal single-newline case.
 */
const PARAGRAPH_BREAK = /\n[^\S\n]*\n/;

/** 1-based capture-group positions in {@link INLINE_LINK_SOURCE}. */
const EMBED_MARKER_GROUP = 1;
const PARENTHETICAL_GROUP = 2;

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
	 * The markdown-style inline links written in `text` — vault link TEXT plus
	 * KIND — in written order, duplicates kept (callers dedupe). Titles, subpaths
	 * and queries are stripped and percent-escapes decoded, because that is the
	 * shape Obsidian's link RESOLUTION accepts. Destinations that name no vault
	 * document — external URLs and empty ones — yield nothing.
	 */
	/**
	 * True when a match straddles a paragraph break. A single line ending is legal
	 * inside an inline link/embed, but a blank line is a CommonMark paragraph break
	 * that ENDS the inline — so a `[label](dest)` spanning one is not one reference.
	 * Both the harvester (which would mint a phantom edge) and the preview flattener
	 * (which REWRITES what it matches, so it must not swallow prose across the break)
	 * ask this before acting on a match.
	 */
	static spansParagraphBreak(matchText: string): boolean {
		return PARAGRAPH_BREAK.test(matchText);
	}

	static harvestedLinksOf(text: string): readonly HarvestedLink[] {
		const links: HarvestedLink[] = [];
		for (const match of text.matchAll(MarkdownInlineLinks.globalPattern())) {
			// A blank line anywhere in the match is a paragraph break, so this is not
			// one link — drop it rather than mint a phantom edge from either half.
			if (MarkdownInlineLinks.spansParagraphBreak(match[0])) {
				continue;
			}
			const linkText = MarkdownInlineLinks.targetOf(match[PARENTHETICAL_GROUP] ?? "");
			if (linkText !== "") {
				links.push({ linkText, kind: LinkKinds.ofEmbedMarker(match[EMBED_MARKER_GROUP] ?? "") });
			}
		}
		return links;
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
