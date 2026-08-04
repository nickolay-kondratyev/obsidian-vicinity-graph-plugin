import { describe, expect, it } from "vitest";
import { NODE_OVERRIDE_HARD_MAX_PX, NODE_OVERRIDE_HARD_MIN_PX } from "../engine";
import { NODE_RESIZE_BOUNDS, planResetSizeAction, resizeEndToOverride } from "./nodeResize";

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
		expect(planResetSizeAction(true)).toEqual({ title: "Reset size", iconId: "undo-2" });
	});

	it("WHEN the node has no size override THEN no reset entry is offered (a no-op menu item violates POLS)", () => {
		expect(planResetSizeAction(false)).toBeNull();
	});
});
