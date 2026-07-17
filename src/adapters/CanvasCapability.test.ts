import { describe, expect, it } from "vitest";
import { CanvasCapabilityDetector } from "./CanvasCapability";

describe("CanvasCapabilityDetector", () => {
	it("WHEN resolvedLinks contains a .canvas source key THEN canvas is core-indexed", () => {
		expect(CanvasCapabilityDetector.detect(["note.md", "board.canvas"])).toBe("core-indexed");
	});

	it("WHEN canvas entries are deliberately absent THEN the fallback is required", () => {
		expect(CanvasCapabilityDetector.detect(["note.md", "other.md"])).toBe("fallback-required");
	});

	it("WHEN resolvedLinks is empty (fresh/tiny vault) THEN the fallback is required", () => {
		expect(CanvasCapabilityDetector.detect([])).toBe("fallback-required");
	});

	it("WHEN a markdown file merely mentions canvas in its name THEN it does not count", () => {
		expect(CanvasCapabilityDetector.detect(["my.canvas.md"])).toBe("fallback-required");
	});
});
