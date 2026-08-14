import type { FolderPath } from "../engine";
import type { FolderGroup } from "./folderGrouping";

/**
 * Truncation-badge derivation (step-05, CLARIFICATION Q4; recursive grouping
 * D4): every hidden node count must surface somewhere. A hidden note's count is
 * attributed to the NEAREST RENDERED ANCESTOR group — the group where the note
 * WOULD have rendered under the nearest-qualifying-ancestor rule — even when no
 * group matches its immediate folder exactly (e.g. a lone hidden note in
 * `SQL/sub/` credits the `SQL` group's "+N"). Counts for the same group
 * accumulate. When NO ancestor group is rendered, the count aggregates into ONE
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
	/** "+N" badge per rendered folder group. */
	readonly hiddenCountByGroupFolder: ReadonlyMap<FolderPath, number>;
	readonly orphan: OrphanTruncation;
}

export function deriveTruncationBadges(
	hiddenNodeCountsByFolder: ReadonlyMap<FolderPath, number>,
	nearestRenderedAncestorGroupOf: (folder: FolderPath) => FolderGroup | null,
): TruncationBadges {
	const hiddenCountByGroupFolder = new Map<FolderPath, number>();
	const orphanBreakdown: FolderHiddenCount[] = [];
	let totalHiddenCount = 0;
	for (const [folder, hiddenCount] of hiddenNodeCountsByFolder) {
		// Attribute the count to the group where the hidden note WOULD have rendered
		// (its nearest qualifying/surviving ancestor), not only an exact folder match;
		// several hidden folders can credit the same ancestor group, so accumulate.
		const group = nearestRenderedAncestorGroupOf(folder);
		if (group !== null) {
			hiddenCountByGroupFolder.set(group.folder, (hiddenCountByGroupFolder.get(group.folder) ?? 0) + hiddenCount);
		} else {
			orphanBreakdown.push({ folder, hiddenCount });
			totalHiddenCount += hiddenCount;
		}
	}
	orphanBreakdown.sort((a, b) => a.folder.localeCompare(b.folder));
	return {
		hiddenCountByGroupFolder,
		orphan: totalHiddenCount === 0 ? NO_ORPHAN_TRUNCATION : { totalHiddenCount, breakdown: orphanBreakdown },
	};
}
