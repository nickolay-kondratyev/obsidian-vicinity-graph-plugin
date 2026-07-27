import { describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import {
	describeInvalidExclusionPatterns,
	describeSizingRejection,
	invalidExclusionPatterns,
	parseExclusionPatterns,
} from "./settingsValidation";

const SIZING = EngineDefaults.sizingSettings();

describe("describeSizingRejection", () => {
	it("WHEN maxPx is below minPx THEN the pair is rejected", () => {
		expect(describeSizingRejection({ ...SIZING, minPx: 200, maxPx: 40 })).toBe(
			"Not applied: maximum node size (40px) must be at least the minimum (200px).",
		);
	});

	it("WHEN maxPx equals minPx THEN the pair is accepted (every node the same size is a real choice)", () => {
		expect(describeSizingRejection({ ...SIZING, minPx: 80, maxPx: 80 })).toBeUndefined();
	});

	it("WHEN maxPx is above minPx THEN the pair is accepted", () => {
		expect(describeSizingRejection({ ...SIZING, minPx: 40, maxPx: 160 })).toBeUndefined();
	});
});

describe("invalidExclusionPatterns", () => {
	it("WHEN a line does not compile THEN it is reported with the line number the user sees", () => {
		expect(invalidExclusionPatterns("^archive/\n[unclosed\ntemplates/")).toMatchObject([
			{ lineNumber: 2, pattern: "[unclosed" },
		]);
	});

	it("WHEN a blank line precedes the invalid one THEN the reported line number still counts it", () => {
		expect(invalidExclusionPatterns("\n\n[unclosed")).toMatchObject([{ lineNumber: 3, pattern: "[unclosed" }]);
	});

	it("WHEN a line does not compile THEN the regex engine's own reason is carried along", () => {
		const [invalid] = invalidExclusionPatterns("[unclosed");
		expect(invalid?.reason).toContain("Invalid regular expression");
	});

	it("WHEN every line compiles THEN nothing is reported", () => {
		expect(invalidExclusionPatterns("^archive/\ntemplates/\n")).toEqual([]);
	});
});

describe("describeInvalidExclusionPatterns", () => {
	it("WHEN a line does not compile THEN the visible message names the line and the pattern", () => {
		expect(describeInvalidExclusionPatterns("^archive/\n[unclosed")?.message).toBe(
			'Line 2: "[unclosed" is not a valid regular expression — ignored.',
		);
	});

	it("WHEN two lines do not compile THEN both are listed", () => {
		expect(describeInvalidExclusionPatterns("[a\n(b")?.message.split("\n")).toHaveLength(2);
	});

	it("WHEN every line compiles THEN there is no feedback at all", () => {
		expect(describeInvalidExclusionPatterns("^archive/")).toBeUndefined();
	});
});

describe("parseExclusionPatterns", () => {
	it("WHEN lines carry blanks and indentation THEN they are trimmed and blank lines dropped", () => {
		expect(parseExclusionPatterns("  ^archive/  \n\n templates/ \n")).toEqual(["^archive/", "templates/"]);
	});

	it("WHEN a line is an invalid regex THEN it is still kept (the engine skips it, the user keeps their text)", () => {
		expect(parseExclusionPatterns("[unclosed")).toEqual(["[unclosed"]);
	});
});
