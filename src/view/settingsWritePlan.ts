import type {
	DepthSettings,
	Direction,
	ForceLayoutSettings,
	NodeExclusionSettings,
	NodePreviewPreference,
	SizingSettings,
	ViewSettings,
} from "../engine";
import { DIRECTION_DEPTH_FIELD, clampSizingSettings } from "../engine";

/**
 * The "which write lands where" contract layer (step-06 #2): it decides WHICH
 * persistence call + field + value a user interaction maps to; it never touches
 * Obsidian. The thin obsidian executor (`ControlsActions`) switches on the
 * returned {@link SettingsCommand}.
 *
 * Every setting is GLOBAL, so every command here writes `data.json` as a whole
 * object — merging exactly one field over the caller's current globals.
 */

/** A user interaction on a control surface (panel stepper / sizing / settings tab). */
export type SettingsInteraction =
	/** The depth for one direction — applies to MAIN and every pinned central alike. */
	| { readonly kind: "global-depth"; readonly direction: Direction; readonly value: number }
	/** Global node cap. */
	| { readonly kind: "global-cap"; readonly value: number }
	/** Global deepest heading level rendered in a node's outline. */
	| { readonly kind: "global-outline-depth"; readonly value: number }
	/** Global preview preference: which region a node's preview slot shows. */
	| { readonly kind: "global-node-preview"; readonly value: NodePreviewPreference }
	/** Global sizing configuration (whole object). */
	| { readonly kind: "global-sizing"; readonly sizing: SizingSettings }
	/** Global force-layout tuning (whole object — sliders and restore-defaults both send it complete). */
	| { readonly kind: "global-force-layout"; readonly forceLayout: ForceLayoutSettings }
	/** Global node exclusion (whole object — pill flips `enabled`, settings tab edits `patterns`). */
	| { readonly kind: "global-node-exclusion"; readonly nodeExclusion: NodeExclusionSettings };

/** The persistence call the executor must make. */
export type SettingsCommand =
	/** → `saveGlobalDepths(depths)` (whole object). */
	| { readonly kind: "global-depths"; readonly depths: DepthSettings }
	/** → `saveGlobalView(view)` (whole object). */
	| { readonly kind: "global-view"; readonly view: ViewSettings }
	/** → `saveNodeExclusion(nodeExclusion)` (whole object). */
	| { readonly kind: "node-exclusion"; readonly nodeExclusion: NodeExclusionSettings };

/** Current globals so whole-object commands can merge exactly one field. */
export interface SettingsWriteContext {
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	readonly nodeExclusion: NodeExclusionSettings;
}

export function planSettingsWrite(interaction: SettingsInteraction, ctx: SettingsWriteContext): SettingsCommand {
	switch (interaction.kind) {
		case "global-depth":
			return {
				kind: "global-depths",
				depths: { ...ctx.globalDepths, [DIRECTION_DEPTH_FIELD[interaction.direction]]: interaction.value },
			};
		case "global-cap":
			return { kind: "global-view", view: { ...ctx.globalView, nodeCap: interaction.value } };
		case "global-outline-depth":
			return { kind: "global-view", view: { ...ctx.globalView, outlineMaxDepth: interaction.value } };
		case "global-node-preview":
			return { kind: "global-view", view: { ...ctx.globalView, nodePreviewPreference: interaction.value } };
		case "global-sizing":
			// Clamped HERE, the one choke point both sizing surfaces (the in-view
			// React panel and the settings tab) write through: an `<input min=…>`
			// does not block a TYPED value, so a `-1` / `1e999` would otherwise
			// reach the live session's node geometry unvetted.
			return { kind: "global-view", view: { ...ctx.globalView, sizing: clampSizingSettings(interaction.sizing) } };
		case "global-force-layout":
			return { kind: "global-view", view: { ...ctx.globalView, forceLayout: interaction.forceLayout } };
		case "global-node-exclusion":
			return { kind: "node-exclusion", nodeExclusion: interaction.nodeExclusion };
	}
}
