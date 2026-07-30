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
 * WHY-NOT the 7-field literal `toEqual` this replaced (called out in the PR): it
 * duplicated the spec's own numbers and went stale twice on intentional retunes
 * (`collidePaddingPx` 20 → 50 in `22bd5cb`, `elkNodeSpacingPx` 40 → 20). The claim it
 * really made — "the default rendered layout did not change" — is not a number-equality
 * claim and was never enforceable here; it is enforced by the layout-quality suites that
 * run AT these defaults and assert measured geometry (`groupPacking.test.ts`,
 * `d3ForceStranding.test.ts`, `elkMapping.test.ts`). Each value's rationale, including
 * what breaks if it moves, lives on `SETTINGS_SPEC.globalView.forceLayout`.
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
