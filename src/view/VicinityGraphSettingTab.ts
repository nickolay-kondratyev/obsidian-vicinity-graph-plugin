import { PluginSettingTab, Setting } from "obsidian";
import type { App, TextAreaComponent, TextComponent, ToggleComponent } from "obsidian";
import type {
	Channel,
	ForceLayoutSettings,
	SettingsRange,
	SizeMetricId,
	SizingMetricSetting,
} from "../engine";
import {
	CHANNEL_DEPTH_FIELD,
	FORCE_LAYOUT_RANGES,
	MAX_OUTLINE_DEPTH,
	MIN_NODE_CAP,
	MIN_OUTLINE_DEPTH,
	NODE_PREVIEW_PREFERENCES,
	SETTINGS_SPEC,
	SIZING_RANGES,
	clampOutlineMaxDepth,
} from "../engine";
import type VicinityGraphPlugin from "../main";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import { ConfirmModal } from "./ConfirmModal";
import { MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH, SETTINGS_WRITE_DEBOUNCE_MS, clampStepperDepth } from "./constants";
import { NODE_PREVIEW_OPTION_META } from "./nodePreviewPreferenceMeta";
import { DebouncedSettingsWrites } from "./settingsDebounce";
import type { SettingsResetScope } from "./settingsResetPlan";
import { ALL_SETTINGS_RESET_SCOPE, SETTINGS_RESET_SCOPES } from "./settingsResetPlan";
import type { SettingsResetTarget } from "./settingsResetSequence";
import { SettingsResetSequence } from "./settingsResetSequence";
import type { SettingsGroup, SettingsRow, SettingsRowBlock, SettingsRowState } from "./settingsRows";
import { SETTINGS_GROUPS, SettingsRowNames, isSettingsRowDisabled, unhandledRowControl } from "./settingsRows";
import type { SettingsSection } from "./settingsSectionFields";
import { SETTINGS_SECTIONS } from "./settingsSectionFields";
import type { SettingsFeedback } from "./settingsValidation";
import { describeInvalidExclusionPatterns, parseExclusionPatterns } from "./settingsValidation";
import type { SettingsWritePipeline } from "./settingsWritePipeline";
import type { SettingsInteraction, SizingNumberField } from "./settingsWritePlan";
import { parseSizingInput } from "./sizingInput";
import type { SizingRowVerdict } from "./sizingRowWrite";
import { SizingRowWrite } from "./sizingRowWrite";

/**
 * The plugin's global settings tab — one of the TWO presenters of the declared row
 * model in `settingsRows.ts` (the other is the in-graph React panel). It renders
 * `SETTINGS_GROUPS` verbatim: card order, headings, row order, labels,
 * descriptions, accessible names and `disabledWhen` are all read from there, so
 * nothing about WHAT the settings are is decided in this file. What IS decided here
 * is HOW Obsidian's `Setting` API expresses each control kind.
 *
 * On edit, a control names a {@link SettingsInteraction} and hands it to the shared
 * {@link SettingsWritePipeline} — the SAME object the controls panel writes
 * through. Serialisation, the merge base, the persist call and the refresh fan-out
 * all live there, so this class holds no write logic at all.
 *
 * EVERY setting on this tab is global (owner decision 2026-07-29): there is no
 * per-note or per-view stored state for anything here to override.
 */

/** Visible height of the exclusion-patterns textarea (one pattern per line). */
const EXCLUSION_TEXTAREA_ROWS = 4;

/** Outline-depth slider granularity — from the spec, like its bounds (one source of truth). */
const OUTLINE_DEPTH_SLIDER_STEP = SETTINGS_SPEC.globalView.outlineMaxDepth.step;

/** Depth sliders move one hop at a time — depths are whole hops. */
const DEPTH_SLIDER_STEP = 1;

/** The node cap is a whole number of nodes. */
const NODE_CAP_STEP = 1;

/**
 * Shared `name` of the Preview pill's radios. Radio grouping is DOCUMENT-scoped
 * for inputs outside a `<form>`, so this must NOT be shared with the controls
 * panel's pill: with both mounted, one name would fuse the two groups and they
 * would un-check each other. Hence a tab-local constant here and a `useId()`
 * there — the shared row model deliberately does not own the name.
 */
