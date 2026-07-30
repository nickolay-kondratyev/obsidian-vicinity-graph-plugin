import { describe, expect, it } from "vitest";
import { SETTINGS_RESET_SCOPES } from "./settingsResetPlan";
import { SettingsWriteFailureNotice } from "./settingsWriteFailureNotice";

/**
 * The notice must name the setting the user just touched — that name is the whole
 * value of the message, so these tests pin the COPY (the literal row labels) rather
 * than re-deriving it from the row model, which would assert nothing.
 *
 * One case per lookup shape: a field-bearing control (three depth rows share a kind,
 * so keying on the kind alone would label them all "Links out"), a field-less one, and
 * a metric row whose two controls must both resolve to their single row.
 */
describe("SettingsWriteFailureNotice for an interaction", () => {
	it("WHEN a depth write fails THEN the notice names THAT depth row, not another one sharing its kind", () => {
		const notice = SettingsWriteFailureNotice.forInteraction({ kind: "global-depth", field: "linkDepthIn", value: 2 });
		expect(notice).toContain("Links in");
	});

	it("WHEN a field-less control's write fails THEN the notice names its row", () => {
		const notice = SettingsWriteFailureNotice.forInteraction({ kind: "global-cap", value: 42 });
		expect(notice).toContain("Node cap");
	});

	it("WHEN a metric WEIGHT write fails THEN the notice names the metric's row", () => {
		const notice = SettingsWriteFailureNotice.forInteraction({
			kind: "global-sizing-metric-weight",
			metric: "backlink-count",
			weight: 3,
		});
		expect(notice).toContain("Backlinks");
	});

	it("WHEN any write fails THEN the notice attributes itself to this plugin", () => {
		// Obsidian notices carry no chrome: an unattributed one reads as the app's own.
		const notice = SettingsWriteFailureNotice.forInteraction({ kind: "global-cap", value: 42 });
		expect(notice).toContain("Vicinity graph");
	});
});

describe("SettingsWriteFailureNotice for a reset", () => {
	it("WHEN a restore-defaults write fails THEN the notice names the DECLARED scope label", () => {
		// Derived on purpose: the point is that the notice's blast radius reads exactly
		// like the button's, whatever that label is changed to.
		expect(SettingsWriteFailureNotice.forReset("node-exclusion")).toContain(
			SETTINGS_RESET_SCOPES["node-exclusion"].label,
		);
	});
});
