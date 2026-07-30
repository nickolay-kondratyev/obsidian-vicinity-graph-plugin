import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import {
	DEPENDENCY_AWARE_CONTROL_KINDS,
	EVERY_SETTINGS_ROW,
	SETTINGS_GROUPS,
	SETTINGS_ROW_CONTROL_KINDS,
	SettingsRowNames,
	isSettingsRowDisabled,
	settingsRowsFor,
} from "./settingsRows";
import type { SettingsRow, SettingsRowState } from "./settingsRows";
import { SETTINGS_SECTIONS } from "./settingsSectionFields";

/**
 * The declared settings row model. Its COMPLETENESS is compile-forced (a `Record`
 * over `SettingsSection`, plus `_assertEveryRowControlKindListed`); what a type
 * cannot see is a row declared TWICE, a control kind declared but never used, or a
 * label that two rows share — which would give two controls one accessible name.
 */
describe("settings row model", () => {
	it("WHEN every declared row is collected THEN each carries a distinct label", () => {
		const labels = EVERY_SETTINGS_ROW.map((row) => row.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it("WHEN the declared control kinds are collected THEN every one of them is used by some row", () => {
		const used = new Set(EVERY_SETTINGS_ROW.map((row) => row.control.kind));
		expect([...SETTINGS_ROW_CONTROL_KINDS].filter((kind) => !used.has(kind))).toEqual([]);
	});

	it("WHEN a section declares no rows THEN it is reported, because a card with no control is a bug", () => {
		const empty = SETTINGS_SECTIONS.filter((section) => SETTINGS_GROUPS[section].blocks.every((b) => b.rows.length === 0));
		expect(empty).toEqual([]);
	});

	it("WHEN the sizing metric rows are read THEN there is one per shipped metric", () => {
		expect(settingsRowsFor("sizing-metric")).toHaveLength(
			Object.keys(EngineDefaults.viewSettings().sizing.metrics).length,
		);
	});
});

/**
 * `disabledWhen` is DATA (a named dependency), not a closure, so it can be
 * enumerated and evaluated here. The rule it encodes: a dependent row is always
 * rendered and merely disabled (owner decision 2026-07-29). Its SCOPE is deliberately
 * narrow — only `DEPENDENCY_AWARE_CONTROL_KINDS` — so the facility never promises more
 * than the presenters implement.
 */
describe("settings row disabledWhen", () => {
	const state = (exclusionEnabled: boolean): SettingsRowState => ({
		globalDepths: EngineDefaults.depthSettings(),
		globalView: EngineDefaults.viewSettings(),
		nodeExclusion: { ...EngineDefaults.nodeExclusionSettings(), enabled: exclusionEnabled },
	});

	const patternsRow = (): SettingsRow => {
		const [row] = settingsRowsFor("exclusion-patterns");
		if (row === undefined) {
			throw new Error("the exclusion-patterns row is not declared");
		}
		return row;
	};

	it("WHEN a row declares no dependency THEN it is never disabled", () => {
		const independent = EVERY_SETTINGS_ROW.filter((row) => row.disabledWhen === undefined);
		expect(independent.filter((row) => isSettingsRowDisabled(row, state(false)))).toEqual([]);
	});

	it("WHEN exclusion is OFF THEN the exclusion-patterns row is disabled", () => {
		expect(isSettingsRowDisabled(patternsRow(), state(false))).toBe(true);
	});

	it("WHEN exclusion is ON THEN the exclusion-patterns row is enabled", () => {
		expect(isSettingsRowDisabled(patternsRow(), state(true))).toBe(false);
	});

	it("WHEN a row declares a dependency THEN its control kind is one both presenters honour", () => {
		// The TYPE already refuses `disabledWhen` elsewhere; this states the same limit
		// at runtime, because rows are also built by `.map()` from other tables where a
		// widened literal could slip the constraint.
		const declared = EVERY_SETTINGS_ROW.filter((row) => row.disabledWhen !== undefined);
		const unhonoured = declared.filter(
			(row) => !DEPENDENCY_AWARE_CONTROL_KINDS.some((kind) => kind === row.control.kind),
		);
		expect(unhonoured).toEqual([]);
	});
});

/**
 * The ONE accessible-naming convention, stated in `SettingsRowNames` and applied by
 * both presenters. Pinned here because the strings are what a screen-reader user
 * hears and what every `getByLabel` in the e2e suite matches.
 */
describe("settings row accessible names", () => {
	const row: SettingsRow = { label: "Links out", control: { kind: "depth", field: "linkDepthOut" } };

	it("WHEN a row has one control THEN its accessible name is the row label verbatim", () => {
		expect(SettingsRowNames.sole(row)).toBe("Links out");
	});

	it("WHEN a row has several controls THEN each is named by the label plus its role", () => {
		expect(SettingsRowNames.role({ ...row, label: "Backlinks" }, "weight")).toBe("Backlinks weight");
	});

	it("WHEN a control acts on the row's value THEN it is named verb-first, over the lower-cased label", () => {
		expect(SettingsRowNames.action("Decrease", row)).toBe("Decrease links out");
	});
});
