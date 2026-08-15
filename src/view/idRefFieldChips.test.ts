import { describe, expect, it } from "vitest";
import { parseIdRefFields } from "../engine";
import { IdRefFieldChips } from "./idRefFieldChips";

describe("IdRefFieldChips.list", () => {
	it("WHEN the stored string is parsed for chips THEN it matches the engine's canonical parse", () => {
		expect(IdRefFieldChips.list(" deps ,links,,deps")).toEqual(parseIdRefFields(" deps ,links,,deps"));
	});
});

describe("IdRefFieldChips.add", () => {
	it("WHEN a new field is added to an empty store THEN the stored string is that field", () => {
		expect(IdRefFieldChips.add("", "deps")).toBe("deps");
	});

	it("WHEN a new field is added THEN it is appended after the existing fields", () => {
		expect(IdRefFieldChips.add("deps", "links")).toBe("deps, links");
	});

	it("WHEN the entry is surrounded by whitespace THEN the stored field is trimmed", () => {
		expect(IdRefFieldChips.add("", "  deps  ")).toBe("deps");
	});

	it("WHEN a comma-separated entry is pasted THEN every new field it carries is added", () => {
		expect(IdRefFieldChips.add("deps", "links, related")).toBe("deps, links, related");
	});

	it("WHEN the entry is empty THEN the add is a no-op", () => {
		expect(IdRefFieldChips.add("deps", "   ")).toBeUndefined();
	});

	it("WHEN the entry is already present THEN the add is a no-op", () => {
		expect(IdRefFieldChips.add("deps, links", "deps")).toBeUndefined();
	});
});

describe("IdRefFieldChips.remove", () => {
	it("WHEN a field is removed THEN the remaining fields keep their order", () => {
		expect(IdRefFieldChips.remove("deps, links, related", "links")).toBe("deps, related");
	});

	it("WHEN the last field is removed THEN the stored string is empty (feature off)", () => {
		expect(IdRefFieldChips.remove("deps", "deps")).toBe("");
	});
});

describe("IdRefFieldChips.removeName", () => {
	it("WHEN a chip's remove button is named THEN the name carries the field", () => {
		expect(IdRefFieldChips.removeName("deps")).toBe("Remove deps");
	});
});
