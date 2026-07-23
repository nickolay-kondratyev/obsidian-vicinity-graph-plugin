import { describe, expect, it } from "vitest";
import { NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx } from "./constants";
import { nodeDimensionsPx } from "./graphIdentity";
import { makeNode } from "./testFixtures/graphFixtures";

// 15 chars: the snug single-line estimate (15*7 + 20 = 125px) lands strictly
// between the score-driven square floor (40px) and the cap — the "medium" case.
const MEDIUM_TITLE = "medium-title-xx";
// Long enough that the snug estimate blows past NODE_MAX_LABEL_WIDTH_PX, so the
// width pins to the cap and the title wraps onto the 4 lines CSS allows.
const LONG_TITLE = "a-really-long-note-title-that-cannot-fit-a-small-square";

describe("nodeDimensionsPx", () => {
	it("WHEN a short title fits the score-driven square THEN width and height both equal sizePx", () => {
		const node = makeNode({ title: "a", sizePx: 160 });
		expect(nodeDimensionsPx(node)).toEqual({ width: 160, height: 160 });
	});

	it("WHEN a medium title outgrows the square but fits the cap THEN width is the snug single-line estimate", () => {
		const node = makeNode({ title: MEDIUM_TITLE, sizePx: 40 });
		expect(nodeDimensionsPx(node).width).toBe(estimateNodeLabelWidthPx(MEDIUM_TITLE));
	});

	it("WHEN a medium title widens the node THEN width lands between the square floor and the cap", () => {
		const width = nodeDimensionsPx(makeNode({ title: MEDIUM_TITLE, sizePx: 40 })).width;
		expect(width > 40 && width < NODE_MAX_LABEL_WIDTH_PX).toBe(true);
	});

	it("WHEN a long title exceeds the cap THEN width pins to NODE_MAX_LABEL_WIDTH_PX (title wraps to 4 lines)", () => {
		const node = makeNode({ title: LONG_TITLE, sizePx: 40 });
		expect(nodeDimensionsPx(node).width).toBe(NODE_MAX_LABEL_WIDTH_PX);
	});

	it("WHEN a long title pins the width to the cap THEN height stays the score-driven size", () => {
		const node = makeNode({ title: LONG_TITLE, sizePx: 40 });
		expect(nodeDimensionsPx(node).height).toBe(40);
	});
});
