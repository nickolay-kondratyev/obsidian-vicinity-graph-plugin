import type { DocId, VaultPath } from "./types";

/**
 * The facts the deterministic priority chain ranks on. Callers ranking
 * entities that predate a build (e.g. pinned descriptors during settings
 * resolution) supply `minDepth: 0` — the chain then effectively collapses to
 * pin recency → docid.
 */
export interface PriorityRankable {
	readonly path: VaultPath;
	readonly minDepth: number;
	/** Undirected graph distance to MAIN; undefined when disconnected from MAIN. */
	readonly distanceToMain?: number;
	/**
	 * Best (lowest) {@link import("./types").DISCOVERY_KIND_RANK} across the node's
	 * depth tags — embed-found (0) outranks link-found (1) outranks hierarchy-only
	 * (2). Undefined for entities that predate a build (settings-cascade pins),
	 * which collapses this level for them.
	 */
	readonly discoveryKindRank?: number;
	/** Epoch ms; present only on pinned entities. */
	readonly pinTimestamp?: number;
	readonly docid?: DocId;
}

/**
 * THE single deterministic priority chain (DRY — step doc mandates one
 * implementation) used by BOTH graph truncation and multi-pin conflict
 * resolution in the view-settings cascade:
 *
 *   lower minDepth → closer to MAIN (connected beats disconnected) →
 *   discovering relation kind (embed-found > link-found > hierarchy-only) →
 *   pin recency (most recent wins; pinned beats unpinned) →
 *   docid (lexicographic; present beats absent) → path (lexicographic).
 *
 * The "higher size score" level between minDepth and distance-to-MAIN was
 * REMOVED with the sizing metrics (node-sizing rethink, 2026-08-03): with
 * size now content-fit, a hidden relevance score would have ranked truncation
 * by how VERBOSE a note is, so distance-to-MAIN takes over as the tiebreak.
 *
 * The final path comparison is a determinism guarantee beyond the step-doc
 * chain: ordinary (non-pinned) nodes carry no docid, and "same input → same
 * output" needs a total order. Negative result ⇒ `a` ranks higher (kept first).
 */
export class NodePriorityChain {
	static compare(a: PriorityRankable, b: PriorityRankable): number {
		return (
			ascending(a.minDepth, b.minDepth) ||
			presentFirst(a.distanceToMain, b.distanceToMain, ascending) ||
			presentFirst(a.discoveryKindRank, b.discoveryKindRank, ascending) ||
			presentFirst(a.pinTimestamp, b.pinTimestamp, descending) ||
			presentFirst(a.docid, b.docid, lexicographic) ||
			lexicographic(a.path, b.path)
		);
	}
}

function ascending(a: number, b: number): number {
	return a - b;
}

function descending(a: number, b: number): number {
	return b - a;
}

function lexicographic(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** A present value always outranks an absent one; two absents tie. */
function presentFirst<T>(a: T | undefined, b: T | undefined, compare: (a: T, b: T) => number): number {
	if (a === undefined && b === undefined) {
		return 0;
	}
	if (a === undefined) {
		return 1;
	}
	if (b === undefined) {
		return -1;
	}
	return compare(a, b);
}
