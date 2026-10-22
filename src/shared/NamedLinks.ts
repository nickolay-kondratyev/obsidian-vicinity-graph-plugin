/**
 * A "named link" is `<rel-name>::[[target]]` in a markdown body (ticket
 * `nid_wu4gfieqps2uw9l8f4wab1abq_e`): the word glued to the `::` right before a
 * plain wikilink names the relation, and the graph shows it on that edge.
 *
 * Pure text rule, no Obsidian: the caller supplies the body text and the offset of
 * a link it already knows is a plain `[[…]]` (from `cache.links`), and this answers
 * "does a relation name sit immediately before it?". Embeds (`![[…]]`) never match,
 * because their offset points at the `!`, not at `[[`.
 */

/**
 * The relation name: the MAXIMAL run of Unicode letters / digits / `_` / `-` glued
 * to `::` at the very end of the text before the link — `$` anchors it to the
 * line prefix, `\p{L}\p{N}` (the `u` flag) admits non-ASCII names, and `\p{M}`
 * keeps a letter's combining marks (Devanagari/Thai vowel signs, NFD accents)
 * inside the word instead of cutting the name at the last mark. Whitespace or
 * any other character ends the run, so `greatly improves::[[x]]` names `improves`
 * and `**x**::[[x]]` names nothing (`*` is not a name character and nothing
 * follows it before `::`).
 */
const RELATION_BEFORE_LINK_PATTERN = /([\p{L}\p{M}\p{N}_-]+)::$/u;

const WIKILINK_OPENER = "[[";
const LINE_BREAK = "\n";

export class NamedLinks {
	/**
	 * The relation name of the plain wikilink starting at `linkOffset`, or `undefined`
	 * when the text at that offset is not `[[` or no `<name>::` directly precedes it
	 * on the same line.
	 */
	static relationAt(text: string, linkOffset: number): string | undefined {
		if (!text.startsWith(WIKILINK_OPENER, linkOffset)) {
			return undefined;
		}
		// Only the current line can name the relation — a name never wraps across a
		// line break, so the look-back stops at the previous newline (or text start).
		const lineStart = text.lastIndexOf(LINE_BREAK, linkOffset - 1) + 1;
		const linePrefix = text.slice(lineStart, linkOffset);
		return RELATION_BEFORE_LINK_PATTERN.exec(linePrefix)?.[1];
	}
}
