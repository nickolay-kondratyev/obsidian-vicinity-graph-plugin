import { describe, expect, it } from "vitest";
import { ContextRowCollapseState } from "./contextRowCollapse";

const THREE_ROWS = ["links:0", "links:1", "backlink:a.md:0"] as const;

function threeRows(): ContextRowCollapseState {
	return ContextRowCollapseState.allCollapsed([...THREE_ROWS]);
}

describe("ContextRowCollapseState initial state", () => {
	it("WHEN created THEN every row is collapsed", () => {
		expect(THREE_ROWS.map((id) => threeRows().isExpanded(id))).toEqual([false, false, false]);
	});

	it("WHEN created with duplicate row ids THEN it throws", () => {
		expect(() => ContextRowCollapseState.allCollapsed(["links:0", "links:0"])).toThrowError(/Duplicate/);
	});
});

describe("ContextRowCollapseState toggling one row", () => {
	it("WHEN one collapsed row is toggled THEN that row is expanded", () => {
		expect(threeRows().toggled("links:1").isExpanded("links:1")).toBe(true);
	});

	it("WHEN one row is toggled THEN the other rows stay collapsed", () => {
		const state = threeRows().toggled("links:1");
		expect([state.isExpanded("links:0"), state.isExpanded("backlink:a.md:0")]).toEqual([false, false]);
	});

	it("WHEN the same row is toggled twice THEN it is collapsed again", () => {
		expect(threeRows().toggled("links:1").toggled("links:1").isExpanded("links:1")).toBe(false);
	});

	it("WHEN an unknown row id is toggled THEN it throws", () => {
		expect(() => threeRows().toggled("nope")).toThrowError(/Unknown/);
	});
});

describe("ContextRowCollapseState bulk transitions", () => {
	it("WHEN expandedAll is applied THEN every row is expanded", () => {
		const state = threeRows().expandedAll();
		expect(THREE_ROWS.map((id) => state.isExpanded(id))).toEqual([true, true, true]);
	});

	it("WHEN collapsedAll follows expandedAll THEN every row is collapsed", () => {
		const state = threeRows().expandedAll().collapsedAll();
		expect(THREE_ROWS.map((id) => state.isExpanded(id))).toEqual([false, false, false]);
	});
});

describe("ContextRowCollapseState enablement — all collapsed", () => {
	it("WHEN all rows are collapsed THEN Expand all is enabled", () => {
		expect(threeRows().enablement().expandAllEnabled).toBe(true);
	});

	it("WHEN all rows are collapsed THEN Collapse all is disabled", () => {
		expect(threeRows().enablement().collapseAllEnabled).toBe(false);
	});
});

describe("ContextRowCollapseState enablement — all expanded", () => {
	it("WHEN all rows are expanded THEN Collapse all is enabled", () => {
		expect(threeRows().expandedAll().enablement().collapseAllEnabled).toBe(true);
	});

	it("WHEN all rows are expanded THEN Expand all is disabled", () => {
		expect(threeRows().expandedAll().enablement().expandAllEnabled).toBe(false);
	});
});

describe("ContextRowCollapseState enablement — mixed", () => {
	it("WHEN some rows are expanded and some collapsed THEN Expand all is enabled", () => {
		expect(threeRows().toggled("links:0").enablement().expandAllEnabled).toBe(true);
	});

	it("WHEN some rows are expanded and some collapsed THEN Collapse all is enabled", () => {
		expect(threeRows().toggled("links:0").enablement().collapseAllEnabled).toBe(true);
	});
});

describe("ContextRowCollapseState enablement — zero rows", () => {
	it("WHEN the model has no rows THEN Expand all is disabled", () => {
		expect(ContextRowCollapseState.allCollapsed([]).enablement().expandAllEnabled).toBe(false);
	});

	it("WHEN the model has no rows THEN Collapse all is disabled", () => {
		expect(ContextRowCollapseState.allCollapsed([]).enablement().collapseAllEnabled).toBe(false);
	});
});

describe("ContextRowCollapseState enablement — single row", () => {
	it("WHEN the only row is collapsed THEN only Expand all is enabled", () => {
		expect(ContextRowCollapseState.allCollapsed(["edge:0"]).enablement()).toEqual({
			expandAllEnabled: true,
			collapseAllEnabled: false,
		});
	});

	it("WHEN the only row is expanded THEN only Collapse all is enabled", () => {
		expect(ContextRowCollapseState.allCollapsed(["edge:0"]).toggled("edge:0").enablement()).toEqual({
			expandAllEnabled: false,
			collapseAllEnabled: true,
		});
	});
});
