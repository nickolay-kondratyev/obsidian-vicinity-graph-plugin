import type {
	DepthSettings,
	ForceLayoutSettings,
	FrontmatterLinkSettings,
	NodeExclusionSettings,
	NodePreviewPreference,
	SizingSettings,
	ViewSettings,
} from "../engine";
import { clampSizingSettings } from "../engine";

/**
 * The "which write lands where" contract layer (step-06 #2): it decides WHICH
 * persistence call + field + value a user interaction maps to; it never touches
 * Obsidian. The thin obsidian executor (`SettingsWritePipeline`) switches on the
 * returned {@link SettingsCommand}.
 *
 * Every setting is GLOBAL, so every command here writes `data.json` as a whole
 * object — merging exactly one field over the caller's current globals.
 *
 * WHY every interaction names ONE FIELD and never a whole slice: this function is
 * the ONLY merger, and the pipeline calls it with globals read FRESH inside the
 * serialised write slot. An interaction carrying a whole `SizingSettings` (or
 * `ForceLayoutSettings`, or `NodeExclusionSettings`) would move the merge back
 * out to the caller — which is where the sibling-field clobbering came from: a
 * React control spread its edit over the snapshot it had RENDERED from, so a
 * second edit landing before the next rebuild reverted the first one's field.
 */

/** The sizing rows that carry a single number. Guarded: a new one is a compile error here. */
export type SizingNumberField = keyof SizingSettings;

/** A user interaction on a control surface (panel stepper / sizing / settings tab). */
export type SettingsInteraction =
	/** One global depth budget — applies to MAIN and every pinned central alike. */
	| { readonly kind: "global-depth"; readonly field: keyof DepthSettings; readonly value: number }
	/** Global node cap. */
	| { readonly kind: "global-cap"; readonly value: number }
	/** Global deepest heading level rendered in a node's outline. */
	| { readonly kind: "global-outline-depth"; readonly value: number }
	/** Global preview preference: which region a node's preview slot shows. */
	| { readonly kind: "global-node-preview"; readonly value: NodePreviewPreference }
	/** Whether links between two visible nodes are drawn even when the walk never took them. */
	| { readonly kind: "global-show-cross-links"; readonly showCrossLinks: boolean }
	/** Whether a collapsed folder chain is labelled with its full path instead of the leaf name. */
	| { readonly kind: "global-group-label-full-path"; readonly groupLabelFullPath: boolean }
	/** One sizing clamp (min/max node px). */
	| { readonly kind: "global-sizing-number"; readonly field: SizingNumberField; readonly value: number }
	/** One force-layout tuning value. */
	| {
			readonly kind: "global-force-layout-field";
			readonly field: keyof ForceLayoutSettings;
			readonly value: number;
	  }
	/** Whether node exclusion applies at all (the pattern list is untouched). */
	| { readonly kind: "global-exclusion-enabled"; readonly enabled: boolean }
	/** The exclusion pattern list (the enable flag is untouched). */
	| { readonly kind: "global-exclusion-patterns"; readonly patterns: readonly string[] }
	/** The comma-separated frontmatter id-ref field-name string (stored verbatim). */
	| { readonly kind: "global-id-ref-fields"; readonly idRefFields: string };

/** The persistence call the executor must make. */
export type SettingsCommand =
	/** → `saveGlobalDepths(depths)` (whole object). */
	| { readonly kind: "global-depths"; readonly depths: DepthSettings }
	/** → `saveGlobalView(view)` (whole object). */
	| { readonly kind: "global-view"; readonly view: ViewSettings }
	/** → `saveNodeExclusion(nodeExclusion)` (whole object). */
	| { readonly kind: "node-exclusion"; readonly nodeExclusion: NodeExclusionSettings }
	/** → `saveFrontmatterLinks(frontmatterLinks)` (whole object). */
	| { readonly kind: "frontmatter-links"; readonly frontmatterLinks: FrontmatterLinkSettings };

/** Current globals so whole-object commands can merge exactly one field. */
export interface SettingsWriteContext {
	readonly globalDepths: DepthSettings;
	readonly globalView: ViewSettings;
	readonly nodeExclusion: NodeExclusionSettings;
	readonly frontmatterLinks: FrontmatterLinkSettings;
}

export function planSettingsWrite(interaction: SettingsInteraction, ctx: SettingsWriteContext): SettingsCommand {
	switch (interaction.kind) {
		case "global-depth":
			return {
				kind: "global-depths",
				depths: { ...ctx.globalDepths, [interaction.field]: interaction.value },
			};
		case "global-cap":
			return { kind: "global-view", view: { ...ctx.globalView, nodeCap: interaction.value } };
		case "global-outline-depth":
			return { kind: "global-view", view: { ...ctx.globalView, outlineMaxDepth: interaction.value } };
		case "global-node-preview":
			return { kind: "global-view", view: { ...ctx.globalView, nodePreviewPreference: interaction.value } };
		case "global-show-cross-links":
			return { kind: "global-view", view: { ...ctx.globalView, showCrossLinks: interaction.showCrossLinks } };
		case "global-group-label-full-path":
			return {
				kind: "global-view",
				view: { ...ctx.globalView, groupLabelFullPath: interaction.groupLabelFullPath },
			};
		case "global-sizing-number":
			return sizingCommand(ctx, { ...ctx.globalView.sizing, [interaction.field]: interaction.value });
		case "global-force-layout-field":
			return {
				kind: "global-view",
				view: { ...ctx.globalView, forceLayout: { ...ctx.globalView.forceLayout, [interaction.field]: interaction.value } },
			};
		case "global-exclusion-enabled":
			return { kind: "node-exclusion", nodeExclusion: { ...ctx.nodeExclusion, enabled: interaction.enabled } };
		case "global-exclusion-patterns":
			return { kind: "node-exclusion", nodeExclusion: { ...ctx.nodeExclusion, patterns: interaction.patterns } };
		case "global-id-ref-fields":
			return {
				kind: "frontmatter-links",
				frontmatterLinks: { ...ctx.frontmatterLinks, idRefFields: interaction.idRefFields },
			};
	}
}

/**
 * Sizing is clamped HERE, the one choke point every sizing surface (the in-view
 * React panel and the settings tab) writes through: an `<input min=…>` does not
 * block a TYPED value, so a `-1` / `1e999` would otherwise reach the live
 * session's node geometry unvetted.
 */
function sizingCommand(ctx: SettingsWriteContext, sizing: SizingSettings): SettingsCommand {
	return { kind: "global-view", view: { ...ctx.globalView, sizing: clampSizingSettings(sizing) } };
}
