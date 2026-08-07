import type { LinkProvider, OutgoingReference } from "./LinkProvider";
import type { DirectedLink, EdgeKind, GraphEdge, VaultPath } from "./types";

export interface EdgeAssemblyInput {
	/**
	 * The pairs this graph renders, already filtered to visible endpoints: the
	 * truncator's walked set, or the induced sweep when cross links are on.
	 */
	readonly visibleEdges: readonly DirectedLink[];
	readonly provider: LinkProvider;
}

/**
 * An emitted edge proves at least one link was walked or swept, so a provider answering 0
 * (momentary cache lag) is floored here — a defensive floor for an edge that
 * demonstrably exists, NOT a fabricated count.
 */
const MIN_EMITTED_EDGE_LINK_COUNT = 1;

/**
 * Turns count-free visible pairs into output {@link GraphEdge}s, attaching the
 * per-pair link COUNT and relationship KIND here (and only here): the provider is
 * the single per-pair truth authority (see {@link LinkProvider.getLinkCount}),
 * because a multi-root walk revisits the same pair and so cannot tally it — and
 * cannot summarise its kinds either (the incoming channel is kind-blind, and a
 * cross-link-swept pair was never walked at all).
 *
 * WHICH links become edges is a SETTING — {@link import("./types").ViewSettings.showCrossLinks}
 * (default OFF, i.e. the walked-only graph of step-02 CLARIFICATION Q5, "the cleaner
 * graph"). ON adds every link between two visible nodes
 * ({@link import("./CrossLinkSweep").CrossLinkSweep}). That choice is made ONCE, in
 * {@link import("./VicinityEngine").VicinityEngine}, and this stage treats both origins
 * IDENTICALLY: a cross link is counted, kinded and badged exactly like a walked one,
 * with no provenance flag for the view to style differently.
 *
 * The same source reference list also yields {@link GraphEdge.embedOrder} — the
 * per-source embed position the view nests embedded children by (embed-nesting
 * P1) — so ONE fetch per source serves count-neutral kind AND order.
 */
export class EdgeAssembly {
	static attach(input: EdgeAssemblyInput): readonly GraphEdge[] {
		// One reference-list fetch per distinct source, not per edge.
		const referencesBySource = new Map<VaultPath, readonly OutgoingReference[]>();
		const referencesOf = (source: VaultPath): readonly OutgoingReference[] => {
			const cached = referencesBySource.get(source);
			if (cached !== undefined) {
				return cached;
			}
			const fetched = input.provider.getOutgoingReferences(source);
			referencesBySource.set(source, fetched);
			return fetched;
		};
		return input.visibleEdges.map((pair): GraphEdge => {
			const references = referencesOf(pair.source);
			const embedOrder = EdgeAssembly.embedOrderOf(references, pair.target);
			return {
				...pair,
				count: Math.max(MIN_EMITTED_EDGE_LINK_COUNT, input.provider.getLinkCount(pair.source, pair.target)),
				kind: EdgeAssembly.kindOf(references, pair.target),
				// Present iff the pair carries an embed reference — i.e. kind embed|both.
				...(embedOrder !== undefined ? { embedOrder } : {}),
			};
		});
	}

	/**
	 * The 0-based position of the FIRST embed reference `source → target` within
	 * `references`'s embed references, or `undefined` when the pair has none (a
	 * plain-link or reference-less pair). The list is already deduped per
	 * (target, kind), so the embed-kind slice holds each target once in reference
	 * order — the index IS the embed order that survives dedup. Feeds
	 * {@link GraphEdge.embedOrder}; the view nests embedded children by it.
	 */
	private static embedOrderOf(references: readonly OutgoingReference[], target: VaultPath): number | undefined {
		const position = references
			.filter((reference) => reference.kind === "embed")
			.findIndex((reference) => reference.target === target);
		return position >= 0 ? position : undefined;
	}

	/**
	 * The pair's {@link EdgeKind} SUMMARY, decided deliberately from the source's
	 * whole reference list — never by whichever kind a walk happened to see first.
	 * A pair the provider reports NO reference for (the same momentary lag the
	 * count floor covers, e.g. a backlink-only truth during Obsidian's boot window)
	 * falls back to `"link"`, the neutral default.
	 */
	private static kindOf(references: readonly OutgoingReference[], target: VaultPath): EdgeKind {
		const kinds = new Set(
			references.filter((reference) => reference.target === target).map((reference) => reference.kind),
		);
		if (kinds.has("embed")) {
			return kinds.has("link") ? "both" : "embed";
		}
		return "link";
	}
}
