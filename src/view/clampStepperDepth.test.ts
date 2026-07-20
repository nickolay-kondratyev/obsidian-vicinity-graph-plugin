import { describe, expect, it } from "vitest";
import { MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH, clampStepperDepth } from "./constants";

describe("clampStepperDepth bounds", () => {
	it("WHEN value below min THEN it clamps up to min", () => {
		expect(clampStepperDepth(-1)).toBe(MIN_STEPPER_DEPTH);
	});

	it("WHEN value equals min THEN it is unchanged", () => {
		expect(clampStepperDepth(0)).toBe(0);
	});

	it("WHEN value is within range THEN it is unchanged", () => {
		expect(clampStepperDepth(3)).toBe(3);
	});

	it("WHEN value equals max THEN it is unchanged", () => {
		expect(clampStepperDepth(5)).toBe(MAX_STEPPER_DEPTH);
	});

	it("WHEN value above max THEN it clamps down to max", () => {
		expect(clampStepperDepth(6)).toBe(MAX_STEPPER_DEPTH);
	});

	it("WHEN value is fractional THEN it rounds to the nearest integer", () => {
		expect(clampStepperDepth(2.4)).toBe(2);
	});
});
