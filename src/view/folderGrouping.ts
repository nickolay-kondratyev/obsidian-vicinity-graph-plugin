import type { FolderPath, GraphNode } from "../engine";
import { asFolderPath } from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { folderGroupIdOf } from "./graphIdentity";
import type { GroupingResult, NodeGroup } from "./grouping";
import { deriveGroupTreeLookups, NO_GROUP_COLOR } from "./grouping";

/**
 * Folder-group membership derivation (recursive): pure, deterministic, RF-free.
 * The FOLDER grouper — one producer of the mode-agnostic {@link GroupingResult}
 * (`grouping.ts`), which is all the layout / render / edge pipeline reads.
 *
 * Groups nest to arbitrary depth (plan `nid_xko67wo2z4awg5gdrm1xx1chz_e`, D2):
 * - A folder QUALIFIES as a group iff >= {@link MIN_GROUP_MEMBER_COUNT} visible
 *   notes are its DESCENDANTS (not merely its direct children). The vault root
 *   ("") never qualifies — root files have no folder identity to box.
 * - Each note renders inside its NEAREST qualifying ancestor folder's group; a
 *   note in a too-small subfolder falls up into the nearest ancestor that has
 *   enough descendants (a lone note in `SQL/sub/` renders in the `SQL` box).
 * - Each qualifying group nests inside its nearest qualifying ancestor group.
 * - Redundant-chain collapse: a qualifying folder whose visible content is
 *   exactly ONE child group and nothing else is skipped (no outer box); the
 *   surviving group carries the collapsed chain on {@link FolderGroup.chainPath}
 *   (e.g. `A/B/C`), while `folder`/`leafName` name its real leaf folder.
 *
 * The tree lookups (LCA, container chain, container-child projection) are NOT
 * implemented here: they come from {@link deriveGroupTreeLookups}, derived from
 * the `parentId` tree alone. This module adds only what needs FOLDER arithmetic —
 * which folders qualify, collapse and survive the depth cap, and
 * {@link FolderGroupingResult.nearestRenderedAncestorGroupOf} (hidden-count
 * attribution). Consumers MUST use the seams and never re-derive the tree (DRY).
 */

/**
 * A folder that renders as a group node within the recursive grouping tree.
 *
 * The folder-vocabulary fields below are this grouper's OWN view of a group (its
 * tests and its folder arithmetic speak folders); pipeline consumers read only
 * the inherited {@link NodeGroup} fields, which {@link toFolderGroup} projects
 * from them — `id` from `folder`, `parentId` from `parentFolder`, `label` /
 * `chainLabel` / `fullLabel` from `leafName` / `chainPath` / `folder`.
 */
export interface FolderGroup extends NodeGroup {
	/** Full vault path of this group's leaf folder; its stable id/key. */
	readonly folder: FolderPath;
	/**
	 * Nearest ancestor group's folder, or `null` when this group renders at the
	 * top level (its container is the canvas pane). A tree edge, not folder
	 * arithmetic — collapsed intermediate folders are already skipped.
	 */
	readonly parentFolder: FolderPath | null;
	/** Display name: the leaf folder's last path segment. */
	readonly leafName: string;
	/**
	 * Collapsed-chain label: this group's folder path RELATIVE to its parent
	 * group (or to the vault root when top-level). Equals {@link leafName} when
	 * nothing collapsed above it within its parent; spans multiple segments
	 * (e.g. `A/B/C`) when redundant single-child ancestors folded into it.
	 */
	readonly chainPath: string;
	/**
	 * Notes assigned directly to THIS group (their nearest RENDERED group is this
	 * folder — the nearest qualifying ancestor uncapped, or the depth-cap
	 * survivor a deeper group merged into), in graph-node order. Always >=
	 * {@link MIN_GROUP_MEMBER_COUNT} across the group's whole subtree, though a
	 * nesting parent may hold fewer direct members than that once descendants
	 * sink into child groups.
	 */
	readonly memberPaths: readonly string[];
}

