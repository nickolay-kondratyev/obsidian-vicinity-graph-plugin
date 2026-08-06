import type { NodeChange } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { NODE_OVERRIDE_HARD_MAX_PX, NODE_OVERRIDE_HARD_MIN_PX } from "../engine";
import {
	isResizeGestureChange,
	NODE_RESIZE_BOUNDS,
	planResetSizeAction,
	resizeEndToOverride,
	startedOnResizeGrip,
} from "./nodeResize";

describe("NODE_RESIZE_BOUNDS", () => {
	it("WHEN the resize handles clamp a drag THEN they clamp to the engine's hard sanity bounds", () => {
		// One rule: what the handle allows during the drag IS what the store keeps
		// (`clampNodeSizeOverridePx` uses the same constants).
		expect(NODE_RESIZE_BOUNDS).toEqual({
			minWidth: NODE_OVERRIDE_HARD_MIN_PX,
			minHeight: NODE_OVERRIDE_HARD_MIN_PX,
			maxWidth: NODE_OVERRIDE_HARD_MAX_PX,
			maxHeight: NODE_OVERRIDE_HARD_MAX_PX,
		});
	});
});

describe("resizeEndToOverride", () => {
	it("WHEN a drag releases on fractional CSS pixels THEN the committed override is whole pixels", () => {
		expect(resizeEndToOverride(321.6328125, 86.5)).toEqual({ widthPx: 322, heightPx: 87 });
	});

	it("WHEN a drag releases on whole pixels THEN they commit verbatim", () => {
		expect(resizeEndToOverride(300, 120)).toEqual({ widthPx: 300, heightPx: 120 });
	});
});

describe("planResetSizeAction", () => {
	it("WHEN the node has a size override THEN the reset entry is offered", () => {
		expect(planResetSizeAction(true)).toEqual({
			title: "Reset size",
			iconId: "undo-2",
			description: "Clears the custom size you set by dragging; the note returns to its computed size.",
		});
	});

	it("WHEN the reset entry is offered THEN it carries an educational sub-line ('custom size' is named nowhere else)", () => {
		expect(planResetSizeAction(true)?.description).not.toBe("");
	});

	it("WHEN the node has no size override THEN no reset entry is offered (a no-op menu item violates POLS)", () => {
		expect(planResetSizeAction(false)).toBeNull();
	});
});

describe("startedOnResizeGrip", () => {
	/** Stands in for an event target that can answer `closest` — the only DOM call the rule makes. */
	const targetInside = (matched: boolean) => ({ closest: (): unknown => (matched ? {} : null) });

	it("WHEN the click started on a resize grip THEN it is not the node's own click", () => {
		expect(startedOnResizeGrip({ target: targetInside(true) as unknown as EventTarget })).toBe(true);
	});

	it("WHEN the click started on the node body THEN it is the node's own click", () => {
		expect(startedOnResizeGrip({ target: targetInside(false) as unknown as EventTarget })).toBe(false);
	});

	it("WHEN the event carries no target THEN it is the node's own click (nothing says otherwise)", () => {
		expect(startedOnResizeGrip({ target: null })).toBe(false);
	});
});

describe("isResizeGestureChange", () => {
	// The distinguishing FACTS of each React Flow `dimensions` change source; the
	// gesture ones carry `resizing`, the ResizeObserver re-measurement does not.
	const midDragResize: NodeChange = {
		id: "n1",
		type: "dimensions",
		resizing: true,
		dimensions: { width: 160, height: 40 },
	};
	const releasedResize: NodeChange = {
		id: "n1",
		type: "dimensions",
		resizing: false,
		dimensions: { width: 160, height: 40 },
	};
	const reMeasurement: NodeChange = {
		id: "n1",
		type: "dimensions",
		dimensions: { width: 40, height: 40 },
	};

	it("WHEN a change is a resize drag in progress THEN it is applied to controller-owned state", () => {
		expect(isResizeGestureChange(midDragResize)).toBe(true);
	});

	it("WHEN a change is a released resize drag THEN it is applied to controller-owned state", () => {
		expect(isResizeGestureChange(releasedResize)).toBe(true);
	});

	it("WHEN a change is React Flow re-measuring a node it already rendered THEN it is NOT applied (it would clobber a fresh publish)", () => {
		expect(isResizeGestureChange(reMeasurement)).toBe(false);
	});

	it("WHEN a change is a plain node selection THEN it is not applied", () => {
		expect(isResizeGestureChange({ id: "n1", type: "select", selected: true })).toBe(false);
	});
});