const NODE_PREVIEW_RADIO_GROUP = "vicinity-graph-node-preview-settings";

/**
 * One rendered control whose enabled-ness is declared by the row's `disabledWhen`
 * rather than by its own value. Collected while rendering so a later write can
 * re-apply every verdict from ONE fresh read.
 */
interface DependentControl {
	readonly row: SettingsRow;
	readonly setDisabled: (disabled: boolean) => void;
}

export class VicinityGraphSettingTab extends PluginSettingTab {
	/**
	 * Every TYPED field writes through here, so a multi-keystroke entry costs ONE
	 * persist + rebuild instead of one per character. Keyed by the row's visible
	 * name — already unique per row, and already the control's accessible name, so
	 * there is no parallel id table to keep in sync.
	 */
	private readonly debounced: DebouncedSettingsWrites;

	/**
	 * Restore-defaults ordering — including "rebuild the controls only once the
	 * write pipeline is idle", which is what keeps a reset from redisplaying ahead
	 * of a control the user used while it ran.
	 */
	private readonly resets: SettingsResetSequence;

	/** Rebuilt by every {@link display}; see {@link DependentControl}. */
	private dependents: DependentControl[] = [];

	constructor(
		app: App,
		private readonly plugin: VicinityGraphPlugin,
	) {
		super(app, plugin);
		this.debounced = new DebouncedSettingsWrites(SETTINGS_WRITE_DEBOUNCE_MS, this.writes);
		const resetTarget: SettingsResetTarget = {
			flushTypedEdits: () => this.settlePendingWrites(),
			writeDefaults: (scope) => this.writes.restoreDefaults(scope),
			drainWrites: () => this.writes.drain(),
			redisplay: () => this.display(),
		};
		this.resets = new SettingsResetSequence(resetTarget);
	}

	private get store(): PluginDataStore {
		return this.plugin.pluginDataStore;
	}

	/** THE settings write pipeline — one per plugin, shared with every controls panel. */
	private get writes(): SettingsWritePipeline {
		return this.plugin.settingsWrites;
	}

	/** The globals every row seeds from, read as ONE snapshot (see {@link SettingsRowState}). */
	private rowState(): SettingsRowState {
		return {
			globalDepths: this.store.globalDepths(),
			globalView: this.store.globalView(),
			nodeExclusion: this.store.nodeExclusion(),
		};
	}

	/**
	 * The tab's ONE accessibility rule lives in {@link SettingsRowNames} (shared with
	 * the panel); this is only the Obsidian mechanics of applying it. Obsidian renders
	 * a row's name in a SIBLING element of `.setting-item-control` with no `for`/`id`
	 * pairing, so the bare `input`/`button` has no accessible name of its own —
	 * without this, the seven force-layout sliders all announce identically.
	 * `e2e/settingsUxVisual.e2e.ts` fails if any input in the tab lacks one.
	 *
	 * Note (verified on 1.12.7): Obsidian pops its own hover tooltip for ANY element
	 * carrying an `aria-label`, so a named control gains a tooltip of that same text
	 * for free — which is why nothing here calls `setTooltip` as well.
	 */
	private static nameControl(el: HTMLElement, accessibleName: string): void {
		el.setAttribute("aria-label", accessibleName);
	}

	/**
	 * The same rule for a toggle, which cannot use {@link nameControl} directly:
	 * `ToggleComponent` exposes only `toggleEl`, and on Obsidian 1.12.7 that is the
	 * wrapping `<label class="checkbox-container">` — not the checkbox. Verified
	 * against the RENDERED DOM (the typings say only `HTMLElement`); the label is
	 * empty, which is exactly why the checkbox inside it has no name to inherit.
	 *
	 * The name must land on the `<input>`: `aria-label` on a `<label>` does not name
	 * the control it wraps — a label names it by its TEXT, and putting text here
	 * would change how the pill looks.
	 *
	 * Does nothing (rather than throwing) if that markup ever changes: a missing
	 * a11y attribute must not take the whole settings tab down. `e2e/settingsUxVisual.e2e.ts`
	 * is what fails loudly, on any unnamed checkbox in the tab.
	 */
	private static nameToggle(toggle: ToggleComponent, accessibleName: string): void {
		const checkbox = toggle.toggleEl.querySelector("input");
		if (checkbox !== null) {
			VicinityGraphSettingTab.nameControl(checkbox, accessibleName);
		}
	}

