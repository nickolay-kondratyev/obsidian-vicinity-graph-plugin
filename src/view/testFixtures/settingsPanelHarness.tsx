import type { RenderResult } from "@testing-library/react";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import type { ViewSettings } from "../../engine";
import { EngineDefaults } from "../../engine";
import { ControlsActionsContext } from "../ControlsActionsContext";
import type { ControlsModel } from "../ControlsModel";
import type { SettingsResetScope } from "../settingsResetPlan";
import type { SettingsRowState } from "../settingsRows";
import type { SettingsInteraction } from "../settingsWritePlan";
import type { ControlsActionsPort } from "../viewPorts";

/**
 * Test support for COMPONENT tests of the in-graph controls panel (jsdom +
 * `@testing-library/react`; each component test file opts into the DOM with a
 * `@vitest-environment jsdom` pragma so the rest of the suite stays node-env —
 * the source-scan guards read the filesystem).
 *
 * The panel's components reach the write path only through
 * {@link ControlsActionsContext}, so a recording fake of that ONE port is the whole
 * seam a render needs: state comes in as props, interactions come out here.
 */

/** Records every interaction the rendered controls emit; persists nothing. */
export class RecordingControlsActions implements ControlsActionsPort {
	readonly interactions: SettingsInteraction[] = [];
	readonly restoredScopes: SettingsResetScope[] = [];

	constructor(
		/** What `storedGlobalView()` answers — the fresh-at-commit-time read cross-field judges use. */
		public view: ViewSettings = EngineDefaults.viewSettings(),
	) {}

	applySettings(interaction: SettingsInteraction): Promise<void> {
		this.interactions.push(interaction);
		return Promise.resolve();
	}

	storedGlobalView(): ViewSettings {
		return this.view;
	}

	restoreDefaults(scope: SettingsResetScope): Promise<void> {
		this.restoredScopes.push(scope);
		return Promise.resolve();
	}

	pinNode(): Promise<void> {
		return Promise.resolve();
	}

	unpinNode(): Promise<void> {
		return Promise.resolve();
	}
}

/** The three global slices at their shipped defaults, any of them overridable. */
export function settingsRowStateFixture(overrides: Partial<SettingsRowState> = {}): SettingsRowState {
	return {
		globalDepths: EngineDefaults.depthSettings(),
		globalView: EngineDefaults.viewSettings(),
		nodeExclusion: EngineDefaults.nodeExclusionSettings(),
		...overrides,
	};
}

/** A whole toolbar read-model over `state` (nothing pinned, nothing excluded). */
export function controlsModelFixture(state: SettingsRowState): ControlsModel {
	return { mainPinned: false, excludedNodeCount: 0, ...state };
}

/** `ui` wired to `actions` — also what a `rerender` must pass, or the context is lost. */
export function withActions(ui: ReactElement, actions: ControlsActionsPort): ReactElement {
	return <ControlsActionsContext.Provider value={actions}>{ui}</ControlsActionsContext.Provider>;
}

export function renderWithActions(ui: ReactElement, actions: ControlsActionsPort): RenderResult {
	return render(withActions(ui, actions));
}
