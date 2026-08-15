import { describe, expect, it } from "vitest";
import { FOLDER_GROUPING_UNLIMITED_LABEL, FolderGroupingDepthSlider } from "./settingsRowAccessors";

/**
 * The ∞-terminated mapping BOTH settings surfaces render the folder-grouping-depth
 * slider through (ticket `nid_rndi5sulwrsx1aq0x4xqcskrb_e`). The track is an integer
 * range whose top stop is ∞; the stored VALUE is a depth (0..max or ∞). These assert the
 * two directions stay inverse and that ∞ lands on the terminal stop.
 */
describe("FolderGroupingDepthSlider", () => {
	const { maxFiniteDepth, unlimitedPosition, track } = FolderGroupingDepthSlider;

	it("WHEN the track is read THEN it spans the finite stops plus one ∞ stop", () => {
		expect(track).toEqual({ min: 0, max: maxFiniteDepth + 1, step: 1 });
	});

	it("WHEN the unlimited position is selected THEN the depth is ∞", () => {
		expect(FolderGroupingDepthSlider.depthAt(unlimitedPosition)).toBe(Number.POSITIVE_INFINITY);
	});

	it("WHEN a finite position is selected THEN the depth is that position verbatim", () => {
		expect(FolderGroupingDepthSlider.depthAt(3)).toBe(3);
	});

	it("WHEN ∞ is placed on the track THEN it lands on the terminal (unlimited) stop", () => {
		expect(FolderGroupingDepthSlider.positionOf(Number.POSITIVE_INFINITY)).toBe(unlimitedPosition);
	});

	it("WHEN a finite depth is placed on the track THEN it lands on its own position", () => {
		expect(FolderGroupingDepthSlider.positionOf(2)).toBe(2);
	});

	it("WHEN a finite depth past the finite max is placed on the track THEN it clamps to the finite max, NOT ∞", () => {
		expect(FolderGroupingDepthSlider.positionOf(maxFiniteDepth + 5)).toBe(maxFiniteDepth);
	});

	it("WHEN a depth round-trips value → position → value THEN it is unchanged", () => {
		for (const depth of [0, 1, maxFiniteDepth, Number.POSITIVE_INFINITY]) {
			expect(FolderGroupingDepthSlider.depthAt(FolderGroupingDepthSlider.positionOf(depth))).toBe(depth);
		}
	});

	it("WHEN ∞ is read out THEN it shows the infinity glyph", () => {
		expect(FolderGroupingDepthSlider.readout(Number.POSITIVE_INFINITY)).toBe(FOLDER_GROUPING_UNLIMITED_LABEL);
	});

	it("WHEN a finite depth is read out THEN it shows the number", () => {
		expect(FolderGroupingDepthSlider.readout(4)).toBe("4");
	});
});
