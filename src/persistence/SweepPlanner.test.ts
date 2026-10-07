import { describe, expect, it } from "vitest";
import type { SweepInputs } from "./SweepPlanner";
import { SweepPlanner } from "./SweepPlanner";

const LIVE: SweepInputs = {
	liveDocids: new Set(["docid_a_e", "docid_b_e"]),
	pinnedDocids: ["docid_b_e", "docid_stale_e"],
	overrideDocids: ["docid_a_e", "docid_gone_e"],
	localPinDocids: ["docid_b_e", "docid_localgone_e"],
};

describe("SweepPlanner.plan", () => {
	it("WHEN a pinned docid no longer resolves THEN exactly that pin is planned for removal", () => {
		expect(SweepPlanner.plan(LIVE).pinsToRemove).toEqual(["docid_stale_e"]);
	});

	it("WHEN an override docid no longer resolves THEN exactly that override is planned for removal", () => {
		expect(SweepPlanner.plan(LIVE).overridesToRemove).toEqual(["docid_gone_e"]);
	});

	it("WHEN a local-pin docid no longer resolves THEN exactly that one is planned for removal", () => {
		expect(SweepPlanner.plan(LIVE).localPinsToRemove).toEqual(["docid_localgone_e"]);
	});

	it("WHEN every docid resolves THEN the plan is empty (sweep is a no-op)", () => {
		const inputs: SweepInputs = {
			liveDocids: new Set(["docid_a_e"]),
			pinnedDocids: ["docid_a_e"],
			overrideDocids: ["docid_a_e"],
			localPinDocids: ["docid_a_e"],
		};
		expect(SweepPlanner.plan(inputs)).toEqual({
			pinsToRemove: [],
			overridesToRemove: [],
			localPinsToRemove: [],
		});
	});
});
