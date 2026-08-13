import type { LinkProvider, OutgoingReference } from "./LinkProvider";
import { directedLinkKey } from "./types";
import type { DirectedLink, EdgeKind, GraphEdge, VaultPath } from "./types";

export interface EdgeAssemblyInput {
	/**
	 * The pairs this graph renders, already filtered to visible endpoints: the
	 * truncator's walked set, or the induced sweep when cross links are on.
	 */
	readonly visibleEdges: readonly DirectedLink[];
	/**
	 * {@link directedLinkKey}s of the pairs carrying the folder-note HIERARCHY
	 * relation (from {@link import("./VicinityTraversal").TraversalResult}). A visible
	 * pair keyed here gets `hierarchy: true`; keyed here AND with no link occurrence
	 * it is a PURE hierarchy edge (`count: 0`). The cross-links sweep never adds to
	 * this set, so the folder relation stays invisible to it. Absent ⇒ no pair
	 * carries the folder relation (every edge is link-only).
	 */
	readonly hierarchyPairKeys?: ReadonlySet<string>;
	/**
	 * {@link directedLinkKey}s of the pairs walked over a LINK channel (from
	 * {@link import("./VicinityTraversal").TraversalResult}). A visible pair carries a
	 * LINK relation iff it is keyed here OR — when {@link crossLinksOn} — the provider
	 * reports a link for it. ABSENT ⇒ EVERY visible pair is a link (the pre-hierarchy
	 * world: no hierarchy set, so nothing to distinguish). Present WITHOUT a key means
	 * the pair is NOT a link — the choke that makes a pure hierarchy edge possible.
	 */
	readonly linkPairKeys?: ReadonlySet<string>;
	/**
	 * The cross-links sweep is on ({@link import("./types").ViewSettings.showCrossLinks}).
	 * With it on, {@link visibleEdges} is the induced subgraph, so a pair between two
	 * visible nodes that the provider reports a link for carries a link relation even
	 * if no LINK channel walked it — "every link between two visible nodes". Off ⇒ only
	 * the walked links ({@link linkPairKeys}) are link relations.
	 */
	readonly crossLinksOn?: boolean;
	readonly provider: LinkProvider;
}

/** Empty membership set for the {@link EdgeAssemblyInput.hierarchyPairKeys}-absent case. */
const NO_HIERARCHY_PAIRS: ReadonlySet<string> = new Set();

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
		const hierarchyPairKeys = input.hierarchyPairKeys ?? NO_HIERARCHY_PAIRS;
		const linkPairKeys = input.linkPairKeys;
		const crossLinksOn = input.crossLinksOn ?? false;
		return input.visibleEdges.map((pair): GraphEdge => {
			const key = directedLinkKey(pair.source, pair.target);
			const hierarchy = hierarchyPairKeys.has(key);
			const linkCount = input.provider.getLinkCount(pair.source, pair.target);
			// A pair carries a LINK relation if a link channel WALKED it, or — with the
			// cross-links sweep on — the provider reports a link between the two visible
			// nodes. Absent linkPairKeys is the pre-hierarchy default: every edge is a link.
			const walkedLink = linkPairKeys === undefined ? true : linkPairKeys.has(key);
			const hasLink = walkedLink || (crossLinksOn && linkCount > 0);
			// A PURE hierarchy edge (folder relation, no link relation): NOT floored — the
			// floor exists for a walked/swept LINK the provider momentarily reports 0 for,
			// which this pair is not. `count: 0` distinguishes it for the view; `kind` is
			// left at its neutral default (no link occurrence to summarise).
			if (!hasLink) {
				return { ...pair, count: 0, kind: "link", hierarchy: true };
			}
			return {
				...pair,
				count: Math.max(MIN_EMITTED_EDGE_LINK_COUNT, linkCount),
				kind: EdgeAssembly.kindOf(referencesOf(pair.source), pair.target),
				hierarchy,
			};
		});
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
