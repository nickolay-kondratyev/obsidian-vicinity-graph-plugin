// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { GraphToolbar } from "./GraphToolbar";
import type { SettingsRow, SettingsRowState } from "./settingsRows";
import { EVERY_SETTINGS_ROW, SettingsRowNames, settingsRowsFor } from "./settingsRows";
import {
	RecordingControlsActions,
	controlsModelFixture,
	renderWithActions,
	settingsRowStateFixture,
} from "./testFixtures/settingsPanelHarness";

/**
 * RENDERED per-row parity for the PANEL surface — the half of the residual gap
 * `settingsRowParity.test.ts` (a source scan) states it cannot close: that every
 * declared row actually PRODUCES a control, under its declared accessible name, in
 * declared order. A walker that dropped a predicate-based subset of a block's rows
 * (`rows.filter(...)` — the escape the label scan cannot see) fails here, because the
 * dropped row's accessible names never reach the DOM.
 *
 * PANEL ONLY, deliberately: the settings tab renders through Obsidian's `Setting`
 * API and the `obsidian` package is types-only, so the tab cannot mount in jsdom —
 * for that surface the source scan plus the Playwright e2e gate remain the guard.
 *
 * Structural over the declared model, like the scan: nothing here names a row.
 */

/**
 * The accessible names the panel's presenter must give one declared row's controls —
 * the row-model naming convention ({@link SettingsRowNames}) applied per control kind.
 */
function expectedControlNames(row: SettingsRow): readonly string[] {
	switch (row.control.kind) {
		case "depth":
			// Two verb buttons share the row; the readout itself is not a control.
			return [SettingsRowNames.action("Decrease", row), SettingsRowNames.action("Increase", row)];
		case "sizing-metric":
			return [SettingsRowNames.role(row, "enabled"), SettingsRowNames.role(row, "weight")];
		default:
			return [SettingsRowNames.sole(row)];
	}
}

/** Exclusion ON with one pattern, so the read-only pattern list renders its named `<ul>`. */
function stateRenderingEveryControl(): SettingsRowState {
	return settingsRowStateFixture({ nodeExclusion: { enabled: true, patterns: ["^archive/"] } });
}

function renderToolbar(state: SettingsRowState): HTMLElement {
	return renderWithActions(<GraphToolbar controls={controlsModelFixture(state)} />, new RecordingControlsActions())
		.container;
}

/** Every rendered `aria-label`, in document order, narrowed to the declared control names. */
function renderedDeclaredNames(container: HTMLElement, declared: readonly string[]): readonly string[] {
	return Array.from(container.querySelectorAll("[aria-label]"))
		.map((el) => el.getAttribute("aria-label"))
		.filter((name): name is string => name !== null && declared.includes(name));
}

afterEach(cleanup);

describe("GraphToolbar (rendered): every declared row produces its declared controls", () => {
	it("WHEN the panel renders THEN every row's controls appear under their declared accessible names, in declared order", () => {
		const container = renderToolbar(stateRenderingEveryControl());
		const declared = EVERY_SETTINGS_ROW.flatMap(expectedControlNames);
		expect(renderedDeclaredNames(container, declared)).toEqual(declared);
	});

	it("WHEN exclusion is OFF THEN the patterns row renders its declared disabledWhen verdict", () => {
		const patternsRow = settingsRowsFor("exclusion-patterns")[0];
		if (patternsRow === undefined) {
			throw new Error("the declared model no longer has an exclusion-patterns row");
		}
		renderToolbar(settingsRowStateFixture({ nodeExclusion: { enabled: false, patterns: ["^archive/"] } }));
		const list = screen.getByLabelText(SettingsRowNames.sole(patternsRow));
		expect(list.closest("[aria-disabled]")?.getAttribute("aria-disabled")).toBe("true");
	});

	it("WHEN exclusion is ON THEN the patterns row is not marked disabled", () => {
		const patternsRow = settingsRowsFor("exclusion-patterns")[0];
		if (patternsRow === undefined) {
			throw new Error("the declared model no longer has an exclusion-patterns row");
		}
		renderToolbar(stateRenderingEveryControl());
		const list = screen.getByLabelText(SettingsRowNames.sole(patternsRow));
		expect(list.closest("[aria-disabled]")?.getAttribute("aria-disabled")).toBe("false");
	});
});

describe("GraphToolbar (rendered): a metric's weight is disabled with its toggle", () => {
	const metricRow = settingsRowsFor("sizing-metric")[0];
	if (metricRow === undefined || metricRow.control.kind !== "sizing-metric") {
		throw new Error("the declared model no longer has a sizing-metric row");
	}
	const metric = metricRow.control.metric;

	/** Defaults with THIS metric's enable flag forced to `enabled`. */
	function stateWithMetricEnabled(enabled: boolean): SettingsRowState {
		const view = EngineDefaults.viewSettings();
		return settingsRowStateFixture({
			globalView: {
				...view,
				sizing: {
					...view.sizing,
					metrics: { ...view.sizing.metrics, [metric]: { ...view.sizing.metrics[metric], enabled } },
				},
			},
		});
	}

	function weightInput(): HTMLInputElement {
		return screen.getByRole("spinbutton", { name: SettingsRowNames.role(metricRow!, "weight") }) as HTMLInputElement;
	}

	it("WHEN the metric toggle is OFF THEN its weight input renders disabled", () => {
		renderToolbar(stateWithMetricEnabled(false));
		expect(weightInput().disabled).toBe(true);
	});

	it("WHEN the metric toggle is ON THEN its weight input renders enabled", () => {
		renderToolbar(stateWithMetricEnabled(true));
		expect(weightInput().disabled).toBe(false);
	});
});
