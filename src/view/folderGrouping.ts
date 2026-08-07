import type { FolderPath, GraphNode } from "../engine";

/**
 * Folder-group membership derivation (step-05): pure, deterministic, RF-free.
 * A folder renders as a group only when 2+ visible nodes live in it; the vault
 * root ("") never groups — root files have no folder identity to box.
 * Singletons stay ungrouped and render as plain note nodes.
 */

/** A folder that renders as a group node, with its member node paths. */
export interface FolderGroup {
	readonly folder: FolderPath;
	/** Member node paths in graph-node order. Always >= MIN_GROUP_MEMBER_COUNT. */
	readonly memberPaths: readonly string[];
}

export interface FolderGroupingResult {
	/** Groups in first-seen folder order (deterministic across rebuilds of the same graph). */
	readonly groups: readonly FolderGroup[];
	/** Reverse index: member node path → its rendered group's folder. */
	readonly groupFolderByMemberPath: ReadonlyMap<string, FolderPath>;
}

/** Groups render only at 2+ members (step-05 spec); singletons render ungrouped. */
export const MIN_GROUP_MEMBER_COUNT = 2;

const VAULT_ROOT_FOLDER = "";

const NO_EXCLUSIONS: ReadonlySet<string> = new Set();

/**
 * CONTRACT: called independently by BOTH `elkMapping` (container structure)
 * and `flowMapping` (group nodes + parentIds) for the same graph, so it MUST
 * stay a pure, deterministic function of `nodes` — any call-site-dependent
 * behavior (randomness, mutation, per-call sorting) would silently
 * desynchronize React Flow parentIds from the elk layout.
 *
 * `excludedPaths` are nodes that leave folder grouping entirely — the nested
 * nodes of the embed-nesting forest (decision Q4: nesting wins over folder
 * grouping). An excluded node neither joins its folder group NOR counts toward
 * {@link MIN_GROUP_MEMBER_COUNT}, so a folder of one plain note plus one note
 * nested elsewhere renders ungrouped. A container (which is NOT nested) still
 * counts, so the chain group → container → nested is intact. Both callers MUST
 * pass the SAME exclusion set or parentIds and layout desynchronize.
 */
export function deriveFolderGroups(
	nodes: readonly GraphNode[],
	excludedPaths: ReadonlySet<string> = NO_EXCLUSIONS,
): FolderGroupingResult {
	const memberPathsByFolder = new Map<FolderPath, string[]>();
	for (const node of nodes) {
		if (node.folder === VAULT_ROOT_FOLDER || excludedPaths.has(node.path)) {
			continue;
		}
		const members = memberPathsByFolder.get(node.folder) ?? [];
		members.push(node.path);
		memberPathsByFolder.set(node.folder, members);
	}
	const groups: FolderGroup[] = [];
	const groupFolderByMemberPath = new Map<string, FolderPath>();
	for (const [folder, memberPaths] of memberPathsByFolder) {
		if (memberPaths.length < MIN_GROUP_MEMBER_COUNT) {
			continue;
		}
		groups.push({ folder, memberPaths });
		for (const path of memberPaths) {
			groupFolderByMemberPath.set(path, folder);
		}
	}
	return { groups, groupFolderByMemberPath };
}
