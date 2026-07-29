import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { SECTION_RESET_SCOPES } from "./settingsResetPlan";
import { SECTION_SETTINGS_FIELDS, SETTINGS_SECTIONS, type SectionSettingsFields } from "./settingsSectionFields";

/**
 * These cover what the module's compile guard CANNOT see: a field listed in TWO
 * sections (which would make two cards both claim to own it, and two scoped
 * resets both write it). The compile guard catches the other direction — a field
 * listed in NO section.
 *
 * Field names come from the engine's own defaults factories, so the expectation
 * grows by itself the day a settings field is added.
 */

function listedFields(family: keyof SectionSettingsFields): string[] {
	return SETTINGS_SECTIONS.flatMap((section) => [...SECTION_SETTINGS_FIELDS[section][family]]);
}

describe("settings section field map", () => {
	it("WHEN the section map is read THEN every ViewSettings field appears in exactly one section", () => {
		expect(listedFields("view").sort()).toEqual(Object.keys(EngineDefaults.viewSettings()).sort());
	});

	it("WHEN the section map is read THEN every DepthSettings field appears in exactly one section", () => {
		expect(listedFields("depth").sort()).toEqual(Object.keys(EngineDefaults.depthSettings()).sort());
	});

	it("WHEN the section map is read THEN every NodeExclusionSettings field appears in exactly one section", () => {
		expect(listedFields("exclusion").sort()).toEqual(Object.keys(EngineDefaults.nodeExclusionSettings()).sort());
	});

	/**
	 * The sections and the per-section reset scopes are the same six cards seen
	 * from two sides; a section with no reset scope would be a card whose
	 * "Restore defaults" row silently does not exist.
	 */
	it("WHEN the section list is read THEN it matches the settings-tab section reset scopes", () => {
		expect([...SETTINGS_SECTIONS]).toEqual([...SECTION_RESET_SCOPES]);
	});
});
