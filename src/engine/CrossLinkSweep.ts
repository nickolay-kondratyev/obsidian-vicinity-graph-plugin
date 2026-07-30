import { EdgeAccumulator } from "./EdgeAccumulator";
import type { LinkProvider } from "./LinkProvider";
import type { DirectedLink, VaultPath } from "./types";

export interface CrossLinkSweepInput {
	/**
	 * The walked edges that survived truncation. SEEDED into the result, so the
	 * toggle can only ever WIDEN the edge set (see the class doc).
	 */
	readonly walkedVisibleEdges: readonly DirectedLink[];
	/** Node paths that survived truncation (attachments are never in this set). */
	readonly visiblePaths: ReadonlySet<VaultPath>;
	readonly provider: LinkProvider;
}

/**
 * The INDUCED SUBGRAPH over the visible nodes — what
 * {@link import("./types").ViewSettings.showCrossLinks} turns on: every link whose
 * source AND target are both on screen, including the ones the BFS never traversed
 * (two notes sitting at the depth frontier that link each other).
 *
 * A SUPERSET of the walked set BY CONSTRUCTION: the walked edges are seeded into the
 * accumulator before the sweep runs, so ON can never LOSE an edge that OFF showed.
 * That is not belt-and-braces. The walk's incoming channel reads
 * {@link LinkProvider.getIncomingLinks} while this sweep reads
 * {@link LinkProvider.getOutgoingLinks}, and in `ObsidianLinkProvider` those are two
 * INDEPENDENT authorities (backlinks vs. the file cache, the latter degrading during
 * Obsidian's boot window) — deriving the union from outgoing truth alone would let a
 * momentary disagreement make a visible edge disappear when the user flips the toggle.
 * Deduplication is free, so the seed costs nothing.
 *
 * Count-free, exactly like {@link import("./VicinityTraversal").VicinityTraversal}'s
 * own output: multiplicity is attached once, from provider truth, in
 * {@link import("./EdgeCounts").EdgeCounts} — so a cross link's `xN` badge comes from
 * the same authority as a walked link's, with no second counting path.
 *
 * NODE SELECTION IS DELIBERATELY UNAFFECTED, and this is a REQUIREMENT rather than an
 * accepted limitation (ticket `nid_puf4a4q6fgn5lpehh5dowfm1r_e`): the sweep runs AFTER
 * truncation, so the node cap and the distance-to-MAIN ranking keep seeing only the
 * WALKED edge set and the same notes are on screen with the toggle either way. Feeding
 * these pairs back into ranking would let a setting about EDGES silently change which
 * NOTES a user sees — do not "fix" it.
 *
 * Sweeping OUTGOING references is enough to induce the rest: every link is some
 * source's outgoing link, and a target that is not node-bearing (an attachment) can
 * never be in `visiblePaths`.
 *
 * KIND-BLIND, deliberately: `getOutgoingLinks` does not distinguish an embed from a
 * plain link, so with `embedDepthOut: 0` an embed between two visible notes IS drawn
 * when this toggle is on though the walk would never have traversed it. That matches
 * the setting's promise ("every link between two visible nodes") and the equally
 * kind-blind {@link LinkProvider.getLinkCount} behind the `xN` badge — the depth dials
 * govern REACH, this toggle governs what is drawn between what reach already found.
 *
 * COST is bounded by the node cap, not by vault size: at most one
 * `getOutgoingReferences` call per visible node per rebuild (the frontier nodes are the
 * ones the walk deliberately never expanded). Worth re-checking if that cap ever grows
 * by an order of magnitude, since rebuilds fire on every active-leaf change.
 */
export class CrossLinkSweep {
	static inducedPairs(input: CrossLinkSweepInput): readonly DirectedLink[] {
		const accumulator = new EdgeAccumulator();
		for (const walked of input.walkedVisibleEdges) {
			accumulator.add(walked.source, walked.target);
		}
		for (const source of input.visiblePaths) {
			for (const target of input.provider.getOutgoingLinks(source)) {
				if (input.visiblePaths.has(target)) {
					accumulator.add(source, target);
				}
			}
		}
		return accumulator.edges();
	}
}
