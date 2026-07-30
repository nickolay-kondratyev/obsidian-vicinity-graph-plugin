import { describe, expect, it } from "vitest";
import type { FakeVaultSpec } from "./FakeLinkProvider";
import {
	bidirectionalClusters,
	hubFanOut,
	largeMixedVault,
	pinnedDisconnectedVault,
} from "./testFixtures/denseVaultFixtures";
import type { TruncationResult } from "./GraphTruncator";
import type { TruncationStages } from "./testFixtures/truncationHarness";
import { build, traverseAndSize, truncateAt, visible } from "./testFixtures/truncationHarness";
import { asVaultPath } from "./types";

/**
 * Step-07 dense-fixture + cap edge-case suite for {@link GraphTruncator}. Runs the
 * real traverse→size→truncate pipeline (via the shared harness) over the committed
 * dense fixtures and over small hand-built shapes that force each cap edge and each
 * truncator-reachable tiebreaker level to be the deciding comparator.
 *
 * TIEBREAKER REACHABILITY (truthful finding): {@link GraphTruncator} ranks only its
 * NON-central candidate pool, and it hardcodes `pinTimestamp: undefined` in
 * `toRankable`. Non-central `TraversedNode`s also never carry a `docid` (docid is
 * assigned only to roots, and roots are centrals, which are cap-exempt and excluded
 * from the pool). So the pin-recency AND docid chain levels are STRUCTURALLY
 * unreachable here — they are exercised at `NodePriorityChain.test.ts` (levels 4/5).
 * The reachable deciding levels are minDepth, sizeScore, distanceToMain (numeric and
 * present-vs-absent) and the path fallback — each isolated below.
 */

function centralPaths(stages: TruncationStages) {
	return [...stages.traversal.nodes.values()].filter((node) => node.isCentral).map((node) => node.path).sort();
}

function candidateCount(stages: TruncationStages): number {
	return [...stages.traversal.nodes.values()].filter((node) => !node.isCentral).length;
}

function visibleNonCentral(stages: TruncationStages, result: TruncationResult): string[] {
	return [...result.visiblePaths].filter((path) => !stages.traversal.nodes.get(path)?.isCentral).sort();
}

function everyCentralVisible(stages: TruncationStages, result: TruncationResult): boolean {
	return centralPaths(stages).every((path) => result.visiblePaths.has(path));
}

function totalHidden(result: TruncationResult): number {
	let sum = 0;
	for (const count of result.hiddenNodeCountsByFolder.values()) {
		sum += count;
	}
	return sum;
}

describe("GraphTruncator dense fixtures respect the cap", () => {
	it("WHEN a 220-spoke hub is capped at 50 THEN exactly 50 non-centrals survive and the hub stays", () => {
		const stages = traverseAndSize(hubFanOut(220).spec, ["hub.md"], { linkDepthOut: 1, linkDepthIn: 0 });
		const result = truncateAt(stages, 50);
		expect(visibleNonCentral(stages, result)).toHaveLength(50);
		expect(result.visiblePaths.has(asVaultPath("hub.md"))).toBe(true);
	});

	it("WHEN the ~500-node vault is capped at 100 THEN exactly 100 non-centrals survive", () => {
		const stages = traverseAndSize(largeMixedVault().spec, ["hub.md"], { linkDepthOut: 2, linkDepthIn: 0 });
		expect(visibleNonCentral(stages, truncateAt(stages, 100))).toHaveLength(100);
	});

	it("WHEN a dense bidirectional-cluster vault is capped below its pool THEN the hidden tally accounts for the remainder", () => {
		const stages = traverseAndSize(bidirectionalClusters().spec, ["hub.md"], { linkDepthOut: 2, linkDepthIn: 0 });
		const cap = 10;
		const result = truncateAt(stages, cap);
		expect(totalHidden(result)).toBe(candidateCount(stages) - cap);
	});
});

