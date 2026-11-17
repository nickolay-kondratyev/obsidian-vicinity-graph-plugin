import type { GraphNode, GroupingMode, VicinityGraph } from "../engine";
import { Tags } from "../shared/Tags";
import type { Tag, TagKey } from "../shared/Tags";
import { deriveFolderGroups } from "./folderGrouping";
import type { GroupingResult } from "./grouping";
import { deriveTagGroups } from "./tagGrouping";

/**
 * THE GROUPER CHOICE POINT (tags-v1, `nid_lmftfz11vvfwj382i4xmmoqgf_e`): the one
 * place that decides WHICH grouper turns a graph's notes into boxes. `elkMapping`,
 * `flowMapping` and `GraphStructureDiff`/`layoutFit` all derive their grouping
 * through {@link deriveGrouping} with a request from {@link groupingRequestOf}, so
 * the layout, the rendered subflows and the relayout decision can never disagree
 * about which boxes exist.
 */

/** What a grouping is derived FROM, beyond the notes themselves. */
export interface GroupingRequest {
	readonly mode: GroupingMode;
	/** Rendered box levels; `0` = no boxes; `UNLIMITED_GROUP_NESTING_DEPTH` = no cap. Same cap in both modes. */
	readonly maxGroupNestingDepth: number;
	/** Tags that are never a box key nor a chip (tag mode only). */
	readonly excludedTagKeys: ReadonlySet<TagKey>;
}

/** A grouping as the view consumes it: the mode-agnostic tree plus each note's chip tags. */
export interface ViewGrouping extends GroupingResult {
	/** The tags drawn as chips on the note — always empty in folder mode (decision 3). */
	readonly leftoverTagsOf: (notePath: string) => readonly Tag[];
}

/** No excluded tags — what every build that is not tag-filtered passes. */
export const NO_EXCLUDED_TAG_KEYS: ReadonlySet<TagKey> = new Set();

const NO_LEFTOVER_TAGS: readonly Tag[] = [];

/**
 * The request a built graph asks for. The ONE reader of the graph's grouping inputs,
 * so every consumer picks up the same excluded tags at once.
 *
 * A TAG-FILTERED graph excludes its filter tag AND that tag's parents (decision 10):
 * every note carries them, so as a box they would only wrap the whole graph, and as
 * a chip they would repeat on every note. Tags nested BELOW the filter tag still
 * group — they tell the filtered notes apart.
 */
export function groupingRequestOf(graph: Pick<VicinityGraph, "viewSettings" | "tagFilter">): GroupingRequest {
	return {
		mode: graph.viewSettings.groupingMode,
		maxGroupNestingDepth: graph.viewSettings.folderGroupingDepth,
		excludedTagKeys: graph.tagFilter === undefined ? NO_EXCLUDED_TAG_KEYS : selfAndParentKeysOf(graph.tagFilter),
	};
}

/** `a/b/c` ⇒ `{a, a/b, a/b/c}` — the tag rule's own ancestor expansion, keys only. */
function selfAndParentKeysOf(key: TagKey): ReadonlySet<TagKey> {
	return new Set(Tags.withAncestors([{ key, name: key }]).map((tag) => tag.key));
}

/**
 * Pure and deterministic (both groupers are), so independent calls for the same
 * graph agree — the contract `elkMapping`/`flowMapping` rely on.
 */
export function deriveGrouping(nodes: readonly GraphNode[], request: GroupingRequest): ViewGrouping {
	switch (request.mode) {
		case "folders":
			return { ...deriveFolderGroups(nodes, request.maxGroupNestingDepth), leftoverTagsOf: () => NO_LEFTOVER_TAGS };
		case "tags":
			return deriveTagGroups(nodes, request.maxGroupNestingDepth, request.excludedTagKeys);
	}
}
