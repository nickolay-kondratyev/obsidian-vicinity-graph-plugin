import { describe, expect, it } from "vitest";
import { EngineDefaults } from "./constants";
import { FakeLinkProvider } from "./FakeLinkProvider";
import { VicinityEngine } from "./VicinityEngine";
import { VicinityTraversal } from "./VicinityTraversal";
import type { GraphBuildRequest } from "./VicinityEngine";
import type { DepthSettings, GraphEdge } from "./types";
import { asVaultPath } from "./types";

/**
 * The folder-note DESCENDANTS/ANCESTORS channels (Hierarchy 1). GIVEN a fixture
 * vault whose paths imply a folder-note hierarchy, WHEN the engine builds with
 * the hierarchy dials set, THEN the descendants/ancestors are reached and their
 * edges carry the folder relation (merged with links where both apply).
 */

/** Build with the four hierarchy dials driven for the ACTIVE (MAIN) root; everything else default. */
function build(
	provider: FakeLinkProvider,
	mainPath: string,
	dials: { linkOut?: number; descendants?: number; ancestors?: number; crossLinks?: boolean } = {},
): GraphEdge[] {
	const request: GraphBuildRequest = {
		main: { path: asVaultPath(mainPath) },
		globalDepths: {
			...EngineDefaults.depthSettings(),
			linkDepthOut: dials.linkOut ?? 0,
			embedDepthOut: 0,
			linkDepthIn: 0,
			descendantDepth: dials.descendants ?? 0,
			ancestorDepth: dials.ancestors ?? 0,
		},
		globalView: { ...EngineDefaults.viewSettings(), showCrossLinks: dials.crossLinks ?? false },
	};
	return [...new VicinityEngine(provider).build(request).edges];
}

function edgeFor(edges: readonly GraphEdge[], source: string, target: string): GraphEdge | undefined {
	return edges.find((edge) => edge.source === source && edge.target === target);
}

function nodePaths(provider: FakeLinkProvider, mainPath: string, dials: Partial<DepthSettings> = {}): string[] {
	const engine = new VicinityEngine(provider);
	return engine
		.build({
			main: { path: asVaultPath(mainPath) },
			globalDepths: { ...EngineDefaults.depthSettings(), linkDepthOut: 0, embedDepthOut: 0, linkDepthIn: 0, ...dials },
			globalView: EngineDefaults.viewSettings(),
		})
		.nodes.map((node) => node.path)
		.sort();
}

// GIVEN Jon.md (folder note of Jon/) whose body links [[child-of-jon]] inside Jon/.
function jonVault(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [{ path: "Jon.md" }, { path: "Jon/child-of-jon.md" }],
		links: { "Jon.md": ["Jon/child-of-jon.md"] },
	});
}

describe("named Jon scenario: the three budget combinations", () => {
	it("WHEN links-out=1 AND descendants=1 THEN ONE merged edge Jon -> child (link + folder relation)", () => {
		const edge = edgeFor(build(jonVault(), "Jon.md", { linkOut: 1, descendants: 1 }), "Jon.md", "Jon/child-of-jon.md");
		expect(edge).toEqual({
			source: "Jon.md",
			target: "Jon/child-of-jon.md",
			count: 1,
			kind: "link",
			hierarchy: true,
		});
	});

	it("WHEN links-out=1, descendants=0 THEN a solid LINK-only edge (no folder relation)", () => {
		const edge = edgeFor(build(jonVault(), "Jon.md", { linkOut: 1, descendants: 0 }), "Jon.md", "Jon/child-of-jon.md");
		expect(edge).toEqual({
			source: "Jon.md",
			target: "Jon/child-of-jon.md",
			count: 1,
			kind: "link",
			hierarchy: false,
		});
	});

	it("WHEN links-out=0, descendants=1 THEN a PURE hierarchy edge (dashed, no badge) though the link exists", () => {
		const edge = edgeFor(build(jonVault(), "Jon.md", { linkOut: 0, descendants: 1 }), "Jon.md", "Jon/child-of-jon.md");
		expect(edge).toEqual({
			source: "Jon.md",
			target: "Jon/child-of-jon.md",
			count: 0,
			kind: "link",
			hierarchy: true,
		});
	});

	it("WHEN cross links are ON THEN the unwalked link surfaces and the pure hierarchy edge becomes merged", () => {
		const edge = edgeFor(
			build(jonVault(), "Jon.md", { linkOut: 0, descendants: 1, crossLinks: true }),
			"Jon.md",
			"Jon/child-of-jon.md",
		);
		expect(edge).toEqual({
			source: "Jon.md",
			target: "Jon/child-of-jon.md",
			count: 1,
			kind: "link",
			hierarchy: true,
		});
	});
});

