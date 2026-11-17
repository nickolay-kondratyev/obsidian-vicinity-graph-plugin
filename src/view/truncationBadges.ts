import type { FolderPath } from "../engine";
import type { GroupId, GroupingResult } from "./grouping";

/**
 * Truncation-badge derivation (step-05, CLARIFICATION Q4; recursive grouping
 * D4): every hidden node count must surface somewhere. A hidden note's count is
 * attributed to the group the GROUPER credits for the note's folder
 * ({@link GroupingResult.groupCreditedForHiddenFolder} — a folder is the only
 * fact the engine reports about a hidden note). Under folder grouping that is
 * the NEAREST RENDERED ANCESTOR group — the group where the note
 * WOULD have rendered under the nearest-qualifying-ancestor rule — even when no
 * group matches its immediate folder exactly (e.g. a lone hidden note in
 * `SQL/sub/` credits the `SQL` group's "+N"). Counts for the same group
 * accumulate. When NO group is credited, the count aggregates into ONE
 * graph-corner overlay badge with a per-folder breakdown for its tooltip — the
 * fallback for folders with no rendered ancestor (top-level singletons and the
 * vault root) so that nothing silently disappears.
 */

export interface FolderHiddenCount {
	readonly folder: FolderPath;
	readonly hiddenCount: number;
}

/** The graph-corner overlay badge data ("+N hidden" + tooltip breakdown). */
export interface OrphanTruncation {
	readonly totalHiddenCount: number;
	/** Per-folder breakdown, sorted by folder path (stable tooltip order). */
	readonly breakdown: readonly FolderHiddenCount[];
}

export const NO_ORPHAN_TRUNCATION: OrphanTruncation = { totalHiddenCount: 0, breakdown: [] };

export interface TruncationBadges {
	/** "+N" badge per rendered group. */
	readonly hiddenCountByGroupId: ReadonlyMap<GroupId, number>;
	readonly orphan: OrphanTruncation;
}

export function deriveTruncationBadges(
	hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>,
	groupCreditedForHiddenFolder: GroupingResult["groupCreditedForHiddenFolder"],
): TruncationBadges {
	const hiddenCountByGroupId = new Map<GroupId, number>();
	const orphanBreakdown: FolderHiddenCount[] = [];
	let totalHiddenCount = 0;
	for (const [folder, hiddenCount] of hiddenNodeCountsByFolder) {
		// Attribute the count to the group where the hidden note WOULD have rendered
		// (its nearest qualifying/surviving ancestor), not only an exact folder match;
		// several hidden folders can credit the same group, so accumulate.
		const group = groupCreditedForHiddenFolder(folder);
		if (group !== null) {
			hiddenCountByGroupId.set(group.id, (hiddenCountByGroupId.get(group.id) ?? 0) + hiddenCount);
		} else {
			orphanBreakdown.push({ folder, hiddenCount });
			totalHiddenCount += hiddenCount;
		}
	}
	orphanBreakdown.sort((a, b) => a.folder.localeCompare(b.folder));
	return {
		hiddenCountByGroupId,
		orphan: totalHiddenCount === 0 ? NO_ORPHAN_TRUNCATION : { totalHiddenCount, breakdown: orphanBreakdown },
	};
}
