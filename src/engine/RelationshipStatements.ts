/**
 * THE pure parse of NAMED-RELATIONSHIP statements out of raw markdown text —
 * `supports::[[note2]]` and its bracketed / rel-note / wrapped variants
 * (feature `named-relationships`, plan ticket `nid_fg66tanwkoyq3cqs1wdxagn21_e`).
 *
 * A named relationship is a labeled directed edge written with Dataview-style
 * inline-field syntax: a NAME, then `::`, then a comma-separated run of link
 * targets. The de-facto typed-link convention across Breadcrumbs / ExcaliBrain /
 * Juggl, so existing typed vaults parse with zero rewriting.
 *
 * Pure engine module: imports only `../shared/` (import-guarded like the rest of
 * the engine — no obsidian / stable-ids / react). Obsidian's metadataCache
 * carries no `::` prefixes, so the raw markdown must be parsed; this is where
 * that happens, once, for every consumer.
 *
 * ## Precedence at each `::` (by LEFT context, decided in the plan)
 *  1. Text before `::` ends with `]]` → REL-NOTE form: `[[he supports]]::[[x]]`
 *     — the name IS a note link (label = alias else basename). WRAPPED variant:
 *     if a `[…]`/`(…)` wrapper opener sits to the left separated from the
 *     rel-note link by WHITESPACE ONLY, the statement takes the bracketed
 *     EXTENT (runs to the closer, consumes it, captures a qualifier). PROSE
 *     between opener and link disqualifies the wrapper → plain rel-note.
 *  2. An unclosed `[…]`/`(…)` wrapper encloses the `::` → BRACKETED form:
 *     `[he supports:: [[x]]]` — name = trimmed text between opener and `::`;
 *     statement runs to the wrapper's closer; text between the target run and
 *     the closer is the QUALIFIER (plain text — links in it stay plain).
 *  3. Else → BARE form: name = the longest `[A-Za-z0-9_-]` run immediately
 *     before `::` (stops at punctuation); surrounding prose ignored.
 *
 * ## Shared rules
 *  - NO whitespace immediately before `::` in EVERY form (stricter than
 *    Dataview — signed off). Optional whitespace after.
 *  - Targets = greedy comma-separated run of `[[link]]`/`![[embed]]` tokens,
 *    stopping at the first non-link/non-comma token. Embeds keep an `isEmbed`
 *    flag. A statement needs at least one target; anything else yields NOTHING
 *    (its links degrade to plain cache edges elsewhere — never guess).
 *  - Qualifiers exist ONLY in wrapped forms (bare / plain rel-note have no
 *    terminator; greedy unbracketed matching is Dataview's most-complained-about
 *    behavior, deliberately refused).
 *
 * ## Masking (offsets stay FILE offsets)
 * Statements inside CODE REGIONS (fenced blocks + inline code) and the leading
 * FRONTMATTER block are NOT statements: core indexes no links there, and
 * frontmatter relations have their own dedicated source. Both are blanked to
 * SAME-LENGTH spaces before scanning (via {@link MarkdownCodeRegions} plus the
 * local frontmatter mask), so every reported offset indexes the ORIGINAL text —
 * and all extracted TEXT is sliced from the original, so a link inside a
 * qualifier survives its own inline-code masking untouched.
 */

import { MarkdownCodeRegions } from "../shared/MarkdownCodeRegions";
import { Wikilinks } from "../shared/Wikilinks";

/** A half-open `[start, end)` range of FILE offsets into the original text. */
export interface TextSpan {
	readonly start: number;
	readonly end: number;
}

/** One target of a statement: WHERE it points (link text, unresolved) and HOW. */
export interface RelationshipTarget {
	/** Link TEXT ready for Obsidian's own resolution — never a resolved path. */
	readonly linkText: string;
	/** `![[x]]` vs `[[x]]`; the edge's displayed kind stays `embed` when true. */
	readonly isEmbed: boolean;
}

/**
 * The name half of a statement, either PLAIN text (bare/bracketed forms) or a
 * REL-NOTE link whose occurrence folds into the edge.
 */
export type RelationshipName =
	| { readonly kind: "text"; readonly text: string }
	| {
			readonly kind: "rel-note";
			/** The rel note's link text (target only), for resolution + flyout link. */
			readonly linkText: string;
			/** What the edge shows: the alias if written, else the target's basename. */
			readonly label: string;
			/** Offsets of the `[[he supports]]` occurrence — folds out of the graph here. */
			readonly occurrence: TextSpan;
	  };

