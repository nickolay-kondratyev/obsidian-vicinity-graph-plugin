import { Tags } from "./Tags";
import type { Tag } from "./Tags";

/**
 * The characters a body hashtag may NOT contain — Obsidian 1.12's own tag token
 * class (its markdown tokenizer and tag suggester share it, verbatim): whitespace,
 * ASCII punctuation except `-` `_` `/`, and the Unicode general / supplemental
 * punctuation blocks. Re-check on an Obsidian bump, like `ObsidianTags`.
 */
const TAG_BODY = /^[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~[\]\\\s]+/;
/** Obsidian rejects an all-digit tag (`#123`); one non-digit makes it a tag. */
const HAS_NON_DIGIT = /[^0-9]/;
const WHITESPACE = /\s/;
const TAG_MARKER = "#";

/**
 * Obsidian's BODY hashtag grammar over a single line of text — what the editor's
 * right-click needs (the right-clicked line's rendered text, not the metadata
 * cache, which lags an unsaved edit). Pure: no `obsidian` import.
 *
 * CEILING: a line is read without its document context, so on its own a `#word`
 * inside an inline code span or a fenced code block counts as a tag. Its one
 * caller (`editorTagSiteOf`) only asks at an offset where the editor itself drew
 * a hashtag span — Obsidian's own tag detection, which skips code — so that false
 * positive never reaches the menu. A new caller without such a gate would need
 * `MarkdownCodeRegions` over the whole document.
 */
export class BodyHashtags {
	/**
	 * The tag whose text spans `offset` (from its `#` up to and including the
	 * position right after its last character — where a click on the tag's right
	 * edge puts the cursor); `undefined` when no tag does.
	 */
	static at(lineText: string, offset: number): Tag | undefined {
		for (let start = lineText.indexOf(TAG_MARKER); start !== -1; start = lineText.indexOf(TAG_MARKER, start + 1)) {
			const body = BodyHashtags.bodyAt(lineText, start);
			if (body === undefined) {
				continue;
			}
			const end = start + TAG_MARKER.length + body.length;
			if (offset >= start && offset <= end) {
				return Tags.parse(body);
			}
		}
		return undefined;
	}

	/** The tag body after the `#` at `start`, or `undefined` when that `#` opens no tag. */
	private static bodyAt(lineText: string, start: number): string | undefined {
		const before = lineText.charAt(start - 1);
		if (start > 0 && !WHITESPACE.test(before)) {
			return undefined;
		}
		const body = TAG_BODY.exec(lineText.slice(start + TAG_MARKER.length))?.[0];
		return body !== undefined && HAS_NON_DIGIT.test(body) ? body : undefined;
	}
}
