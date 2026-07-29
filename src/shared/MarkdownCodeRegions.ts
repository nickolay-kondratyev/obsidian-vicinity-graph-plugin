/**
 * Where markdown says "this is CODE, not prose" — fenced blocks and inline code
 * spans — blanked out so link matchers never harvest what a reader sees as
 * sample text.
 *
 * A PRE-PASS rather than code awareness inside {@link Wikilinks} /
 * {@link MarkdownInlineLinks}: those matchers are also used to strip markup for
 * DISPLAY (`view/outlineEntryLabel`), where a `` `[[x]]` `` in a heading must
 * still render its label. Keeping the masking outside them preserves their
 * "small honest matcher" contract and confines the blast radius to the one call
 * site that wants it — canvas text-node harvesting
 * (`adapters/CanvasFallbackParser`), whose whole job is to agree with what
 * Obsidian core indexes. Core skips code regions (measured by
 * `e2e/canvasMarkdownLinkIndexing.e2e.ts`); now so does the fallback.
 *
 * Masking to SPACES, never deletion: offsets are preserved so no text on either
 * side of a span can fuse into a pseudo-link it never was.
 *
 * A small honest scanner, NOT a markdown parser. DELIBERATELY NOT HANDLED:
 * indented (4-space) code blocks — they need block context, since list
 * continuations indent too; escaped backticks; `%%comments%%`, frontmatter and
 * HTML blocks. Code spans are scanned PER LINE, so a CommonMark span that
 * crosses a newline leaves its interior lines unmasked — vanishingly rare in a
 * canvas text node, and chasing it is what turns this into a parser.
 */

/** Opens a fenced block: up to three spaces of indent, then three-plus backticks or tildes. */
const FENCE_OPENER = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Closes a fenced block: same shape as an opener but with NOTHING after the run
 * except trailing whitespace — CommonMark gives a CLOSING fence no info string,
 * so a "```ts" line inside an open fence is content, not a closer.
 */
const FENCE_CLOSER = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

const BACKTICK = "`";

export class MarkdownCodeRegions {
	/**
	 * `text` with every fenced-block and inline-code-span region replaced by
	 * same-length runs of spaces; every other character, and every offset, is
	 * left exactly as written.
	 */
	static withCodeMasked(text: string): string {
		const masked: string[] = [];
		let openFence: string | null = null;
		for (const line of text.split("\n")) {
			if (openFence !== null) {
				if (MarkdownCodeRegions.closesFence(line, openFence)) {
					openFence = null;
				}
				masked.push(MarkdownCodeRegions.blanked(line));
				continue;
			}
			const opener = MarkdownCodeRegions.fenceOpenerOf(line);
			if (opener !== null) {
				openFence = opener;
				masked.push(MarkdownCodeRegions.blanked(line));
				continue;
			}
			masked.push(MarkdownCodeRegions.withSpansMasked(line));
		}
		// An unclosed fence needs no epilogue: `openFence` simply stayed set, so
		// every remaining line was masked as we went (CommonMark: the fence runs
		// to the end of the document).
		return masked.join("\n");
	}

	/**
	 * The fence run this line opens, or `null` if it opens none. Beyond the
	 * {@link FENCE_OPENER} shape, a BACKTICK fence's info string may not contain
	 * a backtick (CommonMark) — "```cmd``` prose" is an inline code span, and
	 * treating it as an opener would swallow every following line. Tilde info
	 * strings carry no such rule.
	 */
	private static fenceOpenerOf(line: string): string | null {
		const match = FENCE_OPENER.exec(line);
		if (match === null) {
			return null;
		}
		const opener = match[1] as string;
		const infoString = line.slice(match[0].length);
		if (opener[0] === BACKTICK && infoString.includes(BACKTICK)) {
			return null;
		}
		return opener;
	}

	/** A closer is the same fence character, at least as long, with nothing but whitespace after it. */
	private static closesFence(line: string, openFence: string): boolean {
		const closer = FENCE_CLOSER.exec(line)?.[1];
		return closer !== undefined && closer[0] === openFence[0] && closer.length >= openFence.length;
	}

	/**
	 * Hand-rolled rather than a `` /(`+)(.*?)\1(?!`)/ `` one-liner: that regex
	 * backtracks into the wrong pairing on `` ``a`b`` `` — a span opened by N
	 * backticks closes only on a run of EXACTLY N.
	 */
	private static withSpansMasked(line: string): string {
		let result = "";
		let index = 0;
		while (index < line.length) {
			if (line[index] !== BACKTICK) {
				result += line[index];
				index += 1;
				continue;
			}
			const opener = MarkdownCodeRegions.backtickRunLengthAt(line, index);
			const closerStart = MarkdownCodeRegions.closerStartAfter(line, index + opener, opener);
			if (closerStart === null) {
				// No matching run: the backticks are literal text, and scanning resumes
				// after them so a LATER pair on the same line can still form a span.
				result += line.slice(index, index + opener);
				index += opener;
				continue;
			}
			const spanEnd = closerStart + opener;
			result += MarkdownCodeRegions.blanked(line.slice(index, spanEnd));
			index = spanEnd;
		}
		return result;
	}

	/** Start offset of the next backtick run of EXACTLY `length`, or `null` if the line holds none. */
	private static closerStartAfter(line: string, from: number, length: number): number | null {
		let index = from;
		while (index < line.length) {
			if (line[index] !== BACKTICK) {
				index += 1;
				continue;
			}
			const run = MarkdownCodeRegions.backtickRunLengthAt(line, index);
			if (run === length) {
				return index;
			}
			index += run;
		}
		return null;
	}

	private static backtickRunLengthAt(line: string, start: number): number {
		let end = start;
		while (line[end] === BACKTICK) {
			end += 1;
		}
		return end - start;
	}

	private static blanked(region: string): string {
		return " ".repeat(region.length);
	}
}
