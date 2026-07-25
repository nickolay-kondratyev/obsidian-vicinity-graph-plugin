import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import type { Direction, ForceLayoutSettings, SizingSettings } from "../engine";
import {
	FORCE_LAYOUT_RANGES,
	MAX_OUTLINE_DEPTH,
	MIN_NODE_CAP,
	MIN_OUTLINE_DEPTH,
	NODE_PREVIEW_PREFERENCES,
	SETTINGS_SPEC,
	clampOutlineMaxDepth,
} from "../engine";
import type VicinityGraphPlugin from "../main";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import { ConfirmModal } from "./ConfirmModal";
import { MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH, clampStepperDepth } from "./constants";
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
import type { SettingsResetScope } from "./settingsResetPlan";
import {
	ALL_SETTINGS_RESET_SCOPE,
	SETTINGS_RESET_SCOPES,
	planSettingsReset,
	planSettingsResetConfirmation,
} from "./settingsResetPlan";
import type { SettingsCommand, SettingsInteraction, SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";
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

/**
 * Textarea → pattern list: one pattern per line, trimmed, blank lines dropped.
 * WHY trim/drop: newline-delimited input inevitably carries a trailing blank line
 * and stray indentation; an empty regex matches everything, so keeping blanks would
 * silently exclude the whole vault. Invalid regexes are tolerated (engine skips them).
 */
function parseExclusionPatterns(raw: string): readonly string[] {
	return raw
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export class VicinityGraphSettingTab extends PluginSettingTab {
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
	 * stored patterns are untouched so re-enabling restores them. The toggle re-renders
	 * the tab so the textarea appears/disappears immediately.
	 */
	private renderExclusion(): void {
		const section = this.createSection();
		new Setting(section).setName("Node exclusion").setHeading();
		const exclusion = this.store.nodeExclusion();
		new Setting(section)
			.setName("Exclude notes from the graph")
			.setDesc("Hide matching neighbor notes before the graph is built. Central and pinned notes are never excluded.")
			.addToggle((toggle) =>
				toggle.setValue(exclusion.enabled).onChange(async (enabled) => {
					await this.applyInteraction({
						kind: "global-node-exclusion",
						nodeExclusion: { ...this.store.nodeExclusion(), enabled },
					});
					// Re-render so the patterns textarea tracks the toggle.
					this.display();
				}),
			);
		if (exclusion.enabled) {
			this.addExclusionPatterns(section, exclusion.patterns);
		}
		this.addSectionReset(section, "node-exclusion");
	}

	private addExclusionPatterns(section: HTMLElement, patterns: readonly string[]): void {
		new Setting(section)
			.setName("Exclusion patterns")
			.setDesc(
				"One regular expression per line, tested (case-sensitively, unanchored) against each note's vault path including extension. E.g. `^archive/` matches the archive folder at the vault root; `templates/` matches anywhere. Invalid patterns are ignored.",
			)
			.addTextArea((text) => {
				text.inputEl.rows = EXCLUSION_TEXTAREA_ROWS;
				VicinityGraphSettingTab.nameControl(text.inputEl, "Exclusion patterns");
				text.setValue(patterns.join("\n"));
				text.onChange((raw) => {
					void this.applyInteraction({
						kind: "global-node-exclusion",
						nodeExclusion: { ...this.store.nodeExclusion(), patterns: parseExclusionPatterns(raw) },
					});
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
			const metric = sizing.metrics[id];
			new Setting(section)
				.setName(label)
				.addToggle((toggle) =>
					toggle.setValue(metric.enabled).onChange(async (enabled) => {
						const current = this.store.globalView().sizing;
						await this.applySizing({
							...current,
							metrics: { ...current.metrics, [id]: { ...current.metrics[id], enabled } },
						});
						// Re-render so the weight field's enabled state tracks the toggle.
						this.display();
					}),
				)
				.addText((text) => {
					text.inputEl.type = "number";
					text.inputEl.min = "0";
					text.inputEl.step = "0.5";
					text.setValue(String(metric.weight));
					text.setDisabled(!metric.enabled);
					// Two controls share this row (toggle + weight), so the row name
					// alone would not distinguish them.
					VicinityGraphSettingTab.nameControl(text.inputEl, `${label} weight`);
					text.onChange((raw) => {
						const weight = Number(raw);
						if (!Number.isNaN(weight) && weight >= 0) {
							const current = this.store.globalView().sizing;
							void this.applySizing({
								...current,
								metrics: { ...current.metrics, [id]: { ...current.metrics[id], weight } },
							});
						}
					});
				});
		}

		this.addSizingNumber(section, "Minimum node size (px)", sizing.minPx, 1, 4, (minPx) =>
			this.applySizing({ ...this.store.globalView().sizing, minPx }),
		);
		this.addSizingNumber(section, "Maximum node size (px)", sizing.maxPx, 1, 4, (maxPx) =>
			this.applySizing({ ...this.store.globalView().sizing, maxPx }),
		);
		this.addSizingNumber(section, "Depth decay k", sizing.depthDecayK, 0, 0.5, (depthDecayK) =>
			this.applySizing({ ...this.store.globalView().sizing, depthDecayK }),
		);
		this.addSectionReset(section, "node-sizing");
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
				text.onChange((raw) => {
					const value = Number(raw);
					if (Number.isInteger(value) && value >= MIN_NODE_CAP) {
						void this.applyInteraction({ kind: "global-cap", value });
					}
				});
			});
		this.addSectionReset(section, "performance");
	}

	/**
	 * EVERY slider row in this tab. Bounds/value/onChange are the only things a
	 * caller varies, so keeping one row builder means the accessible name (see
	 * {@link VicinityGraphSettingTab.nameControl}) is decided once — a slider added
	 * later cannot forget it.
	 *
	 * WHY-NOT `setDynamicTooltip()`: Obsidian deprecated it to a no-op ("the value is
	 * now always shown inline next to the slider"), so the call was dropped rather
	 * than carried forward as dead code.
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

	private addSizingNumber(
		container: HTMLElement,
		name: string,
		value: number,
		min: number,
		step: number,
		onChange: (value: number) => Promise<void>,
	): void {
		new Setting(container).setName(name).addText((text) => {
			text.inputEl.type = "number";
			text.inputEl.min = String(min);
			text.inputEl.step = String(step);
			text.setValue(String(value));
			VicinityGraphSettingTab.nameControl(text.inputEl, name);
			text.onChange((raw) => {
				const parsed = Number(raw);
				if (!Number.isNaN(parsed) && parsed >= min) {
					void onChange(parsed);
				}
			});
		});
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
