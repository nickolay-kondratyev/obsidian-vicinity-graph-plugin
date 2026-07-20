import { describe, expect, it } from "vitest";
import { EngineDefaults } from "./constants";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { GraphBuildRequest } from "./NeighborhoodEngine";
import { NeighborhoodEngine } from "./NeighborhoodEngine";
import type { NeighborhoodGraph, PinnedNodeDescriptor } from "./types";
import { asDocId, asVaultPath } from "./types";

/**
 * GIVEN a small "vault": MAIN hub.md with two neighbors (one attachment-heavy),
 * a second-hop note, and a pinned island disconnected from MAIN.
 */
function fixtureProvider(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [
			{ path: "hub.md", sizeBytes: 500 },
			{ path: "notes/alpha.md", sizeBytes: 2000 },
			{ path: "notes/beta.md", sizeBytes: 100 },
			{ path: "notes/gamma.md", sizeBytes: 50 },
			{ path: "island/pin.md", sizeBytes: 10 },
			{ path: "island/neighbor.md", sizeBytes: 10 },
			{ path: "img/cover.png" },
		],
		links: {
			"hub.md": ["notes/alpha.md", "notes/beta.md"],
			"notes/alpha.md": ["notes/gamma.md", "img/cover.png"],
			"island/pin.md": ["island/neighbor.md"],
		},
	});
}

const PIN: PinnedNodeDescriptor = {
	path: asVaultPath("island/pin.md"),
	docid: asDocId("docid_pin_e"),
	pinTimestamp: 1000,
};

function buildRequest(overrides: Partial<GraphBuildRequest> = {}): GraphBuildRequest {
	return {
		main: { path: asVaultPath("hub.md"), docid: asDocId("docid_hub_e") },
		pinned: [PIN],
		globalDepths: { outgoingDepth: 2, incomingDepth: 1 },
		globalView: EngineDefaults.viewSettings(),
		...overrides,
	};
}

function build(overrides: Partial<GraphBuildRequest> = {}): NeighborhoodGraph {
	return new NeighborhoodEngine(fixtureProvider()).build(buildRequest(overrides));
}

function node(graph: NeighborhoodGraph, path: string) {
	return graph.nodes.find((candidate) => candidate.path === path);
}

describe("NeighborhoodEngine end-to-end build", () => {
	it("WHEN building THEN the union covers MAIN's neighborhood and the disconnected pinned island", () => {
		expect(build().nodes.map((n) => n.path).sort()).toEqual([
			"hub.md",
			"island/neighbor.md",
			"island/pin.md",
			"notes/alpha.md",
			"notes/beta.md",
			"notes/gamma.md",
		]);
	});

	it("WHEN building THEN attachments never appear as nodes", () => {
		expect(node(build(), "img/cover.png")).toBeUndefined();
	});

	it("WHEN building THEN the attachment-heavy note carries its first image", () => {
		expect(node(build(), "notes/alpha.md")?.firstImagePath).toBe("img/cover.png");
	});

	it("WHEN building THEN MAIN's docid is echoed and it is flagged isMain", () => {
		const main = node(build(), "hub.md");
		expect(`${main?.docid}|${main?.isMain}`).toBe("docid_hub_e|true");
	});

	it("WHEN building THEN the pinned root's docid is echoed and it is central but not MAIN", () => {
		const pin = node(build(), "island/pin.md");
		expect(`${pin?.docid}|${pin?.isCentral}|${pin?.isMain}`).toBe("docid_pin_e|true|false");
	});

	it("WHEN building THEN the disconnected pinned root still gets central (max) sizing", () => {
		const graph = build();
		expect(node(graph, "island/pin.md")?.sizePx).toBe(graph.viewSettings.sizing.maxPx);
	});

	it("WHEN building THEN depth tags record the second hop from MAIN", () => {
		expect(node(build(), "notes/gamma.md")?.depthTags).toEqual([
			{ rootPath: "hub.md", direction: "outgoing", depth: 2 },
		]);
	});

	it("WHEN building THEN edges are directed linker -> linked and complete", () => {
		expect(build().edges.map((e) => `${e.source}->${e.target}`).sort()).toEqual([
			"hub.md->notes/alpha.md",
			"hub.md->notes/beta.md",
			"island/pin.md->island/neighbor.md",
			"notes/alpha.md->notes/gamma.md",
		]);
	});
});

