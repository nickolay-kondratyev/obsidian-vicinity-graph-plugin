import type { FolderHiddenCount } from "./truncationBadges";

/**
 * Badge/tooltip text formatting (step-05). One home for every user-visible
 * badge string so components never concatenate copy inline and Phase C e2e can
 * assert exact text.
 */

/** Display label for the vault root ("" folder path) in user-facing breakdowns. */
export const VAULT_ROOT_LABEL = "(vault root)";

/** Generic "+N" badge (group truncation, extra thumbnails). */
export function plusNText(count: number): string {
	return `+${count}`;
}

/** The graph-corner overlay badge text. */
export function hiddenOverlayText(totalHiddenCount: number): string {
	return `+${totalHiddenCount} hidden`;
}

/**
 * Thumbnail "+N" badge for images beyond the rendered first one;
 * `null` = no badge (zero or one image).
 */
export function extraImageCountText(imageCount: number): string | null {
	return imageCount > 1 ? plusNText(imageCount - 1) : null;
}

/** Tooltip on a folder group's "+N" badge. */
export function groupHiddenTitleText(hiddenCount: number): string {
	const noun = hiddenCount === 1 ? "note" : "notes";
	return `${hiddenCount} more ${noun} in this folder ${hiddenCount === 1 ? "is" : "are"} not shown`;
}

/** Edge multi-link badge; `null` = no badge (single link). */
export function linkCountBadgeText(count: number): string | null {
	return count > 1 ? `×${count}` : null;
}

/** Multiline tooltip body for the corner overlay: one "folder — N hidden" line per folder. */
export function orphanBreakdownTitle(breakdown: readonly FolderHiddenCount[]): string {
	return breakdown
		.map(({ folder, hiddenCount }) => `${folder === "" ? VAULT_ROOT_LABEL : folder} — ${hiddenCount} hidden`)
		.join("\n");
}
