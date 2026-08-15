// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GraphToolbar } from "./GraphToolbar";
import type { SettingsRow, SettingsRowBlock, SettingsRowState } from "./settingsRows";
import {
	EVERY_SETTINGS_BLOCK,
	EVERY_SETTINGS_ROW,
	SETTINGS_SUBHEADING_CLASS,
	SettingsRowNames,
	settingsRowsFor,
} from "./settingsRows";
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

describe("GraphToolbar (rendered): the grouping rows dependent on folder grouping depth", () => {
	/** The named native control of one dependent grouping row (checkbox or range input). */
	function groupingControl(kind: "group-label-full-path" | "edge-depth-into-groups"): HTMLInputElement {
		const row = settingsRowsFor(kind)[0];
		if (row === undefined) {
			throw new Error(`the declared model no longer has a ${kind} row`);
		}
		return screen.getByLabelText(SettingsRowNames.sole(row)) as HTMLInputElement;
	}

	function renderAtGroupingDepth(folderGroupingDepth: number): void {
		const base = stateRenderingEveryControl();
		renderToolbar({ ...base, globalView: { ...base.globalView, folderGroupingDepth } });
	}

	it("WHEN folder grouping depth is 0 THEN the full-path toggle renders its declared disabledWhen verdict", () => {
		renderAtGroupingDepth(0);
		expect(groupingControl("group-label-full-path").disabled).toBe(true);
	});

	it("WHEN folder grouping depth is 0 THEN the edge-depth slider renders its declared disabledWhen verdict", () => {
		renderAtGroupingDepth(0);
		expect(groupingControl("edge-depth-into-groups").disabled).toBe(true);
	});

	it("WHEN folder grouping depth is 1 THEN the full-path toggle is enabled", () => {
		renderAtGroupingDepth(1);
		expect(groupingControl("group-label-full-path").disabled).toBe(false);
	});

	it("WHEN folder grouping depth is 1 THEN the edge-depth slider is enabled", () => {
		renderAtGroupingDepth(1);
		expect(groupingControl("edge-depth-into-groups").disabled).toBe(false);
	});
});

describe("GraphToolbar (rendered): a declared block subheading groups its own rows", () => {
	/** The blocks that name a group, in declared render order. */
	const namedBlocks = EVERY_SETTINGS_BLOCK.filter(
		(block): block is SettingsRowBlock & { readonly subheading: string } => block.subheading !== undefined,
	);

	it("WHEN the panel renders THEN every declared subheading appears, in declared order", () => {
		const container = renderToolbar(stateRenderingEveryControl());
		const rendered = Array.from(container.querySelectorAll(`.${SETTINGS_SUBHEADING_CLASS}`)).map(
			(el) => el.textContent,
		);
		expect(rendered).toEqual(namedBlocks.map((block) => block.subheading));
	});

	it("WHEN a block names a group THEN the name and that block's rows share ONE element", () => {
		// The grouping itself, not just the copy: a subheading rendered as a SIBLING of
		// its rows is spaced by the disclosure body's inter-block gap and reads as a
		// label for everything below it — including the next group.
		const container = renderToolbar(stateRenderingEveryControl());
		const ungrouped = namedBlocks.filter((block) => {
			const heading = Array.from(container.querySelectorAll(`.${SETTINGS_SUBHEADING_CLASS}`)).find(
				(el) => el.textContent === block.subheading,
			);
			const group = heading?.parentElement;
			return (
				group === undefined ||
				group === null ||
				!block.rows
					.flatMap(expectedControlNames)
					.every((name) => group.querySelector(`[aria-label="${name}"]`) !== null)
			);
		});
		expect(ungrouped.map((block) => block.subheading)).toEqual([]);
	});

	it("WHEN the grouping is checked THEN the model actually declares some (the guard is not vacuous)", () => {
		expect(namedBlocks.length).toBeGreaterThan(1);
	});
});

// EXPLICIT ALIGNMENT (nid_cx5zoz7ptucg9nxalibv0mbjb_e): the "a metric's weight
// is disabled with its toggle" suite left with the removed sizing-metric rows;
// the exclusion-patterns suite above still exercises `disabledWhen` end-to-end.
