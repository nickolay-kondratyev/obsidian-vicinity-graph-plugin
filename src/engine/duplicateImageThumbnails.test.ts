import { describe, expect, it } from "vitest";
import type { ThumbnailCandidate } from "./duplicateImageThumbnails";
import { suppressedDuplicateThumbnails } from "./duplicateImageThumbnails";

/** A candidate that WOULD render the given image as its thumbnail. */
function candidate(overrides: Partial<ThumbnailCandidate> & Pick<ThumbnailCandidate, "path">): ThumbnailCandidate {
	return {
		folder: "",
		firstImagePath: "cover.png",
		rendersThumbnail: true,
		...overrides,
	};
}

describe("suppressedDuplicateThumbnails", () => {
	it("WHEN one node renders an image THEN nothing is suppressed", () => {
		const suppressed = suppressedDuplicateThumbnails([candidate({ path: "a.md" })]);
		expect(suppressed.size).toBe(0);
	});

	it("WHEN two nodes at the same depth render the same image THEN the lexicographically-later loses", () => {
		const suppressed = suppressedDuplicateThumbnails([candidate({ path: "b.md" }), candidate({ path: "a.md" })]);
		expect([...suppressed]).toEqual(["b.md"]);
	});

	it("WHEN two nodes render the same image THEN the one higher in the folder hierarchy keeps it", () => {
		const suppressed = suppressedDuplicateThumbnails([
			candidate({ path: "deep/nested/loser.md", folder: "deep/nested" }),
			candidate({ path: "winner.md", folder: "" }),
		]);
		expect([...suppressed]).toEqual(["deep/nested/loser.md"]);
	});

	it("WHEN nodes render DIFFERENT images THEN neither is suppressed", () => {
		const suppressed = suppressedDuplicateThumbnails([
			candidate({ path: "a.md", firstImagePath: "one.png" }),
			candidate({ path: "b.md", firstImagePath: "two.png" }),
		]);
		expect(suppressed.size).toBe(0);
	});

	it("WHEN a node shares the image but was NOT going to render a thumbnail THEN it neither wins nor loses", () => {
		// The higher-up node shows an outline, so it never claimed the image slot;
		// the sole thumbnail-bearer keeps its image (the rule applies only among
		// nodes that were going to display the image).
		const suppressed = suppressedDuplicateThumbnails([
			candidate({ path: "outline.md", folder: "", rendersThumbnail: false }),
			candidate({ path: "sub/image.md", folder: "sub" }),
		]);
		expect(suppressed.size).toBe(0);
	});

	it("WHEN three nodes render the same image THEN only the highest keeps it", () => {
		const suppressed = suppressedDuplicateThumbnails([
			candidate({ path: "a/one.md", folder: "a" }),
			candidate({ path: "top.md", folder: "" }),
			candidate({ path: "a/b/two.md", folder: "a/b" }),
		]);
		expect([...suppressed].sort()).toEqual(["a/b/two.md", "a/one.md"]);
	});
});
