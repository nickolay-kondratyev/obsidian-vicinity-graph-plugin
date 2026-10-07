import { describe, expect, it } from "vitest";
import { MAX_RELATIONSHIP_NAME_LENGTH, parseRelationshipName } from "./RelationshipName";

describe("parseRelationshipName", () => {
	it("WHEN the name has surrounding spaces THEN it is stored trimmed", () => {
		expect(parseRelationshipName("  improves  ")).toEqual({ kind: "valid", name: "improves" });
	});

	it("WHEN the name is empty THEN it is refused as empty", () => {
		expect(parseRelationshipName("")).toEqual({ kind: "refused", reason: "empty" });
	});

	it("WHEN the name is only whitespace THEN it is refused as empty", () => {
		expect(parseRelationshipName("   \t ")).toEqual({ kind: "refused", reason: "empty" });
	});

	it("WHEN the trimmed name is exactly the maximum length THEN it is accepted", () => {
		const name = "x".repeat(MAX_RELATIONSHIP_NAME_LENGTH);
		expect(parseRelationshipName(` ${name} `)).toEqual({ kind: "valid", name });
	});

	it("WHEN the trimmed name is one past the maximum length THEN it is refused as too long", () => {
		expect(parseRelationshipName("x".repeat(MAX_RELATIONSHIP_NAME_LENGTH + 1))).toEqual({
			kind: "refused",
			reason: "too-long",
		});
	});
});