	/**
	 * Re-seeds every control from the store, walking the declared row model in
	 * order — so adding a row anywhere is a data edit, never an edit here.
	 *
	 * Callers that re-render after a write must `await this.settlePendingWrites()`
	 * FIRST: this method reads the globals synchronously, so a debounced write
	 * draining afterwards would leave the tab displaying a value the store no longer
	 * holds.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		// Scope class for the settings-tab card styling (src/view/settings-tab.css).
		containerEl.addClass("vicinity-graph-settings");
		this.dependents = [];

		// ONE store snapshot per render: every row below shows values from the same
		// instant, so two rows of one card can never disagree about the same write.
		const state = this.rowState();
		for (const section of SETTINGS_SECTIONS) {
			this.renderSection(SETTINGS_GROUPS[section], section, state);
		}
		this.renderRestoreAll();
	}

	/**
	 * One framed card per section (settings-ux CLARIFICATION #2: CSS-only visual
	 * grouping, no collapsibles at the CARD level — a block may still declare one).
	 * The scoped restore row is always LAST, inside the frame: a reset rendered after
	 * the frame closes reads as a tab-wide reset.
	 */
	private renderSection(group: SettingsGroup, section: SettingsSection, state: SettingsRowState): void {
		const card = this.containerEl.createDiv({ cls: "vicinity-graph-settings-section" });
		new Setting(card).setName(group.heading).setHeading();
		if (group.description !== undefined) {
			new Setting(card).setDesc(group.description);
		}
		for (const block of group.blocks) {
			this.renderBlock(card, block, state);
		}
		// Every section IS a reset scope (`SettingsResetScope = SettingsSection | "all"`).
		this.addSectionReset(card, section);
	}

	/**
	 * A declared row block. `collapsedUnder` becomes a native `<details>` because
	 * Obsidian's `Setting` API has no collapsible group of its own, and a native
	 * element keeps it dependency-free.
	 */
	private renderBlock(card: HTMLElement, block: SettingsRowBlock, state: SettingsRowState): void {
		let container = card;
		if (block.collapsedUnder !== undefined) {
			container = card.createEl("details", { cls: "vicinity-graph-settings-advanced" });
			container.createEl("summary", { text: block.collapsedUnder });
		}
		for (const row of block.rows) {
			this.addRow(container, row, state);
		}
	}

	/**
	 * The tab's HALF of the row contract: which Obsidian control expresses each
	 * declared kind. EXHAUSTIVE by `switch` on purpose — a new control kind in
	 * `settingsRows.ts` fails to compile HERE and in the panel's twin
	 * (`SettingsRowView.tsx`), which is what makes parity structural.
	 *
	 * The `default` arm is what earns that claim on THIS surface: the method returns
	 * `void`, so without {@link unhandledRowControl}'s `never` parameter a missing case
	 * would just fall through and render nothing (the panel's twin gets it from its
	 * `ReactElement` return type instead).
	 */
	private addRow(container: HTMLElement, row: SettingsRow, state: SettingsRowState): void {
		switch (row.control.kind) {
			case "depth":
				this.addDepthSlider(container, row, row.control.channel, state);
				return;
			case "sizing-metric":
				this.addSizingMetricRow(container, row, row.control.metric, state);
				return;
			case "sizing-number":
				this.addSizingNumber(container, row, row.control.field);
				return;
			case "node-preview":
				this.addNodePreview(container, row, state);
				return;
			case "outline-depth":
				this.addOutlineDepthSlider(container, row, state);
				return;
			case "force-layout":
				this.addForceLayoutSlider(container, row, row.control.field, state);
				return;
			case "exclusion-enabled":
				this.addExclusionToggle(container, row, state);
				return;
			case "exclusion-patterns":
				this.addExclusionPatterns(container, row, state);
				return;
			case "node-cap":
				this.addNodeCap(container, row, state);
				return;
			default:
				return unhandledRowControl(row.control);
		}
	}

