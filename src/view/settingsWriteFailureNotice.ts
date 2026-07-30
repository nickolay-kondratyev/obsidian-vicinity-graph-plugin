import type { SettingsResetScope } from "./settingsResetPlan";
import { SETTINGS_RESET_SCOPES } from "./settingsResetPlan";
import type { SettingsRowControl } from "./settingsRows";
import { EVERY_SETTINGS_ROW, unhandledRowControl } from "./settingsRows";
import type { SettingsInteraction } from "./settingsWritePlan";

/**
 * WHAT THE USER IS TOLD when a settings write does not reach `data.json` — the copy
 * half of the ONE failure policy `SettingsWritePipeline` applies (the pipeline owns
 * WHEN a notice is shown; this owns WHAT it says).
 *
 * WHY it names the setting: a failed persist otherwise looks like nothing happened —
 * the optimistic control releases its override and the old value comes back, with no
 * reason given. "Couldn't save" plus the name of the row the user just touched is the
 * whole difference between a silent revert and an explained one.
 *
 * The name is READ from the declared row model, never re-typed: the notice must say
 * exactly what the row that failed is labelled, on either surface. Same for a reset —
 * its subject is the declared scope label, so the notice's blast radius matches the
 * button's.
 *
 * Pure (no `obsidian`): the notice SURFACE is a `UserNoticePort`, so this module only
 * produces the string.
 */
export class SettingsWriteFailureNotice {
	/**
	 * Every declared row's label, keyed by its control identity ({@link controlKey}).
	 * Built once — the row model is static data.
	 */
	private static readonly ROW_LABELS: ReadonlyMap<string, string> = new Map(
		EVERY_SETTINGS_ROW.map((row) => [SettingsWriteFailureNotice.controlKey(row.control), row.label]),
	);

	/** One control's edit that never reached disk. */
	static forInteraction(interaction: SettingsInteraction): string {
		return SettingsWriteFailureNotice.notice(
			SettingsWriteFailureNotice.rowLabel(SettingsWriteFailureNotice.controlFor(interaction)),
		);
	}

	/** One restore-defaults scope that never reached disk. */
	static forReset(scope: SettingsResetScope): string {
		return SettingsWriteFailureNotice.notice(SETTINGS_RESET_SCOPES[scope].label);
	}

	/**
	 * Points at the console rather than at a remedy: the cause is whatever Obsidian's
	 * `saveData` rejected with (a locked vault, a full disk, a sync conflict), and
	 * guessing which would be a lie. Naming the plugin is required — Obsidian's notices
	 * are chrome-less, so an unattributed one reads as coming from the app.
	 */
	private static notice(subject: string): string {
		return `Vicinity graph couldn't save “${subject}”. See the developer console for details.`;
	}

	/**
	 * The declared label of the row this control belongs to; the control's own key when
	 * no row declares it. The fallback is deliberately un-pretty and deliberately not a
	 * throw: this runs INSIDE a failure handler, so it must always produce something —
	 * `settingsRowSpecCoverage.test.ts` is what keeps every shipped setting declared.
	 */
	private static rowLabel(control: SettingsRowControl): string {
		return SettingsWriteFailureNotice.ROW_LABELS.get(SettingsWriteFailureNotice.controlKey(control)) ?? control.kind;
	}

	/**
	 * The row control an interaction edits. A SECOND switch rather than an
	 * interaction→key mapping on purpose: the key format is then spelled once
	 * ({@link controlKey}), so the two sides cannot drift into keys that never match.
	 */
	private static controlFor(interaction: SettingsInteraction): SettingsRowControl {
		switch (interaction.kind) {
			case "global-depth":
				return { kind: "depth", field: interaction.field };
			case "global-cap":
				return { kind: "node-cap" };
			case "global-outline-depth":
				return { kind: "outline-depth" };
			case "global-node-preview":
				return { kind: "node-preview" };
			case "global-sizing-number":
				return { kind: "sizing-number", field: interaction.field };
			// One ROW carries both of a metric's controls (its enable flag and the weight
			// that flag governs), so both interactions name the same row.
			case "global-sizing-metric-enabled":
			case "global-sizing-metric-weight":
				return { kind: "sizing-metric", metric: interaction.metric };
			case "global-force-layout-field":
				return { kind: "force-layout", field: interaction.field };
			case "global-exclusion-enabled":
				return { kind: "exclusion-enabled" };
			case "global-exclusion-patterns":
				return { kind: "exclusion-patterns" };
		}
	}

	/**
	 * A control's identity as a lookup key: its kind, plus the field it names where the
	 * kind alone would collide (three depths, three sizing numbers, seven force-layout
	 * sliders, five metrics). Exhaustive and closed by {@link unhandledRowControl}, so a
	 * new field-bearing control kind cannot silently key on its bare kind and label
	 * every one of its rows with the first one's copy.
	 */
	private static controlKey(control: SettingsRowControl): string {
		switch (control.kind) {
			case "depth":
				return `depth:${control.field}`;
			case "sizing-metric":
				return `sizing-metric:${control.metric}`;
			case "sizing-number":
				return `sizing-number:${control.field}`;
			case "force-layout":
				return `force-layout:${control.field}`;
			case "node-preview":
			case "outline-depth":
			case "exclusion-enabled":
			case "exclusion-patterns":
			case "node-cap":
				return control.kind;
			default:
				return unhandledRowControl(control);
		}
	}
}
