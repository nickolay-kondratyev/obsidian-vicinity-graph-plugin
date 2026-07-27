import { PluginSettingTab, Setting } from "obsidian";
import type { App, TextComponent } from "obsidian";
import type {
	Direction,
	ForceLayoutSettings,
	SettingsRange,
	SizeMetricId,
	SizingMetricSetting,
	SizingSettings,
} from "../engine";
import {
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
import {
	FORCE_LAYOUT_ADVANCED_FIELDS,
	FORCE_LAYOUT_FIELD_META,
	FORCE_LAYOUT_MAIN_FIELDS,
} from "./forceLayoutFieldMeta";
import {
	NODE_PREVIEW_OPTION_META,
	NODE_PREVIEW_ROW_DESCRIPTION,
	NODE_PREVIEW_ROW_LABEL,
} from "./nodePreviewPreferenceMeta";
import { DebouncedSettingsWrites } from "./settingsDebounce";
import type { SettingsResetScope } from "./settingsResetPlan";
import {
	ALL_SETTINGS_RESET_SCOPE,
	SETTINGS_RESET_SCOPES,
	planSettingsReset,
	planSettingsResetConfirmation,
} from "./settingsResetPlan";
import type { SettingsFeedback } from "./settingsValidation";
import { describeInvalidExclusionPatterns, parseExclusionPatterns } from "./settingsValidation";
import type { SizingNumberField, SizingRowVerdict } from "./sizingRowWrite";
import { SizingRowWrite } from "./sizingRowWrite";
import type { SettingsCommand, SettingsInteraction, SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";
import { parseSizingInput } from "./sizingInput";
import { SIZING_METRICS } from "./sizingMetrics";

/**
 * The plugin's global settings tab (step-06 #7). It is pure obsidian glue: every
 * control seeds from {@link PluginDataStore.globalDepths}/{@link
 * PluginDataStore.globalView} and, on edit, routes through the SAME pure
 * {@link planSettingsWrite} contract the in-view toolbar uses — no
 * "merge one field into the whole object" logic lives here. The resulting
 * {@link SettingsCommand} is persisted through the store, then every open graph
 * view is refreshed so the change is visible immediately (CLARIFICATION Q-C).
 *
 * Node-cap lives here ONLY (CLARIFICATION Q4): it is a global-only knob with no
 * per-doc/per-view surface.
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
 * there — the shared copy module deliberately does not own the name.
 */
const NODE_PREVIEW_RADIO_GROUP = "vicinity-graph-node-preview-settings";

/** Inclusive bounds + granularity of one slider row. */
interface SliderBounds {
	readonly min: number;
	readonly max: number;
	readonly step: number;
}

export class VicinityGraphSettingTab extends PluginSettingTab {
	/**
	 * Every TYPED field writes through here, so a multi-keystroke entry costs ONE
	 * persist + rebuild instead of one per character. Keyed by the row's visible
	 * name — already unique per row, and already the control's accessible name, so
	 * there is no parallel id table to keep in sync.
	 */
	private readonly debounced = new DebouncedSettingsWrites(SETTINGS_WRITE_DEBOUNCE_MS);

	constructor(
		app: App,
		private readonly plugin: VicinityGraphPlugin,
	) {
		super(app, plugin);
	}

	private get store(): PluginDataStore {
		return this.plugin.pluginDataStore;
	}

	/**
	 * The tab's ONE accessibility rule: a control carries an `aria-label` equal to
	 * the row name a sighted user reads (plus the control's role where one row
	 * holds two controls). Obsidian renders that name in a SIBLING element of
	 * `.setting-item-control` with no `for`/`id` pairing, so the bare
	 * `input`/`button` has no accessible name of its own — without this, the seven
	 * force-layout sliders all announce identically. Stated here once and applied
	 * from the shared row helpers so new rows inherit it;
	 * `e2e/settingsUxVisual.e2e.ts` fails if any input in the tab lacks one.
	 */
	private static nameControl(el: HTMLElement, accessibleName: string): void {
		el.setAttribute("aria-label", accessibleName);
	}

	/**
	 * Re-seeds every control from the store. Callers that re-render after a write
	 * must `await this.settlePendingWrites()` FIRST — this method reads the globals
	 * synchronously, so a debounced write draining afterwards would leave the tab
	 * displaying a value the store no longer holds.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		// Scope class for the settings-tab card styling (src/view/settings-tab.css).
		containerEl.addClass("vicinity-graph-settings");

		this.renderDepthDefaults();
		this.renderSizing();
		// Node CONTENTS follow node SIZE: how big a node is decides how much of this fits.
		this.renderNodeContents();
		this.renderForceLayout();
		this.renderExclusion();
		this.renderPerformance();
		this.renderRestoreAll();
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
	private static addFeedbackSlot(row: Setting, role: "alert" | "status"): HTMLElement {
		return row.descEl.createDiv({ cls: "vicinity-graph-settings-error", attr: { role } });
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

	/**
	 * One framed card per section (settings-ux CLARIFICATION #2: CSS-only visual
	 * grouping, no collapsibles here). Each renderX() builds into its own card.
	 */
	private createSection(): HTMLElement {
		return this.containerEl.createDiv({ cls: "vicinity-graph-settings-section" });
	}

	/**
	 * The LAST row of a section card: its restore-defaults affordance. Placement
	 * and copy are uniform across all six cards, and the copy is read from
	 * {@link SETTINGS_RESET_SCOPES} so the stated blast radius always matches the
	 * key-set actually written. Inside the card's frame on purpose — a reset
	 * rendered after the frame closes reads as a tab-wide reset.
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
	 * decided by {@link planSettingsResetConfirmation}, next to the key-set it
	 * clears — never by the call site, or "which resets are destructive" would be
	 * answered in seven places.
	 */
	private requestReset(scope: SettingsResetScope): void {
		const confirmation = planSettingsResetConfirmation(scope, this.writeContext());
		if (confirmation === null) {
			void this.applyReset(scope);
			return;
		}
		new ConfirmModal(this.app, { ...confirmation, onConfirm: () => this.applyReset(scope) }).open();
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
	 * Force-layout tuning (ticket-04). The primary sliders carry the SAME
	 * names as Obsidian's native graph view (POLS — users already know them);
	 * the px fine-tuning knobs live in a collapsible `<details>` block (Obsidian's
	 * Setting API has no built-in collapsible group, and a native details
	 * element keeps it dependency-free). Slider limits come from the engine's
	 * {@link FORCE_LAYOUT_RANGES} — the SAME table the persistence parser clamps
	 * with — labels/descriptions from the shared {@link FORCE_LAYOUT_FIELD_META}
	 * (also driving the in-graph panel), and every control routes through one
	 * `global-force-layout` interaction carrying the complete object.
	 */
	private renderForceLayout(): void {
		const section = this.createSection();
		new Setting(section).setName("Force layout").setHeading();
		for (const field of FORCE_LAYOUT_MAIN_FIELDS) {
			this.addForceLayoutSlider(section, field);
		}
		const advanced = section.createEl("details", { cls: "vicinity-graph-settings-advanced" });
		advanced.createEl("summary", { text: "Advanced spacing" });
		for (const field of FORCE_LAYOUT_ADVANCED_FIELDS) {
			this.addForceLayoutSlider(advanced, field);
		}
		this.addSectionReset(section, "force-layout");
	}

	/**
	 * Global node exclusion (CLARIFICATION: vault-wide). The textarea is the SOURCE
	 * OF TRUTH for the pattern list (one raw regex per line); the toggle mirrors the
	 * toolbar pill's enable flag. Both route through the SAME `global-node-exclusion`
	 * interaction, so there is no bespoke merge logic here.
	 *
	 * WHEN disabled the pattern textarea is hidden (the patterns are inactive), but the
	 * stored patterns are untouched so re-enabling restores them. The toggle swaps that
	 * ONE row in and out of its own slot — see {@link showExclusionPatterns}.
	 */
	private renderExclusion(): void {
		const section = this.createSection();
		new Setting(section).setName("Node exclusion").setHeading();
		const exclusion = this.store.nodeExclusion();
		const toggleRow = new Setting(section)
			.setName("Exclude notes from the graph")
			.setDesc("Hide matching neighbor notes before the graph is built. Central and pinned notes are never excluded.");
		// The patterns row's own slot. Created HERE for two reasons: the toggle wired
		// below has to name it, and a `Setting` appended to `section` later would land
		// under the card's restore footer instead of above it.
		const patternsSlot = section.createDiv();
		toggleRow.addToggle((toggle) =>
			toggle.setValue(exclusion.enabled).onChange(async (enabled) => {
				// Pending typed edits first, and this is the subtle one: the patterns
				// textarea persists on a debounce, while `showExclusionPatterns` below
				// re-seeds the rebuilt row by reading the store SYNCHRONOUSLY. A write
				// draining afterwards would leave that row showing patterns the store no
				// longer has. It also keeps this toggle's write — built from a snapshot
				// taken before the await — from clobbering a still-pending one.
				await this.settlePendingWrites();
				await this.applyInteraction({
					kind: "global-node-exclusion",
					nodeExclusion: { ...this.store.nodeExclusion(), enabled },
				});
				this.showExclusionPatterns(patternsSlot);
			}),
		);
		this.showExclusionPatterns(patternsSlot);
		this.addSectionReset(section, "node-exclusion");
	}

	/**
	 * Builds or tears down the patterns row inside its own slot — and touches
	 * NOTHING else in the tab.
	 *
	 * WHY-NOT `this.display()`, which this replaces: rebuilding all six cards to
	 * reveal one row discards the user's scroll position and keyboard focus. Same
	 * reasoning as the Preview pill (see {@link addNodePreviewSegmented}), one step
	 * further: there the fix was to re-render nothing, here it is to re-render only
	 * the row that actually depends on the control that changed.
	 *
	 * WHY-NOT rendering the row always and merely disabling it (Obsidian's own
	 * preference, since a hidden row also drops out of 1.13's settings search): that
	 * is a deliberate UX change, not a refresh-mechanics one — tracked separately in
	 * `nid_qp56jugz8en8wkgjirwcb269p_e`. This method keeps today's hide/show behaviour
	 * exactly.
	 *
	 * Takes NO `enabled` parameter on purpose. The toggle handler paints AFTER its own
	 * await, so a handler passing the value it captured at click time could repaint a
	 * stale reveal once two fast clicks finish out of order. Reading the store here —
	 * both flags from ONE snapshot — makes the contract literally true: the slot shows
	 * what the store says.
	 */
	private showExclusionPatterns(slot: HTMLElement): void {
		// Read fresh: the caller has just drained the debounce window, so this is the
		// first read that can see everything the user typed.
		const exclusion = this.store.nodeExclusion();
		slot.empty();
		if (exclusion.enabled) {
			this.addExclusionPatterns(slot, exclusion.patterns);
		}
	}

	private addExclusionPatterns(section: HTMLElement, patterns: readonly string[]): void {
		const name = "Exclusion patterns";
		const row = new Setting(section)
			.setName(name)
			.setDesc(
				"One regular expression per line, tested (case-sensitively, unanchored) against each note's vault path including extension. E.g. `^archive/` matches the archive folder at the vault root; `templates/` matches anywhere. Invalid patterns are ignored.",
			);
		// "status", not "alert": this slot updates on EVERY keystroke while a regex is
		// half-typed, and an assertive region would interrupt on every character.
		const feedback = VicinityGraphSettingTab.addFeedbackSlot(row, "status");
		row.addTextArea((text) => {
			text.inputEl.rows = EXCLUSION_TEXTAREA_ROWS;
			VicinityGraphSettingTab.nameControl(text.inputEl, name);
			const initial = patterns.join("\n");
			text.setValue(initial);
			// Patterns already stored (or hand-edited into data.json) get the same
			// verdict on open as a freshly typed one.
			VicinityGraphSettingTab.showWarning(feedback, describeInvalidExclusionPatterns(initial));
			this.flushOnBlur(text.inputEl);
			text.onChange((raw) => {
				// Invalid lines are SURFACED, never rejected: the engine already skips
				// them, and refusing the write would discard the VALID lines typed in
				// the same edit.
				VicinityGraphSettingTab.showWarning(feedback, describeInvalidExclusionPatterns(raw));
				this.debounced.schedule(name, () =>
					this.applyInteraction({
						kind: "global-node-exclusion",
						nodeExclusion: { ...this.store.nodeExclusion(), patterns: parseExclusionPatterns(raw) },
					}),
				);
			});
		});
	}

	private renderDepthDefaults(): void {
		const section = this.createSection();
		new Setting(section).setName("Depth defaults").setHeading();
		const depths = this.store.globalDepths();
		this.addDepthSlider(
			section,
			"Outgoing depth",
			"How many hops of outgoing links to expand from a central note by default.",
			"outgoing",
			depths.outgoingDepth,
		);
		this.addDepthSlider(
			section,
			"Incoming depth",
			"How many hops of incoming links (backlinks) to expand by default.",
			"incoming",
			depths.incomingDepth,
		);
		this.addSectionReset(section, "depth-defaults");
	}

	private renderSizing(): void {
		const section = this.createSection();
		new Setting(section).setName("Node sizing").setHeading();
		new Setting(section).setDesc(
			"Enable metrics and weight their contribution to each node's size. Sizes are normalised across the graph.",
		);

		const sizing = this.store.globalView().sizing;
		for (const { id, label } of SIZING_METRICS) {
			this.addSizingMetricRow(section, id, label, sizing.metrics[id]);
		}

		this.addSizingNumber(section, "Minimum node size (px)", "minPx");
		this.addSizingNumber(section, "Maximum node size (px)", "maxPx");
		this.addSizingNumber(section, "Depth decay k", "depthDecayK");
		this.addSectionReset(section, "node-sizing");
	}

	/**
	 * One metric row: an enable toggle plus the weight input that toggle governs, in
	 * a single `Setting` (they are one decision, not two).
	 *
	 * `seed` is the row's INITIAL displayed state, taken from the card's one store
	 * snapshot; every later write re-reads the store so successive edits compose.
	 */
	private addSizingMetricRow(
		section: HTMLElement,
		id: SizeMetricId,
		label: string,
		seed: SizingMetricSetting,
	): void {
		// The weight input this row's toggle enables and disables. Definite
		// assignment, not an optional: `Setting.addText` below invokes its builder
		// SYNCHRONOUSLY, so the input exists before the row is ever on screen — and
		// the toggle handler can only run once it is.
		let weightInput!: TextComponent;
		new Setting(section)
			.setName(label)
			.addToggle((toggle) =>
				toggle.setValue(seed.enabled).onChange(async (enabled) => {
					// The paired weight input is the ONLY thing on screen that depends on
					// this toggle, so flip it directly instead of rebuilding the tab with
					// `display()` — that discarded the user's scroll position and focus
					// (same reasoning as {@link addNodePreviewSegmented}). Done BEFORE the
					// await so the row answers the click immediately; unlike
					// {@link showExclusionPatterns} this cannot paint a stale value,
					// because at this point `enabled` IS the newest truth — the store has
					// not been told yet.
					weightInput.setDisabled(!enabled);
					// Pending typed edits first: the write below is built from a snapshot
					// of the sizing object taken before its own await, so a weight still
					// inside the debounce window would otherwise be clobbered by it.
					await this.settlePendingWrites();
					const current = this.store.globalView().sizing;
					await this.applySizing({
						...current,
						metrics: { ...current.metrics, [id]: { ...current.metrics[id], enabled } },
					});
				}),
			)
			.addText((text) => {
				weightInput = text;
				// Two controls share this row (toggle + weight), so the row name alone
				// would not distinguish them.
				const weightName = `${label} weight`;
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
					this.debounced.schedule(weightName, () => {
						const current = this.store.globalView().sizing;
						return this.applySizing({
							...current,
							metrics: { ...current.metrics, [id]: { ...current.metrics[id], weight } },
						});
					});
				});
			});
	}

	/**
	 * What a node shows INSIDE itself. One card like every other section (the tab
	 * groups by framed card throughout — mixing mechanisms would invent hierarchy).
	 * Slider bounds come from the engine's spec, the SAME source the persistence
	 * parser clamps with, so the slider and a hand-edited `data.json` agree.
	 *
	 * Row order is general → specific: the Preview pill decides WHICH preview a
	 * node shows, the depth slider only refines the outline once the outline won.
	 *
	 * There is still no enable/disable toggle: document position remains the
	 * escape hatch, now as the pill's `Auto` option (it is the shipped default, so
	 * the behavior the old "by design" note described is unchanged) — a user who
	 * wants one preview regardless of where the image sits picks it explicitly.
	 */
	private renderNodeContents(): void {
		const section = this.createSection();
		new Setting(section).setName("Node contents").setHeading();
		new Setting(section)
			.setName(NODE_PREVIEW_ROW_LABEL)
			.setDesc(NODE_PREVIEW_ROW_DESCRIPTION)
			.then((row) => this.addNodePreviewSegmented(row.controlEl));
		this.addLabeledSlider(
			section,
			"Outline depth",
			"How many heading levels a note's outline shows inside its node.",
			{ min: MIN_OUTLINE_DEPTH, max: MAX_OUTLINE_DEPTH, step: OUTLINE_DEPTH_SLIDER_STEP },
			this.store.globalView().outlineMaxDepth,
			(value) => {
				void this.applyInteraction({
					kind: "global-outline-depth",
					value: clampOutlineMaxDepth(value),
				});
			},
		);
		this.addSectionReset(section, "node-contents");
	}

	/**
	 * The Preview pill: one NATIVE radio per option inside a `role="radiogroup"`,
	 * styled as a segmented control by `segmented-control.css`. Native inputs are
	 * the whole point — one tab stop, arrow-key cycling and correct screen-reader
	 * announcements come free, with no hand-written key handling to get wrong.
	 *
	 * Order comes from {@link NODE_PREVIEW_PREFERENCES} and copy from the shared
	 * {@link NODE_PREVIEW_OPTION_META} (the panel's pill reads the same table), so
	 * the two surfaces cannot drift. Deliberately NO `this.display()` on change:
	 * the browser already moves the selection, and re-rendering the tab would
	 * throw away the user's keyboard focus mid-arrow-key.
	 */
	private addNodePreviewSegmented(controlEl: HTMLElement): void {
		const selected = this.store.globalView().nodePreviewPreference;
		const group = controlEl.createDiv({
			cls: "vicinity-graph-segmented",
			attr: { role: "radiogroup", "aria-label": NODE_PREVIEW_ROW_LABEL },
		});
		for (const preference of NODE_PREVIEW_PREFERENCES) {
			const { label, description } = NODE_PREVIEW_OPTION_META[preference];
			// The <label> WRAPS its radio, so the visible text is the radio's
			// accessible name without any id/for pairing.
			const option = group.createEl("label", {
				cls: "vicinity-graph-segmented__option",
				title: description,
			});
			const radio = option.createEl("input", {
				type: "radio",
				value: preference,
				attr: { name: NODE_PREVIEW_RADIO_GROUP },
			});
			radio.checked = preference === selected;
			option.createSpan({ cls: "vicinity-graph-segmented__text", text: label });
			radio.addEventListener("change", () => {
				void this.applyInteraction({ kind: "global-node-preview", value: preference });
			});
		}
	}

	private renderPerformance(): void {
		const section = this.createSection();
		new Setting(section).setName("Performance").setHeading();
		const nodeCapName = "Node cap";
		new Setting(section)
			.setName(nodeCapName)
			.setDesc("Maximum number of non-central nodes rendered. Central and pinned notes are never capped.")
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = String(MIN_NODE_CAP);
				text.inputEl.step = String(NODE_CAP_STEP);
				text.setValue(String(this.store.globalView().nodeCap));
				VicinityGraphSettingTab.nameControl(text.inputEl, nodeCapName);
				this.flushOnBlur(text.inputEl);
				text.onChange((raw) => {
					const value = Number(raw);
					if (Number.isInteger(value) && value >= MIN_NODE_CAP) {
						this.debounced.schedule(nodeCapName, () => this.applyInteraction({ kind: "global-cap", value }));
						return;
					}
					// Half-typed / cleared: forget the burst's earlier keystrokes.
					this.debounced.drop(nodeCapName);
				});
			});
		this.addSectionReset(section, "performance");
	}

	/**
	 * EVERY slider row in this tab. Bounds/value/onChange are the only things a
	 * caller varies, so keeping one row builder means the accessible name (see
	 * {@link VicinityGraphSettingTab.nameControl}) and the tooltip behaviour are
	 * decided once — a slider added later cannot forget either.
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
	private addLabeledSlider(
		container: HTMLElement,
		name: string,
		desc: string,
		bounds: SliderBounds,
		value: number,
		onChange: (value: number) => void,
	): void {
		new Setting(container)
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) =>
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
		name: string,
		desc: string,
		direction: Direction,
		current: number,
	): void {
		this.addLabeledSlider(
			container,
			name,
			desc,
			{ min: MIN_STEPPER_DEPTH, max: MAX_STEPPER_DEPTH, step: DEPTH_SLIDER_STEP },
			current,
			(value) => {
				void this.applyInteraction({
					kind: "global-depth",
					direction,
					value: clampStepperDepth(value),
				});
			},
		);
	}

	/**
	 * One sizing number input. Pure obsidian glue: {@link parseSizingInput} decides
	 * what counts as typed input (the same rule the in-view sizing mirror uses) and
	 * {@link SizingRowWrite} owns everything else — bounds feedback, the cross-field
	 * rule, and the deferred write that re-checks against the globals as they are at
	 * FLUSH time. A REJECTED value stays in the field with its reason beside it —
	 * never silently persisted, never silently reverted.
	 */
	private addSizingNumber(container: HTMLElement, name: string, field: SizingNumberField): void {
		const write = new SizingRowWrite(
			field,
			() => this.store.globalView().sizing,
			(sizing) => this.applySizing(sizing),
		);
		const row = new Setting(container).setName(name);
		const feedback = VicinityGraphSettingTab.addFeedbackSlot(row, "alert");
		row.addText((text) => {
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
				this.debounced.schedule(name, () => write.persistIfAccepted(parsed));
			});
		});
	}

	/** Mirrors a {@link SettingsRange} onto a number input's stepper attributes. */
	private static applyRange(input: HTMLInputElement, range: SettingsRange): void {
		input.min = String(range.min);
		input.max = String(range.max);
		input.step = String(range.step);
	}

	/**
	 * One force-layout slider. Bounds come from {@link FORCE_LAYOUT_RANGES},
	 * copy from the shared {@link FORCE_LAYOUT_FIELD_META}. The current value is
	 * read fresh from the store on every change so successive edits compose
	 * (same pattern as sizing).
	 */
	private addForceLayoutSlider(container: HTMLElement, field: keyof ForceLayoutSettings): void {
		const meta = FORCE_LAYOUT_FIELD_META[field];
		this.addLabeledSlider(
			container,
			meta.label,
			meta.description,
			FORCE_LAYOUT_RANGES[field],
			this.store.globalView().forceLayout[field],
			(value) => {
				void this.applyForceLayout({ ...this.store.globalView().forceLayout, [field]: value });
			},
		);
	}

	private applyForceLayout(forceLayout: ForceLayoutSettings): Promise<void> {
		return this.applyInteraction({ kind: "global-force-layout", forceLayout });
	}

	private applySizing(sizing: SizingSettings): Promise<void> {
		return this.applyInteraction({ kind: "global-sizing", sizing });
	}

	/**
	 * The single settings-tab write path: plan the command from the CURRENT
	 * globals (read fresh so successive edits compose), persist it, then fan the
	 * change out to every open view. Only the two global command kinds can result
	 * from a global-* interaction; the per-doc kinds are unreachable here.
	 */
	private async applyInteraction(interaction: SettingsInteraction): Promise<void> {
		await this.persist(planSettingsWrite(interaction, this.writeContext()));
		this.plugin.refreshOpenViews();
	}

	/**
	 * Restore-defaults path. It shares the store/refresh seam with every other
	 * settings write — the ONLY difference is that the commands come from
	 * {@link planSettingsReset} (spec defaults) instead of a control's value.
	 * Commands are persisted in order, each planned against the same snapshot, so
	 * a multi-slice reset cannot half-apply a stale view object.
	 */
	private async applyReset(scope: SettingsResetScope): Promise<void> {
		// A keystroke still inside the settle window would otherwise land AFTER the
		// defaults and silently un-reset its field.
		await this.settlePendingWrites();
		for (const command of planSettingsReset(scope, this.writeContext())) {
			await this.persist(command);
		}
		this.plugin.refreshOpenViews();
		// Re-render so every control's displayed value actually moves back.
		this.display();
	}

	/** Globals read FRESH on every write so successive edits compose. */
	private writeContext(): SettingsWriteContext {
		return {
			globalDepths: this.store.globalDepths(),
			globalView: this.store.globalView(),
			nodeExclusion: this.store.nodeExclusion(),
		};
	}

	/**
	 * The single persistence executor. Only the three global command kinds can
	 * result from a global-* interaction or a reset; the per-doc kinds are
	 * unreachable from this surface.
	 */
	private async persist(command: SettingsCommand): Promise<void> {
		switch (command.kind) {
			case "global-depths":
				await this.store.saveGlobalDepths(command.depths);
				return;
			case "global-view":
				await this.store.saveGlobalView(command.view);
				return;
			case "node-exclusion":
				await this.store.saveNodeExclusion(command.nodeExclusion);
				return;
			case "doc-depth-field":
			case "central-depth-field":
				return;
		}
	}
}
