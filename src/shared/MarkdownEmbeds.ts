/**
 * Embeds (`![[…]]`) escaped so they reach the link-preview drawer as their OWN
 * raw wikilink text — ticket `nid_0dle910iia37t42t28dqndc5b_e`.
 *
 * WHY: the drawer renders each context snippet through Obsidian's markdown
 * renderer, which EXPANDS an embed into the whole embedded note (or image). A
 * row meant to show ONE line then shows an entire document. Escaping the embed's
 * markdown-significant characters keeps the renderer from expanding it, so the
 * row shows the embed WRITTEN — `![[note]]`, `![[note|alias]]` — verbatim, no
 * resolution and no rendering.
 *
 * A DISPLAY transform: it leaves the written link text exactly as the author
 * typed it (alias, subpath, size and all) and only makes it render literally.
 *
 * BOTH embed syntaxes are flattened: wikilink embeds (`![[note]]`) and
 * markdown-style embeds (`![alt](pic.png)`), the latter expanding to an IMAGE in
 * the row just as destructively (ticket `nid_vvdc7lhh92122ght4m66t5d61_e`).
 * External destinations (`![alt](https://host/pic.png)`) are in scope too — the
 * renderer expands a remote image the same way — and need no resolution because
 * this transform only escapes the WRITTEN text, never names the target. Plain
 * markdown links (`[label](note.md)`, no bang) are left clickable, untouched.
 */

import { LinkKinds } from "./LinkKind";
import { MarkdownInlineLinks } from "./MarkdownInlineLinks";
import { Wikilinks } from "./Wikilinks";

/**
 * Every ASCII punctuation character — CommonMark allows a backslash escape on
 * ALL of them, so escaping the whole embed makes it render VERBATIM. Load
 * bearing: an unescaped `![[note]]` is expanded by the renderer into the whole
 * embedded note.
 */
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/g;

export class MarkdownEmbeds {
	/** `markdown` with every embed escaped to render as its own raw text; plain links untouched. */
	static flattened(markdown: string): string {
		const wikilinksFlattened = markdown.replace(Wikilinks.globalPattern(), (match, marker: string) =>
			LinkKinds.ofEmbedMarker(marker) === "embed" ? escapedForMarkdown(match) : match,
		);
		// A markdown embed may span a single line ending but NOT a paragraph break;
		// rewriting a match that straddles one would delete the reader's prose between
		// the halves, so a broken match is left verbatim (mirrors the wikilink
		// matcher's newline exclusion — ticket nid_lgo91fzkivxiu32g1j5bttzca_e).
		return wikilinksFlattened.replace(MarkdownInlineLinks.globalPattern(), (match, marker: string) =>
			LinkKinds.ofEmbedMarker(marker) === "embed" && !MarkdownInlineLinks.spansParagraphBreak(match)
				? escapedForMarkdown(match)
				: match,
		);
	}
}

function escapedForMarkdown(text: string): string {
	return text.replace(ASCII_PUNCTUATION, "\\$&");
}
