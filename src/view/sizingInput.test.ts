import { describe, expect, it } from "vitest";
import { parseSizingInput } from "./sizingInput";

describe("parseSizingInput", () => {
	it("WHEN the field holds a plain number THEN it is forwarded", () => {
		expect(parseSizingInput("40")).toBe(40);
	});

	it("WHEN the field holds a negative number THEN it is forwarded (the write path clamps it)", () => {
		expect(parseSizingInput("-1")).toBe(-1);
	});

	it("WHEN the field is cleared THEN nothing is forwarded (Number(\"\") is 0, which would persist a size)", () => {
		expect(parseSizingInput("")).toBeUndefined();
	});

	it("WHEN the field holds only whitespace THEN nothing is forwarded", () => {
		expect(parseSizingInput("   ")).toBeUndefined();
	});

	it("WHEN the field holds a number too large to represent THEN nothing is forwarded (1e999 is Infinity)", () => {
		expect(parseSizingInput("1e999")).toBeUndefined();
	});

	it("WHEN the field holds non-numeric text THEN nothing is forwarded", () => {
		expect(parseSizingInput("abc")).toBeUndefined();
	});
});
