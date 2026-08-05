import { EngineDefaults, SETTINGS_SPEC } from "../engine";
import { NODE_PREVIEW_OPTION_META } from "./nodePreviewPreferenceMeta";
import type { SettingsSection } from "./settingsSectionFields";
import { SECTION_SETTINGS_FIELDS, SETTINGS_SECTIONS } from "./settingsSectionFields";
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

/**
 * One reset affordance: the six per-section scopes plus the tab-wide one.
 *
 * WHY-NOT `SettingsSection | typeof ALL_SETTINGS_RESET_SCOPE`:
 * `ALL_SETTINGS_RESET_SCOPE` is declared as `"all" satisfies SettingsResetScope`,
 * so referring to its `typeof` here closes a cycle (`TS2456` + `TS7022`). The
 * literal keeps the two in lockstep just as well, because that `satisfies` still
 * checks the constant against this union.
 */
export type SettingsResetScope = SettingsSection | "all";

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
 * WHY it names what SURVIVES: the label claims "all", but the pinned set is not
 * a setting and this reset never touches it. Without the second sentence a user
 * reads the label as "my pins are gone too".
 */
const ALL_SCOPE_DESCRIPTION =
	"Resets every Vicinity Graph setting — depth defaults, edges, node sizing, node contents, force layout, node exclusion and performance — to its shipped default. Pinned notes are kept.";

const EXCLUSION_SCOPE_LABEL = "Restore node exclusion defaults";

/** `current`, with every listed key restored from `defaults`. Siblings untouched. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
function restoreFields<T extends object>(current: T, defaults: T, keys: readonly (keyof T)[]): T {
	// The cast only strips `readonly` off a generic; every write below is to a key
	// of T with a value of T's own type for that key.
	const restored = { ...current } as Mutable<T>;
	for (const key of keys) {
		restored[key] = defaults[key];
	}
	return restored;
}

/**
 * The commands one SECTION's reset emits, DERIVED from the section's declared
 * key set ({@link SECTION_SETTINGS_FIELDS}) — so a field that gains a home in a
 * card automatically gains a scoped restore, and the two cannot drift.
 *
 * WHY whole-object writes with the untouched fields carried over:
 * `saveGlobalView` persists the complete object, exactly as the per-field
 * settings writes do (`planSettingsWrite`) — merging here keeps sibling sections
 * byte-identical across a reset.
 *
 * Emission order is view → depth → exclusion. It IS observable: `applyReset`
 * awaits each command in turn and each is a full `data.json` rewrite. Every
 * section today owns fields of exactly ONE family, so this order reproduces the
 * hand-written plans byte-for-byte; the order is pinned here for the day a
 * section spans families.
 */
