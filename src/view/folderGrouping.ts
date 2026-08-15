import type { FolderPath, GraphNode } from "../engine";
import { asFolderPath } from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";

/**
 * Folder-group membership derivation (recursive): pure, deterministic, RF-free.
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
 * LCA, nearest-rendered-ancestor and container-child projection lookups live
 * ONCE here ({@link FolderGroupingResult.nearestRenderedAncestorGroupOf},
 * {@link FolderGroupingResult.lowestCommonAncestorContainerOf},
 * {@link FolderGroupingResult.projectOntoContainerChildOf}); consumers
 * (`elkMapping`, `flowMapping`, `truncationBadges`) MUST use these seams and
 * never re-derive the tree (DRY).
 */

/** A folder that renders as a group node within the recursive grouping tree. */
export interface FolderGroup {
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
	 * Notes assigned directly to THIS group (their nearest qualifying ancestor is
	 * this folder), in graph-node order. Always >= {@link MIN_GROUP_MEMBER_COUNT}
	 * across the group's whole subtree, though a nesting parent may hold fewer
	 * direct members than that once descendants sink into child groups.
	 */
	readonly memberPaths: readonly string[];
}

export interface FolderGroupingResult {
	/** Groups in first-seen folder order (deterministic across rebuilds of the same graph). */
	readonly groups: readonly FolderGroup[];
	/** Reverse index: member node path → the folder of the group it renders in (its nearest qualifying ancestor). */
	readonly groupFolderByMemberPath: ReadonlyMap<string, FolderPath>;
	/**
	 * Nearest rendered (surviving) group that is an ancestor-or-self of `folderPath`,
	 * or `null` when none exists (the folder renders at the top level). Skips
	 * collapsed folders. The ONE nearest-ancestor lookup — e.g. truncation badges
	 * attribute a hidden note's count to `nearestRenderedAncestorGroupOf(note.folder)`.
	 */
	readonly nearestRenderedAncestorGroupOf: (folderPath: FolderPath) => FolderGroup | null;
	/**
	 * Lowest common ancestor CONTAINER of two note paths: the deepest group that
	 * renders BOTH, or `null` when their only common container is the canvas pane.
	 * The ONE LCA lookup — edge collapse projects each endpoint onto the boundary
	 * of the group strictly inside this container.
	 */
	readonly lowestCommonAncestorContainerOf: (pathA: string, pathB: string) => FolderGroup | null;
	/**
	 * Projects `notePath` onto the group strictly inside `container` (null = canvas
	 * pane) the edge should terminate at, given a per-endpoint depth `allowance`.
	 *
	 * At `allowance === 0` (the default, and the ONLY value the layout path uses)
	 * this is the DIRECT CHILD of `container` that renders the note: the group
	 * strictly inside `container` that is an ancestor-or-self of the note, or `null`
	 * when the note is a direct leaf member of `container` with no intervening group.
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
		container: FolderGroup | null,
		allowance?: number,
	) => FolderGroup | null;
}

/** Groups render only at 2+ descendant notes (plan D2); smaller folders fall up to an ancestor. */
export const MIN_GROUP_MEMBER_COUNT = 2;

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
 * CONTRACT: called independently by BOTH `elkMapping` (container structure)
 * and `flowMapping` (group nodes + parentIds) for the same graph, so it MUST
 * stay a pure, deterministic function of `nodes` — any call-site-dependent
 * behavior (randomness, mutation, per-call sorting) would silently
 * desynchronize React Flow parentIds from the elk layout.
 */
export function deriveFolderGroups(nodes: readonly GraphNode[]): FolderGroupingResult {
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
	for (const node of nodes) {
		if (node.folder === VAULT_ROOT_FOLDER) {
			continue;
		}
		const assigned = ancestorFoldersOf(node.folder).find(qualifies);
		if (assigned === undefined) {
			continue;
		}
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

	const groups: FolderGroup[] = survivingLeaves.map((folder) => {
		const parentFolder = effectiveParentOf(folder);
		return {
			folder,
			parentFolder,
			leafName: VaultPathFacts.folderNameOf(folder),
			chainPath: relativeFolderPath(parentFolder, folder),
			memberPaths: membersByQualifyingFolder.get(folder) ?? [],
		};
	});

	const groupByFolder = new Map<FolderPath, FolderGroup>(groups.map((group) => [group.folder, group]));
	const groupFolderByMemberPath = new Map<string, FolderPath>();
	for (const group of groups) {
		for (const path of group.memberPaths) {
			groupFolderByMemberPath.set(path, group.folder);
		}
	}

	const folderByNotePath = new Map<string, FolderPath>(nodes.map((node) => [node.path, node.folder]));

	const nearestRenderedAncestorGroupOf = (folderPath: FolderPath): FolderGroup | null => {
		for (const ancestor of ancestorFoldersOf(folderPath)) {
			const group = groupByFolder.get(ancestor);
			if (group !== undefined) {
				return group;
			}
		}
		return null;
	};

	// Rendered group chain for a note path, DEEPEST first (its group, then each ancestor group).
	const renderedGroupChainOf = (notePath: string): FolderGroup[] => {
		const folder = folderByNotePath.get(notePath);
		const chain: FolderGroup[] = [];
		let group = folder === undefined ? null : nearestRenderedAncestorGroupOf(folder);
		while (group !== null) {
			chain.push(group);
			group = group.parentFolder === null ? null : groupByFolder.get(group.parentFolder) ?? null;
		}
		return chain;
	};

	const lowestCommonAncestorContainerOf = (pathA: string, pathB: string): FolderGroup | null => {
		const foldersA = new Set(renderedGroupChainOf(pathA).map((group) => group.folder));
		return renderedGroupChainOf(pathB).find((group) => foldersA.has(group.folder)) ?? null;
	};

	// The direct child of `container` on the note's chain is the ONE group whose
	// effective parent IS the container (parentFolder === container.folder, or null
	// for the canvas pane); none exists when the note is a direct leaf member. The
	// chain is DEEPEST-FIRST, so the note's own group is index 0 and the direct child
	// sits farthest out — a depth `allowance` of N steps N indices back TOWARD the
	// note (a deeper group). Stepping past the note's own group (index < 0) means the
	// chain is shallower than the reach, so the endpoint stays the true note (null).
	const projectOntoContainerChildOf = (
		notePath: string,
		container: FolderGroup | null,
		allowance = 0,
	): FolderGroup | null => {
		const containerFolder = container === null ? null : container.folder;
		const chain = renderedGroupChainOf(notePath);
		const directChildIndex = chain.findIndex((group) => group.parentFolder === containerFolder);
		if (directChildIndex < 0) {
			return null; // The note is a direct leaf member of `container` — no group to reach.
		}
		const targetIndex = directChildIndex - allowance;
		return targetIndex < 0 ? null : chain[targetIndex] ?? null;
	};

	return {
		groups,
		groupFolderByMemberPath,
		nearestRenderedAncestorGroupOf,
		lowestCommonAncestorContainerOf,
		projectOntoContainerChildOf,
	};
}
