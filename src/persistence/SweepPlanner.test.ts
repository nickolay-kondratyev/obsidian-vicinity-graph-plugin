import { describe, expect, it } from "vitest";
import type { SweepInputs } from "./SweepPlanner";
import { SweepPlanner } from "./SweepPlanner";

const LIVE: SweepInputs = {
	liveDocids: new Set(["docid_a_e", "docid_b_e"]),
	docDataDocids: ["docid_a_e", "docid_gone_e"],
	pinnedDocids: ["docid_b_e", "docid_stale_e"],
	centralDocidsByOwner: new Map([["docid_a_e", ["docid_b_e", "docid_dangling_e"]]]),
};

describe("SweepPlanner.plan", () => {
	it("WHEN a doc-data docid no longer resolves THEN exactly that file is planned for deletion", () => {
		expect(SweepPlanner.plan(LIVE).docDataToDelete).toEqual(["docid_gone_e"]);
	});

	it("WHEN a pinned docid no longer resolves THEN exactly that pin is planned for removal", () => {
		expect(SweepPlanner.plan(LIVE).pinsToRemove).toEqual(["docid_stale_e"]);
	});

	it("WHEN a centralDepths entry dangles THEN exactly that entry is planned for stripping from its owner", () => {
		expect(SweepPlanner.plan(LIVE).staleCentralDocidsByOwner).toEqual(
			new Map([["docid_a_e", ["docid_dangling_e"]]]),
		);
	});

	it("WHEN an owner's centrals are all live THEN that owner needs no cleaning (absent from the plan)", () => {
		const inputs: SweepInputs = {
			...LIVE,
			centralDocidsByOwner: new Map([["docid_a_e", ["docid_b_e"]]]),
		};
		expect(SweepPlanner.plan(inputs).staleCentralDocidsByOwner.size).toBe(0);
	});

	it("WHEN everything resolves THEN the plan is empty (sweep is a no-op)", () => {
		const inputs: SweepInputs = {
			liveDocids: new Set(["docid_a_e"]),
			docDataDocids: ["docid_a_e"],
			pinnedDocids: ["docid_a_e"],
			centralDocidsByOwner: new Map(),
		};
		expect(SweepPlanner.plan(inputs)).toEqual({
			docDataToDelete: [],
			pinsToRemove: [],
			staleCentralDocidsByOwner: new Map(),
		});
	});
});
