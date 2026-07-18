import { describe, expect, it } from "vitest";
import { DocPersistEligibility } from "./DocPersistEligibility";

describe("DocPersistEligibility.classify", () => {
	it("WHEN the docid follows the generated format THEN the doc is persistable", () => {
		expect(DocPersistEligibility.classify("docid_a1b2c3d4e5f6g7h8i9j0k1l2_e")).toEqual({
			kind: "persistable",
			docid: "docid_a1b2c3d4e5f6g7h8i9j0k1l2_e",
		});
	});

	it("WHEN a foreign-format docid is filename-safe THEN it is honored (README: ids pass through)", () => {
		expect(DocPersistEligibility.classify("Legacy-Id_42").kind).toBe("persistable");
	});

	it("WHEN the doc has no docid THEN the typed reason is no-docid", () => {
		expect(DocPersistEligibility.classify(null)).toEqual({ kind: "not-persistable", reason: "no-docid" });
	});

	it("WHEN a foreign docid contains a path separator THEN the typed reason is unsafe-docid", () => {
		expect(DocPersistEligibility.classify("evil/../../escape")).toEqual({
			kind: "not-persistable",
			reason: "unsafe-docid",
		});
	});

	it("WHEN a foreign docid contains dots THEN it is unsafe (no '..' style names ever)", () => {
		expect(DocPersistEligibility.classify("v1.2.3").kind).toBe("not-persistable");
	});

	it("WHEN the docid is empty THEN it is unsafe", () => {
		expect(DocPersistEligibility.classify("").kind).toBe("not-persistable");
	});

	it("WHEN a foreign docid is a Windows reserved device name THEN it is unsafe (CON.json is unwritable there)", () => {
		expect(DocPersistEligibility.classify("CON").kind).toBe("not-persistable");
	});

	it("WHEN a reserved device name arrives in another case THEN it is still unsafe (Windows is case-insensitive)", () => {
		expect(DocPersistEligibility.classify("com3").kind).toBe("not-persistable");
	});

	it("WHEN a docid merely STARTS with a reserved device name THEN it stays persistable", () => {
		expect(DocPersistEligibility.classify("CONSOLE").kind).toBe("persistable");
	});
});
