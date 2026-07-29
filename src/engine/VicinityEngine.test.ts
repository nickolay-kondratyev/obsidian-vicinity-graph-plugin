import { describe, expect, it } from "vitest";
import { EngineDefaults } from "./constants";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { GraphBuildRequest } from "./VicinityEngine";
import { VicinityEngine } from "./VicinityEngine";
import type { NodePreviewPreference, VicinityGraph, PinnedNodeDescriptor } from "./types";
import { asDocId, asVaultPath, NODE_PREVIEW_PREFERENCES } from "./types";

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

function build(overrides: Partial<GraphBuildRequest> = {}): VicinityGraph {
	return new VicinityEngine(fixtureProvider()).build(buildRequest(overrides));
}

function node(graph: VicinityGraph, path: string) {
	return graph.nodes.find((candidate) => candidate.path === path);
}

describe("VicinityEngine global node exclusion", () => {
	it("WHEN exclusion is enabled with a matching pattern THEN the neighbor is suppressed and counted", () => {
		const graph = build({ nodeExclusion: { enabled: true, patterns: ["^notes/beta"] } });
		expect({ hasBeta: node(graph, "notes/beta.md") !== undefined, count: graph.excludedNodeCount }).toEqual({
			hasBeta: false,
			count: 1,
		});
	});

	it("WHEN exclusion is DISABLED THEN patterns are ignored (no-op, zero count)", () => {
		const graph = build({ nodeExclusion: { enabled: false, patterns: ["^notes/beta"] } });
		expect({ hasBeta: node(graph, "notes/beta.md") !== undefined, count: graph.excludedNodeCount }).toEqual({
			hasBeta: true,
			count: 0,
		});
	});

	it("WHEN no exclusion config is supplied THEN the count is zero", () => {
		expect(build().excludedNodeCount).toBe(0);
	});

	it("WHEN a pattern matches a pinned ROOT THEN the root stays (roots exempt)", () => {
		const graph = build({ nodeExclusion: { enabled: true, patterns: ["^island/pin"] } });
		expect(node(graph, "island/pin.md")?.isCentral).toBe(true);
	});
});

describe("VicinityEngine end-to-end build", () => {
	it("WHEN building THEN the union covers MAIN's vicinity and the disconnected pinned island", () => {
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

/** Settings are GLOBAL-only: one depth dial, one view object, no override layer. */
describe("VicinityEngine settings integration", () => {
	function capped(nodeCap: number): Partial<GraphBuildRequest> {
		return { globalView: { ...EngineDefaults.viewSettings(), nodeCap } };
	}

	it("WHEN the global outgoing depth allows one hop THEN the second hop disappears", () => {
		const graph = build({ globalDepths: { outgoingDepth: 1, incomingDepth: 1 } });
		expect(node(graph, "notes/gamma.md")).toBeUndefined();
	});

	it("WHEN the global view caps the graph THEN non-centrals are truncated to the cap", () => {
		expect(build(capped(1)).nodes.filter((n) => !n.isCentral)).toHaveLength(1);
	});

	it("WHEN truncation hides nodes THEN hidden counts are reported per folder", () => {
		// Kept non-central: notes/alpha.md (biggest). Hidden: beta+gamma (notes), island/neighbor.md.
		expect([...build(capped(1)).hiddenNodeCountsByFolder.entries()].sort()).toEqual([
			["island", 1],
			["notes", 2],
		]);
	});

	it("WHEN the global view sets a node preview preference THEN the build reports it verbatim", () => {
		const graph = build({
			globalView: { ...EngineDefaults.viewSettings(), nodePreviewPreference: "image" },
		});
		expect(graph.viewSettings.nodePreviewPreference).toBe("image");
	});

	it("WHEN the same request is built twice THEN outputs are identical (determinism)", () => {
		expect(build(capped(2))).toEqual(build(capped(2)));
	});
});

describe("VicinityEngine walked-edge semantics (CLARIFICATION Q5)", () => {
	/** GIVEN MAIN hub.md whose two depth-1 siblings link each other. */
	function siblingBuild(overrides: Partial<GraphBuildRequest> = {}): VicinityGraph {
		const provider = new FakeLinkProvider({
			files: [{ path: "hub.md" }, { path: "a.md" }, { path: "b.md" }],
			links: {
				"hub.md": ["a.md", "b.md"],
				"a.md": ["b.md"],
			},
		});
		return new VicinityEngine(provider).build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { outgoingDepth: 1, incomingDepth: 0 },
			globalView: EngineDefaults.viewSettings(),
			...overrides,
		});
	}

	function edgeStrings(graph: VicinityGraph): string[] {
		return graph.edges.map((e) => `${e.source}->${e.target}`).sort();
	}

	it("WHEN the walk never reaches a sibling link THEN that link is not an edge", () => {
		expect(edgeStrings(siblingBuild())).toEqual(["hub.md->a.md", "hub.md->b.md"]);
	});

	// The lever the edge-routing e2e fixtures use to render sibling chords: depth,
	// not a visibility mode — a second hop WALKS the sibling link.
	it("WHEN the walk reaches the sibling link at depth 2 THEN it becomes an edge", () => {
		const graph = siblingBuild({ globalDepths: { outgoingDepth: 2, incomingDepth: 0 } });
		expect(edgeStrings(graph)).toEqual(["a.md->b.md", "hub.md->a.md", "hub.md->b.md"]);
	});
});

describe("VicinityEngine edge link counts (step-05, CLARIFICATION Q1)", () => {
	// GIVEN hub.md links twin.md twice and solo.md once.
	function duplicateLinkEngine(): VicinityEngine {
		return new VicinityEngine(
			new FakeLinkProvider({
				files: [{ path: "hub.md" }, { path: "twin.md" }, { path: "solo.md" }],
				links: { "hub.md": ["twin.md", "solo.md", "twin.md"] },
			}),
		);
	}

	function edgeCounts(): Record<string, number> {
		const graph = duplicateLinkEngine().build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { outgoingDepth: 1, incomingDepth: 1 },
			globalView: EngineDefaults.viewSettings(),
		});
		return Object.fromEntries(graph.edges.map((edge) => [`${edge.source}->${edge.target}`, edge.count]));
	}

	it("WHEN a build walks a double link THEN that edge carries count 2", () => {
		expect(edgeCounts()).toEqual({ "hub.md->twin.md": 2, "hub.md->solo.md": 1 });
	});
});

