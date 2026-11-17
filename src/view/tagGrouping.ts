import type { FolderPath, GraphNode } from "../engine";
import type { Tag, TagKey } from "../shared/Tags";
import { Tags } from "../shared/Tags";
import { MIN_GROUP_MEMBER_COUNT } from "./folderGrouping";
import { tagGroupIdOf } from "./graphIdentity";
import type { GroupColorToken, GroupId, GroupingResult, NodeGroup } from "./grouping";
import { deriveGroupTreeLookups, NO_GROUP_COLOR } from "./grouping";
import { presetTagColorOf, tagColorTokenOf } from "./tagColor";

/**
 * The TAG grouper (tags-v1 decisions 1-5): a second producer of the mode-agnostic
 * {@link GroupingResult}, beside `folderGrouping.ts`. Pure, deterministic, RF-free.
 *
 * Rule — "explain the most tag memberships", greedy and recursive. At each level:
 * - every tag carried by >= {@link MIN_GROUP_MEMBER_COUNT} of the level's notes is a
 *   CANDIDATE; its box's tag SET is the tags shared by ALL those notes;
 * - score = members x LABEL tags — the set minus parents implied by a nested child
 *   in it (see {@link scoreOf} for why and for the ceiling); ties go to more
 *   members, then the set's tag keys (plain code-unit order);
 * - the winner's notes leave the level and the level repeats on the rest;
 * - inside a box the same rule re-runs on each member's NOT-YET-EXPLAINED tags, so
 *   boxes nest. Notes no candidate claims render directly in the enclosing box
 *   (or on the canvas pane at the top level).
 * A note's tags count WITH their ancestors (`#project/alpha` is also `#project`,
 * via {@link Tags.withAncestors}); a box label drops a parent implied by a nested
 * child in the same set. Each note renders in exactly one box or none.
 */

export interface TagGroupingResult extends GroupingResult {
	/**
	 * The note's OWN tags (provider order, never ancestor-expanded) that no
	 * enclosing box names and that are not excluded — what the view draws as chips.
	 * Empty for an unknown path.
	 */
	readonly leftoverTagsOf: (notePath: string) => readonly Tag[];
}

/** A note at one level of the recursion, with the tags no enclosing box explains yet. */
interface LevelNote {
	readonly node: GraphNode;
	/** Ancestor-expanded, excluded tags removed, enclosing boxes' sets removed. */
	readonly unexplained: ReadonlyMap<TagKey, Tag>;
}

/** One possible box at a level. */
interface Candidate {
	readonly members: readonly LevelNote[];
	/** The shared tag set, sorted by key — also the tie-break and the id segment. */
	readonly tagKeys: readonly TagKey[];
}

/** The tree position a level's boxes hang under. */
interface ParentBox {
	readonly id: GroupId;
	/** Tag-key sets of the box chain, outermost first (the id source). */
	readonly keySetChain: readonly (readonly TagKey[])[];
	/** The chain's label tags, outermost first (the full label source). */
	readonly labelTagChain: readonly Tag[];
}

/**
 * CONTRACT (same as `deriveFolderGroups`): called independently by `elkMapping`
 * and `flowMapping` for the same graph, so it MUST stay a pure, deterministic
 * function of its arguments.
 *
 * `maxGroupNestingDepth` caps RENDERED box levels exactly like folders: a box at
 * the cap depth does not sub-group, its notes stay its direct members (their
 * would-be nested tags become leftovers). `0` disables grouping. Pass a
 * non-negative integer or `UNLIMITED_GROUP_NESTING_DEPTH`.
 *
 * `excludedTagKeys` are never group keys NOR leftovers (tag-filter mode passes its
 * filter tag, decision 10 — every note carries it). Exact keys only: excluding
 * `project` leaves `project/alpha` free to box.
 */
