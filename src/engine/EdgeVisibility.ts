import { EdgeAccumulator } from "./EdgeAccumulator";
import type { LinkProvider } from "./LinkProvider";
import type { EdgeVisibilityMode, GraphEdge, VaultPath } from "./types";

export interface EdgeVisibilityInput {
	readonly mode: EdgeVisibilityMode;
	/** Node paths that survived truncation (attachments are never in this set). */
	readonly visiblePaths: ReadonlySet<VaultPath>;
	/** BFS-walked edges already filtered to visible endpoints (truncator output). */
	readonly walkedVisibleEdges: readonly GraphEdge[];
	readonly provider: LinkProvider;
}

/**
 * Owns the semantics of {@link EdgeVisibilityMode} (CLARIFICATION Q5):
 * - `"walked-from-center"` passes the truncator's walked edge set through.
 * - `"all-edges"` sweeps the POST-truncation visible node set via the provider
 *   and emits every link whose endpoints are both visible (induced subgraph).
 *
 * The sweep only needs outgoing links: every real link is its source's
 * outgoing link, and non-node targets (attachments) can never be visible.
 *
 * WHY-NOT pre-truncation: Q5 specifies a post-truncation sweep, so the
 * truncator's distance-to-MAIN ranking intentionally runs on the walked edge
 * set in both modes.
 */
export class EdgeVisibility {
	static edgesFor(input: EdgeVisibilityInput): readonly GraphEdge[] {
		return input.mode === "all-edges" ? collectInducedEdges(input) : input.walkedVisibleEdges;
	}
}

function collectInducedEdges(input: EdgeVisibilityInput): readonly GraphEdge[] {
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
