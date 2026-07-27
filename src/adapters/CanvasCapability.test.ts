import { describe, expect, it } from "vitest";
import { CanvasCapabilityDetector } from "./CanvasCapability";

describe("CanvasCapabilityDetector", () => {
	it("WHEN resolvedLinks holds this canvas's own key THEN that canvas is core-indexed", () => {
		expect(CanvasCapabilityDetector.detectFor({ "note.md": {}, "board.canvas": {} }, "board.canvas")).toBe(
			"core-indexed",
		);
	});

	it("WHEN this canvas's key is absent THEN the fallback is required for it", () => {
		expect(CanvasCapabilityDetector.detectFor({ "note.md": {} }, "board.canvas")).toBe("fallback-required");
	});

	it("WHEN ANOTHER canvas is indexed but this one is not THEN this one still requires the fallback", () => {
		// The partial-index case: a vault-wide verdict would strand `board.canvas`
		// with no link source at all.
		expect(CanvasCapabilityDetector.detectFor({ "indexed.canvas": {} }, "board.canvas")).toBe("fallback-required");
	});

	it("WHEN an indexed canvas has no links THEN its empty entry still counts as core-indexed", () => {
		// `{}` is core's answer ("indexed, links: none"), not an absence of an answer.
		expect(CanvasCapabilityDetector.detectFor({ "board.canvas": {} }, "board.canvas")).toBe("core-indexed");
	});

	it("WHEN resolvedLinks is empty (fresh/tiny vault) THEN the fallback is required", () => {
		expect(CanvasCapabilityDetector.detectFor({}, "board.canvas")).toBe("fallback-required");
	});

	it("WHEN a markdown file merely mentions canvas in its name THEN it does not answer for a canvas", () => {
		expect(CanvasCapabilityDetector.detectFor({ "my.canvas.md": {} }, "my.canvas")).toBe("fallback-required");
	});
});
