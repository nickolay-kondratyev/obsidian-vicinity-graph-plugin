import { describe, expect, it } from "vitest";
import { Tags } from "../shared/Tags";
import type { TagKey } from "../shared/Tags";
import { EngineDefaults } from "./constants";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { TagGraphBuildRequest } from "./VicinityEngine";
import { VicinityEngine } from "./VicinityEngine";
import type { VicinityGraph } from "./types";
import { asDocId, asVaultPath } from "./types";

function tagKey(raw: string): TagKey {
	const tag = Tags.parse(raw);
	if (tag === undefined) {
		throw new Error(`fixture bug: [${raw}] is not a tag`);
	}
	return tag.key;
}

/**
 * GIVEN a vault where three notes carry `#project` (one through the nested
 * `#project/alpha`), one carries only `#other`, and an untagged hub links them.
 */
function fixtureProvider(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [
			{ path: "hub.md" },
			{ path: "work/plan.md", tags: ["#project"] },
			{ path: "work/alpha.md", tags: ["#Project/Alpha"] },
			{ path: "work/retro.md", tags: ["project", "#other"] },
			{ path: "misc/other.md", tags: ["#other"] },
			{ path: "misc/projects.md", tags: ["#projects"] },
			{ path: "img/cover.png" },
		],
		links: {
			"hub.md": ["work/plan.md", "misc/other.md"],
			"work/plan.md": ["work/alpha.md", "work/alpha.md", "hub.md", "img/cover.png"],
			"work/retro.md": ["work/plan.md", "misc/other.md"],
		},
	});
}

function request(overrides: Partial<TagGraphBuildRequest> = {}): TagGraphBuildRequest {
	return { tag: tagKey("#project"), globalView: EngineDefaults.viewSettings(), ...overrides };
}

function build(overrides: Partial<TagGraphBuildRequest> = {}, provider = fixtureProvider()): VicinityGraph {
	return new VicinityEngine(provider).buildForTag(request(overrides));
}

function paths(graph: VicinityGraph): string[] {
	return graph.nodes.map((node) => node.path).sort();
}

function edgeKeys(graph: VicinityGraph): string[] {
	return graph.edges.map((edge) => `${edge.source}->${edge.target}`).sort();
}

describe("VicinityEngine.buildForTag membership", () => {
	it("WHEN a tag is built THEN every note carrying it or a nested child tag is a node", () => {
		expect(paths(build())).toEqual(["work/alpha.md", "work/plan.md", "work/retro.md"]);
	});

	it("WHEN the tag is written in another casing THEN the same notes match", () => {
		expect(paths(build({ tag: tagKey("#PROJECT") }))).toEqual(["work/alpha.md", "work/plan.md", "work/retro.md"]);
	});

	it("WHEN a nested tag is built THEN a note carrying only the parent tag is not a node", () => {
		expect(paths(build({ tag: tagKey("#project/alpha") }))).toEqual(["work/alpha.md"]);
	});

	it("WHEN no note carries the tag THEN the graph has no nodes", () => {
		expect(build({ tag: tagKey("#nobody") }).nodes).toEqual([]);
	});

	it("WHEN a tag is built THEN no node is MAIN", () => {
		expect(build().nodes.some((node) => node.isMain)).toBe(false);
	});

	it("WHEN a tag is built THEN no node is central", () => {
		expect(build().nodes.some((node) => node.isCentral)).toBe(false);
	});

	it("WHEN a tagged note has a per-node override THEN it is echoed onto the node", () => {
		const graph = build({ nodeOverrides: new Map([[asVaultPath("work/plan.md"), { sizePx: { widthPx: 200, heightPx: 90 } }]]) });

		expect(graph.nodes.find((node) => node.path === "work/plan.md")?.override).toEqual({
			sizePx: { widthPx: 200, heightPx: 90 },
		});
	});
});

