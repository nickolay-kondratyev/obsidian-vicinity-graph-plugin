import type { LinkProvider } from "./LinkProvider";
import type { DirectedLink, GraphEdge } from "./types";

export interface EdgeCountsInput {
	/** BFS-walked edges already filtered to visible endpoints (truncator output). */
	readonly walkedVisibleEdges: readonly DirectedLink[];
	readonly provider: LinkProvider;
}

/**
 * An emitted edge proves at least one link was walked, so a provider answering 0
 * (momentary cache lag) is floored here — a defensive floor for an edge that
 * demonstrably exists, NOT a fabricated count.
 */
const MIN_EMITTED_EDGE_LINK_COUNT = 1;

/**
 * Turns the truncator's count-free walked pairs into output {@link GraphEdge}s,
 * attaching the per-pair link COUNT here (and only here): the provider is the
 * single multiplicity authority (see {@link LinkProvider.getLinkCount}), because
 * a multi-root walk revisits the same pair and so cannot tally it.
 *
 * WHICH links become edges is not a setting: only edges the BFS actually walked
 * render (human decision, step-02 CLARIFICATION Q5 — the cleaner graph to see),
 * so a link between two frontier nodes shows up only when the walk reached it.
 */
export class EdgeCounts {
	static attach(input: EdgeCountsInput): readonly GraphEdge[] {
		return input.walkedVisibleEdges.map(
			(pair): GraphEdge => ({
				...pair,
				count: Math.max(MIN_EMITTED_EDGE_LINK_COUNT, input.provider.getLinkCount(pair.source, pair.target)),
			}),
		);
	}
}
