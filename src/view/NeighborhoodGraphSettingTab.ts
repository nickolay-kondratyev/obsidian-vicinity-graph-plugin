import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import type { Direction, SizingSettings } from "../engine";
import type NeighborhoodGraphPlugin from "../main";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import { MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH, clampStepperDepth } from "./constants";
import type { SettingsInteraction } from "./settingsWritePlan";
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

/** A node cap below 1 would hide every non-central node — the floor is 1. */
const MIN_NODE_CAP = 1;

export class NeighborhoodGraphSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: NeighborhoodGraphPlugin,
	) {
		super(app, plugin);
	}

	private get store(): PluginDataStore {
		return this.plugin.pluginDataStore;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderDepthDefaults();
		this.renderSizing();
		this.renderPerformance();
	}

	private renderDepthDefaults(): void {
		new Setting(this.containerEl).setName("Depth defaults").setHeading();
		const depths = this.store.globalDepths();
		this.addDepthSlider(
			"Outgoing depth",
			"How many hops of outgoing links to expand from a central note by default.",
			"outgoing",
			depths.outgoingDepth,
		);
		this.addDepthSlider(
			"Incoming depth",
			"How many hops of incoming links (backlinks) to expand by default.",
			"incoming",
			depths.incomingDepth,
		);
	}

	private renderSizing(): void {
		new Setting(this.containerEl).setName("Node sizing").setHeading();
		new Setting(this.containerEl).setDesc(
			"Enable metrics and weight their contribution to each node's size. Sizes are normalised across the graph.",
		);

		const sizing = this.store.globalView().sizing;
		for (const { id, label } of SIZING_METRICS) {
			const metric = sizing.metrics[id];
			new Setting(this.containerEl)
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
					text.inputEl.setAttribute("aria-label", `${label} weight`);
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

		this.addSizingNumber("Minimum node size (px)", sizing.minPx, 1, 4, (minPx) =>
			this.applySizing({ ...this.store.globalView().sizing, minPx }),
		);
		this.addSizingNumber("Maximum node size (px)", sizing.maxPx, 1, 4, (maxPx) =>
			this.applySizing({ ...this.store.globalView().sizing, maxPx }),
		);
		this.addSizingNumber("Depth decay k", sizing.depthDecayK, 0, 0.5, (depthDecayK) =>
			this.applySizing({ ...this.store.globalView().sizing, depthDecayK }),
		);
	}

	private renderPerformance(): void {
		new Setting(this.containerEl).setName("Performance").setHeading();
		new Setting(this.containerEl)
			.setName("Node cap")
			.setDesc("Maximum number of non-central nodes rendered. Central and pinned notes are never capped.")
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = String(MIN_NODE_CAP);
				text.inputEl.step = "1";
				text.setValue(String(this.store.globalView().nodeCap));
				text.onChange((raw) => {
					const value = Number(raw);
					if (Number.isInteger(value) && value >= MIN_NODE_CAP) {
						void this.applyInteraction({ kind: "global-cap", value });
					}
				});
			});
	}

	private addDepthSlider(name: string, desc: string, direction: Direction, current: number): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) =>
				slider
					.setLimits(MIN_STEPPER_DEPTH, MAX_STEPPER_DEPTH, 1)
					.setValue(current)
					.setDynamicTooltip()
					.onChange((value) => {
						void this.applyInteraction({
							kind: "global-depth",
							direction,
							value: clampStepperDepth(value),
						});
					}),
			);
	}

	private addSizingNumber(
		name: string,
		value: number,
		min: number,
		step: number,
		onChange: (value: number) => Promise<void>,
	): void {
		new Setting(this.containerEl).setName(name).addText((text) => {
			text.inputEl.type = "number";
			text.inputEl.min = String(min);
			text.inputEl.step = String(step);
			text.setValue(String(value));
			text.onChange((raw) => {
				const parsed = Number(raw);
				if (!Number.isNaN(parsed) && parsed >= min) {
					void onChange(parsed);
				}
			});
		});
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
		const command = planSettingsWrite(interaction, {
			globalDepths: this.store.globalDepths(),
			globalView: this.store.globalView(),
		});
		switch (command.kind) {
			case "global-depths":
				await this.store.saveGlobalDepths(command.depths);
				break;
			case "global-view":
				await this.store.saveGlobalView(command.view);
				break;
			case "doc-depth-field":
			case "central-depth-field":
				return;
		}
		this.plugin.refreshOpenViews();
	}
}
