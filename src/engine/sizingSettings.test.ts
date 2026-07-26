import { describe, expect, it } from "vitest";
import { EngineDefaults, SIZING_RANGES, clampSizingSettings } from "./constants";
import type { SizingSettings } from "./types";

/**
 * Guards the sizing counterpart of the force-layout "degenerate values are
 * unreachable" contract: a hostile `depthDecayK` / `minPx` / `maxPx` / metric
 * weight must never survive into {@link SizingSettings}, because those numbers
 * become node pixel geometry (`sizePx` → React-Flow width/height → the libavoid
 * router, which ABORTS its wasm module on a non-finite rectangle).
 *
 * Clamping MUST be a no-op for every shipped default and every reasonable value
 * — a failure of the first test means the default node sizes changed.
 */
describe("clampSizingSettings (defaults pass through)", () => {
	it("WHEN the shipped defaults are clamped THEN they come back unchanged", () => {
		const defaults = EngineDefaults.sizingSettings();
		expect(clampSizingSettings(defaults)).toEqual(defaults);
	});
});

/** Sizing settings built from the defaults with the numeric fields overridden. */
function sizingWithNumbers(fields: {
	readonly depthDecayK: number;
	readonly minPx: number;
	readonly maxPx: number;
	readonly weight: number;
}): SizingSettings {
	const defaults = EngineDefaults.sizingSettings();
	const metrics = Object.fromEntries(
		Object.entries(defaults.metrics).map(([id, metric]) => [id, { ...metric, weight: fields.weight }]),
	) as SizingSettings["metrics"];
	return { metrics, depthDecayK: fields.depthDecayK, minPx: fields.minPx, maxPx: fields.maxPx };
}

describe("clampSizingSettings (degenerate values are unreachable)", () => {
	it("WHEN every numeric field exceeds its maximum THEN each is clamped to its range max", () => {
		const clamped = clampSizingSettings(
			sizingWithNumbers({
				depthDecayK: SIZING_RANGES.depthDecayK.max + 1000,
				minPx: SIZING_RANGES.minPx.max + 1000,
				maxPx: SIZING_RANGES.maxPx.max + 1000,
				weight: SIZING_RANGES.metricWeight.max + 1000,
			}),
		);
		expect(clamped).toEqual(
			sizingWithNumbers({
				depthDecayK: SIZING_RANGES.depthDecayK.max,
				minPx: SIZING_RANGES.minPx.max,
				maxPx: SIZING_RANGES.maxPx.max,
				weight: SIZING_RANGES.metricWeight.max,
			}),
		);
	});

	it("WHEN every numeric field undershoots its minimum THEN each is clamped to its range min", () => {
		const clamped = clampSizingSettings(
			sizingWithNumbers({ depthDecayK: -1000, minPx: -1000, maxPx: -1000, weight: -1000 }),
		);
		expect(clamped).toEqual(
			sizingWithNumbers({
				depthDecayK: SIZING_RANGES.depthDecayK.min,
				minPx: SIZING_RANGES.minPx.min,
				maxPx: SIZING_RANGES.maxPx.min,
				weight: SIZING_RANGES.metricWeight.min,
			}),
		);
	});

	it("WHEN a field is NaN THEN it falls back to the shipped default (Math.min/Math.max do NOT filter NaN)", () => {
		const defaults = EngineDefaults.sizingSettings();
		const clamped = clampSizingSettings(
			sizingWithNumbers({ depthDecayK: Number.NaN, minPx: Number.NaN, maxPx: Number.NaN, weight: Number.NaN }),
		);
		expect(clamped).toEqual(defaults);
	});

	it("WHEN a field is Infinity THEN it is clamped to its range max (never reaches pixel geometry)", () => {
		const clamped = clampSizingSettings(
			sizingWithNumbers({
				depthDecayK: Number.POSITIVE_INFINITY,
				minPx: Number.POSITIVE_INFINITY,
				maxPx: Number.POSITIVE_INFINITY,
				weight: Number.POSITIVE_INFINITY,
			}),
		);
		expect(clamped).toEqual(
			sizingWithNumbers({
				depthDecayK: SIZING_RANGES.depthDecayK.max,
				minPx: SIZING_RANGES.minPx.max,
				maxPx: SIZING_RANGES.maxPx.max,
				weight: SIZING_RANGES.metricWeight.max,
			}),
		);
	});

	it("WHEN a metric's enabled flag is set THEN clamping preserves it (only weights are bounded)", () => {
		const settings = sizingWithNumbers({ depthDecayK: 1, minPx: 40, maxPx: 160, weight: -5 });
		expect(clampSizingSettings(settings).metrics["depth-decay"].enabled).toBe(
			settings.metrics["depth-decay"].enabled,
		);
	});
});

describe("SIZING_RANGES (the singularity is out of reach)", () => {
	it("WHEN the depth-decay k range is read THEN its minimum is non-negative", () => {
		// `1 / (1 + k * minDepth)` divides by zero at k = -1/minDepth; a k >= 0
		// keeps the denominator >= 1 for every reachable depth.
		expect(SIZING_RANGES.depthDecayK.min).toBeGreaterThanOrEqual(0);
	});

	it("WHEN the min node size range is read THEN its minimum is positive (a zero-size box is not geometry)", () => {
		expect(SIZING_RANGES.minPx.min).toBeGreaterThan(0);
	});
});