/** One parsed named-relationship statement. */
export interface RelationshipStatement {
	readonly name: RelationshipName;
	/** Ordered targets, at least one (a target-less match is not a statement). */
	readonly targets: readonly RelationshipTarget[];
	/**
	 * The wrapped forms' trailing qualifier (trimmed, possibly `""`); `null` for
	 * the unwrapped forms, which have no terminator and so no qualifier.
	 */
	readonly qualifier: string | null;
	/** Offsets of the WHOLE statement (a wrapped form includes its closer). */
	readonly span: TextSpan;
}

const FIELD_MARKER = "::";
/** The bare form's name alphabet — a run of these immediately before `::`. */
const BARE_NAME_CHAR = /[A-Za-z0-9_-]/;
/** A frontmatter fence line: `---` (opener) or `---`/`...` (closer), alone on its line. */
const FRONTMATTER_OPENER = /^---[ \t]*\r?$/;
const FRONTMATTER_CLOSER = /^(?:---|\.\.\.)[ \t]*\r?$/;

/** A wikilink/embed token located in the text: its bounds and inner-text bounds. */
interface WikilinkToken {
	/** Offset of the leading `!` (embed) or the first `[`. */
	readonly start: number;
	/** Offset just past the closing `]]`. */
	readonly end: number;
	readonly innerStart: number;
	readonly innerEnd: number;
	readonly isEmbed: boolean;
}

/** The targets found after a `::`, plus where their run ENDS (qualifiers begin there). */
interface TargetRun {
	readonly targets: readonly RelationshipTarget[];
	readonly runEnd: number;
}

export class RelationshipStatements {
	/**
	 * Every named-relationship statement in `text`, in written order. Offsets on
	 * the results index `text` directly (masking is same-length). Text with no
	 * recognizable statement yields `[]`.
	 */
	static parse(text: string): readonly RelationshipStatement[] {
		const masked = MarkdownCodeRegions.withCodeMasked(RelationshipStatements.frontmatterMasked(text));
		const statements: RelationshipStatement[] = [];
		let index = masked.indexOf(FIELD_MARKER);
		while (index !== -1) {
			const statement = RelationshipStatements.statementAt(text, masked, index);
			if (statement !== null) {
				statements.push(statement);
			}
			// Advance PAST the `::` — a `::` never overlaps another, and re-scanning
			// its second colon would only re-fail.
			index = masked.indexOf(FIELD_MARKER, index + FIELD_MARKER.length);
		}
		return statements;
	}

	/**
	 * The statement anchored at the `::` starting at `markerIndex`, or `null` if
	 * that `::` heads no statement. Reads STRUCTURE off `masked` (code/frontmatter
	 * blanked) and CONTENT off the original `text`.
	 */
	private static statementAt(text: string, masked: string, markerIndex: number): RelationshipStatement | null {
		// Whitespace immediately before `::` disqualifies EVERY form (signed off).
		if (markerIndex === 0 || /\s/.test(masked[markerIndex - 1] ?? "")) {
			return null;
		}
		const relNote = RelationshipStatements.relNoteLinkEndingAt(masked, markerIndex);
		if (relNote !== null) {
			return RelationshipStatements.relNoteStatement(text, masked, markerIndex, relNote);
		}
		const opener = RelationshipStatements.enclosingWrapperOpener(masked, markerIndex);
		if (opener !== null) {
			return RelationshipStatements.bracketedStatement(text, masked, markerIndex, opener);
		}
		return RelationshipStatements.bareStatement(text, masked, markerIndex);
	}

	// --- Rel-note form (precedence 1) --------------------------------------

	private static relNoteStatement(
		text: string,
		masked: string,
		markerIndex: number,
		link: WikilinkToken,
	): RelationshipStatement | null {
		const parts = Wikilinks.partsOf(text.slice(link.innerStart, link.innerEnd));
		// A pure-subpath / alias-only link (`[[#h]]`, `[[|a]]`) names no note, so it
		// heads no rel-note statement — matching relNoteLinkEndingAt's contract.
		if (parts.target === "") {
			return null;
		}
		const run = RelationshipStatements.targetRun(text, masked, markerIndex + FIELD_MARKER.length);
		if (run.targets.length === 0) {
			return null;
		}
		const name: RelationshipName = {
			kind: "rel-note",
			linkText: parts.target,
			label: parts.alias !== "" ? parts.alias : RelationshipStatements.basenameOf(parts.target),
			occurrence: { start: link.start, end: markerIndex },
		};
		// WRAPPED rel-note: a `[`/`(` opener separated from the link by WHITESPACE
		// ONLY lends the statement the bracketed extent + qualifier. Prose in that
		// gap (or no opener) leaves a PLAIN rel-note whose trailing text is ignored.
		const wrapper = RelationshipStatements.whitespaceOnlyWrapperOpener(masked, link.start);
		if (wrapper !== null) {
			const closer = RelationshipStatements.matchingCloser(masked, wrapper);
			if (closer !== null && closer >= run.runEnd) {
				return {
					name,
					targets: run.targets,
					qualifier: text.slice(run.runEnd, closer).trim(),
					span: { start: wrapper, end: closer + 1 },
				};
			}
		}
		return { name, targets: run.targets, qualifier: null, span: { start: link.start, end: run.runEnd } };
	}

