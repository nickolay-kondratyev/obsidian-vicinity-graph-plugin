import { describe, expect, it } from "vitest";
import { NODE_PREVIEW_PREFERENCES } from "../engine";
import { NODE_PREVIEW_OPTION_META } from "./nodePreviewPreferenceMeta";
import { settingsRowsFor } from "./settingsRows";

/**
 * The option copy IS the accessible name of each segment in both radiogroups
 * (settings tab + controls panel): the `<label>`'s text names its radio. A
 * `Record` over the union already makes a MISSING label a compile error; what it
 * cannot catch is two options sharing one label, which would leave the group
 * with duplicate accessible names — ambiguous for a screen reader, for
 * `getByRole("radio", { name })`, and for a sighted user picking a segment.
 */
describe("nodePreviewPreferenceMeta option labels", () => {
	it("WHEN the segment labels are collected THEN every preference carries a distinct one", () => {
		const labels = NODE_PREVIEW_PREFERENCES.map((preference) => NODE_PREVIEW_OPTION_META[preference].label);
		expect(new Set(labels).size).toBe(NODE_PREVIEW_PREFERENCES.length);
	});

	it("WHEN the row label is used as the radiogroup's accessible name THEN it does not collide with a segment label", () => {
		// Both strings sit in the same a11y subtree (group name + option names);
		// "Preview / Preview" would make the group indistinguishable from a segment.
		const previewRows = settingsRowsFor("node-preview");
		// Asserted, not optional-chained away: a `not.toContain(undefined)` would pass
		// vacuously if the preview row ever stopped being declared.
		expect(previewRows).toHaveLength(1);
		const labels = NODE_PREVIEW_PREFERENCES.map((preference) => NODE_PREVIEW_OPTION_META[preference].label);
		expect(labels).not.toContain(previewRows[0]?.label);
	});
});
