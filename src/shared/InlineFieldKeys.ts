/**
 * Which inline-field KEY (Dataview style, `some-rel:: [[target]]`) a link sits
 * in — the note-declared relationship name of the source → target edge (ticket
 * `nid_gk9h4jpa7di1al7och0rehd3h_e`). The caller passes WHERE the link starts
 * (Obsidian's link cache position), so link recognition and resolution stay
 * Obsidian's; this module only reads the text in front of the link.
 *
 * Recognised (the Dataview forms):
 * - a LINE field: `key::` at the start of the line, after optional indentation,
 *   blockquote `>` markers, a list marker (`-`, `*`, `+`, `1.`, `1)`) and a task
 *   box (`[ ]`). Its value runs to the end of the line.
 * - a BRACKETED field anywhere on the line: `[key:: …]` or `(key:: …)`. Its
 *   value runs to the matching close bracket.
 * Inside a field's value, every link takes the key — `rel:: [[a]], [[b]]` names
 * both — up to the next `key::` on the line, which takes over from there.
 *
 * A small honest matcher, not a markdown parser (same spirit as `Wikilinks`):
 * one left-to-right pass over ONE line. DELIBERATELY NOT HANDLED: keys with
 * spaces or emoji (Dataview allows them; a relationship name never needs them),
 * escaped brackets, and multi-line values.
 */

/**
 * WHAT: an inline-field key — one or more Unicode letters, digits, `-` or `_`.
 * Used with the `u` flag (for `\p{…}`).
 */
const INLINE_FIELD_KEY = "[\\p{L}\\p{N}_-]+";

/**
 * WHAT: a LINE field's prefix — indentation, any blockquote `>` markers, an
 * optional list marker (`-`/`*`/`+` or `12.`/`12)`) and an optional task box
 * (`[ ]`, `[x]`, …), then `key::`. Group 1 is the key.
 */
const LINE_FIELD_PREFIX = new RegExp(
	`^[ \\t]*(?:>[ \\t]*)*(?:(?:[-*+]|\\d+[.)])[ \\t]+)?(?:\\[.\\][ \\t]+)?(${INLINE_FIELD_KEY})::`,
	"u",
);

/**
 * WHAT: `key::` starting EXACTLY at `lastIndex` (sticky), after optional spaces
 * — the opener of a bracketed field (tried right after `[` / `(`) and a key
 * switch inside a value. Group 1 is the key.
 */
const FIELD_MARKER = new RegExp(`[ \\t]*(${INLINE_FIELD_KEY})::`, "uy");

const WIKILINK_OPEN = "[[";
const WIKILINK_CLOSE = "]]";
const CODE_SPAN_FENCE = "`";

/** The closing bracket of each bracket that can hold a field. */
const CLOSER_OF: Readonly<Record<string, string>> = { "[": "]", "(": ")" };

/** One open bracket level: what closes it, and the key its contents take. */
interface Frame {
	readonly closer: string | null;
	key: string | null;
}

export class InlineFieldKeys {
	/**
	 * The key of the inline field the link starting at `column` of `line` sits
	 * in, or `null` when the link is in no field.
	 */
	static keyAtColumn(line: string, column: number): string | null {
		const outer: Frame[] = [];
		let frame: Frame = { closer: null, key: null };
		let index = 0;
		const lineField = LINE_FIELD_PREFIX.exec(line);
		if (lineField !== null && lineField[0].length <= column) {
			frame.key = lineField[1] ?? null;
			index = lineField[0].length;
		}
		while (index < column) {
			// A wikilink's text and inline code never open, close or name a field.
			if (line.startsWith(WIKILINK_OPEN, index)) {
				index = InlineFieldKeys.indexAfter(line, WIKILINK_CLOSE, index + WIKILINK_OPEN.length);
				continue;
			}
			const char = line.charAt(index);
			if (char === CODE_SPAN_FENCE) {
				index = InlineFieldKeys.indexAfter(line, CODE_SPAN_FENCE, index + 1);
				continue;
			}
			const closer = CLOSER_OF[char];
			if (closer !== undefined) {
				const marker = InlineFieldKeys.markerAt(line, index + 1);
				outer.push(frame);
				// A bracket WITHOUT a key (a parenthetical, a markdown link label) is
				// still part of the enclosing value, so it inherits that key.
				frame = { closer, key: marker === null ? frame.key : marker.key };
				index = marker === null ? index + 1 : marker.end;
				continue;
			}
			if (char === frame.closer) {
				frame = outer.pop() ?? { closer: null, key: null };
				index += 1;
				continue;
			}
			// Only INSIDE a value does a `key::` take over; in prose it is just text.
			const marker = frame.key === null ? null : InlineFieldKeys.markerAt(line, index);
			if (marker !== null) {
				frame.key = marker.key;
				index = marker.end;
				continue;
			}
			index += 1;
		}
		return frame.key;
	}

	/**
	 * {@link keyAtColumn} for a link at character `offset` of a whole note's
	 * `text` — the metadata cache's `position.start.offset` coordinate space.
	 */
	static keyAtOffset(text: string, offset: number): string | null {
		const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
		const lineEnd = text.indexOf("\n", offset);
		const line = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
		return InlineFieldKeys.keyAtColumn(line, offset - lineStart);
	}

	/** The `key::` starting at `index` (after optional spaces), or null. */
	private static markerAt(line: string, index: number): { readonly key: string; readonly end: number } | null {
		FIELD_MARKER.lastIndex = index;
		const match = FIELD_MARKER.exec(line);
		const key = match?.[1];
		return key === undefined ? null : { key, end: FIELD_MARKER.lastIndex };
	}

	/** Index just past the next `token` at or after `from`; the line end when it never closes. */
	private static indexAfter(line: string, token: string, from: number): number {
		const found = line.indexOf(token, from);
		return found < 0 ? line.length : found + token.length;
	}
}