	/**
	 * Re-applies every declared `disabledWhen` verdict.
	 *
	 * Called TWICE around a write that a dependent row reads: once synchronously with
	 * the state the click implies (so the row answers immediately, in click order —
	 * the newest click paints last), then again with a FRESH read once the write has
	 * landed, which is the authoritative pass. Both are idempotent.
	 */
	private applyRowDependencies(state: SettingsRowState): void {
		for (const dependent of this.dependents) {
			dependent.setDisabled(isSettingsRowDisabled(dependent.row, state));
		}
	}

	/**
	 * Leaving the tab must not lose the keystrokes still inside the debounce
	 * window — a debounce that swallows the user's last edit is worse than none.
	 */
	hide(): void {
		void this.settlePendingWrites();
		super.hide();
	}

	/**
	 * A field that lost focus has finished being typed: persist it now instead of
	 * making the user wait out the settle window.
	 */
	private flushOnBlur(input: HTMLElement): void {
		input.addEventListener("blur", () => {
			void this.settlePendingWrites();
		});
	}

	/**
	 * Drains the debounce window and RESOLVES either way. Awaited before anything
	 * that re-reads the globals (a reset, a re-render), because a write still inside
	 * the window would otherwise drain afterwards and quietly undo part of it.
	 *
	 * Swallowing-with-a-log is deliberate: a failed `data.json` write must not abort
	 * the reset the user just asked for, and `flush()`'s rejection has nowhere else
	 * to go — the alternative is the unhandled rejection this replaces.
	 */
	private async settlePendingWrites(): Promise<void> {
		try {
			await this.debounced.flush();
		} catch (error) {
			console.error("vicinity-graph: failed to persist a settings change", error);
		}
	}

	/**
	 * One row's inline feedback slot: a live region under the row description.
	 * Empty text hides it (CSS `:empty`), so showing and clearing are the SAME
	 * assignment — no visibility state to get out of sync with the message.
	 * Must be created AFTER `setDesc()`, which owns `descEl`'s text.
	 *
	 * `role` is the caller's choice because urgency differs: a REFUSED value must
	 * interrupt (`alert`), while a per-keystroke advisory must not — `alert` there
	 * would talk over a screen-reader user on every character they type.
	 */
	private static addFeedbackSlot(setting: Setting, role: "alert" | "status"): HTMLElement {
		return setting.descEl.createDiv({ cls: "vicinity-graph-settings-error", attr: { role } });
	}

	/** Renders one row's verdict: the message, and `aria-invalid` only when it REFUSED the value. */
	private static showVerdict(slot: HTMLElement, input: HTMLElement, verdict: SizingRowVerdict): void {
		slot.textContent = verdict.message ?? "";
		input.setAttribute("aria-invalid", String(verdict.rejected));
	}

	/**
	 * The typed value was ACCEPTED but part of it will not do anything. No
	 * `aria-invalid` — the write happened; `detail` carries the long form on hover.
	 */
	private static showWarning(slot: HTMLElement, feedback: SettingsFeedback | undefined): void {
		slot.textContent = feedback?.message ?? "";
		slot.title = feedback?.detail ?? "";
	}

	/** A row's frame: the declared label and description, before any control is added. */
	private static row(container: HTMLElement, row: SettingsRow): Setting {
		const setting = new Setting(container).setName(row.label);
		if (row.description !== undefined) {
			setting.setDesc(row.description);
		}
		return setting;
	}

	/**
	 * The LAST row of a section card: its restore-defaults affordance. Placement
	 * and copy are uniform across all six cards, and the copy is read from
	 * {@link SETTINGS_RESET_SCOPES} so the stated blast radius always matches the
	 * key-set actually written.
	 */
	private addSectionReset(section: HTMLElement, scope: SettingsResetScope): void {
		const { label, description } = SETTINGS_RESET_SCOPES[scope];
		new Setting(section)
			.setClass("vicinity-graph-settings-reset")
			.setName(label)
			.setDesc(description)
			.addButton((button) =>
				button
					.setButtonText("Restore defaults")
					// The button alone would be ambiguous once the tab has seven of
					// them; the accessible name carries the scope, like the row name.
					.setTooltip(label)
					.then(() => VicinityGraphSettingTab.nameControl(button.buttonEl, label))
					.onClick(() => this.requestReset(scope)),
			);
	}

