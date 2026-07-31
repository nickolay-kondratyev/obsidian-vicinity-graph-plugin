/**
 * Context lines shown ABOVE and BELOW the occurrence line in the expanded
 * snippet (link-preview design: "surrounding ±N lines").
 */
export const EXPANDED_CONTEXT_LINES_EACH_SIDE = 2;

/**
 * The two context views of one link occurrence inside a note's text — what the
 * link-preview modal renders next to the occurrence.
 */
export interface LinkContextSnippet {
	/** The trimmed line containing the occurrence. */
	readonly shortContext: string;
	/**
	 * The occurrence line with {@link EXPANDED_CONTEXT_LINES_EACH_SIDE} raw
	 * neighbouring lines each side, newline-joined, trimmed at the ends.
	 */
	readonly expandedContext: string;
	/**
	 * 0-based index of the occurrence line in the source file — the editor's
	 * `eState.line` coordinate, so the modal's GO navigation lands on the line
	 * the snippet came from without re-reading the file.
	 */
	readonly line: number;
}

/**
 * Pure snippet extraction: file text + character offset → context views. The
 * offset is the SAME coordinate space as the metadata cache's
 * `position.start.offset` (see `adapters/ReferenceOrder.ts`), which is exactly
 * what the occurrence layer hands over. Adapter-side text reading (cachedRead)
 * stays out of here — this module never does IO.
 */
export class LinkContextSnippets {
	/**
	 * The snippet around `offset` in `fileText`. An offset outside the text
	 * (stale cache vs. current text) clamps to the nearest end — a slightly-off
	 * snippet beats a throw in a preview surface.
	 */
	static snippetAt(fileText: string, offset: number): LinkContextSnippet {
		const lines = fileText.split("\n");
		const lineIndex = LinkContextSnippets.lineIndexAt(lines, offset);
		const firstLine = Math.max(0, lineIndex - EXPANDED_CONTEXT_LINES_EACH_SIDE);
		const lastLine = Math.min(lines.length - 1, lineIndex + EXPANDED_CONTEXT_LINES_EACH_SIDE);
		return {
			shortContext: (lines[lineIndex] ?? "").trim(),
			expandedContext: lines.slice(firstLine, lastLine + 1).join("\n").trim(),
			line: lineIndex,
		};
	}

	/** Index of the line whose character range contains `offset` (clamped to the text). */
	private static lineIndexAt(lines: readonly string[], offset: number): number {
		let lineStart = 0;
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index] ?? "";
			// +1 covers the newline the split removed; the final line has no newline,
			// so an offset at (or past) the end of the text lands on it via the fallthrough.
			if (offset < lineStart + line.length + 1) {
				return index;
			}
			lineStart += line.length + 1;
		}
		return Math.max(0, lines.length - 1);
	}
}
