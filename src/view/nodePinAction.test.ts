import { describe, expect, it } from "vitest";
import { planNodePinAction } from "./nodePinAction";

describe("planNodePinAction", () => {
	it("WHEN the tier is main THEN there is no pin action", () => {
		expect(planNodePinAction("main")).toEqual({ kind: "none" });
	});

	it("WHEN the tier is regular THEN the action is a labelled pin", () => {
		expect(planNodePinAction("regular")).toEqual({ kind: "pin", title: "Pin to graph", iconId: "pin" });
	});

	it("WHEN the tier is pinned-central THEN the action is a labelled unpin", () => {
		expect(planNodePinAction("pinned-central")).toEqual({
			kind: "unpin",
			title: "Unpin from graph",
			iconId: "pin-off",
		});
	});
});