function planSectionReset(section: SettingsSection, ctx: SettingsWriteContext): readonly SettingsCommand[] {
	const fields = SECTION_SETTINGS_FIELDS[section];
	const commands: SettingsCommand[] = [];
	if (fields.view.length > 0) {
		commands.push({
			kind: "global-view",
			view: restoreFields(ctx.globalView, EngineDefaults.viewSettings(), fields.view),
		});
	}
	if (fields.depth.length > 0) {
		commands.push({
			kind: "global-depths",
			depths: restoreFields(ctx.globalDepths, EngineDefaults.depthSettings(), fields.depth),
		});
	}
	if (fields.exclusion.length > 0) {
		commands.push({
			kind: "node-exclusion",
			nodeExclusion: restoreFields(ctx.nodeExclusion, EngineDefaults.nodeExclusionSettings(), fields.exclusion),
		});
	}
	return commands;
}
export const SETTINGS_RESET_SCOPES: Readonly<Record<SettingsResetScope, SettingsResetScopeSpec>> = {
	"depth-defaults": {
		label: "Restore depth defaults",
		description: "Resets the link and embed depths for the active note and for pinned notes.",
		plan: (ctx) => planSectionReset("depth-defaults", ctx),
	},
	edges: {
		label: "Restore edges defaults",
		// Deliberately does not state WHICH way the toggle lands: that literal lives in
		// `SETTINGS_SPEC` alone, and a re-typed one here could outlive a retune.
		description: "Resets whether cross links — links between visible notes the graph never walked — are drawn.",
		plan: (ctx) => planSectionReset("edges", ctx),
	},
	"node-sizing": {
		label: "Restore node sizing defaults",
		description:
			"Resets the minimum and maximum node size.",
		plan: (ctx) => planSectionReset("node-sizing", ctx),
	},
	"node-contents": {
		label: "Restore node contents defaults",
		// The preview LABEL is read from the shared option copy — a re-typed "Auto"
		// here could outlive a copy change and describe a value that never resets.
		description:
			`Resets the outline depth to ${SETTINGS_SPEC.globalView.outlineMaxDepth.default} heading levels ` +
			`and the node preview to ${NODE_PREVIEW_OPTION_META[SETTINGS_SPEC.globalView.nodePreviewPreference.default].label}.`,
		plan: (ctx) => planSectionReset("node-contents", ctx),
	},
	"force-layout": {
		label: "Restore force layout defaults",
		// Count-free on purpose: this string said "six" while seven sliders shipped
		// (edge-routing__06) because no test asserts it. Naming the GROUPS instead of
		// counting them keeps it true as fields are added.
		description: "Resets every force layout slider, including the ones under Advanced spacing.",
		plan: (ctx) => planSectionReset("force-layout", ctx),
	},
	"node-exclusion": {
		label: EXCLUSION_SCOPE_LABEL,
		description: "Turns exclusion off and deletes every exclusion pattern.",
		plan: (ctx) => planSectionReset("node-exclusion", ctx),
		/**
		 * The ONE section reset that destroys user-authored CONTENT (hand-written
		 * regexes), not a numeric knob. Confirming — and listing them VERBATIM — is
		 * what makes the loss reviewable: the textarea can be scrolled off screen, or
		 * DISABLED because exclusion is off (the row is always rendered, so it is
		 * visible but easy to read past). Nothing to destroy → no pointless dialog.
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
		plan: (ctx) => planSectionReset("performance", ctx),
	},
	all: {
		label: ALL_SCOPE_LABEL,
		description: ALL_SCOPE_DESCRIPTION,
		// Whole-slice writes (NOT a merge, and deliberately NOT derived from the
		// section map): this is the one scope that must also clear persisted view
		// fields the tab exposes no control for. Deriving it would make it only as
		// complete as the section map — precisely the thing it exists to be
		// independent of.
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

/** The tab-wide scope, rendered once at the bottom behind a confirmation modal. */
export const ALL_SETTINGS_RESET_SCOPE = "all" satisfies SettingsResetScope;

/**
 * TAUTOLOGICAL BY CONSTRUCTION as of the descriptor-model ticket, and kept
 * deliberately: with {@link SettingsResetScope} derived from
 * {@link SETTINGS_SECTIONS} — which is also the one tuple the per-section scopes
 * are read from, each settings-tab card ending with exactly one of them
 * (obsidian-settings: a section reset must live INSIDE the boundary it resets) —
 * `UnplacedScope` cannot be anything but `never`, so this can no longer fail.
 *
 * What carries the guarantee now is the
 * `Readonly<Record<SettingsResetScope, SettingsResetScopeSpec>>` annotation on
 * {@link SETTINGS_RESET_SCOPES} — which is STRICTLY STRONGER, because it also
 * forces a reset spec for a newly added SECTION (previously unguarded).
 *
 * Retained rather than deleted so it goes live again the moment the scope union
 * and the section list are ever decoupled. Annotated rather than left silent
 * because a guard that cannot fail while READING as protection is a POLS
 * violation.
 */
type PlacedScope = (typeof SETTINGS_SECTIONS)[number] | typeof ALL_SETTINGS_RESET_SCOPE;
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
