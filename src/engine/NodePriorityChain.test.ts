import { describe, expect, it } from "vitest";
import type { PriorityRankable } from "./NodePriorityChain";
import { NodePriorityChain } from "./NodePriorityChain";
import { asDocId, asVaultPath } from "./types";

function rankable(
	overrides: Omit<Partial<PriorityRankable>, "path"> & { readonly path: string },
): PriorityRankable {
	return {
		path: asVaultPath(overrides.path),
		minDepth: overrides.minDepth ?? 1,
		sizeScore: overrides.sizeScore ?? 0.5,
		distanceToMain: overrides.distanceToMain,
		pinTimestamp: overrides.pinTimestamp,
		docid: overrides.docid,
	};
}

function ranked(...items: PriorityRankable[]): string[] {
	return [...items].sort(NodePriorityChain.compare).map((item) => item.path);
}

// GIVEN the deterministic priority chain (shared by truncation and settings cascade)
describe("NodePriorityChain level 1: minDepth", () => {
	it("WHEN depths differ THEN the shallower node ranks first", () => {
		expect(ranked(rankable({ path: "deep.md", minDepth: 3 }), rankable({ path: "shallow.md", minDepth: 1 }))).toEqual(
			["shallow.md", "deep.md"],
		);
	});
});

describe("NodePriorityChain level 2: size score", () => {
	it("WHEN depths tie THEN the higher size score ranks first", () => {
		expect(ranked(rankable({ path: "small.md", sizeScore: 0.2 }), rankable({ path: "big.md", sizeScore: 0.9 }))).toEqual(
			["big.md", "small.md"],
		);
	});
});

describe("NodePriorityChain level 3: graph distance to MAIN", () => {
	it("WHEN depth and size tie THEN the node closer to MAIN ranks first", () => {
		expect(ranked(rankable({ path: "far.md", distanceToMain: 4 }), rankable({ path: "near.md", distanceToMain: 2 }))).toEqual(
			["near.md", "far.md"],
		);
	});

	it("WHEN one node is disconnected from MAIN THEN the connected node ranks first", () => {
		expect(ranked(rankable({ path: "island.md" }), rankable({ path: "linked.md", distanceToMain: 5 }))).toEqual(
			["linked.md", "island.md"],
		);
	});
});

describe("NodePriorityChain level 4: pin recency", () => {
	it("WHEN earlier levels tie THEN the most recently pinned ranks first", () => {
		expect(ranked(rankable({ path: "old.md", pinTimestamp: 100 }), rankable({ path: "new.md", pinTimestamp: 200 }))).toEqual(
			["new.md", "old.md"],
		);
	});

	it("WHEN only one node is pinned THEN the pinned node ranks first", () => {
		expect(ranked(rankable({ path: "unpinned.md" }), rankable({ path: "pinned.md", pinTimestamp: 100 }))).toEqual(
			["pinned.md", "unpinned.md"],
		);
	});
});

describe("NodePriorityChain level 5: docid", () => {
	it("WHEN everything else ties THEN the lexicographically smaller docid ranks first", () => {
		expect(
			ranked(
				rankable({ path: "z.md", docid: asDocId("docid_bbb_e") }),
				rankable({ path: "y.md", docid: asDocId("docid_aaa_e") }),
			),
		).toEqual(["y.md", "z.md"]);
	});
});

describe("NodePriorityChain level 6: path (determinism fallback)", () => {
	// WHY: ordinary (non-pinned) nodes carry no docid; a total order still must exist.
	it("WHEN no level up to docid discriminates THEN the lexicographically smaller path ranks first", () => {
		expect(ranked(rankable({ path: "b.md" }), rankable({ path: "a.md" }))).toEqual(["a.md", "b.md"]);
	});
});

describe("NodePriorityChain determinism", () => {
	it("WHEN the same set is sorted from different starting orders THEN the result is identical", () => {
		const a = rankable({ path: "a.md", minDepth: 2, sizeScore: 0.5 });
		const b = rankable({ path: "b.md", minDepth: 1, sizeScore: 0.1 });
		const c = rankable({ path: "c.md", minDepth: 1, sizeScore: 0.9 });
		expect(ranked(a, b, c)).toEqual(ranked(c, a, b));
	});
});