describe("GraphTruncator determinism over dense fixtures", () => {
	it("WHEN the ~500-node vault is truncated twice THEN visible paths, edges and hidden counts are identical", () => {
		const spec = largeMixedVault().spec;
		const first = build(spec, ["hub.md"], 100, { linkDepthOut: 2, linkDepthIn: 0 });
		const second = build(spec, ["hub.md"], 100, { linkDepthOut: 2, linkDepthIn: 0 });
		expect({
			visible: visible(first),
			edges: first.visibleEdges.map((edge) => `${edge.source}->${edge.target}`).sort(),
			hidden: [...first.hiddenNodeCountsByFolder.entries()].sort(),
		}).toEqual({
			visible: visible(second),
			edges: second.visibleEdges.map((edge) => `${edge.source}->${edge.target}`).sort(),
			hidden: [...second.hiddenNodeCountsByFolder.entries()].sort(),
		});
	});
});

describe("GraphTruncator cap edge case: centrals alone exceed the cap", () => {
	// GIVEN MAIN + three pinned centrals and two non-central neighbors, capped at 0.
	const spec: FakeVaultSpec = {
		files: [
			{ path: "m.md" },
			{ path: "c/c0.md" },
			{ path: "c/c1.md" },
			{ path: "c/c2.md" },
			{ path: "nc/n0.md" },
			{ path: "nc/n1.md" },
		],
		links: { "m.md": ["nc/n0.md", "nc/n1.md"] },
	};
	const roots = ["m.md", "c/c0.md", "c/c1.md", "c/c2.md"];

	it("WHEN centrals already exceed the cap THEN every central still renders", () => {
		const stages = traverseAndSize(spec, roots, { linkDepthOut: 1, linkDepthIn: 0 });
		expect(everyCentralVisible(stages, truncateAt(stages, 0))).toBe(true);
	});

	it("WHEN centrals exhaust the render budget THEN nothing non-central renders", () => {
		const stages = traverseAndSize(spec, roots, { linkDepthOut: 1, linkDepthIn: 0 });
		expect(visibleNonCentral(stages, truncateAt(stages, 0))).toEqual([]);
	});

	it("WHEN non-centrals are all hidden THEN hiddenNodeCountsByFolder communicates them to the UI", () => {
		const stages = traverseAndSize(spec, roots, { linkDepthOut: 1, linkDepthIn: 0 });
		expect([...truncateAt(stages, 0).hiddenNodeCountsByFolder.entries()].sort()).toEqual([["nc", 2]]);
	});
});

describe("GraphTruncator cap boundary ±1", () => {
	// GIVEN a hub with exactly 5 same-folder non-central spokes.
	const POOL = 5;
	const spec = hubFanOut(POOL).spec;

	function keptAndHidden(cap: number): { kept: number; hidden: number } {
		const stages = traverseAndSize(spec, ["hub.md"], { linkDepthOut: 1, linkDepthIn: 0 });
		const result = truncateAt(stages, cap);
		return { kept: visibleNonCentral(stages, result).length, hidden: totalHidden(result) };
	}

	it("WHEN the cap is one below the pool THEN one node is hidden", () => {
		expect(keptAndHidden(POOL - 1)).toEqual({ kept: POOL - 1, hidden: 1 });
	});

	it("WHEN the cap exactly equals the pool THEN nothing is hidden", () => {
		expect(keptAndHidden(POOL)).toEqual({ kept: POOL, hidden: 0 });
	});

	it("WHEN the cap is one above the pool THEN the whole pool renders and nothing is hidden", () => {
		expect(keptAndHidden(POOL + 1)).toEqual({ kept: POOL, hidden: 0 });
	});
});

