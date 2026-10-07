import { describe, expect, it } from "vitest";
import { MAX_RELATIONSHIP_NAME_LENGTH } from "./RelationshipName";
import { AI_ANCHOR_RELATIONSHIP_NAMES, buildRelationshipPrompt, parseModelRelationshipName } from "./RelationshipPrompt";

const SOURCE = { title: "Caching", text: "Caching makes [[Latency]] lower by keeping hot data close." };
const TARGET = { title: "Latency", text: "Latency is the time a request waits." };

describe("buildRelationshipPrompt", () => {
	const prompt = buildRelationshipPrompt(SOURCE, TARGET);

	it("WHEN built THEN the input carries the source note's full text, its link included", () => {
		expect(prompt.input).toContain(SOURCE.text);
	});

	it("WHEN built THEN the input carries the target note's full text", () => {
		expect(prompt.input).toContain(TARGET.text);
	});

	it("WHEN built THEN the input names the source note by title", () => {
		expect(prompt.input).toContain('<source_note title="Caching">');
	});

	it("WHEN built THEN the input names the target note by title", () => {
		expect(prompt.input).toContain('<target_note title="Latency">');
	});

	it("WHEN built THEN the source comes before the target", () => {
		expect(prompt.input.indexOf("<source_note")).toBeLessThan(prompt.input.indexOf("<target_note"));
	});

	it("WHEN built THEN the instructions list every anchor name", () => {
		expect(AI_ANCHOR_RELATIONSHIP_NAMES.filter((anchor) => !prompt.instructions.includes(anchor))).toEqual([]);
	});

	it("WHEN built THEN the instructions read the name from the source's point of view", () => {
		expect(prompt.instructions).toContain('"<source title> <name> <target title>"');
	});

	it("WHEN built THEN the instructions say an anchor is used only when it fits well", () => {
		expect(prompt.instructions).toContain("Use an anchor name ONLY when it fits well");
	});

	it("WHEN built THEN the instructions steer away from vague names", () => {
		expect(prompt.instructions).toContain('"related-to"');
	});

	it("WHEN built THEN the instructions ask for short kebab-case", () => {
		expect(prompt.instructions).toContain("kebab-case");
	});

	it("WHEN a title holds a quote THEN it is escaped and cannot break the note tag", () => {
		const quoted = buildRelationshipPrompt({ title: 'Say "hi"', text: "x" }, TARGET);
		expect(quoted.input).toContain('<source_note title="Say \\"hi\\"">');
	});
});

describe("AI_ANCHOR_RELATIONSHIP_NAMES", () => {
	it("WHEN listed THEN the vague related-to is not an anchor (human decision 2026-10-06)", () => {
		expect(AI_ANCHOR_RELATIONSHIP_NAMES).not.toContain("related-to");
	});
});

describe("parseModelRelationshipName", () => {
	it("WHEN the model answers a name THEN it is valid", () => {
		expect(parseModelRelationshipName('{"name":"depends-on"}')).toEqual({ kind: "valid", name: "depends-on" });
	});

	it("WHEN the name has surrounding whitespace THEN it is trimmed, like a typed name", () => {
		expect(parseModelRelationshipName('{"name":"  causes "}')).toEqual({ kind: "valid", name: "causes" });
	});

	it("WHEN the name is empty THEN it is invalid", () => {
		expect(parseModelRelationshipName('{"name":"  "}')).toEqual({ kind: "invalid" });
	});

	it("WHEN the name is longer than a typed name may be THEN it is invalid", () => {
		const tooLong = "x".repeat(MAX_RELATIONSHIP_NAME_LENGTH + 1);
		expect(parseModelRelationshipName(JSON.stringify({ name: tooLong }))).toEqual({ kind: "invalid" });
	});

	it("WHEN the text is not JSON THEN it is invalid", () => {
		expect(parseModelRelationshipName("depends-on")).toEqual({ kind: "invalid" });
	});

	it("WHEN the name is not a string THEN it is invalid", () => {
		expect(parseModelRelationshipName('{"name":42}')).toEqual({ kind: "invalid" });
	});

	it("WHEN the JSON is an array THEN it is invalid", () => {
		expect(parseModelRelationshipName('["depends-on"]')).toEqual({ kind: "invalid" });
	});
});