describe("descendants depth reaches grandchildren only through an intermediate folder note", () => {
	// GIVEN top.md (folder note of top/) with NO direct files; top/mid/ is a direct
	// subfolder whose INSIDE-style note top/mid/mid.md bridges UP to level 1 (the
	// symmetric-descendants rule), and top/mid/leaf.md is its grandchild. `plain`
	// (a folder with NO folder note) holds top/plain/hidden.md, never reached.
	function nestedVault(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [
				{ path: "top.md" },
				{ path: "top/mid/mid.md" },
				{ path: "top/mid/leaf.md" },
				{ path: "top/plain/hidden.md" },
			],
		});
	}

	it("WHEN descendants=1 THEN the inside-style subfolder note is bridged to level 1 (grandchild still out of reach)", () => {
		expect(nodePaths(nestedVault(), "top.md", { descendantDepth: 1 })).toEqual(["top.md", "top/mid/mid.md"]);
	});

	it("WHEN descendants=2 THEN the grandchild is reached THROUGH the intermediate folder note", () => {
		expect(nodePaths(nestedVault(), "top.md", { descendantDepth: 2 })).toEqual([
			"top.md",
			"top/mid/leaf.md",
			"top/mid/mid.md",
		]);
	});

	it("WHEN a folder has no folder note THEN its files are never bridged (no synthetic folder node)", () => {
		expect(nodePaths(nestedVault(), "top.md", { descendantDepth: 5 })).not.toContain("top/plain/hidden.md");
	});
});

describe("ancestors chain stops at the first folder-note gap", () => {
	// GIVEN a/b.md (folder note of a/b/) and a/b/leaf.md, but folder `a/` has NO
	// folder note — so the walk up from leaf stops at a/b.md.
	function gappedVault(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [{ path: "a/b.md" }, { path: "a/b/leaf.md" }, { path: "a/other.md" }],
		});
	}

	it("WHEN ancestors=5 from the leaf THEN the walk reaches a/b.md and stops at the a/ gap", () => {
		expect(nodePaths(gappedVault(), "a/b/leaf.md", { ancestorDepth: 5 })).toEqual(["a/b.md", "a/b/leaf.md"]);
	});
});

describe("both-present tie: inside wins, sibling is an ordinary note", () => {
	// GIVEN both Jon.md (sibling) and Jon/Jon.md (inside) folder-note candidates.
	function bothPresentVault(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [{ path: "Jon.md" }, { path: "Jon/Jon.md" }, { path: "Jon/child.md" }],
		});
	}

	it("WHEN Jon/Jon.md is the folder note THEN it owns the child (descendants reach it)", () => {
		expect(nodePaths(bothPresentVault(), "Jon/Jon.md", { descendantDepth: 1 })).toEqual(["Jon/Jon.md", "Jon/child.md"]);
	});

	it("WHEN the sibling Jon.md lost the tie THEN it owns nothing (an ordinary note)", () => {
		expect(nodePaths(bothPresentVault(), "Jon.md", { descendantDepth: 1 })).toEqual(["Jon.md"]);
	});
});

describe("canvas folder notes, self-exclusion, and kind purity", () => {
	it("WHEN a .canvas folder note owns a .canvas child THEN both participate and the note is not its own child", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "Draw/Draw.canvas" }, { path: "Draw/leaf.canvas" }],
		});
		expect(provider.getChildNotes(asVaultPath("Draw/Draw.canvas"))).toEqual([asVaultPath("Draw/leaf.canvas")]);
		expect(nodePaths(provider, "Draw/Draw.canvas", { descendantDepth: 1 })).toEqual([
			"Draw/Draw.canvas",
			"Draw/leaf.canvas",
		]);
	});

	it("WHEN a descendant has its OWN wikilinks THEN they are NOT expanded (kind-pure channel)", () => {
		// child.md links out.md; walking descendants only must NOT follow child's link.
		const provider = new FakeLinkProvider({
			files: [{ path: "Home.md" }, { path: "Home/child.md" }, { path: "out.md" }],
			links: { "Home/child.md": ["out.md"] },
		});
		expect(nodePaths(provider, "Home.md", { descendantDepth: 5 })).toEqual(["Home.md", "Home/child.md"]);
	});
});

describe("hierarchy relations are invisible to the cross-links sweep and getLinkCount", () => {
	it("WHEN a pure hierarchy pair has no link THEN its count is 0 (getLinkCount sees no folder relation)", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "Home.md" }, { path: "Home/child.md" }],
		});
		const edge = edgeFor(build(provider, "Home.md", { descendants: 1 }), "Home.md", "Home/child.md");
		expect(edge?.count).toBe(0);
	});

	it("WHEN traversal records a hierarchy pair THEN it is keyed as hierarchy, not as a link", () => {
		const provider = new FakeLinkProvider({ files: [{ path: "Home.md" }, { path: "Home/child.md" }] });
		const result = new VicinityTraversal(provider).traverse([
			{
				descriptor: { path: asVaultPath("Home.md") },
				depths: { linkDepthOut: 0, embedDepthOut: 0, linkDepthIn: 0, namedDepthOut: 0, namedDepthIn: 0, descendantDepth: 1, ancestorDepth: 0 },
			},
		]);
		const key = [...result.hierarchyPairKeys][0];
		expect({ hierarchy: result.hierarchyPairKeys.size, link: result.linkPairKeys.size, key }).toEqual({
			hierarchy: 1,
			link: 0,
			key,
		});
	});
});
