import { describe, expect, it } from "vitest";
import { parseIdRefFields } from "./frontmatterLinkFields";

/**
 * The ONE canonical parse of the comma-separated id-reference field list. Both the
 * settings surfaces and the adapter (dependent ticket) read field names through this,
 * so "which fields are id-refs" is pinned here once.
 */
describe("parseIdRefFields", () => {
	it("WHEN the raw string is empty THEN no fields are returned (feature off)", () => {
		expect(parseIdRefFields("")).toEqual([]);
	});

	it("WHEN the raw string is only whitespace THEN no fields are returned", () => {
		expect(parseIdRefFields("   ")).toEqual([]);
	});

	it("WHEN the raw string is only commas THEN no fields are returned", () => {
		expect(parseIdRefFields(",,,")).toEqual([]);
	});

	it("WHEN a single field name is given THEN it is returned as the sole entry", () => {
		expect(parseIdRefFields("deps")).toEqual(["deps"]);
	});

	it("WHEN names are comma-separated THEN each is returned in order", () => {
		expect(parseIdRefFields("deps,links")).toEqual(["deps", "links"]);
	});

	it("WHEN names carry surrounding whitespace THEN each is trimmed", () => {
		expect(parseIdRefFields("  deps ,  links ")).toEqual(["deps", "links"]);
	});

	it("WHEN empty segments sit between names THEN they are dropped", () => {
		expect(parseIdRefFields("deps,,links,")).toEqual(["deps", "links"]);
	});

	it("WHEN a name repeats THEN only its first occurrence is kept", () => {
		expect(parseIdRefFields("deps, links, deps")).toEqual(["deps", "links"]);
	});
});
