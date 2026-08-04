import { describe, expect, it } from "vitest";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { FakeVaultSpec } from "./FakeLinkProvider";
import { GraphTruncator } from "./GraphTruncator";
import { VicinityTraversal } from "./VicinityTraversal";
import type { TraversalRoot } from "./VicinityTraversal";
import { build, visible } from "./testFixtures/truncationHarness";
import { asVaultPath } from "./types";

// GIVEN MAIN m.md linking five equal-priority neighbors in two folders
const fanOutSpec: FakeVaultSpec = {
	files: [
		{ path: "m.md" },
		{ path: "alpha/a1.md" },
		{ path: "alpha/a2.md" },
		{ path: "alpha/a3.md" },
		{ path: "beta/b1.md" },
		{ path: "beta/b2.md" },
	],
	links: { "m.md": ["alpha/a1.md", "alpha/a2.md", "alpha/a3.md", "beta/b1.md", "beta/b2.md"] },
};

describe("GraphTruncator cap enforcement", () => {
	it("WHEN the cap is smaller than the neighbor count THEN only cap non-centrals survive", () => {
		const result = build(fanOutSpec, ["m.md"], 2);
		// Same depth/distance → deterministic path fallback keeps the first two alphabetically.
		expect(visible(result)).toEqual(["alpha/a1.md", "alpha/a2.md", "m.md"]);
	});

	it("WHEN the cap is zero THEN only centrals remain", () => {
		expect(visible(build(fanOutSpec, ["m.md"], 0))).toEqual(["m.md"]);
	});

	it("WHEN the neighbor count is within the cap THEN nothing is hidden", () => {
		expect(build(fanOutSpec, ["m.md"], 100).hiddenNodeCountsByFolder.size).toBe(0);
	});

	it("WHEN centrals exceed the cap THEN they are all kept anyway (centrals exempt)", () => {
		const result = build(fanOutSpec, ["m.md", "alpha/a1.md", "beta/b1.md"], 0);
		expect(visible(result)).toEqual(["alpha/a1.md", "beta/b1.md", "m.md"]);
	});
});

describe("GraphTruncator hidden counts per folder", () => {
	it("WHEN three nodes are hidden across two folders THEN counts are grouped by folder", () => {
		const result = build(fanOutSpec, ["m.md"], 2);
		expect([...result.hiddenNodeCountsByFolder.entries()].sort()).toEqual([
			["alpha", 1],
			["beta", 2],
		]);
	});
});

describe("GraphTruncator edge filtering", () => {
	it("WHEN a node is hidden THEN its edges are dropped from the visible edge set", () => {
		const result = build(fanOutSpec, ["m.md"], 2);
		expect(result.visibleEdges.map((e) => `${e.source}->${e.target}`).sort()).toEqual([
			"m.md->alpha/a1.md",
			"m.md->alpha/a2.md",
		]);
	});
});

describe("GraphTruncator priority ordering", () => {
	// EXPLICIT ALIGNMENT (nid_cx5zoz7ptucg9nxalibv0mbjb_e): the "higher size
	// score survives" test is REMOVED — truncation no longer consumes sizes
	// (content-fit sizing has no score); distance-to-MAIN is the depth tiebreak.

	it("WHEN nodes tie on depth THEN the node graph-closer to MAIN survives", () => {
		// near.md/hop.md: distance 1 from MAIN. far.md: minDepth 1 via pinned p.md,
		// but distance 2 from MAIN (via hop.md) — same minDepth.
		const spec: FakeVaultSpec = {
			files: [
				{ path: "m.md" },
				{ path: "near.md" },
				{ path: "hop.md" },
				{ path: "far.md" },
				{ path: "p.md" },
			],
			links: { "m.md": ["near.md", "hop.md"], "hop.md": ["far.md"], "p.md": ["far.md"] },
		};
		const provider = new FakeLinkProvider(spec);
		const roots: TraversalRoot[] = [
			{ descriptor: { path: asVaultPath("m.md") }, depths: { linkDepthOut: 2, embedDepthOut: 2, linkDepthIn: 0 } },
			{ descriptor: { path: asVaultPath("p.md") }, depths: { linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 0 } },
		];
		const traversal = new VicinityTraversal(provider).traverse(roots);
		const result = GraphTruncator.truncate({
			nodes: traversal.nodes,
			edges: traversal.edges,
			mainPath: asVaultPath("m.md"),
			nodeCap: 2,
		});
		// hop and near (distance 1) beat far (distance 2).
		expect(visible(result)).toEqual(["hop.md", "m.md", "near.md", "p.md"]);
	});

	it("WHEN a node is disconnected from MAIN THEN a connected node of equal depth survives instead", () => {
		// island.md hangs off pinned p.md with no route to MAIN.
		const spec: FakeVaultSpec = {
			files: [{ path: "m.md" }, { path: "near.md" }, { path: "p.md" }, { path: "island.md" }],
			links: { "m.md": ["near.md"], "p.md": ["island.md"] },
		};
		const result = build(spec, ["m.md", "p.md"], 1, { linkDepthOut: 1, linkDepthIn: 0 });
		expect(visible(result)).toEqual(["m.md", "near.md", "p.md"]);
	});
});

describe("GraphTruncator determinism", () => {
	it("WHEN the same input is truncated twice THEN the outputs are identical", () => {
		const first = build(fanOutSpec, ["m.md"], 2);
		const second = build(fanOutSpec, ["m.md"], 2);
		expect({ visible: visible(first), hidden: [...first.hiddenNodeCountsByFolder] }).toEqual({
			visible: visible(second),
			hidden: [...second.hiddenNodeCountsByFolder],
		});
	});
});
