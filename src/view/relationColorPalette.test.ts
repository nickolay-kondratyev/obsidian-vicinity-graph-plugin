import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RELATION_COLOR_SLOT_COUNT } from "./relationColor";

/**
 * Tripwire: relationColor.ts mints a class per slot `0 … RELATION_COLOR_SLOT_COUNT - 1`,
 * but the actual hues live in graph-view.css. If the slot count grows without a matching
 * CSS rule, edges would draw an UNSTYLED (default) stroke or chip for the new slot with
 * no compile-time signal. This scan fails that gap: every slot MUST have a palette
 * variable, a chip rule, and an edge-line rule. (A source scan, like the repo's other
 * settings/parity guards — no rendering.)
 */
const graphViewCss = readFileSync(join(__dirname, "graph-view.css"), "utf8");

describe("relation colour palette CSS coverage", () => {
	for (let slot = 0; slot < RELATION_COLOR_SLOT_COUNT; slot += 1) {
		it(`WHEN slot ${slot} exists THEN graph-view.css defines its palette variable`, () => {
			expect(graphViewCss).toContain(`--vicinity-rel-color-${slot}:`);
		});

		it(`WHEN slot ${slot} exists THEN graph-view.css defines its chip colour rule`, () => {
			expect(graphViewCss).toContain(`.vicinity-graph-edge__relation--color-${slot}`);
		});

		it(`WHEN slot ${slot} exists THEN graph-view.css defines its edge-line colour rule`, () => {
			expect(graphViewCss).toContain(`.vicinity-graph-edge--relation-color-${slot} .react-flow__edge-path`);
		});
	}
});