export function deriveTagGroups(
	nodes: readonly GraphNode[],
	maxGroupNestingDepth: number,
	excludedTagKeys: ReadonlySet<TagKey>,
): TagGroupingResult {
	const groups: NodeGroup[] = [];
	const explainedKeysByPath = new Map<string, ReadonlySet<TagKey>>();

	const groupLevel = (levelNotes: readonly LevelNote[], parent: ParentBox | null, depth: number): readonly LevelNote[] => {
		let remaining = levelNotes;
		if (depth > maxGroupNestingDepth) {
			return remaining;
		}
		for (let winner = bestCandidateOf(remaining); winner !== undefined; winner = bestCandidateOf(remaining)) {
			const memberSet = new Set(winner.members);
			remaining = remaining.filter((levelNote) => !memberSet.has(levelNote));
			const box = boxOf(winner, parent);
			// Pre-order push: a box always precedes its children (ancestor-first).
			const index = groups.push(box.group) - 1;
			const inner = winner.members.map((member) => explainedBy(member, winner.tagKeys));
			const directMembers = groupLevel(inner, box.asParent, depth + 1);
			groups[index] = { ...box.group, memberPaths: directMembers.map((member) => member.node.path) };
			recordExplained(directMembers, box.asParent.keySetChain);
		}
		return remaining;
	};

	const recordExplained = (directMembers: readonly LevelNote[], keySetChain: readonly (readonly TagKey[])[]): void => {
		const explained = new Set(keySetChain.flat());
		for (const member of directMembers) {
			explainedKeysByPath.set(member.node.path, explained);
		}
	};

	const topLevel = nodes.map((node) => toLevelNote(node, excludedTagKeys));
	recordExplained(groupLevel(topLevel, null, 1), []);

	const leftoverTagsByPath = new Map<string, readonly Tag[]>(
		nodes.map((node) => {
			const explained = explainedKeysByPath.get(node.path);
			return [node.path, node.tags.filter((tag) => !excludedTagKeys.has(tag.key) && !explained?.has(tag.key))];
		}),
	);

	return {
		groups,
		groupsAncestorFirst: groups,
		...deriveGroupTreeLookups(groups),
		// Tag boxes stand for no folder, so no box can honestly claim a folder's
		// hidden notes — they aggregate into the graph-corner badge.
		groupCreditedForHiddenFolder: (_folder: FolderPath) => null,
		leftoverTagsOf: (notePath) => leftoverTagsByPath.get(notePath) ?? [],
	};
}

function toLevelNote(node: GraphNode, excludedTagKeys: ReadonlySet<TagKey>): LevelNote {
	const expanded = Tags.withAncestors(node.tags).filter((tag) => !excludedTagKeys.has(tag.key));
	return { node, unexplained: new Map(expanded.map((tag) => [tag.key, tag])) };
}

/** `levelNote` with `tagKeys` now explained by its enclosing box. */
function explainedBy(levelNote: LevelNote, tagKeys: readonly TagKey[]): LevelNote {
	const unexplained = new Map(levelNote.unexplained);
	for (const key of tagKeys) {
		unexplained.delete(key);
	}
	return { node: levelNote.node, unexplained };
}

/**
 * The level's winning box, or `undefined` when no tag reaches the member floor.
 * Ceiling: rebuilds every candidate after each win — O(boxes x tag incidences x
 * tags per note) per level, fine at the node cap (<= 1000 notes). Upgrade path if
 * it ever shows in a profile: update candidates incrementally as winners leave.
 */
function bestCandidateOf(levelNotes: readonly LevelNote[]): Candidate | undefined {
	const membersByTag = new Map<TagKey, LevelNote[]>();
	for (const levelNote of levelNotes) {
		for (const key of levelNote.unexplained.keys()) {
			const members = membersByTag.get(key) ?? [];
			members.push(levelNote);
			membersByTag.set(key, members);
		}
	}
	let best: Candidate | undefined;
	for (const members of membersByTag.values()) {
		if (members.length < MIN_GROUP_MEMBER_COUNT) {
			continue;
		}
		const candidate: Candidate = { members, tagKeys: sharedTagKeysOf(members) };
		if (best === undefined || outranks(candidate, best)) {
			best = candidate;
		}
	}
	return best;
}