/**
 * The GLOBAL-only depth contract at the pinned central, END-TO-END (proves the
 * BFS actually walks a pinned root to the global depth, not just that a number
 * was passed): X's chain X → x1 → x2 → x3 has neighbors at hops 1/2/3, and X is
 * NOT main — the depth it uses is the one global dial, whoever is MAIN.
 */
describe("VicinityEngine pinned-central depth exploration", () => {
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

	/** Build with MAIN=`mainPath` and ONE global outgoing depth for every root. */
	function build(mainPath: string, globalOutgoing: number): VicinityGraph {
		return new VicinityEngine(chainProvider()).build({
			main: { path: asVaultPath(mainPath) },
			pinned: [X_PIN],
			globalDepths: { outgoingDepth: globalOutgoing, incomingDepth: 0 },
			globalView: { ...EngineDefaults.viewSettings(), nodeCap: 100 },
		});
	}

	it("WHEN the global outgoing depth is 3 THEN the pinned central reaches x3 at depth 3", () => {
		expect(node(build("y.md", 3), "x3.md")?.depthTags).toEqual([
			{ rootPath: "x.md", direction: "outgoing", depth: 3 },
		]);
	});

	it("WHEN the global outgoing depth is 1 THEN x2 and x3 are out of the pinned central's reach", () => {
		const graph = build("y.md", 1);
		expect({ x1: node(graph, "x1.md") !== undefined, x2: node(graph, "x2.md"), x3: node(graph, "x3.md") }).toEqual({
			x1: true,
			x2: undefined,
			x3: undefined,
		});
	});

	it("WHEN MAIN changes THEN the pinned central's reach is unchanged (no per-MAIN depth memory)", () => {
		// The CONCRETE tag, not a comparison against the other build: with two
		// `?.depthTags` sides a pinned root that stopped being walked at all would
		// leave both `undefined` and keep this green — a silent fallback.
		expect(node(build("z.md", 3), "x3.md")?.depthTags).toEqual([
			{ rootPath: "x.md", direction: "outgoing", depth: 3 },
		]);
	});
});

describe("VicinityEngine outline pass-through", () => {
	it("WHEN a graph is built THEN each output node carries its file's outline", () => {
		// GIVEN a hub linking one note that declares an outline (the spread-through guard:
		// GraphNode gets `outline` only because VicinityEngine copies the traversed node).
		const provider = new FakeLinkProvider({
			files: [{ path: "hub.md" }, { path: "child.md", outline: [{ rawText: "Intro", level: 1 }] }],
			links: { "hub.md": ["child.md"] },
		});
		const graph = new VicinityEngine(provider).build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { outgoingDepth: 1, incomingDepth: 0 },
			globalView: EngineDefaults.viewSettings(),
		});
		expect(graph.nodes.find((candidate) => candidate.path === "child.md")?.outline).toEqual([
			{ rawText: "Intro", level: 1 },
		]);
	});

	it("WHEN a traversed node carries imagePrecedesOutline THEN the output node carries it too", () => {
		// The same spread-through guard as `outline`: the view's preview rule reads
		// this fact off GraphNode, so a dropped echo would silently change previews.
		const provider = new FakeLinkProvider({
			files: [
				{ path: "hub.md" },
				{ path: "cover.md", outline: [{ rawText: "Intro", level: 1 }], imagePrecedesOutline: true },
			],
			links: { "hub.md": ["cover.md"] },
		});
		const graph = new VicinityEngine(provider).build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { outgoingDepth: 1, incomingDepth: 0 },
			globalView: EngineDefaults.viewSettings(),
		});
		expect(graph.nodes.find((candidate) => candidate.path === "cover.md")?.imagePrecedesOutline).toBe(true);
	});
});

/**
 * The `globalView -> NodeSizer` seam counterpart of the invariant
 * pinned in `NodeSizer.test.ts`: only `viewSettings.sizing` may reach sizing.
 * Someone routing `viewSettings` wholesale into a new size metric surfaces HERE,
 * and every preview-pill flip would then force a relayout instead of the
 * data-only refresh it promises.
 */
describe("VicinityEngine sizing ignores the node preview preference", () => {
	it("WHEN two builds differ ONLY in nodePreviewPreference THEN every node's sizePx is identical", () => {
		const sizesUnderPreference = (preference: NodePreviewPreference) =>
			build({
				globalView: { ...EngineDefaults.viewSettings(), nodePreviewPreference: preference },
			}).nodes.map((candidate) => ({ path: candidate.path, sizePx: candidate.sizePx }));

		const baseline = sizesUnderPreference(NODE_PREVIEW_PREFERENCES[0]);
		// Keyed by preference so a failure names the offending value.
		const actual = Object.fromEntries(NODE_PREVIEW_PREFERENCES.map((p) => [p, sizesUnderPreference(p)]));
		expect(actual).toEqual(Object.fromEntries(NODE_PREVIEW_PREFERENCES.map((p) => [p, baseline])));
	});
});
