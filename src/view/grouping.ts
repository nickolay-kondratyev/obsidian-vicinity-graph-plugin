import type { FolderPath } from "../engine";
import type { Tag } from "../shared/Tags";

/**
 * The MODE-AGNOSTIC grouping model: what every grouping consumer (`elkMapping`,
 * `flowMapping`, `layoutFit`, `truncationBadges`, `FolderGroupNode`) reads.
 *
 * A GROUPER turns the visible notes into a tree of boxes and answers the lookup
 * seams below; the layout / render / edge-collapse pipeline never asks HOW a
 * note landed in its box. `folderGrouping.ts` (`deriveFolderGroups`) is the one
 * grouper today; a tag grouper is a second producer of this exact shape (epic
 * `nid_xhed75cwiy0ui4fokv6l02cxf_e`).
 *
 * What the shape promises, and what it deliberately does NOT:
 * - A note renders in EXACTLY ONE group (or none) — {@link GroupingResult.groupIdByMemberPath}
 *   is a function of the note path.
 * - The tree is {@link NodeGroup.parentId} edges ONLY. A group is NOT assumed to
 *   be a path prefix of its members or of its child groups, so no consumer may
 *   do folder arithmetic on an id or a label.
 * - Pure and deterministic: `elkMapping` and `flowMapping` each derive a
 *   grouping for the same graph, and a call-site-dependent answer would
 *   desynchronize React Flow `parentId`s from the elk layout.
 */

/**
 * Opaque identity of a rendered group. It IS the group's React Flow / elk node
 * id, so a grouper must mint it in a namespace no note path occupies and keep it
 * stable across rebuilds of the same graph (the structural diff compares ids).
 * Folder groups mint theirs with `folderGroupIdOf` (`graphIdentity.ts`).
 */
export type GroupId = string & { readonly __brand: "GroupId" };

export function asGroupId(id: string): GroupId {
	return id as GroupId;
}

/**
 * Names a theme colour for a group box. Carried, NOT rendered yet: folder boxes
 * are deliberately neutral (`docs-internal/tickets/ticket-folder-color-ux-design-pass.md`),
 * so the palette and its CSS land with the first grouper that colours (tags).
 */
export type GroupColorToken = string & { readonly __brand: "GroupColorToken" };

/** The "no colour" presentation hint — a neutral, theme-default box. */
export const NO_GROUP_COLOR = null;

/**
 * What a group STANDS FOR — the one place a grouping mode's own vocabulary
 * reaches a consumer, and only for the things that genuinely depend on it (the
 * label's navigation target, the DOM hook). A closed union: a new grouper adds
 * its member and the compiler points at every consumer that must decide.
 */
export type GroupSubject =
	| {
			readonly kind: "folder";
			/** The group's own (deepest) folder — never a collapsed ancestor. */
			readonly folder: FolderPath;
	  }
	| {
			readonly kind: "tag";
			/**
			 * The tags the box is LABELLED with (`tagGrouping.ts`): every tag its
			 * members share at this level, minus a parent tag implied by a nested child
			 * in the same set. Never empty; sorted by key.
			 */
			readonly tags: readonly Tag[];
	  };

/** One rendered box of the grouping tree. */
export interface NodeGroup {
	readonly id: GroupId;
	/**
	 * The group this one nests inside, or `null` when it renders at the top level
	 * (its container is the canvas pane). A TREE EDGE — never derivable from ids.
	 */
	readonly parentId: GroupId | null;
	/** Compact display label (the default box title). */
	readonly label: string;
	/**
	 * The label spelling out everything this ONE box stands for, relative to its
	 * parent box — what the "Full folder path" label setting shows. Equals
	 * {@link label} unless the box collapsed several levels into itself.
	 */
	readonly chainLabel: string;
	/** Full, context-free description of the group — the box title's tooltip. */
	readonly fullLabel: string;
	/** Notes rendered DIRECTLY in this box (not in a child box), in graph-node order. */
	readonly memberPaths: readonly string[];
	readonly subject: GroupSubject;
	/** Presentation hint; {@link NO_GROUP_COLOR} keeps the box neutral. */
	readonly colorToken: GroupColorToken | null;
}

/**
 * A grouper's whole answer. Generic in the group type only so a grouper can hand
 * its own richer groups to its own tests; consumers take the default.
 */