	/**
	 * The ONE entry point for every reset button. Whether a scope confirms first is
	 * decided by the reset plan (`planSettingsResetConfirmation`), next to the key-set it
	 * clears — never by the call site, or "which resets are destructive" would be
	 * answered in seven places.
	 */
	private requestReset(scope: SettingsResetScope): void {
		const confirmation = this.writes.planResetConfirmation(scope);
		if (confirmation === null) {
			void this.resets.run(scope);
			return;
		}
		// The defaults themselves are written through the pipeline like every other
		// interaction: a reset that overtook a click still in flight would be undone
		// by it, defaults and all.
		new ConfirmModal(this.app, {
			...confirmation,
			onConfirm: () => this.resets.run(scope),
		}).open();
	}

	/**
	 * Tab-wide restore, outside every section frame (its blast radius is the whole
	 * plugin, so it must not sit inside any one card). Always confirms; the red
	 * treatment lives on the modal's confirm button, never on this one.
	 */
	private renderRestoreAll(): void {
		const { label, description } = SETTINGS_RESET_SCOPES[ALL_SETTINGS_RESET_SCOPE];
		const footer = this.containerEl.createDiv({ cls: "vicinity-graph-settings-reset-all" });
		new Setting(footer)
			.setName(label)
			.setDesc(description)
			.addButton((button) =>
				button
					.setButtonText("Restore all defaults")
					.setTooltip(label)
					.then(() => VicinityGraphSettingTab.nameControl(button.buttonEl, label))
					.onClick(() => this.requestReset(ALL_SETTINGS_RESET_SCOPE)),
			);
	}

	/**
	 * Global node exclusion (CLARIFICATION: vault-wide). The toggle mirrors the
	 * controls panel's switch; the patterns row beside it is the SOURCE OF TRUTH for
	 * the list. The two write SEPARATE interactions that the pipeline merges over
	 * each other's stored value, so neither can clobber the other.
	 *
	 * WHEN off the patterns row stays on screen, DISABLED — its `disabledWhen` is
	 * declared in the row model and applied by {@link applyRowDependencies}, the same
	 * mechanism any future dependent row gets for free. (Owner decision 2026-07-29,
	 * replacing the hide/reveal slot this used to swap the row in and out of.)
	 */
	private addExclusionToggle(container: HTMLElement, row: SettingsRow, state: SettingsRowState): void {
		const enabledNow = state.nodeExclusion.enabled;
		VicinityGraphSettingTab.row(container, row).addToggle((toggle) => {
			// The row's only control, so the row name alone identifies it.
			VicinityGraphSettingTab.nameToggle(toggle, SettingsRowNames.sole(row));
			// No queue of its own: the handler emits ONE granular interaction and
			// `SettingsWritePipeline` plans it from a fresh read inside its serialised
			// slot, so two fast clicks cannot both plan from the same pre-write state.
			toggle.setValue(enabledNow).onChange(async (enabled) => {
				// Answer the click immediately, from the state the click implies.
				this.applyRowDependencies({ ...state, nodeExclusion: { ...state.nodeExclusion, enabled } });
				// Pending typed edits first: the patterns textarea persists on a debounce,
				// and its own write must not land behind the flag it belongs to.
				await this.settlePendingWrites();
				await this.writes.apply({ kind: "global-exclusion-enabled", enabled });
				// Authoritative pass: whatever actually landed, however the clicks raced.
				this.applyRowDependencies(this.rowState());
			});
		});
	}

