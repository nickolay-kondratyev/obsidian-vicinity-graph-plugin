import type { GroupingMode } from "../engine";

/**
 * PER-OPTION UI COPY for the grouping mode, shared by every surface that renders
 * the Folders | Tags pill: the settings tab's row, the controls panel's row and the
 * graph's own top-right toggle. Same contract as `nodePreviewPreferenceMeta.ts`:
 * surfaces share the DATA and duplicate their own markup (Obsidian's `Setting` API
 * cannot mount inside React). The ROW's label/description live in `settingsRows.ts`.
 */
export interface GroupingModeOptionMeta {
	/** Segment label — also the accessible name of the option's radio. */
	readonly label: string;
	/** One sentence on what the option does — the segment's tooltip. */
	readonly description: string;
}

/**
 * Per-option copy. A `Record` over the union is compile-time exhaustive; the RENDER
 * ORDER comes from `GROUPING_MODES`, never from `Object.keys`.
 */
export const GROUPING_MODE_OPTION_META: Readonly<Record<GroupingMode, GroupingModeOptionMeta>> = {
	folders: {
		label: "Folders",
		description: "Draw a box around the notes that share a folder.",
	},
	tags: {
		label: "Tags",
		description:
			"Draw a coloured box around the notes that share tags. A note's other tags show as small chips under it.",
	},
};
