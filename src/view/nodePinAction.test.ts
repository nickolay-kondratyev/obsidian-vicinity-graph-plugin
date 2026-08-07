import { describe, expect, it } from "vitest";
import { planNodeLocalPinAction, planNodePinAction } from "./nodePinAction";

describe("planNodePinAction", () => {
	it("WHEN the doc is not pinned THEN the action is a labelled pin (applies to regular nodes AND MAIN)", () => {
		expect(planNodePinAction(false)).toEqual({ kind: "pin", title: "Pin to graph", iconId: "pin" });
	});

	it("WHEN the doc is pinned THEN the action is a labelled unpin (pinned central OR pinned MAIN)", () => {
		expect(planNodePinAction(true)).toEqual({
			kind: "unpin",
			title: "Unpin from graph",
			iconId: "pin-off",
		});
	});
});

describe("planNodeLocalPinAction", () => {
	it("WHEN the doc is NOT locally pinned THEN the action is a labelled local pin with a distinct icon", () => {
		expect(planNodeLocalPinAction(false)).toEqual({
			kind: "local-pin",
			title: "Pin for this note",
			iconId: "map-pin",
		});
	});

	it("WHEN the doc is locally pinned THEN the action is a labelled local unpin", () => {
		expect(planNodeLocalPinAction(true)).toEqual({
			kind: "local-unpin",
			title: "Unpin for this note",
			iconId: "map-pin-off",
		});
	});

	it("WHEN a doc is both globally and locally pinned THEN the two toggles carry DISTINCT icons (both indicators)", () => {
		expect(planNodePinAction(true).iconId).not.toBe(planNodeLocalPinAction(true).iconId);
	});
});
