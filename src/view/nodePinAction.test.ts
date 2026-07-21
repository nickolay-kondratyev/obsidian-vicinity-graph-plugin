import { describe, expect, it } from "vitest";
import { planNodePinAction } from "./nodePinAction";

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
