import { describe, expect, it } from "vitest";
import { EngineDefaults, FORCE_LAYOUT_RANGES, clampForceLayoutSettings } from "./constants";
import { SETTINGS_SPEC } from "./SettingsSpec";
import type { ForceLayoutSettings } from "./types";

/**
 * The ticket-04 criterion this file guards: the force-layout defaults must be exactly
 * what `SETTINGS_SPEC` declares, and every one of them must be REACHABLE — a default
 * outside its own slider range would be silently rewritten by the load-path clamp, so
 * the shipped layout would differ from the declared one.
 *
 * WHY-NOT the 7-field literal `toEqual` this replaced: it duplicated the spec's own
 * numbers and went stale twice on intentional retunes (`collidePaddingPx` 20 → 50 in
 * `22bd5cb`, `elkNodeSpacingPx` 40 → 20). Those seven literals are NOT gone — they moved
 * to `settingsProductDefaults.test.ts`, the single baseline that pins every spec leaf's
 * default. They are deliberately not restated here as well; that duplication is what went
 * stale. Each value's rationale, including what breaks if it moves, lives on
 * `SETTINGS_SPEC.globalView.forceLayout`.
 *
 * WHAT THE GEOMETRY SUITES DO AND DO NOT ADD: `groupPacking.test.ts`,
 * `d3ForceStranding.test.ts` and `elkMapping.test.ts` run AT these defaults and assert
 * measured placement, so they catch a retune of `repelStrength`, `collidePaddingPx`,
 * `elkNodeSpacingPx` or `linkGapPx` as a real quality regression. Measured: they do NOT
 * react to `centerPullStrength`, `linkStrengthFactor` or `edgeRoutingClearancePx` at all.
 * The literal baseline is the only tripwire those three have.
 */
describe("EngineDefaults.forceLayoutSettings", () => {
	it("WHEN defaults are built THEN every field projects the spec default", () => {
		const declared = Object.fromEntries(
			Object.entries(SETTINGS_SPEC.globalView.forceLayout).map(([field, spec]) => [field, spec.default]),
		);
		expect(EngineDefaults.forceLayoutSettings()).toEqual(declared);
	});

	it("WHEN defaults are clamped THEN they pass through unchanged (every default is reachable in its own range)", () => {
		const defaults = EngineDefaults.forceLayoutSettings();
		expect(clampForceLayoutSettings(defaults)).toEqual(defaults);
	});
});

/**
 * The whole-object clamp. Per-field bounds behavior (below-min, above-max, NaN) is
 * asserted for every bounded spec leaf — force layout included — in
 * `settingsSpecBounds.test.ts`; what is left here is the clamp's WHOLE-OBJECT contract:
 * it must repair every field of a mangled object at once, never just the first.
 */
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
});

/**
 * A cross-FIELD invariant on the ranges — a force-layout DOMAIN claim, so it lives with
 * the force layout rather than in the generic bounds walk (`settingsSpecBounds.test.ts`),
 * which is also where a future "simplify these ranges" edit lands.
 */
describe("force-layout range invariants", () => {
	it("WHEN the center pull is maxed and the link factor is minimized THEN links still dominate the pull (anti-collapse invariant)", () => {
		// A degree-1 leaf's weakest spring is linkStrengthFactor.min / 1; the strongest
		// reachable center pull must stay below it, or the hub-collapse degeneracy
		// documented at the ranges table becomes reachable from the sliders.
		const forceLayout = SETTINGS_SPEC.globalView.forceLayout;
		expect(forceLayout.centerPullStrength.max).toBeLessThan(forceLayout.linkStrengthFactor.min);
	});
});
