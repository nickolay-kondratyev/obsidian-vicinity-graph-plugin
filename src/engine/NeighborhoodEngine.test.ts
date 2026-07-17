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
