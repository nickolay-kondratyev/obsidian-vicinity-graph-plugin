import type { VaultPath } from "./types";

/**
 * The engine seam for the NAMED-RELATIONSHIP data that cannot ride the
 * {@link import("./LinkProvider").LinkProvider} outgoing-reference stream (feature
 * `named-relationships`, plan ticket `nid_fg66tanwkoyq3cqs1wdxagn21_e`).
 *
 * The LABEL half of a named relationship DOES ride `LinkProvider` — a named link is
 * still a link, so the adapter merges the label onto the very reference the plain
 * link produces ({@link import("./LinkProvider").OutgoingReference.relations}). This
 * port carries the ONE thing that reference cannot: the REL-NOTE fold.
 *
 * ## Rel-note folding (per-occurrence accounting)
 * In `[[he supports]]::[[x]]` the NAME is itself a note link. Obsidian indexes that
 * `[[he supports]]` as an ordinary outgoing link of the source — a DIFFERENT target
 * (`he supports`) than the statement's target (`x`). Left alone, the rel note would
 * be discovered as a neighbor via the very occurrence that named a relationship,
 * then stranded as an orphan or given a count-0 edge. So the rel-note NAME
 * occurrence is FOLDED out of the plain link stream (see
 * {@link import("./RelationFoldingLinkProvider").RelationFoldingLinkProvider}, the one
 * choke point both traversal discovery and edge assembly consume). The subtraction
 * is PER-OCCURRENCE: a rel note that ALSO has other, non-relationship links in the
 * source keeps those — it still renders as a normal node there, and those links
 * still count.
 *
 * OCP seam like `LinkProvider`: the adapter implements it from the pure parser's
 * output resolved against the vault; the engine and its `Fake*` never parse.
 * Synchronous by the same contract (adapters index up-front, answer queries sync).
 */
export interface RelationProvider {
	/**
	 * The rel-note NAME targets referenced from `source`, ONE entry PER STATEMENT
	 * OCCURRENCE (two statements naming the same rel note yield two entries) — each the
	 * `[[he supports]]` of a `[[he supports]]::[[target]]` statement, RESOLVED to the note
	 * it names. This is the per-occurrence quantity the folding choke point subtracts from
	 * the plain link stream. A source with no rel-note statements answers `[]`; a target
	 * unknown to the vault answers `[]`, never a throw.
	 */
	relNoteFolds(source: VaultPath): readonly VaultPath[];
}