describe("NeighborhoodEngine settings integration", () => {
	it("WHEN a per-root depth override shrinks MAIN's outgoing depth THEN the second hop disappears", () => {
		const graph = build({
			depthOverridesByRoot: new Map([[asVaultPath("hub.md"), { outgoingDepth: 1 }]]),
		});
		expect(node(graph, "notes/gamma.md")).toBeUndefined();
	});

	it("WHEN MAIN's view override caps the graph THEN non-centrals are truncated to the cap", () => {
		const graph = build({ mainViewOverride: { nodeCap: 1 } });
		expect(graph.nodes.filter((n) => !n.isCentral)).toHaveLength(1);
	});

	it("WHEN truncation hides nodes THEN hidden counts are reported per folder", () => {
		const graph = build({ mainViewOverride: { nodeCap: 1 } });
		// Kept non-central: notes/alpha.md (biggest). Hidden: beta+gamma (notes), island/neighbor.md.
		expect([...graph.hiddenNodeCountsByFolder.entries()].sort()).toEqual([
			["island", 1],
			["notes", 2],
		]);
	});

	it("WHEN a pinned doc pins a view field MAIN leaves unset THEN the build uses the pinned value", () => {
		const graph = build({
			pinnedViewOverrides: [{ descriptor: PIN, override: { groupByFolder: false } }],
		});
		expect(graph.viewSettings.groupByFolder).toBe(false);
	});

	it("WHEN the same request is built twice THEN outputs are identical (determinism)", () => {
		expect(build({ mainViewOverride: { nodeCap: 2 } })).toEqual(build({ mainViewOverride: { nodeCap: 2 } }));
	});
});

describe("NeighborhoodEngine edge visibility (CLARIFICATION Q5)", () => {
	/** GIVEN MAIN hub.md whose two depth-1 siblings link each other. */
	function siblingBuild(overrides: Partial<GraphBuildRequest> = {}): NeighborhoodGraph {
		const provider = new FakeLinkProvider({
			files: [{ path: "hub.md" }, { path: "a.md" }, { path: "b.md" }],
			links: {
				"hub.md": ["a.md", "b.md"],
				"a.md": ["b.md"],
			},
		});
		return new NeighborhoodEngine(provider).build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { outgoingDepth: 1, incomingDepth: 0 },
			globalView: EngineDefaults.viewSettings(),
			...overrides,
		});
	}

	function edgeStrings(graph: NeighborhoodGraph): string[] {
		return graph.edges.map((e) => `${e.source}->${e.target}`).sort();
	}

	it("WHEN building with defaults THEN the sibling link is hidden (default mode is walked-from-center)", () => {
		expect(edgeStrings(siblingBuild())).toEqual(["hub.md->a.md", "hub.md->b.md"]);
	});

	it("WHEN the global view asks for all-edges THEN the sibling link renders (induced subgraph)", () => {
		const graph = siblingBuild({
			globalView: { ...EngineDefaults.viewSettings(), edgeVisibility: "all-edges" },
		});
		expect(edgeStrings(graph)).toEqual(["a.md->b.md", "hub.md->a.md", "hub.md->b.md"]);
	});

	it("WHEN MAIN's override pins all-edges THEN it beats the walked-from-center global (cascade)", () => {
		const graph = siblingBuild({ mainViewOverride: { edgeVisibility: "all-edges" } });
		expect(edgeStrings(graph)).toEqual(["a.md->b.md", "hub.md->a.md", "hub.md->b.md"]);
	});
});

