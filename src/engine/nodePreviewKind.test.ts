import { describe, expect, it } from "vitest";
import type { NodePreviewPreference } from "./types";
import type { NodePreviewInput } from "./nodePreviewKind";
import { nodePreviewKind } from "./nodePreviewKind";

/**
 * The outline-vs-image precedence rule as a truth table: every preference × every
 * reachable fact combination. The adapter reports facts only, so every cell of
 * the decision lives here.
 *
 * TIER matters on the Auto branch only — Auto withholds the outline from ordinary
 * neighbours — so the preference suites below are tabulated for a central and the
 * neighbour suites state the two ways the tier does and does not change the answer.
 *
 * Unreachable by construction (and therefore not tabulated): `imagePrecedesOutline`
 * with no image (nothing to precede with) or with no outline (nothing to precede).
 */
type PreviewFacts = Omit<NodePreviewInput, "preference" | "isCentral">;

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

/** A central (MAIN or a pinned root) — the tier the Auto ladder is unabridged for. */
function previewForCentral(preference: NodePreviewPreference, facts: PreviewFacts) {
	return nodePreviewKind({ preference, isCentral: true, ...facts });
}

/** An ordinary neighbour in the vicinity — neither MAIN nor pinned. */
function previewForNeighbour(preference: NodePreviewPreference, facts: PreviewFacts) {
	return nodePreviewKind({ preference, isCentral: false, ...facts });
}

describe("nodePreviewKind under the Auto preference for a central", () => {
	it("WHEN the note has both AND the image precedes the outline THEN the thumbnail claims the slot", () => {
		expect(previewForCentral("auto", BOTH_IMAGE_FIRST)).toBe("thumbnail");
	});

	it("WHEN the note has both AND the image does NOT precede the outline THEN the outline claims the slot", () => {
		expect(previewForCentral("auto", BOTH_OUTLINE_FIRST)).toBe("outline");
	});

	it("WHEN the note has an outline only THEN the outline claims the slot", () => {
		expect(previewForCentral("auto", OUTLINE_ONLY)).toBe("outline");
	});

	it("WHEN the note has an image only THEN the thumbnail claims the slot", () => {
		expect(previewForCentral("auto", IMAGE_ONLY)).toBe("thumbnail");
	});

	it("WHEN the note has neither THEN no preview region is claimed", () => {
		expect(previewForCentral("auto", NEITHER)).toBe("none");
	});
});

describe("nodePreviewKind under the Auto preference for an ordinary neighbour", () => {
	it("WHEN the note has an outline only THEN no preview region is claimed (title only)", () => {
		expect(previewForNeighbour("auto", OUTLINE_ONLY)).toBe("none");
	});

	it("WHEN the note has both AND the outline precedes the image THEN the thumbnail still claims the slot (the outline is not offered)", () => {
		expect(previewForNeighbour("auto", BOTH_OUTLINE_FIRST)).toBe("thumbnail");
	});

	it("WHEN the note has both AND the image precedes the outline THEN the thumbnail claims the slot", () => {
		expect(previewForNeighbour("auto", BOTH_IMAGE_FIRST)).toBe("thumbnail");
	});

	it("WHEN the note has an image only THEN the thumbnail claims the slot", () => {
		expect(previewForNeighbour("auto", IMAGE_ONLY)).toBe("thumbnail");
	});

	it("WHEN the note has neither THEN no preview region is claimed", () => {
		expect(previewForNeighbour("auto", NEITHER)).toBe("none");
	});
});

describe("nodePreviewKind for an ordinary neighbour under an EXPLICIT preference", () => {
	it("WHEN the preference is Outline AND the note has an outline only THEN the outline claims the slot (the tier gate is Auto's, not the preference's)", () => {
		expect(previewForNeighbour("outline", OUTLINE_ONLY)).toBe("outline");
	});

	it("WHEN the preference is Outline AND the image precedes the outline THEN the outline still claims the slot", () => {
		expect(previewForNeighbour("outline", BOTH_IMAGE_FIRST)).toBe("outline");
	});

	it("WHEN the preference is Image AND the note has an outline only THEN the outline claims the slot (a preference never empties a node)", () => {
		expect(previewForNeighbour("image", OUTLINE_ONLY)).toBe("outline");
	});
});

describe("nodePreviewKind under the Outline preference", () => {
	it("WHEN the note has both AND the image precedes the outline THEN the outline still claims the slot (the preference overrides document position)", () => {
		expect(previewForCentral("outline", BOTH_IMAGE_FIRST)).toBe("outline");
	});

	it("WHEN the note has both AND the image does NOT precede the outline THEN the outline claims the slot", () => {
		expect(previewForCentral("outline", BOTH_OUTLINE_FIRST)).toBe("outline");
	});

	it("WHEN the note has an image only THEN the thumbnail claims the slot (a preference never empties a node)", () => {
		expect(previewForCentral("outline", IMAGE_ONLY)).toBe("thumbnail");
	});

	it("WHEN the note has an outline only THEN the outline claims the slot", () => {
		expect(previewForCentral("outline", OUTLINE_ONLY)).toBe("outline");
	});

	it("WHEN the note has neither THEN no preview region is claimed", () => {
		expect(previewForCentral("outline", NEITHER)).toBe("none");
	});
});

describe("nodePreviewKind under the Title only preference", () => {
	// The one preference that empties the content slot: no region is ever claimed,
	// whatever the note has. Tabulated across every fact combination to pin that.
	it("WHEN the note has both AND the image precedes the outline THEN no region is claimed", () => {
		expect(previewForCentral("title-only", BOTH_IMAGE_FIRST)).toBe("none");
	});

	it("WHEN the note has both AND the outline precedes the image THEN no region is claimed", () => {
		expect(previewForCentral("title-only", BOTH_OUTLINE_FIRST)).toBe("none");
	});

	it("WHEN the note has an outline only THEN no region is claimed (the preference wins over the outline)", () => {
		expect(previewForCentral("title-only", OUTLINE_ONLY)).toBe("none");
	});

	it("WHEN the note has an image only THEN no region is claimed (the preference wins over the image)", () => {
		expect(previewForCentral("title-only", IMAGE_ONLY)).toBe("none");
	});

	it("WHEN the note has neither THEN no region is claimed", () => {
		expect(previewForCentral("title-only", NEITHER)).toBe("none");
	});

	it("WHEN the node is an ordinary neighbour with an outline THEN no region is claimed (tier is irrelevant here)", () => {
		expect(previewForNeighbour("title-only", OUTLINE_ONLY)).toBe("none");
	});
});

describe("nodePreviewKind under the Image preference", () => {
	it("WHEN the note has both AND the image does NOT precede the outline THEN the thumbnail claims the slot (the preference overrides document position)", () => {
		expect(previewForCentral("image", BOTH_OUTLINE_FIRST)).toBe("thumbnail");
	});

	it("WHEN the note has both AND the image precedes the outline THEN the thumbnail claims the slot", () => {
		expect(previewForCentral("image", BOTH_IMAGE_FIRST)).toBe("thumbnail");
	});

	it("WHEN the note has an outline only THEN the outline claims the slot (a preference never empties a node)", () => {
		expect(previewForCentral("image", OUTLINE_ONLY)).toBe("outline");
	});

	it("WHEN the note has an image only THEN the thumbnail claims the slot", () => {
		expect(previewForCentral("image", IMAGE_ONLY)).toBe("thumbnail");
	});

	it("WHEN the note has neither THEN no preview region is claimed", () => {
		expect(previewForCentral("image", NEITHER)).toBe("none");
	});
});