	/**
	 * The exclusion pattern list: one raw regex per line, with live per-keystroke
	 * validation feedback. Rendered ALWAYS and disabled while exclusion is off (see
	 * {@link addExclusionToggle}); the stored patterns are untouched either way, so
	 * re-enabling restores them without this row ever being rebuilt.
	 */
	private addExclusionPatterns(container: HTMLElement, row: SettingsRow, state: SettingsRowState): void {
		const name = SettingsRowNames.sole(row);
		const setting = VicinityGraphSettingTab.row(container, row);
		// "status", not "alert": this slot updates on EVERY keystroke while a regex is
		// half-typed, and an assertive region would interrupt on every character.
		const feedback = VicinityGraphSettingTab.addFeedbackSlot(setting, "status");
		setting.addTextArea((text: TextAreaComponent) => {
			text.inputEl.rows = EXCLUSION_TEXTAREA_ROWS;
			VicinityGraphSettingTab.nameControl(text.inputEl, name);
			const initial = state.nodeExclusion.patterns.join("\n");
			text.setValue(initial);
			text.setDisabled(isSettingsRowDisabled(row, state));
			this.dependents.push({ row, setDisabled: (disabled) => text.setDisabled(disabled) });
			// Patterns already stored (or hand-edited into data.json) get the same
			// verdict on open as a freshly typed one.
			VicinityGraphSettingTab.showWarning(feedback, describeInvalidExclusionPatterns(initial));
			this.flushOnBlur(text.inputEl);
			text.onChange((raw) => {
				// Invalid lines are SURFACED, never rejected: the engine already skips
				// them, and refusing the write would discard the VALID lines typed in
				// the same edit.
				VicinityGraphSettingTab.showWarning(feedback, describeInvalidExclusionPatterns(raw));
				this.debounced.schedule(name, (writer) =>
					writer.apply({ kind: "global-exclusion-patterns", patterns: parseExclusionPatterns(raw) }),
				);
			});
		});
	}

	/**
	 * One metric row: an enable toggle plus the weight input that toggle governs, in
	 * a single `Setting` (they are one decision, not two).
	 *
	 * WHY the weight is disabled imperatively rather than by `disabledWhen`: it is
	 * the SECOND control on this row, and `disabledWhen` is a ROW-level declaration.
	 * A row whose whole control is inert (exclusion patterns) is the declarative
	 * case; a control governed by its own row-mate is this one.
	 */
	private addSizingMetricRow(
		container: HTMLElement,
		row: SettingsRow,
		metric: SizeMetricId,
		state: SettingsRowState,
	): void {
		const seed: SizingMetricSetting = state.globalView.sizing.metrics[metric];
		// The weight input this row's toggle enables and disables. Definite
		// assignment, not an optional: `Setting.addText` below invokes its builder
		// SYNCHRONOUSLY, so the input exists before the row is ever on screen — and
		// the toggle handler can only run once it is.
		let weightInput!: TextComponent;
		VicinityGraphSettingTab.row(container, row)
			.addToggle((toggle) => {
				// Two controls share this row, so the row name alone would not
				// distinguish them — hence the declared role suffix.
				VicinityGraphSettingTab.nameToggle(toggle, SettingsRowNames.role(row, "enabled"));
				toggle.setValue(seed.enabled).onChange((enabled) => {
					// Flipped BEFORE the write is awaited so the row answers the click
					// immediately; this cannot paint a stale value, because the flip happens
					// in click order — the newest click paints last.
					weightInput.setDisabled(!enabled);
					// Pending typed edits first so this row's own weight, still inside the
					// debounce window, is not left behind the enable flag it belongs to.
					return this.settlePendingWrites().then(() =>
						this.writes.apply({ kind: "global-sizing-metric-enabled", metric, enabled }),
					);
				});
			})
			.addText((text) => {
				weightInput = text;
				const weightName = SettingsRowNames.role(row, "weight");
				text.inputEl.type = "number";
				VicinityGraphSettingTab.applyRange(text.inputEl, SIZING_RANGES.metricWeight);
				text.setValue(String(seed.weight));
				text.setDisabled(!seed.enabled);
				VicinityGraphSettingTab.nameControl(text.inputEl, weightName);
				this.flushOnBlur(text.inputEl);
				text.onChange((raw) => {
					const weight = parseSizingInput(raw);
					if (weight === undefined) {
						this.debounced.drop(weightName);
						return;
					}
					this.debounced.schedule(weightName, (writer) =>
						writer.apply({ kind: "global-sizing-metric-weight", metric, weight }),
					);
				});
			});
	}

