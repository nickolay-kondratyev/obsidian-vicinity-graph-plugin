import type { SizingSettings } from "../engine";

/**
 * What the settings tab REFUSES to persist, and what it merely warns about —
 * decided here, as plain data-in/string-out, so the obsidian glue only renders the
 * result (the tab itself has no unit-test harness; this module does).
 *
 * Two different verdicts on purpose:
 * - **Sizing**: an inverted `maxPx < minPx` pair is REJECTED. Each field is inside
 *   its own spec bounds, so nothing downstream would notice, and the pair decides
 *   node GEOMETRY — persisting it silently is the bug this module closes.
 * - **Exclusion patterns**: an invalid line is only SURFACED, never rejected. The
 *   engine already skips uncompilable patterns (`PathExclusionMatcher`), and
 *   refusing the write would throw away the VALID lines typed in the same edit.
 */

/** One exclusion line that will never match anything, addressed as the user sees it. */
export interface InvalidExclusionPattern {
	/** 1-based line number in the textarea, blank lines included in the count. */
	readonly lineNumber: number;
	readonly pattern: string;
	/** The regex engine's own complaint — the detail that actually helps fix it. */
	readonly reason: string;
}

/** Inline feedback for one row: short visible copy plus a hover detail. */
export interface SettingsFeedback {
	readonly message: string;
	readonly detail: string;
}

/**
 * Textarea → pattern list: one pattern per line, trimmed, blank lines dropped.
 * WHY trim/drop: newline-delimited input inevitably carries a trailing blank line
 * and stray indentation; an empty regex matches everything, so keeping blanks would
 * silently exclude the whole vault. Invalid regexes are tolerated (engine skips them).
 */
export function parseExclusionPatterns(raw: string): readonly string[] {
	return numberedPatternLines(raw).map((line) => line.pattern);
}

/** Every non-blank line that fails to compile, in textarea order. */
export function invalidExclusionPatterns(raw: string): readonly InvalidExclusionPattern[] {
	const invalid: InvalidExclusionPattern[] = [];
	for (const { lineNumber, pattern } of numberedPatternLines(raw)) {
		const reason = compileFailure(pattern);
		if (reason !== undefined) {
			invalid.push({ lineNumber, pattern, reason });
		}
	}
	return invalid;
}

/** `undefined` when every line compiles — the row then shows no feedback at all. */
export function describeInvalidExclusionPatterns(raw: string): SettingsFeedback | undefined {
	const invalid = invalidExclusionPatterns(raw);
	if (invalid.length === 0) {
		return undefined;
	}
	return {
		message: invalid
			.map(({ lineNumber, pattern }) => `Line ${lineNumber}: "${pattern}" is not a valid regular expression — ignored.`)
			.join("\n"),
		detail: invalid.map(({ lineNumber, reason }) => `Line ${lineNumber}: ${reason}`).join("\n"),
	};
}

/**
 * `undefined` when `sizing` may be persisted. The ONE cross-field sizing rule:
 * `maxPx >= minPx`. Equal is allowed — that is a legitimate "every node the same
 * size" configuration, not an inversion.
 */
export function describeSizingRejection(sizing: SizingSettings): string | undefined {
	if (sizing.maxPx >= sizing.minPx) {
		return undefined;
	}
	return `Not applied: maximum node size (${sizing.maxPx}px) must be at least the minimum (${sizing.minPx}px).`;
}

/** Non-blank lines with the line number the user reads in the textarea (1-based). */
function numberedPatternLines(raw: string): readonly { lineNumber: number; pattern: string }[] {
	return raw
		.split("\n")
		.map((line, index) => ({ lineNumber: index + 1, pattern: line.trim() }))
		.filter(({ pattern }) => pattern.length > 0);
}

/** The regex engine's message when `pattern` does not compile, `undefined` when it does. */
function compileFailure(pattern: string): string | undefined {
	try {
		new RegExp(pattern);
		return undefined;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}
