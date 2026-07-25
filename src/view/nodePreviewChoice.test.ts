import { describe, expect, it } from "vitest";
import { nodePreviewKind } from "./nodePreviewChoice";

/**
 * The outline-vs-image precedence rule, asserted as a truth table. The adapter
 * reports facts only, so every cell of the decision lives here.
 */
describe("nodePreviewKind", () => {
	it("WHEN the note has both AND the image precedes the outline THEN the thumbnail claims the slot", () => {
		expect(nodePreviewKind({ outlineEntryCount: 3, hasImage: true, imagePrecedesOutline: true })).toBe("thumbnail");
	});

	it("WHEN the note has both AND the image does NOT precede the outline THEN the outline claims the slot", () => {
		expect(nodePreviewKind({ outlineEntryCount: 3, hasImage: true, imagePrecedesOutline: false })).toBe("outline");
	});

	it("WHEN the note has an outline only THEN the outline claims the slot", () => {
		expect(nodePreviewKind({ outlineEntryCount: 3, hasImage: false, imagePrecedesOutline: false })).toBe("outline");
	});

	it("WHEN the note has an image only THEN the thumbnail claims the slot", () => {
		expect(nodePreviewKind({ outlineEntryCount: 0, hasImage: true, imagePrecedesOutline: false })).toBe("thumbnail");
	});

	it("WHEN the note has neither THEN no preview region is claimed", () => {
		expect(nodePreviewKind({ outlineEntryCount: 0, hasImage: false, imagePrecedesOutline: false })).toBe("none");
	});
});
