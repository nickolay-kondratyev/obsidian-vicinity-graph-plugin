import type {
	DepthOverride,
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
 * The "which write lands where" contract layer (step-06 #2). Mirrors
 * {@link DocDataMutations}' role for the toolbar/settings surfaces: it decides
 * WHICH persistence call + field + value a user interaction maps to; it never
 * touches Obsidian. The thin obsidian executor (`ControlsActions`, Phase B)
 * switches on the returned {@link SettingsCommand}.
 *
 * Pin-on-toggle at this layer: the planner NEVER inspects whether a depth value
 * equals the global default — an explicit interaction ALWAYS emits the write.
 * Field presence (inherit vs. pinned) is `DocDataMutations`' concern downstream.
 */

/** A user interaction on a control surface (toolbar stepper / sizing / settings tab). */
export type SettingsInteraction =
	/** MAIN's own per-direction depth. `undefined` = reset (unpin the field). */
	| { readonly kind: "main-depth"; readonly direction: Direction; readonly value: number | undefined }
	/** A pinned central's depth as adjusted while THIS doc is MAIN. `undefined` = reset. */
	| {
			readonly kind: "central-depth";
			readonly centralDocid: string;
			readonly direction: Direction;
			readonly value: number | undefined;
	  }
	/** Global default depth for one direction. */
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
	/** → `setDocDepthField(mainFile, field, value)`. */
	| { readonly kind: "doc-depth-field"; readonly field: keyof DepthOverride; readonly value: number | undefined }
	/** → `setCentralDepthField(mainFile, centralDocid, field, value)`. */
	| {
			readonly kind: "central-depth-field";
			readonly centralDocid: string;
			readonly field: keyof DepthOverride;
			readonly value: number | undefined;
	  }
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
		case "main-depth":
			return {
				kind: "doc-depth-field",
				field: DIRECTION_DEPTH_FIELD[interaction.direction],
				value: interaction.value,
			};
		case "central-depth":
			return {
				kind: "central-depth-field",
				centralDocid: interaction.centralDocid,
				field: DIRECTION_DEPTH_FIELD[interaction.direction],
				value: interaction.value,
			};
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
