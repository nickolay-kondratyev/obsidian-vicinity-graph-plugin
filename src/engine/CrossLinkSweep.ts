import { EdgeAccumulator } from "./EdgeAccumulator";
import type { LinkProvider } from "./LinkProvider";
import type { DirectedLink, VaultPath } from "./types";

export interface CrossLinkSweepInput {
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
 * Outgoing links alone are sufficient: every real link is some source's outgoing link,
 * and a target that is not node-bearing (an attachment) can never be in `visiblePaths`.
 */
export class CrossLinkSweep {
	static inducedPairs(input: CrossLinkSweepInput): readonly DirectedLink[] {
		const accumulator = new EdgeAccumulator();
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
