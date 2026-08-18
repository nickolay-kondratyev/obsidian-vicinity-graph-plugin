import { describe, expect, it } from "vitest";
import {
	RELATION_COLOR_SLOT_COUNT,
	relationChipColorClassName,
	relationColorSlot,
	relationEdgeColorClassName,
} from "./relationColor";

/**
 * BDD coverage for per-relation-name colouring (ticket nid_adesjb4clls56623vdu773ubg_e).
 * Pins the CONTRACT the view + CSS depend on: deterministic slots in range, case- and
 * whitespace-folding, and the "single hue or nothing" rule for the edge line.
 */
describe("relationColorSlot", () => {
	it("WHEN called twice with the same name THEN it returns the same slot (deterministic)", () => {
		expect(relationColorSlot("supports")).toBe(relationColorSlot("supports"));
	});

	it("WHEN any name is hashed THEN the slot is within the palette range", () => {
		for (const name of ["supports", "contradicts", "cites", "up", "", "a-very-long-relation-name"]) {
			const slot = relationColorSlot(name);
			expect(slot).toBeGreaterThanOrEqual(0);
			expect(slot).toBeLessThan(RELATION_COLOR_SLOT_COUNT);
		}
	});

	it("WHEN a name differs only by case THEN it maps to the SAME slot", () => {
		expect(relationColorSlot("Supports")).toBe(relationColorSlot("supports"));
	});

	it("WHEN a name differs only by surrounding whitespace THEN it maps to the SAME slot", () => {
		expect(relationColorSlot("  supports  ")).toBe(relationColorSlot("supports"));
	});

	it("WHEN two distinct common names are hashed THEN they land on different slots", () => {
		// Not guaranteed in general, but these two argument-map staples must be distinguishable.
		expect(relationColorSlot("supports")).not.toBe(relationColorSlot("contradicts"));
	});
});

describe("relationChipColorClassName", () => {
	it("WHEN a name is passed THEN it returns the slot's chip class", () => {
		expect(relationChipColorClassName("supports")).toBe(
			`vicinity-graph-edge__relation--color-${relationColorSlot("supports")}`,
		);
	});
});

describe("relationEdgeColorClassName", () => {
	it("WHEN the edge has one name THEN it returns that name's edge-line class", () => {
		expect(relationEdgeColorClassName(["supports"])).toBe(
			`vicinity-graph-edge--relation-color-${relationColorSlot("supports")}`,
		);
	});

	it("WHEN every name shares one hue THEN it returns that single hue's class", () => {
		expect(relationEdgeColorClassName(["supports", "SUPPORTS", " supports "])).toBe(
			`vicinity-graph-edge--relation-color-${relationColorSlot("supports")}`,
		);
	});

	it("WHEN names span more than one hue THEN it returns undefined (the line stays neutral)", () => {
		expect(relationEdgeColorClassName(["supports", "contradicts"])).toBeUndefined();
	});

	it("WHEN there are no names THEN it returns undefined", () => {
		expect(relationEdgeColorClassName([])).toBeUndefined();
	});
});
