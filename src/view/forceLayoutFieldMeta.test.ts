import { describe, expect, it } from "vitest";
import { FORCE_LAYOUT_RANGES } from "../engine";
import { FORCE_LAYOUT_ADVANCED_FIELDS, FORCE_LAYOUT_MAIN_FIELDS } from "./forceLayoutFieldMeta";

/**
 * The main/advanced grouping drives BOTH slider surfaces (settings tab and
 * in-graph panel). Missing fields are a compile error (see the type-level
 * assert in forceLayoutFieldMeta.ts); this test closes the remaining runtime
 * gap — a field accidentally listed in BOTH groups would render twice.
 */
describe("forceLayoutFieldMeta field grouping", () => {
	it("WHEN the main and advanced groups are combined THEN they cover every FORCE_LAYOUT_RANGES field exactly once", () => {
		const grouped = [...FORCE_LAYOUT_MAIN_FIELDS, ...FORCE_LAYOUT_ADVANCED_FIELDS];
		expect([...grouped].sort()).toEqual(Object.keys(FORCE_LAYOUT_RANGES).sort());
	});
});
