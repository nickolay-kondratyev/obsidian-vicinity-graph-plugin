/**
 * What a wikilink LOOKS LIKE, in one place — shared because two layers ask the
 * same question about the same syntax: `view/outlineEntryLabel` strips the
 * markup for display, `adapters/CanvasFallbackParser` harvests link targets out
 * of canvas text-node bodies.
 *
 * A small honest matcher, NOT a markdown parser (same spirit as
 * `outlineEntryLabel`): one left-to-right pass, no code-span or escape
 * analysis. A caller that must skip CODE — canvas harvesting, which has to match
 * what core indexes — masks those regions first with
 * {@link MarkdownCodeRegions}; that stays OUT of here because the display caller
 * wants the opposite (a `` `[[x]]` `` in a heading still renders its label).
 *
 * Wikilinks ONLY, by design — markdown-style `[a](b.md)` links are the sibling
 * `MarkdownInlineLinks`'s job (different syntax, different rules), and canvas
 * text-node harvesting runs both.
 */

import type { HarvestedLink } from "./LinkKind";
import { LinkKinds } from "./LinkKind";

/**
 * Wikilinks and embeds. Capture group {@link EMBED_MARKER_GROUP} is the embed
 * marker (`"!"` or empty) and group {@link INNER_TEXT_GROUP} the raw inner text
 * (`target`, `target#heading|alias`, …). The marker is CAPTURED rather than
 * merely tolerated because `![[x]]` and `[[x]]` are different kinds of reference
 * (see {@link LinkKind}), and a matcher that swallows the `!` cannot say which.
 */
const WIKILINK_SOURCE = "(!?)\\[\\[([^\\]]+)\\]\\]";

/** 1-based capture-group positions in {@link WIKILINK_SOURCE} (also the `String.replace` callback's argument order). */
const EMBED_MARKER_GROUP = 1;
const INNER_TEXT_GROUP = 2;

/** Ends the link TARGET: an alias pipe or a `#heading`/`#^block` subpath. */
const TARGET_TERMINATOR = /[#|]/;

export class Wikilinks {
	/**
	 * A FRESH global matcher each call — a `/g` regex carries mutable `lastIndex`,
	 * so a shared module-level instance would let one caller's scan position leak
	 * into another's.
	 */
	static globalPattern(): RegExp {
		return new RegExp(WIKILINK_SOURCE, "g");
	}

	/**
	 * The wikilinks written in `text` — target plus KIND — in written order,
	 * duplicates kept (callers dedupe). Aliases and subpaths are stripped —
	 * `[[note#h|Alias]]` yields `note` — because that is the shape Obsidian's link
	 * RESOLUTION accepts (`getFirstLinkpathDest`). Pure-subpath links
	 * (`[[#heading]]`, same-file) yield nothing: they name no other document.
	 */
	static harvestedLinksOf(text: string): readonly HarvestedLink[] {
		const links: HarvestedLink[] = [];
		for (const match of text.matchAll(Wikilinks.globalPattern())) {
			const linkText = Wikilinks.targetOf(match[INNER_TEXT_GROUP] ?? "");
			if (linkText !== "") {
				links.push({ linkText, kind: LinkKinds.ofEmbedMarker(match[EMBED_MARKER_GROUP] ?? "") });
			}
		}
		return links;
	}

	private static targetOf(innerText: string): string {
		const terminator = innerText.search(TARGET_TERMINATOR);
		return (terminator === -1 ? innerText : innerText.slice(0, terminator)).trim();
	}
}