export interface GroupingResult<G extends NodeGroup = NodeGroup> {
	/** Groups in the grouper's deterministic first-seen order (elk container order). */
	readonly groups: readonly G[];
	/**
	 * The same groups ordered so every group FOLLOWS its parent — React Flow's
	 * parent-before-child rule. The grouper owns this order (as it owns
	 * {@link groups}'), so siblings stay deterministic across rebuilds.
	 */
	readonly groupsAncestorFirst: readonly G[];
	/** Reverse index: member note path → the id of the ONE group it renders in. */
	readonly groupIdByMemberPath: ReadonlyMap<string, GroupId>;
	/**
	 * The groups CONTAINING a note, DEEPEST first: its own group, then each
	 * ancestor group. Empty for a note that renders on the canvas pane.
	 */
	readonly containerChainOf: (notePath: string) => readonly G[];
	/**
	 * Lowest common ancestor CONTAINER of two note paths: the deepest group that
	 * renders BOTH, or `null` when their only common container is the canvas pane.
	 * The ONE LCA lookup — edge collapse projects each endpoint onto the boundary
	 * of the group strictly inside this container.
	 */
	readonly lowestCommonAncestorContainerOf: (pathA: string, pathB: string) => G | null;
	/**
	 * Projects `notePath` onto the group strictly inside `container` (null = canvas
	 * pane) the edge should terminate at, given a per-endpoint depth `allowance`.
	 *
	 * At `allowance === 0` (the default, and the ONLY value the layout path uses)
	 * this is the DIRECT CHILD of `container` that renders the note: the group
	 * strictly inside `container` that is an ancestor-or-self of the note's group,
	 * or `null` when the note is a direct leaf member of `container` with no
	 * intervening group.
	 *
	 * With `allowance === N` the endpoint reaches `N` levels DEEPER — onto the
	 * ancestor group `N` below that direct child (= depth `N+1` below `container`) —
	 * or `null` (the true note) when the note's chain is shallower than that. `N` is
	 * the "Edge depth into groups" setting (plan `nid_6fkhyw97hjs84xb62z6tommhi_e`,
	 * D1/D4); only `flowMapping` passes a non-zero value (RENDER-ONLY, D2).
	 *
	 * Precondition: `container` is on the note's rendered chain (i.e. `container` is
	 * a {@link lowestCommonAncestorContainerOf} result for that note, or `null`).
	 * The ONE projection seam BOTH edge consumers (`elkMapping`, `flowMapping`) use
	 * to attach a cross-boundary edge while naming a group `container` actually
	 * contains — never a nested descendant elk cannot reference under
	 * `SEPARATE_CHILDREN` (which is why the layout path stays at `allowance` 0).
	 */
	readonly projectOntoContainerChildOf: (
		notePath: string,
		container: NodeGroup | null,
		allowance?: number,
	) => G | null;
	/**
	 * The group whose "+N" badge surfaces the notes the node cap hid in `folder`,
	 * or `null` when no rendered box can honestly claim them (they aggregate into
	 * the graph-corner badge). Keyed by FOLDER because that is the only fact the
	 * engine reports about a hidden note (`VicinityGraph.hiddenNodeCountsByFolder`)
	 * — so the folder arithmetic stays inside the grouper that answers.
	 */
	readonly groupCreditedForHiddenFolder: (folder: FolderPath) => G | null;
}

/** The lookups any grouper gets for free from its tree — see {@link deriveGroupTreeLookups}. */
export type GroupTreeLookups<G extends NodeGroup> = Pick<
	GroupingResult<G>,
	"groupIdByMemberPath" | "containerChainOf" | "lowestCommonAncestorContainerOf" | "projectOntoContainerChildOf"
>;

/**
 * Derives the reverse index and the container lookups from the tree ALONE
 * (`memberPaths` + `parentId`), so every grouper answers them identically and
 * none re-implements LCA / projection (DRY across groupers, not just consumers).
 */
export function deriveGroupTreeLookups<G extends NodeGroup>(groups: readonly G[]): GroupTreeLookups<G> {
	const groupById = new Map<GroupId, G>(groups.map((group) => [group.id, group]));
	const groupIdByMemberPath = new Map<string, GroupId>();
	for (const group of groups) {
		for (const path of group.memberPaths) {
			groupIdByMemberPath.set(path, group.id);
		}
	}

	const containerChainOf = (notePath: string): G[] => {
		const chain: G[] = [];
		const ownId = groupIdByMemberPath.get(notePath);
		let group = ownId === undefined ? undefined : groupById.get(ownId);
		while (group !== undefined) {
			chain.push(group);
			group = group.parentId === null ? undefined : groupById.get(group.parentId);
		}
		return chain;
	};

	const lowestCommonAncestorContainerOf = (pathA: string, pathB: string): G | null => {
		const idsA = new Set(containerChainOf(pathA).map((group) => group.id));
		return containerChainOf(pathB).find((group) => idsA.has(group.id)) ?? null;
	};

	// The direct child of `container` on the note's chain is the ONE group whose
	// parent IS the container (`parentId === container.id`, or null for the canvas
	// pane); none exists when the note is a direct leaf member. The chain is
	// DEEPEST-FIRST, so the note's own group is index 0 and the direct child sits
	// farthest out — a depth `allowance` of N steps N indices back TOWARD the note
	// (a deeper group). Stepping past the note's own group (index < 0) means the
	// chain is shallower than the reach, so the endpoint stays the true note (null).
	const projectOntoContainerChildOf = (
		notePath: string,
		container: NodeGroup | null,
		allowance = 0,
	): G | null => {
		const containerId = container === null ? null : container.id;
		const chain = containerChainOf(notePath);
		const directChildIndex = chain.findIndex((group) => group.parentId === containerId);
		if (directChildIndex < 0) {
			return null; // The note is a direct leaf member of `container` — no group to reach.
		}
		const targetIndex = directChildIndex - allowance;
		return targetIndex < 0 ? null : chain[targetIndex] ?? null;
	};

	return { groupIdByMemberPath, containerChainOf, lowestCommonAncestorContainerOf, projectOntoContainerChildOf };
}
