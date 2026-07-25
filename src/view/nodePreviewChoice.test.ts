import { describe, expect, it } from "vitest";
import type { NodePreviewPreference } from "../engine";
import type { NodePreviewInput } from "./nodePreviewChoice";
import { nodePreviewKind } from "./nodePreviewChoice";

/**
 * The outline-vs-image precedence rule as a truth table: every preference × every
 * reachable fact combination. The adapter reports facts only, so every cell of
 * the decision lives here.
 *
 * Unreachable by construction (and therefore not tabulated): `imagePrecedesOutline`
 * with no image (nothing to precede with) or with no outline (nothing to precede).
 */
type PreviewFacts = Omit<NodePreviewInput, "preference">;

const OUTLINE_ENTRIES = 3;
const BOTH_IMAGE_FIRST: PreviewFacts = {
	outlineEntryCount: OUTLINE_ENTRIES,
	hasImage: true,
	imagePrecedesOutline: true,
};
const BOTH_OUTLINE_FIRST: PreviewFacts = {
	outlineEntryCount: OUTLINE_ENTRIES,
	hasImage: true,
	imagePrecedesOutline: false,
};
const OUTLINE_ONLY: PreviewFacts = { outlineEntryCount: OUTLINE_ENTRIES, hasImage: false, imagePrecedesOutline: false };
const IMAGE_ONLY: PreviewFacts = { outlineEntryCount: 0, hasImage: true, imagePrecedesOutline: false };
const NEITHER: PreviewFacts = { outlineEntryCount: 0, hasImage: false, imagePrecedesOutline: false };

function previewUnder(preference: NodePreviewPreference, facts: PreviewFacts) {
	return nodePreviewKind({ preference, ...facts });
}

describe("nodePreviewKind under the Auto preference", () => {
	it("WHEN the note has both AND the image precedes the outline THEN the thumbnail claims the slot", () => {
		expect(previewUnder("auto", BOTH_IMAGE_FIRST)).toBe("thumbnail");
	});

	it("WHEN the note has both AND the image does NOT precede the outline THEN the outline claims the slot", () => {
		expect(previewUnder("auto", BOTH_OUTLINE_FIRST)).toBe("outline");
	});

	it("WHEN the note has an outline only THEN the outline claims the slot", () => {
		expect(previewUnder("auto", OUTLINE_ONLY)).toBe("outline");
	});

	it("WHEN the note has an image only THEN the thumbnail claims the slot", () => {
		expect(previewUnder("auto", IMAGE_ONLY)).toBe("thumbnail");
	});

	it("WHEN the note has neither THEN no preview region is claimed", () => {
		expect(previewUnder("auto", NEITHER)).toBe("none");
	});
});

describe("nodePreviewKind under the Outline preference", () => {
	it("WHEN the note has both AND the image precedes the outline THEN the outline still claims the slot (the preference overrides document position)", () => {
		expect(previewUnder("outline", BOTH_IMAGE_FIRST)).toBe("outline");
	});

	it("WHEN the note has both AND the image does NOT precede the outline THEN the outline claims the slot", () => {
		expect(previewUnder("outline", BOTH_OUTLINE_FIRST)).toBe("outline");
	});

	it("WHEN the note has an image only THEN the thumbnail claims the slot (a preference never empties a node)", () => {
		expect(previewUnder("outline", IMAGE_ONLY)).toBe("thumbnail");
	});

	it("WHEN the note has an outline only THEN the outline claims the slot", () => {
		expect(previewUnder("outline", OUTLINE_ONLY)).toBe("outline");
	});

	it("WHEN the note has neither THEN no preview region is claimed", () => {
		expect(previewUnder("outline", NEITHER)).toBe("none");
	});
});

describe("nodePreviewKind under the Image preference", () => {
	it("WHEN the note has both AND the image does NOT precede the outline THEN the thumbnail claims the slot (the preference overrides document position)", () => {
		expect(previewUnder("image", BOTH_OUTLINE_FIRST)).toBe("thumbnail");
	});

	it("WHEN the note has both AND the image precedes the outline THEN the thumbnail claims the slot", () => {
		expect(previewUnder("image", BOTH_IMAGE_FIRST)).toBe("thumbnail");
	});

	it("WHEN the note has an outline only THEN the outline claims the slot (a preference never empties a node)", () => {
		expect(previewUnder("image", OUTLINE_ONLY)).toBe("outline");
	});

	it("WHEN the note has an image only THEN the thumbnail claims the slot", () => {
		expect(previewUnder("image", IMAGE_ONLY)).toBe("thumbnail");
	});

	it("WHEN the note has neither THEN no preview region is claimed", () => {
		expect(previewUnder("image", NEITHER)).toBe("none");
	});
});
