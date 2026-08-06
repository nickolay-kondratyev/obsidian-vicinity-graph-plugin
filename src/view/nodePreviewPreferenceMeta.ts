import type { NodePreviewPreference } from "../engine";

/**
 * PER-OPTION UI COPY for the node-preview preference, shared by every surface that
 * renders the pill (the settings tab's row, the graph controls panel) and by the
 * restore-defaults description. Same contract as `forceLayoutFieldMeta`: surfaces
 * share the DATA and duplicate their own markup, because Obsidian's `Setting` API
 * cannot mount inside React.
 *
 * The ROW's own label and description are NOT here: they are row copy for a
 * `keyof ViewSettings` field, so they live with every other row's copy in
 * `settingsRows.ts`. This table is keyed by the VALUE union instead.
 */

export interface NodePreviewOptionMeta {
	/** Segment label — also the accessible name of the option's radio. */
	readonly label: string;
	/** One sentence on what the option does, including its graceful fallback. */
	readonly description: string;
}

/**
 * Per-option copy. A `Record` over the union is compile-time exhaustive, so a new
 * preference cannot ship label-less. The RENDER ORDER comes from
 * `NODE_PREVIEW_PREFERENCES`, never from `Object.keys` — key insertion order is
 * not a contract.
 */
export const NODE_PREVIEW_OPTION_META: Readonly<Record<NodePreviewPreference, NodePreviewOptionMeta>> = {
	auto: {
		label: "Auto",
		description:
			"Outline on the active and pinned notes only (an image above their first heading still wins). Every other note shows its image, or just its title.",
	},
	"title-only": {
		label: "Title only",
		description: "Every note shows just its title — no outline, no image.",
	},
	outline: {
		label: "Outline",
		description: "Prefer the heading outline. Notes without headings still show their image.",
	},
	image: {
		label: "Image",
		description: "Prefer the first image. Notes without an image still show their outline.",
	},
};
