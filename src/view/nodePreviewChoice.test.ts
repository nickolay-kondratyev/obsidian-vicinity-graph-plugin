import { describe, expect, it } from "vitest";
import { nodePreviewKind } from "./nodePreviewChoice";

describe("nodePreviewKind", () => {
	it("WHEN the node has outline entries and an image THEN the outline claims the preview slot", () => {
		// The adapter already applied the image-vs-outline rule: entries surviving
		// to here mean the outline won.
		expect(nodePreviewKind({ outlineEntryCount: 3, hasImage: true })).toBe("outline");
	});

	it("WHEN the node has no outline entries but has an image THEN the thumbnail claims the slot", () => {
		expect(nodePreviewKind({ outlineEntryCount: 0, hasImage: true })).toBe("thumbnail");
	});

	it("WHEN the node has neither THEN no preview region is claimed", () => {
		expect(nodePreviewKind({ outlineEntryCount: 0, hasImage: false })).toBe("none");
	});
});