describe("NeighborhoodEngine edge link counts (step-05, CLARIFICATION Q1)", () => {
	// GIVEN hub.md links twin.md twice and solo.md once.
	function duplicateLinkEngine(): NeighborhoodEngine {
		return new NeighborhoodEngine(
			new FakeLinkProvider({
				files: [{ path: "hub.md" }, { path: "twin.md" }, { path: "solo.md" }],
				links: { "hub.md": ["twin.md", "solo.md", "twin.md"] },
			}),
		);
	}

	function edgeCounts(edgeVisibility: "walked-from-center" | "all-edges"): Record<string, number> {
		const graph = duplicateLinkEngine().build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { outgoingDepth: 1, incomingDepth: 1 },
			globalView: { ...EngineDefaults.viewSettings(), edgeVisibility },
		});
		return Object.fromEntries(graph.edges.map((edge) => [`${edge.source}->${edge.target}`, edge.count]));
	}

	it("WHEN walked-from-center builds over a double link THEN that edge carries count 2", () => {
		expect(edgeCounts("walked-from-center")).toEqual({ "hub.md->twin.md": 2, "hub.md->solo.md": 1 });
	});

	it("WHEN all-edges builds over a double link THEN that edge carries count 2", () => {
		expect(edgeCounts("all-edges")).toEqual({ "hub.md->twin.md": 2, "hub.md->solo.md": 1 });
	});
});

/**
 * Scenario §11.5(b): a pinned central X whose outgoing depth is adjusted while
 * MAIN is Y must re-explore its chain to that depth END-TO-END (proves the BFS
 * actually re-walks X, not just that the resolver returns a number). X's chain
 * X → x1 → x2 → x3 has neighbors at hops 1/2/3; X's OWN depth is 1.
 */
describe("NeighborhoodEngine pinned-central depth re-exploration", () => {
	function chainProvider(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [
				{ path: "y.md" },
				{ path: "z.md" },
				{ path: "x.md" },
				{ path: "x1.md" },
				{ path: "x2.md" },
				{ path: "x3.md" },
			],
			links: { "x.md": ["x1.md"], "x1.md": ["x2.md"], "x2.md": ["x3.md"] },
		});
	}

	const X_PIN: PinnedNodeDescriptor = {
		path: asVaultPath("x.md"),
		docid: asDocId("docid_x_e"),
		pinTimestamp: 1,
	};

	/** Build with MAIN=`mainPath` and X's outgoing depth pinned to `xOutgoing`. */
	function build(mainPath: string, xOutgoing: number): NeighborhoodGraph {
		return new NeighborhoodEngine(chainProvider()).build({
			main: { path: asVaultPath(mainPath) },
			pinned: [X_PIN],
			globalDepths: { outgoingDepth: 1, incomingDepth: 0 },
			globalView: { ...EngineDefaults.viewSettings(), nodeCap: 100 },
			depthOverridesByRoot: new Map([[asVaultPath("x.md"), { outgoingDepth: xOutgoing }]]),
		});
	}

	it("WHEN MAIN is Y and X's depth is adjusted to 3 THEN X reaches x3 at depth 3", () => {
		expect(node(build("y.md", 3), "x3.md")?.depthTags).toEqual([
			{ rootPath: "x.md", direction: "outgoing", depth: 3 },
		]);
	});

	it("WHEN MAIN is Z and X uses its OWN depth 1 THEN x2 and x3 are out of reach", () => {
		const graph = build("z.md", 1);
		expect({ x1: node(graph, "x1.md") !== undefined, x2: node(graph, "x2.md"), x3: node(graph, "x3.md") }).toEqual({
			x1: true,
			x2: undefined,
			x3: undefined,
		});
	});

	it("WHEN MAIN returns to Y with X adjusted to 3 THEN X reaches x3 at depth 3 again", () => {
		expect(node(build("y.md", 3), "x3.md")?.depthTags).toEqual([
			{ rootPath: "x.md", direction: "outgoing", depth: 3 },
		]);
	});
});
