import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { SIZING_METRICS } from "./sizingMetrics";

/**
 * The shared list is the single presentation contract for BOTH sizing surfaces
 * (in-view disclosure + settings tab). Its invariant: it must expose EVERY
 * engine sizing metric exactly once — a missing metric would silently vanish
 * from both UIs, an extra one would map to a non-existent setting.
 */
describe("SIZING_METRICS", () => {
	const engineMetricIds = Object.keys(EngineDefaults.sizingSettings().metrics).sort();

	it("covers every engine sizing metric id exactly once", () => {
		const listedIds = SIZING_METRICS.map((metric) => metric.id).sort();
		expect(listedIds).toEqual(engineMetricIds);
	});

	it("gives every metric a non-empty label", () => {
		const blankLabels = SIZING_METRICS.filter((metric) => metric.label.trim().length === 0);
		expect(blankLabels).toEqual([]);
	});
});