describe("VicinityEngine.buildForTag pinned docids", () => {
	const pinnedDocIds = new Map([
		[asVaultPath("work/plan.md"), asDocId("docid_plan_e")],
		[asVaultPath("hub.md"), asDocId("docid_hub_e")],
	]);

	it("WHEN a tagged note is pinned THEN its docid is echoed onto the node", () => {
		const graph = build({ pinnedDocIds });

		expect(graph.nodes.find((node) => node.path === "work/plan.md")?.docid).toBe("docid_plan_e");
	});

	it("WHEN a pinned note does not carry the tag THEN the pin adds no node", () => {
		expect(paths(build({ pinnedDocIds }))).not.toContain("hub.md");
	});

	it("WHEN a tagged note is pinned THEN it is still not central", () => {
		expect(build({ pinnedDocIds }).nodes.some((node) => node.isCentral)).toBe(false);
	});
});

describe("VicinityEngine.buildForTag edges", () => {
	it("WHEN tagged notes link each other THEN exactly those links are edges, untagged endpoints dropped", () => {
		expect(edgeKeys(build())).toEqual(["work/plan.md->work/alpha.md", "work/retro.md->work/plan.md"]);
	});

	it("WHEN a pair is linked twice THEN the edge carries the link count", () => {
		const edge = build().edges.find((candidate) => candidate.target === "work/alpha.md");

		expect(edge?.count).toBe(2);
	});

	it("WHEN cross links are OFF THEN the links between tagged notes are still edges", () => {
		const globalView = { ...EngineDefaults.viewSettings(), showCrossLinks: false };

		expect(edgeKeys(build({ globalView }))).toHaveLength(2);
	});

	it("WHEN a tagged note links itself THEN no self-loop edge is emitted", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "self.md", tags: ["#project"] }],
			links: { "self.md": ["self.md"] },
		});

		expect(build({}, provider).edges).toEqual([]);
	});
});

describe("VicinityEngine.buildForTag node exclusion", () => {
	const nodeExclusion = { enabled: true, patterns: ["^work/retro"] };

	it("WHEN a tagged note matches an exclusion pattern THEN it is not a node", () => {
		expect(paths(build({ nodeExclusion }))).toEqual(["work/alpha.md", "work/plan.md"]);
	});

	it("WHEN a tagged note is excluded THEN it is counted as excluded", () => {
		expect(build({ nodeExclusion }).excludedNodeCount).toBe(1);
	});

	it("WHEN exclusion is disabled THEN a matching tagged note stays", () => {
		const graph = build({ nodeExclusion: { enabled: false, patterns: ["^work/retro"] } });

		expect(paths(graph)).toContain("work/retro.md");
	});
});

describe("VicinityEngine.buildForTag node cap", () => {
	/**
	 * GIVEN five `#t` notes: `hub` linked with three of them (degree 3), `b` with
	 * two (hub, a), `a` with two (hub, b), `c` with one (hub) and `z` with none.
	 */
	function cappedProvider(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [
				{ path: "z.md", tags: ["#t"] },
				{ path: "c.md", tags: ["#t"] },
				{ path: "b.md", tags: ["#t"] },
				{ path: "a.md", tags: ["#t"] },
				{ path: "sub/hub.md", tags: ["#t"] },
			],
			links: {
				"sub/hub.md": ["a.md", "b.md"],
				"c.md": ["sub/hub.md"],
				"a.md": ["b.md"],
			},
		});
	}

	function capped(nodeCap: number): VicinityGraph {
		const globalView = { ...EngineDefaults.viewSettings(), nodeCap };
		return build({ tag: tagKey("#t"), globalView }, cappedProvider());
	}

	it("WHEN the cap is below the tagged count THEN the most-linked notes are kept", () => {
		expect(paths(capped(1))).toEqual(["sub/hub.md"]);
	});

	it("WHEN notes tie on link count THEN the path order breaks the tie deterministically", () => {
		expect(paths(capped(2))).toEqual(["a.md", "sub/hub.md"]);
	});

	it("WHEN notes are truncated THEN they are counted as hidden per folder", () => {
		expect([...capped(1).hiddenNodeCountsByFolder]).toEqual([["", 4]]);
	});

	it("WHEN notes are truncated THEN edges to hidden notes are dropped", () => {
		expect(edgeKeys(capped(2))).toEqual(["sub/hub.md->a.md"]);
	});

	it("WHEN the cap covers every tagged note THEN nothing is hidden", () => {
		expect(capped(5).hiddenNodeCountsByFolder.size).toBe(0);
	});
});
