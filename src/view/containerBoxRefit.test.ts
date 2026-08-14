import { describe, expect, it } from "vitest";
import type { ElkNode } from "elkjs";
import { GROUP_BOX_PADDING_PX } from "./constants";
import { refitContainerBox } from "./containerBoxRefit";

/**
 * The pure geometry of the container box refit: after a d3 interior refinement
 * moves a container's children (recentring them around the origin, possibly
 * into negative coordinates), the stored elk box no longer wraps them. The
 * refit must translate the children back into padding-origin coordinates and
 * recompute the box, restoring the invariant the rest of the pipeline assumes:
 * children lie inside the box, inset by exactly the group padding at the
 * bounding-box extremes.
 */
describe("refitContainerBox", () => {
	it("WHEN refinement moved children into arbitrary coordinates THEN the box re-wraps them with the group padding at the extremes", () => {
		const pad = GROUP_BOX_PADDING_PX;
		const container: ElkNode = {
			id: "group:alpha",
			width: 300, // stale elk box: refinement moved the children out of it
			height: 200,
			children: [
				{ id: "a.md", x: -70, y: -10, width: 40, height: 30 },
				{ id: "b.md", x: 25, y: 55, width: 60, height: 45 },
			],
		};
		expect(refitContainerBox(container)).toEqual({
			id: "group:alpha",
			// children bbox: x -70..85 (width 155), y -10..100 (height 110)
			width: 155 + pad.left + pad.right,
			height: 110 + pad.top + pad.bottom,
			children: [
				{ id: "a.md", x: pad.left, y: pad.top, width: 40, height: 30 },
				{ id: "b.md", x: pad.left + 95, y: pad.top + 65, width: 60, height: 45 },
			],
		});
	});

	it("WHEN a child is itself a container THEN its full width/height participates in the wrap (nested boxes never poke out)", () => {
		const pad = GROUP_BOX_PADDING_PX;
		const nested: ElkNode = {
			id: "group:sql",
			width: 10,
			height: 10,
			children: [{ id: "group:sql/joins", x: 100, y: 100, width: 220, height: 180, children: [] }],
		};
		expect(refitContainerBox(nested)).toEqual({
			id: "group:sql",
			width: 220 + pad.left + pad.right,
			height: 180 + pad.top + pad.bottom,
			children: [{ id: "group:sql/joins", x: pad.left, y: pad.top, width: 220, height: 180, children: [] }],
		});
	});

	it("WHEN the container has no children THEN it is returned unchanged", () => {
		const leaf: ElkNode = { id: "group:empty", width: 50, height: 40 };
		expect(refitContainerBox(leaf)).toBe(leaf);
	});
});
