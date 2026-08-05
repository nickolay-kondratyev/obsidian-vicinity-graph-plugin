import { describe, expect, it } from "vitest";
import { EngineDefaults, SIZING_RANGES, clampSizingNumber, clampSizingSettings } from "./constants";
import type { SizingSettings } from "./types";

/**
 * Guards the sizing counterpart of the force-layout "degenerate values are
 * unreachable" contract: a hostile `minPx` / `maxPx` must never survive into
 * {@link SizingSettings}, because those numbers become node pixel geometry
 * (`sizePx` → React-Flow width/height → the libavoid router, which ABORTS its
 * wasm module on a non-finite rectangle).
 *
 * Clamping MUST be a no-op for every shipped default and every reasonable value
 * — a failure of the first test means the default node sizes changed.
 *
 * EXPLICIT ALIGNMENT (nid_cx5zoz7ptucg9nxalibv0mbjb_e): the metric dials
 * (`metrics`, `depthDecayK`, metric weights) are REMOVED — sizing is content-fit
 * and only the two clamps remain, so their clamp tests left with them.
 */
describe("clampSizingSettings (defaults pass through)", () => {
	it("WHEN the shipped defaults are clamped THEN they come back unchanged", () => {
		const defaults = EngineDefaults.sizingSettings();
		expect(clampSizingSettings(defaults)).toEqual(defaults);
	});
});

/** Sizing settings with both clamps set. */
function sizingWithNumbers(fields: { readonly minPx: number; readonly maxPx: number }): SizingSettings {
	return { minPx: fields.minPx, maxPx: fields.maxPx };
}

describe("clampSizingSettings (degenerate values are unreachable)", () => {
	it("WHEN every numeric field exceeds its maximum THEN each is clamped to its range max", () => {
		const clamped = clampSizingSettings(
			sizingWithNumbers({
				minPx: SIZING_RANGES.minPx.max + 1000,
				maxPx: SIZING_RANGES.maxPx.max + 1000,
			}),
		);
		expect(clamped).toEqual(
			sizingWithNumbers({
				minPx: SIZING_RANGES.minPx.max,
				maxPx: SIZING_RANGES.maxPx.max,
			}),
		);
	});

	it("WHEN every numeric field undershoots its minimum THEN each is clamped to its range min", () => {
		const clamped = clampSizingSettings(sizingWithNumbers({ minPx: -1000, maxPx: -1000 }));
		expect(clamped).toEqual(
			sizingWithNumbers({
				minPx: SIZING_RANGES.minPx.min,
				maxPx: SIZING_RANGES.maxPx.min,
			}),
		);
	});

	it("WHEN a field is NaN THEN it falls back to the shipped default (Math.min/Math.max do NOT filter NaN)", () => {
		const defaults = EngineDefaults.sizingSettings();
		const clamped = clampSizingSettings(sizingWithNumbers({ minPx: Number.NaN, maxPx: Number.NaN }));
		expect(clamped).toEqual(defaults);
	});

	it("WHEN a field is Infinity THEN it is clamped to its range max (never reaches pixel geometry)", () => {
		const clamped = clampSizingSettings(
			sizingWithNumbers({ minPx: Number.POSITIVE_INFINITY, maxPx: Number.POSITIVE_INFINITY }),
		);
		expect(clamped).toEqual(
			sizingWithNumbers({
				minPx: SIZING_RANGES.minPx.max,
				maxPx: SIZING_RANGES.maxPx.max,
			}),
		);
	});

	it("WHEN the pair is inverted THEN maxPx is RAISED to minPx", () => {
		const inverted = sizingWithNumbers({ minPx: 200, maxPx: 40 });
		expect(clampSizingSettings(inverted).maxPx).toBe(inverted.minPx);
	});

	it("WHEN the pair is inverted THEN minPx is left exactly as typed (the rule RAISES, it never swaps)", () => {
		const inverted = sizingWithNumbers({ minPx: 200, maxPx: 40 });
		expect(clampSizingSettings(inverted).minPx).toBe(inverted.minPx);
	});

	it("WHEN minPx equals maxPx THEN neither moves (every node the same size is a real choice)", () => {
		const flat = sizingWithNumbers({ minPx: 80, maxPx: 80 });
		expect(clampSizingSettings(flat)).toEqual(flat);
	});

	it("WHEN an out-of-range minPx inverts the pair only AFTER clamping THEN maxPx follows the CLAMPED minPx", () => {
		// The raise must read the clamped minPx, not the typed one: a hand-edited 1e6
		// minPx would otherwise drag maxPx far outside its own range and back into
		// pixel geometry — the one thing this clamp exists to prevent.
		const huge = sizingWithNumbers({ minPx: SIZING_RANGES.minPx.max + 1000, maxPx: 40 });
		expect(clampSizingSettings(huge).maxPx).toBe(SIZING_RANGES.minPx.max);
	});
});

describe("clampSizingNumber (one field, same clamp)", () => {
	it("WHEN one field is clamped alone THEN it lands where the whole-object clamp lands it", () => {
		// The panel's optimistic rows ask this function what the write path will STORE for
		// a typed value. If the two clamps could disagree, a row would either lie about a
		// stored value or hold its override forever waiting for one that never arrives.
		const typed = SIZING_RANGES.maxPx.max + 1000;
		const settings = sizingWithNumbers({ minPx: 40, maxPx: typed });
		expect(clampSizingNumber("maxPx", typed)).toBe(clampSizingSettings(settings).maxPx);
	});
});

describe("SIZING_RANGES", () => {
	it("WHEN the min node size range is read THEN its minimum is positive (a zero-size box is not geometry)", () => {
		expect(SIZING_RANGES.minPx.min).toBeGreaterThan(0);
	});
});