export interface FolderGroupingResult extends GroupingResult<FolderGroup> {
	/** Reverse index: member node path → the folder of the group it RENDERS in (nearest qualifying ancestor, capped to the depth-cap survivor). */
	readonly groupFolderByMemberPath: ReadonlyMap<string, FolderPath>;
	/**
	 * Nearest rendered (surviving) group that is an ancestor-or-self of `folderPath`,
	 * or `null` when none exists (the folder renders at the top level). Skips
	 * collapsed folders. The ONE nearest-ancestor lookup, and this grouper's answer
	 * to {@link GroupingResult.groupCreditedForHiddenFolder}: truncation badges
	 * attribute a hidden note's count to the group where it WOULD have rendered.
	 */
	readonly nearestRenderedAncestorGroupOf: (folderPath: FolderPath) => FolderGroup | null;
}

/** Groups render only at 2+ descendant notes (plan D2); smaller folders fall up to an ancestor. */
export const MIN_GROUP_MEMBER_COUNT = 2;

/**
 * `maxGroupNestingDepth` value imposing no cap: every rendered nesting level
 * survives. Callers pass this until the "Folder grouping depth" setting lands
 * (plan `nid_yyugpoh3gv8ip24cizvgrs4w4_e`, ticket `nid_5vz7mtm2rn6n7nj9cp5mfbslx_e`).
 */
export const UNLIMITED_GROUP_NESTING_DEPTH = Number.POSITIVE_INFINITY;

const VAULT_ROOT_FOLDER = "";
const FOLDER_SEPARATOR = "/";

/** Self + each proper ancestor folder, NEAREST first; excludes the vault root (""). */
function ancestorFoldersOf(folder: FolderPath): FolderPath[] {
	const chain: FolderPath[] = [];
	let current: string = folder;
	while (current !== VAULT_ROOT_FOLDER) {
		chain.push(asFolderPath(current));
		const slashIndex = current.lastIndexOf(FOLDER_SEPARATOR);
		current = slashIndex < 0 ? VAULT_ROOT_FOLDER : current.slice(0, slashIndex);
	}
	return chain;
}

/** Immediate parent folder of a folder path; the vault root ("") for a top-level folder. */
function parentFolderOf(folder: FolderPath): FolderPath {
	const slashIndex = folder.lastIndexOf(FOLDER_SEPARATOR);
	return asFolderPath(slashIndex < 0 ? VAULT_ROOT_FOLDER : folder.slice(0, slashIndex));
}

/** `folder` expressed relative to its ancestor `base` ("" = vault root), i.e. `base` stripped off the front. */
function relativeFolderPath(base: FolderPath | null, folder: FolderPath): string {
	if (base === null || base === VAULT_ROOT_FOLDER) {
		return folder;
	}
	return folder.slice(base.length + FOLDER_SEPARATOR.length);
}

/**
 * Nesting depth of a folder path (segment count): an ancestor folder always has
 * a strictly smaller depth than its descendants. Used only to order groups
 * ancestor-first — group folders are never the vault root, so the empty-string
 * edge case does not arise.
 */
function folderDepthOf(folder: FolderPath): number {
	return folder.split(FOLDER_SEPARATOR).length;
}

/** The ONE place a folder group's mode-agnostic {@link NodeGroup} fields are projected from its folder facts. */
function toFolderGroup(
	folder: FolderPath,
	parentFolder: FolderPath | null,
	memberPaths: readonly string[],
): FolderGroup {
	const leafName = VaultPathFacts.folderNameOf(folder);
	const chainPath = relativeFolderPath(parentFolder, folder);
	return {
		id: folderGroupIdOf(folder),
		parentId: parentFolder === null ? null : folderGroupIdOf(parentFolder),
		label: leafName,
		chainLabel: chainPath,
		fullLabel: folder,
		memberPaths,
		subject: { kind: "folder", folder },
		colorToken: NO_GROUP_COLOR,
		folder,
		parentFolder,
		leafName,
		chainPath,
	};
}

