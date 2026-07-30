import type {
	DepthSettings,
	Direction,
	ForceLayoutSettings,
	NodeExclusionSettings,
	NodePreviewPreference,
	SizeMetricId,
	SizingSettings,
	ViewSettings,
} from "../engine";
import { DIRECTION_DEPTH_FIELD, clampSizingSettings } from "../engine";

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
export type SizingNumberField = Exclude<keyof SizingSettings, "metrics">;

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
	/** One sizing number (min/max px, depth decay). */
	| { readonly kind: "global-sizing-number"; readonly field: SizingNumberField; readonly value: number }
	/** Whether one size metric contributes at all. */
	| { readonly kind: "global-sizing-metric-enabled"; readonly metric: SizeMetricId; readonly enabled: boolean }
	/** One size metric's contribution weight. */
	| { readonly kind: "global-sizing-metric-weight"; readonly metric: SizeMetricId; readonly weight: number }
	/** One force-layout tuning value. */
	| {
			readonly kind: "global-force-layout-field";
			readonly field: keyof ForceLayoutSettings;
			readonly value: number;
	  }
	/** Whether node exclusion applies at all (the pattern list is untouched). */
	| { readonly kind: "global-exclusion-enabled"; readonly enabled: boolean }
	/** The exclusion pattern list (the enable flag is untouched). */
	| { readonly kind: "global-exclusion-patterns"; readonly patterns: readonly string[] };

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
		case "global-sizing-number":
			return sizingCommand(ctx, { ...ctx.globalView.sizing, [interaction.field]: interaction.value });
		case "global-sizing-metric-enabled":
			return sizingCommand(ctx, withMetric(ctx.globalView.sizing, interaction.metric, { enabled: interaction.enabled }));
		case "global-sizing-metric-weight":
			return sizingCommand(ctx, withMetric(ctx.globalView.sizing, interaction.metric, { weight: interaction.weight }));
		case "global-force-layout-field":
			return {
				kind: "global-view",
				view: { ...ctx.globalView, forceLayout: { ...ctx.globalView.forceLayout, [interaction.field]: interaction.value } },
			};
		case "global-exclusion-enabled":
			return { kind: "node-exclusion", nodeExclusion: { ...ctx.nodeExclusion, enabled: interaction.enabled } };
		case "global-exclusion-patterns":
			return { kind: "node-exclusion", nodeExclusion: { ...ctx.nodeExclusion, patterns: interaction.patterns } };
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

/** One metric's patch merged over the CURRENT metric table — sibling metrics carried over. */
function withMetric(
	sizing: SizingSettings,
	metric: SizeMetricId,
	patch: { readonly enabled?: boolean; readonly weight?: number },
): SizingSettings {
	return { ...sizing, metrics: { ...sizing.metrics, [metric]: { ...sizing.metrics[metric], ...patch } } };
}
