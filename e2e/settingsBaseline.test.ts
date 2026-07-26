import { describe, expect, it } from "vitest";
import {
	ALL_SETTINGS_RESET_NAME,
	CONTROLS_PANEL_DISCLOSURES,
	EVERY_SETTINGS_RESET_NAME,
	SECTION_RESET_NAMES,
	SETTINGS_TAB_SECTION_HEADINGS,
	SETTINGS_TAB_SECTIONS,
} from "./settingsBaseline";

/**
 * The INDEPENDENT second opinion on `settingsBaseline`'s derived copy.
 *
 * The e2e specs now assert restore-row names against values read out of
 * `src/view/settingsResetPlan`, which on its own would make a copy change
 * self-fulfilling: rename a label and every spec would happily follow it. These
 * literals are the pin that says "this rename was deliberate" — exactly the
 * strength the three specs used to carry, now in ONE place instead of five.
 *
 * Runs under `npm test` (vitest), not Playwright: nothing here needs Obsidian.
 */

describe("settings-tab baseline", () => {
	it("WHEN the section table is read THEN it lists every card heading in settings-tab render order", () => {
		expect(SETTINGS_TAB_SECTION_HEADINGS).toEqual([
			"Depth defaults",
			"Node sizing",
			"Node contents",
			"Force layout",
			"Node exclusion",
			"Performance",
		]);
	});

	it("WHEN the section reset names are derived from the plugin THEN they are the shipped restore-row copy", () => {
		expect(SECTION_RESET_NAMES).toEqual([
			"Restore depth defaults",
			"Restore node sizing defaults",
			"Restore node contents defaults",
			"Restore force layout defaults",
			"Restore node exclusion defaults",
			"Restore performance defaults",
		]);
	});

	it("WHEN the tab-wide reset name is derived from the plugin THEN it is the shipped footer copy", () => {
		expect(ALL_SETTINGS_RESET_NAME).toBe("Restore all Vicinity Graph settings");
	});

	it("WHEN every reset name is listed THEN the tab-wide one comes last, after the per-card ones", () => {
		expect(EVERY_SETTINGS_RESET_NAME).toEqual([...SECTION_RESET_NAMES, ALL_SETTINGS_RESET_NAME]);
	});

	it("WHEN a section is described THEN its heading and its reset name are both present", () => {
		expect(SETTINGS_TAB_SECTIONS.filter((section) => section.heading === "" || section.resetName === "")).toEqual(
			[],
		);
	});
});

describe("controls-panel baseline", () => {
	it("WHEN the panel disclosures are listed THEN exactly one of them starts open", () => {
		expect(CONTROLS_PANEL_DISCLOSURES.filter((disclosure) => disclosure.startsOpen).map((d) => d.summaryText)).toEqual([
			"Depth",
		]);
	});
});
