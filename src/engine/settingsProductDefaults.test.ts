import { describe, expect, it } from "vitest";
import { SETTINGS_SPEC } from "./SettingsSpec";

/**
 * THE ONE PLACE WHERE A SETTINGS DEFAULT IS PINNED AS A LITERAL.
 *
 * Every other settings test in this repo iterates {@link SETTINGS_SPEC} and asserts
 * STRUCTURE (a field parses, round-trips, resets, honours its own bounds), precisely so
 * that retuning a value is a one-line edit instead of a hunt through mirrored baselines.
 * The cost of that is real: a structural suite stays green when a default MOVES, including
 * when it moves by accident. This file buys the tripwire back — for a deliberately SMALL,
 * curated set (owner decision, 2026-07-29).
 *
 * ADMISSION RULE — a default belongs here only if changing it changes what the user MEETS
 * on first run, so a silent change would be a product regression rather than a retune.
 * A tuning constant whose rationale is measured and documented on the spec
 * (`repelStrength`, `collidePaddingPx`, `edgeRoutingClearancePx`, …) does NOT belong here:
 * those are the values that went stale twice, their WHY already lives on the spec, and the
 * layout-quality suites (`groupPacking.test.ts`, `d3ForceStranding.test.ts`) run AT the
 * shipped defaults and fail on a real placement regression with measured numbers.
 *
 * WHEN A LITERAL HERE FAILS: do not "fix" the test. Either the change was intended — then
 * update the literal in the same commit as the spec, and say so in the release note — or
 * it was not, and the spec is what needs reverting.
 */
describe("product-meaningful settings defaults (deliberately hand-pinned literals)", () => {
	it("WHEN the node cap default is read THEN it is 100 (the shipped performance ceiling)", () => {
		expect(SETTINGS_SPEC.globalView.nodeCap.default).toBe(100);
	});

	it("WHEN the depth defaults are read THEN both are 1 hop (mirrors Obsidian's local graph)", () => {
		expect({
			outgoing: SETTINGS_SPEC.globalDepths.outgoingDepth.default,
			incoming: SETTINGS_SPEC.globalDepths.incomingDepth.default,
		}).toEqual({ outgoing: 1, incoming: 1 });
	});

	it("WHEN the outline depth default is read THEN it is 2 heading levels (sections + subsections)", () => {
		expect(SETTINGS_SPEC.globalView.outlineMaxDepth.default).toBe(2);
	});

	it("WHEN the outline depth range is read THEN it is 1..6 (markdown's own heading levels, never 0)", () => {
		const spec = SETTINGS_SPEC.globalView.outlineMaxDepth;
		expect({ min: spec.min, max: spec.max }).toEqual({ min: 1, max: 6 });
	});

	it("WHEN the node preview default is read THEN it is auto (the documented document-position rule)", () => {
		expect(SETTINGS_SPEC.globalView.nodePreviewPreference.default).toBe("auto");
	});

	it("WHEN the sizing metrics are read THEN own-file-size is the only one shipped ON", () => {
		const enabled = Object.entries(SETTINGS_SPEC.globalView.sizing.metrics)
			.filter(([, metric]) => metric.default.enabled)
			.map(([metricId]) => metricId);
		expect(enabled).toEqual(["own-file-size"]);
	});

	it("WHEN the node size range defaults are read THEN nodes span 40..160px", () => {
		const sizing = SETTINGS_SPEC.globalView.sizing;
		expect({ minPx: sizing.minPx.default, maxPx: sizing.maxPx.default }).toEqual({ minPx: 40, maxPx: 160 });
	});

	it("WHEN the node exclusion defaults are read THEN the feature ships OFF with no patterns", () => {
		expect({
			enabled: SETTINGS_SPEC.nodeExclusion.enabled.default,
			patterns: SETTINGS_SPEC.nodeExclusion.patterns.default,
		}).toEqual({ enabled: false, patterns: [] });
	});
});
