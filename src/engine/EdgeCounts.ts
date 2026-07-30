import type { LinkProvider } from "./LinkProvider";
import type { DirectedLink, GraphEdge } from "./types";

export interface EdgeCountsInput {
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
 * per-pair link COUNT here (and only here): the provider is the single multiplicity
 * authority (see {@link LinkProvider.getLinkCount}), because a multi-root walk
 * revisits the same pair and so cannot tally it.
 *
 * WHICH links become edges is a SETTING — {@link import("./types").ViewSettings.showCrossLinks}
 * (default OFF, i.e. the walked-only graph of step-02 CLARIFICATION Q5, "the cleaner
 * graph"). ON adds every link between two visible nodes
 * ({@link import("./CrossLinkSweep").CrossLinkSweep}). That choice is made ONCE, in
 * {@link import("./VicinityEngine").VicinityEngine}, and this stage treats both kinds
 * IDENTICALLY: a cross link is counted, rendered and badged exactly like a walked one,
 * with no provenance flag for the view to style differently.
 */
export class EdgeCounts {
	static attach(input: EdgeCountsInput): readonly GraphEdge[] {
		return input.visibleEdges.map(
			(pair): GraphEdge => ({
				...pair,
				count: Math.max(MIN_EMITTED_EDGE_LINK_COUNT, input.provider.getLinkCount(pair.source, pair.target)),
			}),
		);
	}
}
