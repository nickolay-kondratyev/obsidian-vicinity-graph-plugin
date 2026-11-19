import type { TagKey } from "../shared/Tags";
import { CrossLinkSweep } from "./CrossLinkSweep";
import type { LinkProvider } from "./LinkProvider";
import { NodeEligibility } from "./NodeEligibility";
import type { PathExclusionMatcher } from "./PathExclusionMatcher";
import type { TraversedNode } from "./VicinityTraversal";
import { toTraversedNode } from "./VicinityTraversal";
import type { DirectedLink, DocId, FolderPath, VaultPath } from "./types";

export interface TagFilteredSelectionInput {
	readonly provider: LinkProvider;
	readonly tag: TagKey;
	/** Global node exclusion. With no roots there is nothing to exempt: it applies to every tagged note. */
	readonly exclusion: PathExclusionMatcher;
	/** Hard cap on the number of notes kept. */
	readonly nodeCap: number;
	/** Docids to echo onto the selected notes that have one (never a membership input). */
	readonly echoedDocIds?: ReadonlyMap<VaultPath, DocId>;
}

/** The node/edge selection of a tag-filtered build — the tag-mode twin of traversal + truncation. */
export interface TagFilteredSelection {
	/** The tagged notes that survived exclusion and the cap. */
	readonly visibleNodes: ReadonlyMap<VaultPath, TraversedNode>;
	/** Every link between two visible notes (count-free; EdgeAssembly attaches multiplicity). */
	readonly visibleEdges: readonly DirectedLink[];
	readonly hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>;
	/** Tagged, node-bearing notes rejected by global exclusion. */
	readonly excludedNodeCount: number;
}

/**
 * WHICH notes and links a tag-filtered graph shows (tags-v1 decisions 9-10):
 * every node-bearing note carrying the tag (or a nested child tag) that global
 * exclusion does not reject, and every link between two of them. There are NO
 * roots — nothing is walked, no note is central, pins add nothing.
 *
 * Truncation cannot use the vicinity chain (depth / distance to MAIN — there is
 * no MAIN), so it keeps the MOST-LINKED notes: ranked by how many OTHER tagged
 * notes a note is linked with (either direction, each neighbour once), ties
 * broken by path so the same vault always yields the same graph.
 *
 * COST CEILING: one `getOutgoingLinks` per TAGGED note per rebuild — the ranking
 * needs every member's links BEFORE the cap can be applied, so unlike the
 * vicinity walk this is bounded by the tag's size, not the node cap. Fine for the
 * hundreds; a tag on tens of thousands of notes would want a cheaper rank
 * (e.g. the provider's own link counts) before sweeping.
 */
export class TagFilteredSelector {
	static select(input: TagFilteredSelectionInput): TagFilteredSelection {
		const eligibility = new NodeEligibility(input.provider);
		const members = new Set<VaultPath>();
		let excludedNodeCount = 0;
		for (const path of input.provider.getPathsCarryingTag(input.tag)) {
			if (!eligibility.isNodeBearing(path)) {
				continue;
			}
			if (input.exclusion.excludes(path)) {
				excludedNodeCount += 1;
				continue;
			}
			members.add(path);
		}
		// The induced subgraph over the members, minus self-references (the vicinity
		// walk drops those at discovery; nothing is walked here, so drop them now).
		const memberEdges = CrossLinkSweep.inducedPairs({
			walkedVisibleEdges: [],
			visiblePaths: members,
			provider: input.provider,
		}).filter((edge) => edge.source !== edge.target);
		const ranked = TagFilteredSelector.mostLinkedFirst(members, memberEdges);
		const visiblePaths = new Set(ranked.slice(0, input.nodeCap));
		const hiddenNodeCountsByFolder = new Map<FolderPath, number>();
		const visibleNodes = new Map<VaultPath, TraversedNode>();
		// Insertion order = vault order (the provider's), not rank order: the cap picks
		// WHICH notes show, it must not reshuffle the ones that do.
		for (const path of members) {
			const metadata = input.provider.getFileMetadata(path);
			if (metadata === undefined) {
				continue; // Unreachable: members are node-bearing, hence known.
			}
			if (visiblePaths.has(path)) {
				visibleNodes.set(
					path,
					toTraversedNode(path, metadata, {
						docid: input.echoedDocIds?.get(path),
						isCentral: false,
						depthTags: [],
					}),
				);
			} else {
				hiddenNodeCountsByFolder.set(metadata.folder, (hiddenNodeCountsByFolder.get(metadata.folder) ?? 0) + 1);
			}
		}
		return {
			visibleNodes,
			visibleEdges: memberEdges.filter((edge) => visiblePaths.has(edge.source) && visiblePaths.has(edge.target)),
			hiddenNodeCountsByFolder,
			excludedNodeCount,
		};
	}

	/** Members by linked-neighbour count, highest first; path order breaks ties (deterministic). */
	private static mostLinkedFirst(
		members: ReadonlySet<VaultPath>,
		memberEdges: readonly DirectedLink[],
	): readonly VaultPath[] {
		const neighbours = new Map<VaultPath, Set<VaultPath>>();
		for (const path of members) {
			neighbours.set(path, new Set());
		}
		for (const edge of memberEdges) {
			neighbours.get(edge.source)?.add(edge.target);
			neighbours.get(edge.target)?.add(edge.source);
		}
		const linkedCount = (path: VaultPath): number => neighbours.get(path)?.size ?? 0;
		return [...members].sort(
			(a, b) => linkedCount(b) - linkedCount(a) || (a < b ? -1 : a > b ? 1 : 0),
		);
	}
}