	/**
	 * One sizing number input. Pure obsidian glue: {@link parseSizingInput} decides
	 * what counts as typed input (the same rule the in-view sizing mirror uses) and
	 * {@link SizingRowWrite} owns everything else — bounds feedback, the cross-field
	 * rule, and the deferred write that re-checks against the globals as they are at
	 * FLUSH time. A REJECTED value stays in the field with its reason beside it —
	 * never silently persisted, never silently reverted.
	 */
	private addSizingNumber(container: HTMLElement, row: SettingsRow, field: SizingNumberField): void {
		const name = SettingsRowNames.sole(row);
		const write = new SizingRowWrite(field, () => this.store.globalView().sizing);
		const setting = VicinityGraphSettingTab.row(container, row);
		const feedback = VicinityGraphSettingTab.addFeedbackSlot(setting, "alert");
		setting.addText((text) => {
			text.inputEl.type = "number";
			VicinityGraphSettingTab.applyRange(text.inputEl, SIZING_RANGES[field]);
			const stored = write.storedValue();
			text.setValue(String(stored));
			VicinityGraphSettingTab.nameControl(text.inputEl, name);
			this.flushOnBlur(text.inputEl);
			// A hand-edited data.json can still hold an inverted pair; say so on open
			// rather than only once the user types.
			VicinityGraphSettingTab.showVerdict(feedback, text.inputEl, write.judge(stored));
			text.onChange((raw) => {
				const parsed = parseSizingInput(raw);
				if (parsed === undefined) {
					// Cleared / not a number yet: the EARLIER keystrokes of this burst
					// must not persist behind the user's back.
					this.debounced.drop(name);
					return;
				}
				const verdict = write.judge(parsed);
				VicinityGraphSettingTab.showVerdict(feedback, text.inputEl, verdict);
				if (verdict.rejected) {
					this.debounced.drop(name);
					return;
				}
				// The thunk writes through the writer it is HANDED: it runs inside the
				// pipeline's serialised slot, so entering the chain again would deadlock.
				this.debounced.schedule(name, (writer) => {
					const interaction = write.interactionIfAccepted(parsed);
					return interaction === null ? Promise.resolve() : writer.apply(interaction);
				});
			});
		});
	}

	/**
	 * The Preview pill: one NATIVE radio per option inside a `role="radiogroup"`,
	 * styled as a segmented control by `segmented-control.css`. Native inputs are
	 * the whole point — one tab stop, arrow-key cycling and correct screen-reader
	 * announcements come free, with no hand-written key handling to get wrong.
	 *
	 * Order comes from {@link NODE_PREVIEW_PREFERENCES} and per-option copy from the
	 * shared {@link NODE_PREVIEW_OPTION_META} (the panel's pill reads the same table),
	 * so the two surfaces cannot drift. Deliberately NO `this.display()` on change:
	 * the browser already moves the selection, and re-rendering the tab would throw
	 * away the user's keyboard focus mid-arrow-key.
	 */
	private addNodePreview(container: HTMLElement, row: SettingsRow, state: SettingsRowState): void {
		const selected = state.globalView.nodePreviewPreference;
		const groupName = SettingsRowNames.sole(row);
		VicinityGraphSettingTab.row(container, row).then((setting) => {
			const group = setting.controlEl.createDiv({
				cls: "vicinity-graph-segmented",
				attr: { role: "radiogroup", "aria-label": groupName },
			});
			for (const preference of NODE_PREVIEW_PREFERENCES) {
				const { label, description } = NODE_PREVIEW_OPTION_META[preference];
				// The <label> WRAPS its radio, so the visible text is the radio's
				// accessible name without any id/for pairing.
				const option = group.createEl("label", { cls: "vicinity-graph-segmented__option", title: description });
				const radio = option.createEl("input", {
					type: "radio",
					value: preference,
					attr: { name: NODE_PREVIEW_RADIO_GROUP },
				});
				radio.checked = preference === selected;
				option.createSpan({ cls: "vicinity-graph-segmented__text", text: label });
				radio.addEventListener("change", () => {
					void this.writes.apply({ kind: "global-node-preview", value: preference });
				});
			}
		});
	}

