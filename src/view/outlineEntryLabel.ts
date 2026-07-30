/**
 * Turns an `OutlineEntry.rawText` — the heading's SOURCE markdown — into the
 * text a node's outline displays (CLARIFICATION Q7: no `##`, no `[[ ]]`, no
 * `**`). The raw text stays the link key; only the label is formatted.
 *
 * This is a small honest stripper, NOT a markdown parser: one left-to-right
 * pass per construct, no nesting analysis, no tokenizer. DELIBERATELY NOT
 * HANDLED (each degrades to a few stray characters in a label — never a broken
 * link, never a crash):
 *
 * - `_underscore emphasis_` — stripping `_` would mangle `snake_case_identifiers`,
 *   which are far more common in headings than underscore italics.
 * - Backslash escapes (`\*literal\*`).
 * - Markers INSIDE code spans: code runs before emphasis, so `` `**a**` `` → `a`.
 * - Markdown link URLs containing `)`, nested or unbalanced markers, HTML tags,
 *   footnote refs, LaTeX.
 * - `[[note#heading]]` → Obsidian's "note > heading" display form.
 * - Multi-pipe wikilinks: `[[a|b|c]]` → `c`, where Obsidian displays `b|c`.
 * - The pathological `"## "` (marker only): the empty-result fallback below shows
 *   its raw text, the sole path by which a `#` marker reaches the display.
 */

import { Wikilinks } from "../shared/Wikilinks";

/** Leading `#` marker + WHITESPACE. The whitespace is required so a `#tag` heading survives. */
const LEADING_MARKER = /^#{1,6}\s+/;
/** Markdown links and images; the capture is the link text. */
const MARKDOWN_LINK = /!?\[([^\]]*)\]\([^)]*\)/g;
const CODE_SPAN = /`([^`]+)`/g;
const STRONG = /\*\*([^*]+)\*\*/g;
const EMPHASIS = /\*([^*]+)\*/g;
const HIGHLIGHT = /==([^=]+)==/g;
const STRIKETHROUGH = /~~([^~]+)~~/g;
const WHITESPACE_RUN = /\s+/g;

export function outlineEntryLabel(rawText: string): string {
	const stripped = rawText
		.replace(LEADING_MARKER, "")
		// `lastIndexOf` returns -1 without an alias pipe, so `slice(0)` keeps the
		// whole target — which is what Obsidian displays for an unaliased link.
		// Shared syntax knowledge (`Wikilinks`), local display rule: this strips the
		// markup down to the ALIAS-or-target Obsidian shows, which is a different
		// question from `Wikilinks.harvestedLinksOf`'s "what does this link point at".
		// The pattern captures the embed marker FIRST (that is how the kind travels),
		// so the inner text is the callback's SECOND group — display treats an embed
		// like any other link, hence the marker is discarded here.
		.replace(
			Wikilinks.globalPattern(),
			(_match, _embedMarker: string, link: string) => link.slice(link.lastIndexOf("|") + 1),
		)
		.replace(MARKDOWN_LINK, "$1")
		.replace(CODE_SPAN, "$1")
		.replace(STRONG, "$1")
		.replace(EMPHASIS, "$1")
		.replace(HIGHLIGHT, "$1")
		.replace(STRIKETHROUGH, "$1")
		.replace(WHITESPACE_RUN, " ")
		.trim();
	// A heading made entirely of markup (e.g. `[]()`) would render as a blank,
	// unclickable-looking row; showing its source is the honest fallback.
	return stripped === "" ? rawText.trim() : stripped;
}