describe("GraphTruncator tiebreaker: minDepth decides", () => {
	// a.md (depth 1) vs b.md (depth 2), equal size — minDepth is the first differing level.
	const spec: FakeVaultSpec = {
		files: [
			{ path: "m.md" },
			{ path: "a.md", sizeBytes: 500 },
			{ path: "b.md", sizeBytes: 500 },
		],
		links: { "m.md": ["a.md"], "a.md": ["b.md"] },
	};

	it("WHEN two candidates differ only from minDepth up THEN the shallower one is kept", () => {
		const stages = traverseAndSize(spec, ["m.md"], { linkDepthOut: 2, linkDepthIn: 0 });
		expect(visibleNonCentral(stages, truncateAt(stages, 1))).toEqual(["a.md"]);
	});
});

describe("GraphTruncator tiebreaker: sizeScore decides", () => {
	// Same minDepth, same distance; only size differs.
	const spec: FakeVaultSpec = {
		files: [
			{ path: "m.md" },
			{ path: "big.md", sizeBytes: 100_000 },
			{ path: "small.md", sizeBytes: 1 },
		],
		links: { "m.md": ["big.md", "small.md"] },
	};

	it("WHEN minDepth ties THEN the larger size score is kept", () => {
		const stages = traverseAndSize(spec, ["m.md"], { linkDepthOut: 1, linkDepthIn: 0 });
		expect(visibleNonCentral(stages, truncateAt(stages, 1))).toEqual(["big.md"]);
	});
});

describe("GraphTruncator tiebreaker: distanceToMain (numeric) decides", () => {
	// near/hop are distance 1; far is distance 2 (reached via hop) but minDepth 1 (via pin p).
	const spec: FakeVaultSpec = {
		files: [
			{ path: "m.md" },
			{ path: "p.md" },
			{ path: "near.md", sizeBytes: 500 },
			{ path: "hop.md", sizeBytes: 500 },
			{ path: "far.md", sizeBytes: 500 },
		],
		links: { "m.md": ["near.md", "hop.md"], "hop.md": ["far.md"], "p.md": ["far.md"] },
	};

	it("WHEN minDepth and size tie THEN the two distance-1 nodes beat the distance-2 node", () => {
		const stages = traverseAndSize(spec, ["m.md", "p.md"], { linkDepthOut: 2, linkDepthIn: 0 });
		// cap 2 keeps both distance-1 nodes (hop, near) and hides far (distance 2).
		expect(visibleNonCentral(stages, truncateAt(stages, 2))).toEqual(["hop.md", "near.md"]);
	});
});

describe("GraphTruncator tiebreaker: distanceToMain present-vs-absent decides", () => {
	// conn is connected to MAIN; island hangs off pin p, disconnected from MAIN. Equal minDepth/size.
	const spec: FakeVaultSpec = {
		files: [
			{ path: "m.md" },
			{ path: "p.md" },
			{ path: "conn.md", sizeBytes: 500 },
			{ path: "island.md", sizeBytes: 500 },
		],
		links: { "m.md": ["conn.md"], "p.md": ["island.md"] },
	};

	it("WHEN one candidate is disconnected from MAIN THEN the connected one is kept", () => {
		const stages = traverseAndSize(spec, ["m.md", "p.md"], { linkDepthOut: 1, linkDepthIn: 0 });
		expect(visibleNonCentral(stages, truncateAt(stages, 1))).toEqual(["conn.md"]);
	});
});

describe("GraphTruncator tiebreaker: path fallback decides", () => {
	// Everything up to docid ties; the lexicographically smaller path wins the total order.
	const spec: FakeVaultSpec = {
		files: [
			{ path: "m.md" },
			{ path: "aa.md", sizeBytes: 500 },
			{ path: "ab.md", sizeBytes: 500 },
		],
		links: { "m.md": ["aa.md", "ab.md"] },
	};

	it("WHEN no earlier level discriminates THEN the smaller path is kept", () => {
		const stages = traverseAndSize(spec, ["m.md"], { linkDepthOut: 1, linkDepthIn: 0 });
		expect(visibleNonCentral(stages, truncateAt(stages, 1))).toEqual(["aa.md"]);
	});
});