/**
 * CONTRACT: called independently by BOTH `elkMapping` (container structure)
 * and `flowMapping` (group nodes + parentIds) for the same graph, so it MUST
 * stay a pure, deterministic function of `(nodes, maxGroupNestingDepth)` — any
 * call-site-dependent behavior (randomness, mutation, per-call sorting) would
 * silently desynchronize React Flow parentIds from the elk layout.
 *
 * `maxGroupNestingDepth` caps RENDERED group-nesting levels — visible boxes,
 * so a collapsed single-child chain (one box labelled `A/B/C`) counts as ONE
 * level (plan `nid_yyugpoh3gv8ip24cizvgrs4w4_e`, Q1). The tree is built
 * exactly as without a cap, then every group whose rendered depth exceeds the
 * cap merges into its depth-cap ancestor: its members fall up into that box
 * and every lookup seam reflects the merged tree. `0` disables grouping
 * entirely (no groups; every note renders flat). Pass a non-negative integer
 * or {@link UNLIMITED_GROUP_NESTING_DEPTH}.
 */
export function deriveFolderGroups(
	nodes: readonly GraphNode[],
	maxGroupNestingDepth: number,
): FolderGroupingResult {
	// Descendant count + first-seen order per folder, walking each note's ancestor chain.
	const descendantCountByFolder = new Map<FolderPath, number>();
	const firstSeenIndexByFolder = new Map<FolderPath, number>();
	nodes.forEach((node, index) => {
		if (node.folder === VAULT_ROOT_FOLDER) {
			return;
		}
		for (const ancestor of ancestorFoldersOf(node.folder)) {
			descendantCountByFolder.set(ancestor, (descendantCountByFolder.get(ancestor) ?? 0) + 1);
			if (!firstSeenIndexByFolder.has(ancestor)) {
				firstSeenIndexByFolder.set(ancestor, index);
			}
		}
	});

	const qualifies = (folder: FolderPath): boolean =>
		(descendantCountByFolder.get(folder) ?? 0) >= MIN_GROUP_MEMBER_COUNT;

	// Assign each note to its nearest qualifying ancestor folder (self-first).
	const membersByQualifyingFolder = new Map<FolderPath, string[]>();
	const assignedFolderByNotePath = new Map<string, FolderPath>();
	for (const node of nodes) {
		if (node.folder === VAULT_ROOT_FOLDER) {
			continue;
		}
		const assigned = ancestorFoldersOf(node.folder).find(qualifies);
		if (assigned === undefined) {
			continue;
		}
		assignedFolderByNotePath.set(node.path, assigned);
		const members = membersByQualifyingFolder.get(assigned) ?? [];
		members.push(node.path);
		membersByQualifyingFolder.set(assigned, members);
	}

	const qualifyingFolders = [...firstSeenIndexByFolder.keys()].filter(qualifies);
	// Immediate qualifying children per qualifying folder (its parent folder always
	// qualifies too, since descendant counts only grow towards the root).
	const childCountByFolder = new Map<FolderPath, number>();
	for (const folder of qualifyingFolders) {
		const parent = parentFolderOf(folder);
		if (parent !== VAULT_ROOT_FOLDER) {
			childCountByFolder.set(parent, (childCountByFolder.get(parent) ?? 0) + 1);
		}
	}

	// A folder collapses into its single child when it holds no notes of its own
	// and exactly one child group — nothing worth its own box.
	const isCollapsible = (folder: FolderPath): boolean =>
		(membersByQualifyingFolder.get(folder)?.length ?? 0) === 0 &&
		(childCountByFolder.get(folder) ?? 0) === 1;

	// Surviving groups = qualifying folders that are NOT collapsed into their child.
	const survivingLeaves = qualifyingFolders
		.filter((folder) => !isCollapsible(folder))
		.sort((a, b) => (firstSeenIndexByFolder.get(a) ?? 0) - (firstSeenIndexByFolder.get(b) ?? 0));

	// For a surviving leaf, walk up through collapsible qualifying ancestors to its
	// effective parent group (first non-collapsible ancestor, or root → null).
	const effectiveParentOf = (leaf: FolderPath): FolderPath | null => {
		let current = parentFolderOf(leaf);
		while (current !== VAULT_ROOT_FOLDER && isCollapsible(current)) {
			current = parentFolderOf(current);
		}
		return current === VAULT_ROOT_FOLDER ? null : current;
	};

	const fullTreeGroups: FolderGroup[] = survivingLeaves.map((folder) =>
		toFolderGroup(folder, effectiveParentOf(folder), membersByQualifyingFolder.get(folder) ?? []),
	);

	// Depth-cap post-pass (plan Q1): rendered depth counts VISIBLE boxes, so it
	// walks `parentFolder` tree edges (a collapsed chain is one edge = one level).
	const fullTreeGroupByFolder = new Map<FolderPath, FolderGroup>(
		fullTreeGroups.map((group) => [group.folder, group]),
	);
	const renderedDepthByFolder = new Map<FolderPath, number>();
	const renderedDepthOf = (group: FolderGroup): number => {
		const memoized = renderedDepthByFolder.get(group.folder);
		if (memoized !== undefined) {
			return memoized;
		}
		const parent = group.parentFolder === null ? undefined : fullTreeGroupByFolder.get(group.parentFolder);
		const depth = parent === undefined ? 1 : renderedDepthOf(parent) + 1;
		renderedDepthByFolder.set(group.folder, depth);
		return depth;
	};

	// A too-deep group's members fall up into its ancestor AT the cap depth;
	// `null` only at cap 0, where every note renders flat on the canvas pane.
	const cappedAncestorFolderOf = (group: FolderGroup): FolderPath | null => {
		let current: FolderGroup | undefined = group;
		while (current !== undefined && renderedDepthOf(current) > maxGroupNestingDepth) {
			current = current.parentFolder === null ? undefined : fullTreeGroupByFolder.get(current.parentFolder);
		}
		return current?.folder ?? null;
	};

	// Rebuilt in graph-node order so merged member lists stay deterministic; a
	// surviving group's parent always survives too (parent depth = depth - 1).
	const cappedMemberPathsByFolder = new Map<FolderPath, string[]>();
	for (const node of nodes) {
		const assigned = assignedFolderByNotePath.get(node.path);
		const assignedGroup = assigned === undefined ? undefined : fullTreeGroupByFolder.get(assigned);
		const cappedFolder = assignedGroup === undefined ? null : cappedAncestorFolderOf(assignedGroup);
		if (cappedFolder === null) {
			continue;
		}
		const members = cappedMemberPathsByFolder.get(cappedFolder) ?? [];
		members.push(node.path);
		cappedMemberPathsByFolder.set(cappedFolder, members);
	}

	const groups: FolderGroup[] = fullTreeGroups
		.filter((group) => renderedDepthOf(group) <= maxGroupNestingDepth)
		.map((group) => ({ ...group, memberPaths: cappedMemberPathsByFolder.get(group.folder) ?? [] }));

	const groupByFolder = new Map<FolderPath, FolderGroup>(groups.map((group) => [group.folder, group]));
	const groupFolderByMemberPath = new Map<string, FolderPath>();
	for (const group of groups) {
		for (const path of group.memberPaths) {
			groupFolderByMemberPath.set(path, group.folder);
		}
	}

	const nearestRenderedAncestorGroupOf = (folderPath: FolderPath): FolderGroup | null => {
		for (const ancestor of ancestorFoldersOf(folderPath)) {
			const group = groupByFolder.get(ancestor);
			if (group !== undefined) {
				return group;
			}
		}
		return null;
	};

	// React Flow needs parents before children. `groups` is in first-seen
	// (nearest-ancestor-first) order, which can place a nesting parent AFTER its
	// child, so order by folder DEPTH — an ancestor folder always has fewer
	// segments than its descendants. A stable sort keeps first-seen order among
	// siblings (determinism unchanged).
	const groupsAncestorFirst = [...groups].sort((a, b) => folderDepthOf(a.folder) - folderDepthOf(b.folder));

	return {
		groups,
		groupsAncestorFirst,
		...deriveGroupTreeLookups(groups),
		groupCreditedForHiddenFolder: nearestRenderedAncestorGroupOf,
		groupFolderByMemberPath,
		nearestRenderedAncestorGroupOf,
	};
}