/** Keys every member carries, sorted by plain code-unit order (locale-independent, so deterministic). */
function sharedTagKeysOf(members: readonly LevelNote[]): readonly TagKey[] {
	const [first, ...rest] = members;
	const firstKeys = first === undefined ? [] : [...first.unexplained.keys()];
	return firstKeys.filter((key) => rest.every((member) => member.unexplained.has(key))).sort(compareCodeUnits);
}

/**
 * "Tag memberships explained" by a box, counting only its LABEL tags. WHY-NOT the
 * raw set size: a nested tag drags its implied parent into the set, so
 * `#project/alpha` on 2 notes (2 x 2) would beat `#project` on 3 (3 x 1) and
 * strand the third note outside the parent box it plainly belongs to.
 * CEILING (decision 1): greedy, not optimal — 2 notes sharing 10 tags (20)
 * outscore 15 notes sharing 1 (15), so a small many-tag cluster can claim notes a
 * broad single-tag box would have gathered. Upgrade path: a members-weighted
 * score (e.g. members^2 x label tags).
 */
function scoreOf(candidate: Candidate): number {
	return candidate.members.length * labelKeysOf(candidate.tagKeys).length;
}

function outranks(challenger: Candidate, incumbent: Candidate): boolean {
	const scoreDelta = scoreOf(challenger) - scoreOf(incumbent);
	if (scoreDelta !== 0) {
		return scoreDelta > 0;
	}
	const membersDelta = challenger.members.length - incumbent.members.length;
	if (membersDelta !== 0) {
		return membersDelta > 0;
	}
	return compareCodeUnits(challenger.tagKeys.join(" "), incumbent.tagKeys.join(" ")) < 0;
}

function compareCodeUnits(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** The ONE place a winning candidate becomes a {@link NodeGroup} (members filled in after recursion). */
function boxOf(winner: Candidate, parent: ParentBox | null): { readonly group: NodeGroup; readonly asParent: ParentBox } {
	const labelTags = labelTagsOf(winner);
	const keySetChain = [...(parent?.keySetChain ?? []), winner.tagKeys];
	const labelTagChain = [...(parent?.labelTagChain ?? []), ...labelTags];
	const id = tagGroupIdOf(keySetChain);
	const label = hashtagsOf(labelTags);
	const group: NodeGroup = {
		id,
		parentId: parent?.id ?? null,
		label,
		// A tag box never collapses a chain into itself: its label already names
		// everything it stands for relative to its parent.
		chainLabel: label,
		fullLabel: hashtagsOf(labelTagChain),
		memberPaths: [],
		subject: { kind: "tag", tags: labelTags },
		colorToken: colorOfLabel(labelTags),
	};
	return { group, asParent: { id, keySetChain, labelTagChain } };
}

/**
 * The set's keys minus any parent implied by a nested child in the same set
 * (`{project, project/alpha}` ⇒ `project/alpha`), in key order. The ONE label
 * rule: both the score and the label read it.
 */
function labelKeysOf(tagKeys: readonly TagKey[]): readonly TagKey[] {
	return tagKeys.filter((key) => !tagKeys.some((other) => other !== key && Tags.isSameOrNestedUnder(other, key)));
}

/** {@link labelKeysOf} as tags. Display casing is the FIRST member's (graph-node order), so it is deterministic. */
function labelTagsOf(winner: Candidate): readonly Tag[] {
	const firstMember = winner.members[0];
	return labelKeysOf(winner.tagKeys).map((key) => firstMember?.unexplained.get(key) ?? { key, name: key });
}

function hashtagsOf(tags: readonly Tag[]): string {
	return tags.map((tag) => `#${tag.name}`).join(" ");
}

/**
 * A multi-tag box takes the colour of its first label tag that HAS a preset
 * family (a preset carries meaning: `#important #follow-up` stays orange/red, not
 * a random hash), else its first label tag's hashed colour.
 */
function colorOfLabel(labelTags: readonly Tag[]): GroupColorToken | null {
	for (const tag of labelTags) {
		const preset = presetTagColorOf(tag.key);
		if (preset !== undefined) {
			return preset;
		}
	}
	const first = labelTags[0];
	return first === undefined ? NO_GROUP_COLOR : tagColorTokenOf(first.key);
}
