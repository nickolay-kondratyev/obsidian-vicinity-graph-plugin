import { describe, expect, it } from "vitest";
import { EngineDefaults, FORCE_LAYOUT_RANGES, clampForceLayoutSettings } from "./constants";
import type { ForceLayoutSettings } from "./types";

/**
 * Guards the ticket-04 "sliders must not change default behavior" criterion:
 * the default force-layout settings MUST equal the exact constants currently
 * shipped. A failure here means the default rendered layout changed — align
 * with the human before touching these values.
 *
 * Baseline is ticket-03's placement-quality constants except `collidePaddingPx`,
 * deliberately raised 20 → 50 in `22bd5cb` (see `SettingsSpec.ts`).
 */
describe("EngineDefaults.forceLayoutSettings (shipped baseline)", () => {
	it("WHEN defaults are built THEN they equal the shipped layout constants", () => {
		expect(EngineDefaults.forceLayoutSettings()).toEqual({
			centerPullStrength: 0.05,
			repelStrength: 300,
			linkStrengthFactor: 1,
			linkGapPx: 40,
			collidePaddingPx: 50,
			elkNodeSpacingPx: 40,
		});
	});

	it("WHEN defaults are clamped THEN they pass through unchanged (every default sits inside its range)", () => {
		const defaults = EngineDefaults.forceLayoutSettings();
		expect(clampForceLayoutSettings(defaults)).toEqual(defaults);
	});
});

describe("clampForceLayoutSettings (degenerate values are unreachable)", () => {
	it("WHEN every field exceeds its maximum THEN each is clamped to its range max", () => {
		const excessive = Object.fromEntries(
			Object.entries(FORCE_LAYOUT_RANGES).map(([field, range]) => [field, range.max + 1000]),
		) as unknown as ForceLayoutSettings;
		const expected = Object.fromEntries(
			Object.entries(FORCE_LAYOUT_RANGES).map(([field, range]) => [field, range.max]),
		);
		expect(clampForceLayoutSettings(excessive)).toEqual(expected);
	});

	it("WHEN every field undershoots its minimum THEN each is clamped to its range min", () => {
		const undershooting = Object.fromEntries(
			Object.entries(FORCE_LAYOUT_RANGES).map(([field]) => [field, -1000]),
		) as unknown as ForceLayoutSettings;
		const expected = Object.fromEntries(
			Object.entries(FORCE_LAYOUT_RANGES).map(([field, range]) => [field, range.min]),
		);
		expect(clampForceLayoutSettings(undershooting)).toEqual(expected);
	});

	it("WHEN the center pull is maxed and the link factor is minimized THEN links still dominate the pull (anti-collapse invariant)", () => {
		// A degree-1 leaf's weakest spring is linkStrengthFactor.min / 1; the
		// strongest reachable center pull must stay below it or the hub-collapse
		// degeneracy documented at the ranges table becomes reachable.
		expect(FORCE_LAYOUT_RANGES.centerPullStrength.max).toBeLessThan(FORCE_LAYOUT_RANGES.linkStrengthFactor.min);
	});
});
