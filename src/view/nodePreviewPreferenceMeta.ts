import type { NodePreviewPreference } from "../engine";

/**
 * UI COPY for the node-preview preference, shared by every surface that names it
 * (the settings tab's row, the graph controls panel, the restore-defaults
 * description). Same contract as `forceLayoutFieldMeta`: surfaces share the DATA
 * and duplicate their own markup, because Obsidian's `Setting` API cannot mount
 * inside React.
 */

/**
 * Names the SETTING, on the settings-tab row and as the `aria-label` of both
 * radiogroups. The panel repeats it as a visible row label: a bare
 * Auto/Outline/Image trio never says what it switches.
 */
export const NODE_PREVIEW_ROW_LABEL = "Preview";

/**
 * Row description. It states the case where the preference actually bites (a
 * note with BOTH), because that is the only situation the three options differ
 * in — the graceful fallback is the second sentence so nobody fears a blank node.
 */
export const NODE_PREVIEW_ROW_DESCRIPTION =
	"Which preview a node shows when it has both a heading outline and an image. " +
	"A note that only has one of the two always shows that one.";

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
		description: "Let the note decide: the image wins only when it sits before the first heading.",
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
