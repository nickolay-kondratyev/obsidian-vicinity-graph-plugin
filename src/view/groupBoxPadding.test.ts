import { describe, expect, it } from "vitest";
import { ELK_GROUP_PADDING, GROUP_BOX_PADDING_PX, GROUP_SIDE_PADDING_PX } from "./constants";
import { ELK_TAG_GROUP_PADDING, TAG_CHIP_ROW_HANG_PX, groupBoxPaddingOf, groupBoxPaddingOfElkContainer } from "./groupBoxPadding";

describe("groupBoxPaddingOf (the per-box-kind inset)", () => {
	it("WHEN the box is a folder box THEN it keeps the folder inset unchanged", () => {
		expect(groupBoxPaddingOf("folder")).toEqual(GROUP_BOX_PADDING_PX);
	});

	it("WHEN the box is a tag box THEN its bottom inset clears the lowest note's hanging chip row by the side inset", () => {
		expect(groupBoxPaddingOf("tag").bottom).toBe(TAG_CHIP_ROW_HANG_PX + GROUP_SIDE_PADDING_PX);
	});

	it("WHEN the box is a tag box THEN only its bottom inset grows", () => {
		const { bottom: _folderBottom, ...folderSides } = GROUP_BOX_PADDING_PX;
		const { bottom: _tagBottom, ...tagSides } = groupBoxPaddingOf("tag");

		expect(tagSides).toEqual(folderSides);
	});

	it("WHEN the tag inset is written for elk THEN the string carries the grown bottom", () => {
		expect(ELK_TAG_GROUP_PADDING).toBe("[top=36.0,left=16.0,bottom=38.0,right=16.0]");
	});
});

describe("groupBoxPaddingOfElkContainer (reading a laid-out container's inset back)", () => {
	it("WHEN the container carries the tag inset THEN the tag padding is returned", () => {
		expect(groupBoxPaddingOfElkContainer({ id: "g", layoutOptions: { "elk.padding": ELK_TAG_GROUP_PADDING } })).toEqual(
			groupBoxPaddingOf("tag"),
		);
	});

	it("WHEN the container carries the folder inset THEN the folder padding is returned", () => {
		expect(groupBoxPaddingOfElkContainer({ id: "g", layoutOptions: { "elk.padding": ELK_GROUP_PADDING } })).toEqual(
			GROUP_BOX_PADDING_PX,
		);
	});
});
