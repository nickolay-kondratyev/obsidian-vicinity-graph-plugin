import type { LinkContextSnippet } from "./LinkContextSnippets";
import type { VaultPath } from "./types";

/**
 * One concrete appearance of a link inside a source note — the unit the
 * link-preview modal lists.
 *
 * `offset` is the character offset of the reference in the SOURCE file's text
 * (the metadata cache's `position.start.offset` coordinate space). It is `null`
 * — EXPLICITLY, not 0 — for the occurrences that have no markdown position:
 * canvas references, frontmatter (property) links, and every occurrence served
 * by the resolvedLinks-inversion backlink fallback. `context` is `null` exactly
 * when there is no position to extract it from (or the source text is
 * unreadable), so `offset === null` implies `context === null`.
 */
export interface LinkOccurrence {
	readonly offset: number | null;
	readonly context: LinkContextSnippet | null;
}

/** An occurrence of an OUTGOING reference: where it appears plus where it points. */
export interface OutgoingLinkOccurrence extends LinkOccurrence {
	readonly targetPath: VaultPath;
}

/** All occurrences of links FROM one source note TO the queried note, grouped. */
export interface BacklinkSourceOccurrences {
	readonly sourcePath: VaultPath;
	/** At least one entry — a source with zero occurrences is not a backlink source. */
	readonly occurrences: readonly LinkOccurrence[];
}

/**
 * Per-occurrence link data for the link-preview modal (parent ticket
 * `nid_tohotgq2s92dvd1iov1rd0umv_e`) — the occurrence-level companion of
 * {@link LinkProvider}, which deliberately dedupes to paths. Async, unlike
 * `LinkProvider`: answers include context snippets, and reading a note's text
 * (`cachedRead`) is async. A path unknown to the vault answers `[]`, never a
 * throw — a modal over a just-renamed note should render empty, not break.
 */
export interface LinkOccurrenceProvider {
	/** Outgoing link occurrences of `path`, in document order, duplicates kept. */
	outgoingOccurrences(path: VaultPath): Promise<readonly OutgoingLinkOccurrence[]>;
	/** Backlink occurrences of `path`, grouped by source note. */
	backlinkOccurrences(path: VaultPath): Promise<readonly BacklinkSourceOccurrences[]>;
	/** Occurrences of links `source` → `target` only (the edge-click modal's query). */
	occurrencesBetween(source: VaultPath, target: VaultPath): Promise<readonly LinkOccurrence[]>;
}
