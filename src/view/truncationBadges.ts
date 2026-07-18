import type { FolderPath } from "../engine";

/**
 * Truncation-badge derivation (step-05, CLARIFICATION Q4): every hidden node
 * count must surface somewhere — "+N" on the folder group when one is
 * rendered, otherwise aggregated into ONE graph-corner overlay badge with a
 * per-folder breakdown for its tooltip. The aggregate covers every folder
 * WITHOUT a rendered group (zero visible members, singleton folders, and the
 * vault root) — a superset of "fully truncated folders" so that nothing
 * silently disappears.
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
	renderedGroupFolders: ReadonlySet<FolderPath>,
): TruncationBadges {
	const hiddenCountByGroupFolder = new Map<FolderPath, number>();
	const orphanBreakdown: FolderHiddenCount[] = [];
	let totalHiddenCount = 0;
	for (const [folder, hiddenCount] of hiddenNodeCountsByFolder) {
		if (renderedGroupFolders.has(folder)) {
			hiddenCountByGroupFolder.set(folder, hiddenCount);
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
