import type { LinkContextSnippet } from "./LinkContextSnippets";
import type { VaultPath } from "./types";

/**
 * One concrete appearance of a link inside a source note — the unit the
 * link-preview drawer lists.
 *
 * `offset` is the character offset of the reference in the SOURCE file's text
 * (the metadata cache's `position.start.offset` coordinate space). It is `null`
 * — EXPLICITLY, not 0 — for the occurrences that have no markdown position:
 * canvas references and frontmatter (property) links. `context` is `null`
 * exactly when there is no position to extract it from (or the source text is
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

/**
 * Per-occurrence link data for the EDGE-click preview drawer (parent ticket
 * `nid_tohotgq2s92dvd1iov1rd0umv_e`) — the occurrence-level companion of
 * {@link LinkProvider}, which deliberately dedupes to paths. Async, unlike
 * `LinkProvider`: answers include context snippets, and reading a note's text
 * (`cachedRead`) is async. A path unknown to the vault answers `[]`, never a
 * throw — a drawer over a just-renamed note should render empty, not break.
 */
export interface LinkOccurrenceProvider {
	/** Occurrences of links `source` → `target` only (the edge-click drawer's query). */
	occurrencesBetween(source: VaultPath, target: VaultPath): Promise<readonly LinkOccurrence[]>;
}
