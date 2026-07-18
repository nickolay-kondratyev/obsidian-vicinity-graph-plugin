/**
 * Pure planning for the native attachment menu (review MINOR-2): a note with a
 * huge file group must not produce an unbounded flat `Menu` (scroll-hunting a
 * long native menu degrades badly), so entries are capped and the remainder is
 * summarized by one disabled trailing "…and N more" item. Pure so the cap
 * behavior is node-tested; the Obsidian adapter only renders the plan.
 */

/**
 * Max file entries in one attachment menu. 20 fits comfortably on-screen
 * without scrolling at Obsidian's default menu item height.
 */
export const ATTACHMENT_MENU_MAX_ITEMS = 20;

export interface AttachmentMenuPlan {
	readonly visiblePaths: readonly string[];
	/** Disabled trailing summary item for capped-off entries; `null` = nothing capped. */
	readonly overflowText: string | null;
}

export function planAttachmentMenu(paths: readonly string[]): AttachmentMenuPlan {
	if (paths.length <= ATTACHMENT_MENU_MAX_ITEMS) {
		return { visiblePaths: paths, overflowText: null };
	}
	return {
		visiblePaths: paths.slice(0, ATTACHMENT_MENU_MAX_ITEMS),
		overflowText: `…and ${paths.length - ATTACHMENT_MENU_MAX_ITEMS} more`,
	};
}
