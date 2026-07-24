import { EngineDefaults, SETTINGS_SPEC } from "../engine";
import type { SettingsCommand, SettingsWriteContext } from "./settingsWritePlan";

/**
 * RESTORE-DEFAULTS contract — the ONE mechanism that turns "reset this key-set"
 * into persistence writes, for every scope offered anywhere in the settings tab.
 *
 * Pure (no obsidian, no store): it maps a {@link SettingsResetScope} plus the
 * CURRENT globals to the same {@link SettingsCommand} list every other settings
 * write produces, so a reset travels the identical persist/apply seam as a slider
 * drag. Defaults are read ONLY from `EngineDefaults` / `SETTINGS_SPEC` — never
 * re-typed here, or "restore defaults" could restore a value that was never the
 * default.
 *
 * Scope granularity mirrors the settings tab's five cards, plus the tab-wide
 * scope at the bottom. The UX rule this encodes (obsidian-settings skill): a
 * reset's blast radius must be readable from its label alone, so the label lives
 * HERE next to the key-set it clears — the two cannot drift.
 */

/** One reset affordance: the five per-section scopes plus the tab-wide one. */
export type SettingsResetScope =
	| "depth-defaults"
	| "node-sizing"
	| "force-layout"
	| "node-exclusion"
	| "performance"
	| "all";

export interface SettingsResetScopeSpec {
	/** Row name AND button tooltip copy. MUST name the scope (never a bare "Restore defaults"). */
	readonly label: string;
	/** One sentence spelling out exactly which values change. */
	readonly description: string;
	/** Current globals → the writes that restore this scope's spec defaults. */
	readonly plan: (ctx: SettingsWriteContext) => readonly SettingsCommand[];
}

/**
 * WHY whole-object `global-view` writes with the untouched fields carried over:
 * `saveGlobalView` persists the complete object, exactly as the per-field
 * settings writes do (`planSettingsWrite`) — merging here keeps sibling sections
 * byte-identical across a reset.
 */
export const SETTINGS_RESET_SCOPES: Readonly<Record<SettingsResetScope, SettingsResetScopeSpec>> = {
	"depth-defaults": {
		label: "Restore depth defaults",
		description: "Resets the default outgoing and incoming depth. Per-note depth overrides are kept.",
		plan: () => [{ kind: "global-depths", depths: EngineDefaults.depthSettings() }],
	},
	"node-sizing": {
		label: "Restore node sizing defaults",
		description:
			"Resets every sizing metric and weight, the minimum and maximum node size, and the depth decay k.",
		plan: (ctx) => [
			{ kind: "global-view", view: { ...ctx.globalView, sizing: EngineDefaults.sizingSettings() } },
		],
	},
	"force-layout": {
		label: "Restore force layout defaults",
		description: "Resets all six force layout sliders, including the two under Advanced spacing.",
		plan: (ctx) => [
			{ kind: "global-view", view: { ...ctx.globalView, forceLayout: EngineDefaults.forceLayoutSettings() } },
		],
	},
	"node-exclusion": {
		label: "Restore node exclusion defaults",
		description: "Turns exclusion off and deletes every exclusion pattern.",
		plan: () => [{ kind: "node-exclusion", nodeExclusion: EngineDefaults.nodeExclusionSettings() }],
	},
	performance: {
		label: "Restore performance defaults",
		description: `Resets the node cap to ${SETTINGS_SPEC.globalView.nodeCap.default}.`,
		plan: (ctx) => [
			{ kind: "global-view", view: { ...ctx.globalView, nodeCap: SETTINGS_SPEC.globalView.nodeCap.default } },
		],
	},
	all: {
		label: "Restore all Vicinity Graph settings",
		description:
			"Resets every setting in this tab — depth defaults, node sizing, force layout, node exclusion and performance — to its shipped default.",
		// Whole-slice writes (NOT a merge): this is the one scope that must also
		// clear persisted view fields the tab exposes no control for.
		plan: () => [
			{ kind: "global-depths", depths: EngineDefaults.depthSettings() },
			{ kind: "global-view", view: EngineDefaults.viewSettings() },
			{ kind: "node-exclusion", nodeExclusion: EngineDefaults.nodeExclusionSettings() },
		],
	},
};

/**
 * The per-section scopes, in settings-tab render order. Each settings-tab card
 * ends with exactly one of these (obsidian-settings: a section reset must live
 * INSIDE the boundary it resets).
 */
export const SECTION_RESET_SCOPES = [
	"depth-defaults",
	"node-sizing",
	"force-layout",
	"node-exclusion",
	"performance",
] as const satisfies readonly SettingsResetScope[];

/** The tab-wide scope, rendered once at the bottom behind a confirmation modal. */
export const ALL_SETTINGS_RESET_SCOPE = "all" satisfies SettingsResetScope;

/**
 * Compile-time completeness: a new scope that is neither a section reset nor the
 * tab-wide one surfaces here as a type error naming the orphaned scope.
 */
type PlacedScope = (typeof SECTION_RESET_SCOPES)[number] | typeof ALL_SETTINGS_RESET_SCOPE;
type UnplacedScope = Exclude<SettingsResetScope, PlacedScope>;
export const _assertEveryResetScopePlaced: UnplacedScope extends never ? true : UnplacedScope = true;

export function planSettingsReset(scope: SettingsResetScope, ctx: SettingsWriteContext): readonly SettingsCommand[] {
	return SETTINGS_RESET_SCOPES[scope].plan(ctx);
}
