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
 * Wikilink embeds ONLY: markdown-style `![alt](img.png)` embeds are a different
 * syntax whose expansion (an image) is the sibling `MarkdownInlineLinks`'s
 * territory; nothing has asked for it yet.
 */

import { LinkKinds } from "./LinkKind";
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
		return markdown.replace(Wikilinks.globalPattern(), (match, marker: string) =>
			LinkKinds.ofEmbedMarker(marker) === "embed" ? escapedForMarkdown(match) : match,
		);
	}
}

function escapedForMarkdown(text: string): string {
	return text.replace(ASCII_PUNCTUATION, "\\$&");
}
