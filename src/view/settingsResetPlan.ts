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
 * Scope granularity mirrors the settings tab's six cards, plus the tab-wide
 * scope at the bottom. The UX rule this encodes (obsidian-settings skill): a
 * reset's blast radius must be readable from its label alone, so the label lives
 * HERE next to the key-set it clears — the two cannot drift.
 */

/** One reset affordance: the six per-section scopes plus the tab-wide one. */
export type SettingsResetScope =
	| "depth-defaults"
	| "node-sizing"
	| "node-contents"
	| "force-layout"
	| "node-exclusion"
	| "performance"
	| "all";

/**
 * Copy for the "are you sure?" step of a reset — the exact shape
 * {@link ConfirmModal} renders, minus the callback.
 */
export interface SettingsResetConfirmation {
	readonly title: string;
	readonly body: string;
	/** MUST restate the action (never "OK"). */
	readonly confirmText: string;
	/** Verbatim list of the user-authored content about to be destroyed, if any. */
	readonly items?: readonly string[];
}

export interface SettingsResetScopeSpec {
	/** Row name AND button tooltip copy. MUST name the scope (never a bare "Restore defaults"). */
	readonly label: string;
	/** One sentence spelling out exactly which values change. */
	readonly description: string;
	/** Current globals → the writes that restore this scope's spec defaults. */
	readonly plan: (ctx: SettingsWriteContext) => readonly SettingsCommand[];
	/**
	 * Friction scales with blast radius: `null` (or absent) applies the reset
	 * instantly, anything else gates it behind a confirmation. Context-dependent
	 * on purpose — a scope only needs confirming when it actually has something
	 * irreversible to destroy.
	 */
	readonly confirmation?: (ctx: SettingsWriteContext) => SettingsResetConfirmation | null;
}

const CANNOT_BE_UNDONE = "This cannot be undone.";

const ALL_SCOPE_LABEL = "Restore all Vicinity Graph settings";
/**
 * WHY it names what SURVIVES: the label claims "all", but per-note depth
 * overrides and pins live in per-doc files this reset never touches. Without the
 * second sentence a user reads the label as "my per-note work is gone too".
 */
const ALL_SCOPE_DESCRIPTION =
	"Resets every Vicinity Graph setting — depth defaults, node sizing, node contents, force layout, node exclusion and performance — to its shipped default. Per-note depth overrides and pinned notes are kept.";

const EXCLUSION_SCOPE_LABEL = "Restore node exclusion defaults";

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
	"node-contents": {
		label: "Restore node contents defaults",
		description: `Resets the outline depth to ${SETTINGS_SPEC.globalView.outlineMaxDepth.default} heading levels.`,
		plan: (ctx) => [
			{
				kind: "global-view",
				view: { ...ctx.globalView, outlineMaxDepth: SETTINGS_SPEC.globalView.outlineMaxDepth.default },
			},
		],
	},
	"force-layout": {
		label: "Restore force layout defaults",
		// Count-free on purpose: this string said "six" while seven sliders shipped
		// (edge-routing__06) because no test asserts it. Naming the GROUPS instead of
		// counting them keeps it true as fields are added.
		description: "Resets every force layout slider, including the ones under Advanced spacing.",
		plan: (ctx) => [
			{ kind: "global-view", view: { ...ctx.globalView, forceLayout: EngineDefaults.forceLayoutSettings() } },
		],
	},
	"node-exclusion": {
		label: EXCLUSION_SCOPE_LABEL,
		description: "Turns exclusion off and deletes every exclusion pattern.",
		plan: () => [{ kind: "node-exclusion", nodeExclusion: EngineDefaults.nodeExclusionSettings() }],
		/**
		 * The ONE section reset that destroys user-authored CONTENT (hand-written
		 * regexes), not a numeric knob — and the tab hides the patterns textarea
		 * while exclusion is toggled off, so the patterns may not even be on screen.
		 * Confirming (and listing them verbatim) is the only chance the user gets to
		 * see what is about to go. Nothing to destroy → no pointless dialog.
		 */
		confirmation: (ctx) => {
			const { patterns } = ctx.nodeExclusion;
			if (patterns.length === 0) {
				return null;
			}
			const count = `${patterns.length} exclusion pattern${patterns.length === 1 ? "" : "s"}`;
			return {
				title: `${EXCLUSION_SCOPE_LABEL}?`,
				body: `Turns exclusion off and deletes the following ${count}. ${CANNOT_BE_UNDONE}`,
				confirmText: "Delete patterns and restore defaults",
				items: patterns,
			};
		},
	},
	performance: {
		label: "Restore performance defaults",
		description: `Resets the node cap to ${SETTINGS_SPEC.globalView.nodeCap.default}.`,
		plan: (ctx) => [
			{ kind: "global-view", view: { ...ctx.globalView, nodeCap: SETTINGS_SPEC.globalView.nodeCap.default } },
		],
	},
	all: {
		label: ALL_SCOPE_LABEL,
		description: ALL_SCOPE_DESCRIPTION,
		// Whole-slice writes (NOT a merge): this is the one scope that must also
		// clear persisted view fields the tab exposes no control for.
		plan: () => [
			{ kind: "global-depths", depths: EngineDefaults.depthSettings() },
			{ kind: "global-view", view: EngineDefaults.viewSettings() },
			{ kind: "node-exclusion", nodeExclusion: EngineDefaults.nodeExclusionSettings() },
		],
		// Always confirms: the blast radius is the whole plugin, so there is no
		// "nothing to lose" state worth skipping the dialog for.
		confirmation: () => ({
			title: `${ALL_SCOPE_LABEL}?`,
			body: `${ALL_SCOPE_DESCRIPTION} ${CANNOT_BE_UNDONE}`,
			confirmText: "Restore all defaults",
		}),
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
	"node-contents",
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

/**
 * The confirmation this reset must show first, or `null` to apply it straight
 * away. Callers MUST route every reset through here rather than deciding per
 * scope at the call site — that is what keeps "which resets are destructive"
 * answerable in one place.
 */
export function planSettingsResetConfirmation(
	scope: SettingsResetScope,
	ctx: SettingsWriteContext,
): SettingsResetConfirmation | null {
	return SETTINGS_RESET_SCOPES[scope].confirmation?.(ctx) ?? null;
}