	/**
	 * The wikilink `[[…]]` (optionally `![[…]]`) whose closing `]]` ends exactly at
	 * `markerIndex`, or `null` if the text before `::` is not such a link. The link
	 * must carry a resolvable target — a pure-subpath `[[#h]]::` names no note.
	 */
	private static relNoteLinkEndingAt(masked: string, markerIndex: number): WikilinkToken | null {
		if (masked[markerIndex - 1] !== "]" || masked[markerIndex - 2] !== "]") {
			return null;
		}
		const innerEnd = markerIndex - 2;
		for (let k = innerEnd - 1; k >= 1; k -= 1) {
			const c = masked[k];
			// A newline or a stray `]` before the opener means this is no simple link.
			if (c === "\n" || c === "]") {
				return null;
			}
			if (c === "[" && masked[k - 1] === "[") {
				const isEmbed = masked[k - 2] === "!";
				const token: WikilinkToken = {
					start: isEmbed ? k - 2 : k - 1,
					end: markerIndex,
					innerStart: k + 1,
					innerEnd,
					isEmbed,
				};
				return innerEnd > token.innerStart ? token : null;
			}
		}
		return null;
	}

	/**
	 * The `[`/`(` offset when scanning left from `linkStart` crosses ONLY
	 * whitespace before reaching a wrapper opener, else `null`. Whitespace-only is
	 * the wrapped rel-note's gate; any prose (or a boundary) fails it.
	 */
	private static whitespaceOnlyWrapperOpener(masked: string, linkStart: number): number | null {
		let k = linkStart - 1;
		while (k >= 0 && /[ \t]/.test(masked[k] ?? "")) {
			k -= 1;
		}
		if (k < 0) {
			return null;
		}
		const c = masked[k];
		return c === "[" || c === "(" ? k : null;
	}

	// --- Bracketed form (precedence 2) -------------------------------------

	private static bracketedStatement(
		text: string,
		masked: string,
		markerIndex: number,
		opener: number,
	): RelationshipStatement | null {
		const rawName = text.slice(opener + 1, markerIndex).trim();
		if (rawName === "") {
			return null;
		}
		const run = RelationshipStatements.targetRun(text, masked, markerIndex + FIELD_MARKER.length);
		if (run.targets.length === 0) {
			return null;
		}
		const name: RelationshipName = { kind: "text", text: rawName };
		const closer = RelationshipStatements.matchingCloser(masked, opener);
		if (closer !== null && closer >= run.runEnd) {
			return {
				name,
				targets: run.targets,
				qualifier: text.slice(run.runEnd, closer).trim(),
				span: { start: opener, end: closer + 1 },
			};
		}
		// Opener with no closer on its line: no terminator, so no qualifier —
		// degrade to the run's extent rather than swallow the rest of the line.
		return { name, targets: run.targets, qualifier: null, span: { start: opener, end: run.runEnd } };
	}

	/**
	 * The offset of the innermost UNCLOSED `[`/`(` to the left of `markerIndex` on
	 * the same line, or `null` when none encloses it. A closer (`]`/`)`) first
	 * means the `::` sits outside any open wrapper (→ bare form).
	 */
	private static enclosingWrapperOpener(masked: string, markerIndex: number): number | null {
		for (let k = markerIndex - 1; k >= 0; k -= 1) {
			const c = masked[k];
			if (c === "\n") {
				return null;
			}
			if (c === "]" || c === ")") {
				return null;
			}
			if (c === "[" || c === "(") {
				return k;
			}
		}
		return null;
	}

	// --- Bare form (precedence 3) ------------------------------------------

