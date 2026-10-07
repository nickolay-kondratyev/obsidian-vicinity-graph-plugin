import { describe, expect, it } from "vitest";
import { MAX_RELATIONSHIP_NAME_LENGTH } from "../engine";
import { decideRelationshipNameCommit, describeRelationshipNameRejection } from "./relationshipNameCommit";

const TOO_LONG = "x".repeat(MAX_RELATIONSHIP_NAME_LENGTH + 1);

describe("decideRelationshipNameCommit", () => {
	it("WHEN a new name is entered THEN it is saved trimmed", () => {
		expect(decideRelationshipNameCommit("  supports ", null, "enter")).toEqual({ kind: "save", name: "supports" });
	});

	it("WHEN a new name is left by blurring THEN it is saved", () => {
		expect(decideRelationshipNameCommit("supports", null, "blur")).toEqual({ kind: "save", name: "supports" });
	});

	it("WHEN the field is left empty THEN the edit is cancelled", () => {
		expect(decideRelationshipNameCommit("   ", null, "blur")).toEqual({ kind: "cancel" });
	});

	it("WHEN Enter is pressed on an empty field THEN it is refused with the way out", () => {
		expect(decideRelationshipNameCommit("", null, "enter")).toEqual({
			kind: "refuse",
			message: describeRelationshipNameRejection("empty"),
		});
	});

	it("WHEN the name is too long THEN it is refused even on blur", () => {
		expect(decideRelationshipNameCommit(TOO_LONG, null, "blur")).toEqual({
			kind: "refuse",
			message: describeRelationshipNameRejection("too-long"),
		});
	});

	it("WHEN the name is unchanged THEN nothing is saved", () => {
		expect(decideRelationshipNameCommit(" supports ", "supports", "enter")).toEqual({ kind: "cancel" });
	});

	it("WHEN the too-long copy is shown THEN it names the limit", () => {
		expect(describeRelationshipNameRejection("too-long")).toContain(String(MAX_RELATIONSHIP_NAME_LENGTH));
	});
});