	private addNodeCap(container: HTMLElement, row: SettingsRow, state: SettingsRowState): void {
		const name = SettingsRowNames.sole(row);
		VicinityGraphSettingTab.row(container, row).addText((text) => {
			text.inputEl.type = "number";
			text.inputEl.min = String(MIN_NODE_CAP);
			text.inputEl.step = String(NODE_CAP_STEP);
			text.setValue(String(state.globalView.nodeCap));
			VicinityGraphSettingTab.nameControl(text.inputEl, name);
			this.flushOnBlur(text.inputEl);
			text.onChange((raw) => {
				const value = Number(raw);
				if (Number.isInteger(value) && value >= MIN_NODE_CAP) {
					this.debounced.schedule(name, (writer) => writer.apply({ kind: "global-cap", value }));
					return;
				}
				// Half-typed / cleared: forget the burst's earlier keystrokes.
				this.debounced.drop(name);
			});
		});
	}

	/**
	 * EVERY slider row in this tab. Bounds/value/onChange are the only things a
	 * caller varies, so keeping one row builder means the accessible name and the
	 * tooltip behaviour are decided once — a slider added later cannot forget either.
	 *
	 * WHY `setDynamicTooltip()` despite the `@deprecated` tag: the tag comes from the
	 * 1.13 typings ("the value is now always shown inline"), and the inline readout it
	 * describes only landed in 1.13.0. Our floor is `minAppVersion` 1.12.4 (e2e pins
	 * 1.12.7), where the method still installs the hover listeners that are a slider's
	 * ONLY value readout — verified on 1.12.7. Removing it silently blanks the value on
	 * every supported build below 1.13. Drop it only when `minAppVersion` reaches 1.13.0.
	 *
	 * @see e2e/settingsUxVisual.e2e.ts — "settings tab: WHEN a slider is hovered THEN its
	 *      current value is readable" is the test that catches this removal.
	 */
	private addSlider(
		container: HTMLElement,
		row: SettingsRow,
		bounds: SettingsRange,
		value: number,
		onChange: (value: number) => void,
	): void {
		const name = SettingsRowNames.sole(row);
		VicinityGraphSettingTab.row(container, row).addSlider((slider) =>
			slider
				.setLimits(bounds.min, bounds.max, bounds.step)
				.setValue(value)
				.setDynamicTooltip()
				.then(() => VicinityGraphSettingTab.nameControl(slider.sliderEl, name))
				.onChange(onChange),
		);
	}

	private addDepthSlider(
		container: HTMLElement,
		row: SettingsRow,
		channel: Channel,
		state: SettingsRowState,
	): void {
		this.addSlider(
			container,
			row,
			{ min: MIN_STEPPER_DEPTH, max: MAX_STEPPER_DEPTH, step: DEPTH_SLIDER_STEP },
			state.globalDepths[CHANNEL_DEPTH_FIELD[channel]],
			(value) => {
				void this.writes.apply({ kind: "global-depth", channel, value: clampStepperDepth(value) });
			},
		);
	}

	private addOutlineDepthSlider(container: HTMLElement, row: SettingsRow, state: SettingsRowState): void {
		this.addSlider(
			container,
			row,
			{ min: MIN_OUTLINE_DEPTH, max: MAX_OUTLINE_DEPTH, step: OUTLINE_DEPTH_SLIDER_STEP },
			state.globalView.outlineMaxDepth,
			(value) => {
				void this.writes.apply({ kind: "global-outline-depth", value: clampOutlineMaxDepth(value) });
			},
		);
	}

	/**
	 * One force-layout slider. Bounds come from {@link FORCE_LAYOUT_RANGES} — the SAME
	 * table the persistence parser clamps with — and the copy from the row model. The
	 * sibling knobs are merged by the pipeline from a read taken inside its own
	 * serialised slot, so this slider names ONLY its own field.
	 */
	private addForceLayoutSlider(
		container: HTMLElement,
		row: SettingsRow,
		field: keyof ForceLayoutSettings,
		state: SettingsRowState,
	): void {
		this.addSlider(container, row, FORCE_LAYOUT_RANGES[field], state.globalView.forceLayout[field], (value) => {
			void this.writes.apply({ kind: "global-force-layout-field", field, value });
		});
	}

	/** Mirrors a {@link SettingsRange} onto a number input's stepper attributes. */
	private static applyRange(input: HTMLInputElement, range: SettingsRange): void {
		input.min = String(range.min);
		input.max = String(range.max);
		input.step = String(range.step);
	}
}