	private static bareStatement(text: string, masked: string, markerIndex: number): RelationshipStatement | null {
		let start = markerIndex;
		while (start > 0 && BARE_NAME_CHAR.test(masked[start - 1] ?? "")) {
			start -= 1;
		}
		if (start === markerIndex) {
			return null;
		}
		const run = RelationshipStatements.targetRun(text, masked, markerIndex + FIELD_MARKER.length);
		if (run.targets.length === 0) {
			return null;
		}
		return {
			name: { kind: "text", text: text.slice(start, markerIndex) },
			targets: run.targets,
			qualifier: null,
			span: { start, end: run.runEnd },
		};
	}

	// --- Targets + shared helpers ------------------------------------------

	/**
	 * The comma-separated run of link/embed targets starting at `from` (after the
	 * `::`), skipping optional whitespace. Stops at the first token that is not a
	 * link or a separating comma; `runEnd` is the offset just past the LAST target
	 * (a trailing comma is not part of it, so it falls into a wrapper's qualifier).
	 */
	private static targetRun(text: string, masked: string, from: number): TargetRun {
		const targets: RelationshipTarget[] = [];
		let pos = RelationshipStatements.skipInlineWhitespace(masked, from);
		let runEnd = pos;
		for (;;) {
			const token = RelationshipStatements.wikilinkTokenAt(masked, pos);
			if (token === null) {
				break;
			}
			const linkText = Wikilinks.partsOf(text.slice(token.innerStart, token.innerEnd)).target;
			if (linkText === "") {
				break;
			}
			targets.push({ linkText, isEmbed: token.isEmbed });
			runEnd = token.end;
			const afterComma = RelationshipStatements.skipInlineWhitespace(masked, token.end);
			if (masked[afterComma] !== ",") {
				break;
			}
			pos = RelationshipStatements.skipInlineWhitespace(masked, afterComma + 1);
		}
		return { targets, runEnd };
	}

	/** A wikilink/embed token starting exactly at `pos`, or `null`. */
	private static wikilinkTokenAt(masked: string, pos: number): WikilinkToken | null {
		let p = pos;
		const isEmbed = masked[p] === "!";
		if (isEmbed) {
			p += 1;
		}
		if (masked[p] !== "[" || masked[p + 1] !== "[") {
			return null;
		}
		const innerStart = p + 2;
		for (let q = innerStart; q < masked.length; q += 1) {
			const c = masked[q];
			if (c === "\n") {
				return null;
			}
			if (c === "]") {
				if (masked[q + 1] !== "]") {
					return null;
				}
				return { start: pos, end: q + 2, innerStart, innerEnd: q, isEmbed };
			}
		}
		return null;
	}

	/**
	 * The offset of the bracket matching the opener at `openerIndex`, counting
	 * only that opener's own bracket type (so a nested `[[x]]` inside a `[…]`
	 * wrapper balances), or `null` if it never closes on the line.
	 */
	private static matchingCloser(masked: string, openerIndex: number): number | null {
		const open = masked[openerIndex];
		const close = open === "[" ? "]" : ")";
		let depth = 0;
		for (let k = openerIndex; k < masked.length; k += 1) {
			const c = masked[k];
			if (c === "\n") {
				return null;
			}
			if (c === open) {
				depth += 1;
			} else if (c === close) {
				depth -= 1;
				if (depth === 0) {
					return k;
				}
			}
		}
		return null;
	}

	private static skipInlineWhitespace(masked: string, from: number): number {
		let pos = from;
		while (pos < masked.length && /[ \t]/.test(masked[pos] ?? "")) {
			pos += 1;
		}
		return pos;
	}

	private static basenameOf(linkText: string): string {
		const slash = linkText.lastIndexOf("/");
		return slash === -1 ? linkText : linkText.slice(slash + 1);
	}

	/**
	 * `text` with its leading YAML FRONTMATTER block blanked to same-length spaces
	 * (newlines preserved), so a `::` inside it is not scanned — frontmatter
	 * relations have their own dedicated source (`frontmatterLinks`). An
	 * unterminated block is not frontmatter (Obsidian agrees) and is left as-is.
	 *
	 * A small honest scanner, NOT a YAML parser: the opener must be `---` alone on
	 * the very first line, the closer the first later `---`/`...` line.
	 */
	private static frontmatterMasked(text: string): string {
		const lines = text.split("\n");
		if (lines.length === 0 || !FRONTMATTER_OPENER.test(lines[0] ?? "")) {
			return text;
		}
		for (let i = 1; i < lines.length; i += 1) {
			if (FRONTMATTER_CLOSER.test(lines[i] ?? "")) {
				const masked = lines.map((line, index) => (index <= i ? " ".repeat(line.length) : line));
				return masked.join("\n");
			}
		}
		return text;
	}
}