describe("GraphTruncator tiebreaker: pin-recency and docid are unreachable here", () => {
	// WHY: docid/pinTimestamp only exist on centrals, which never enter the candidate
	// pool. This asserts that structural fact so the reachability claim is not silent.
	// Those two levels are covered at NodePriorityChain.test.ts (levels 4 and 5).
	it("WHEN dense candidates are ranked THEN none carry a docid (so docid can never decide)", () => {
		const stages = traverseAndSize(largeMixedVault().spec, ["hub.md"], { linkDepthOut: 2, linkDepthIn: 0 });
		const candidatesWithDocid = [...stages.traversal.nodes.values()].filter(
			(node) => !node.isCentral && node.docid !== undefined,
		);
		expect(candidatesWithDocid).toEqual([]);
	});
});

describe("GraphTruncator runtime cap change", () => {
	// Re-running truncate on ONE traversal with a growing cap = the runtime cap-change path.
	function stagesOnce(): TruncationStages {
		return traverseAndSize(largeMixedVault().spec, ["hub.md"], { linkDepthOut: 2, linkDepthIn: 0 });
	}

	it("WHEN the cap grows THEN the smaller cap's visible set is a subset of the larger cap's", () => {
		const stages = stagesOnce();
		const atTen = truncateAt(stages, 10).visiblePaths;
		const atFifty = truncateAt(stages, 50).visiblePaths;
		const atHundred = truncateAt(stages, 100).visiblePaths;
		const isSubset = (small: ReadonlySet<string>, large: ReadonlySet<string>): boolean =>
			[...small].every((path) => large.has(path));
		expect(isSubset(atTen, atFifty) && isSubset(atFifty, atHundred)).toBe(true);
	});

	it("WHEN the cap changes THEN the hidden tally is recounted to pool-minus-cap", () => {
		const stages = stagesOnce();
		const pool = candidateCount(stages);
		expect([totalHidden(truncateAt(stages, 10)), totalHidden(truncateAt(stages, 100))]).toEqual([pool - 10, pool - 100]);
	});
});

describe("GraphTruncator pinned disconnected vicinity under a tight cap", () => {
	const fixture = pinnedDisconnectedVault(3, 3);
	const roots = [fixture.mainPath, ...(fixture.pinnedPaths ?? [])];

	it("WHEN the cap is tight THEN both the MAIN and the pinned central still render (cap-exempt)", () => {
		const stages = traverseAndSize(fixture.spec, roots, { linkDepthOut: 1, linkDepthIn: 0 });
		const result = truncateAt(stages, 1);
		expect({ hub: result.visiblePaths.has(asVaultPath("hub.md")), pin: result.visiblePaths.has(asVaultPath("island/pin.md")) }).toEqual(
			{ hub: true, pin: true },
		);
	});

	it("WHEN one non-central survives THEN it is a MAIN-connected node, not a disconnected island one", () => {
		const stages = traverseAndSize(fixture.spec, roots, { linkDepthOut: 1, linkDepthIn: 0 });
		const survivors = visibleNonCentral(stages, truncateAt(stages, 1));
		expect(survivors.every((path) => path.startsWith("connected/"))).toBe(true);
	});

	it("WHEN the cap admits the connected tier exactly THEN all connected render and all island neighbors hide", () => {
		const stages = traverseAndSize(fixture.spec, roots, { linkDepthOut: 1, linkDepthIn: 0 });
		const result = truncateAt(stages, 3);
		expect(visibleNonCentral(stages, result)).toEqual(["connected/c0.md", "connected/c1.md", "connected/c2.md"]);
	});

	it("WHEN built twice under the tight cap THEN the outcome is identical (determinism)", () => {
		const build1 = build(fixture.spec, roots, 1, { linkDepthOut: 1, linkDepthIn: 0 });
		const build2 = build(fixture.spec, roots, 1, { linkDepthOut: 1, linkDepthIn: 0 });
		expect(visible(build1)).toEqual(visible(build2));
	});
});
