import { describe, expect, it } from "vitest";
import { ALL_SETTINGS_RESET_NAME, SECTION_RESET_NAMES } from "./settingsBaseline";

/**
 * The INDEPENDENT second opinion on `settingsBaseline`'s DERIVED copy.
 *
 * The e2e specs now assert restore-row names against values read out of
 * `src/view/settingsResetPlan`, which on its own would make a copy change
 * self-fulfilling: rename a label and every spec would happily follow it. These
 * literals are the pin that says "this rename was deliberate" — exactly the
 * strength the three specs used to carry, now in ONE place instead of five.
 *
 * WHY-NOT pin the hand-written parts too (card headings, disclosure flags): a
 * literal here asserting a literal one file over has no independent authority —
 * it just makes a rename a two-file edit, the duplication this module removes.
 * Their real pin is the DOM: `settingsUxVisual.e2e.ts` asserts the headings and
 * the disclosure states against a real Obsidian.
 *
 * Runs under `npm test` (vitest), not Playwright: nothing here needs Obsidian.
 */

describe("settings-tab baseline", () => {
	it("WHEN the section reset names are derived from the plugin THEN they are the shipped restore-row copy", () => {
		expect(SECTION_RESET_NAMES).toEqual([
			"Restore depth defaults",
			"Restore grouping defaults",
			"Restore node sizing defaults",
			"Restore node contents defaults",
			"Restore edges defaults",
			"Restore force layout defaults",
			"Restore node exclusion defaults",
			"Restore frontmatter links defaults",
			"Restore performance defaults",
		]);
	});

	it("WHEN the tab-wide reset name is derived from the plugin THEN it is the shipped footer copy", () => {
		expect(ALL_SETTINGS_RESET_NAME).toBe("Restore all Vicinity Graph settings");
	});
});
