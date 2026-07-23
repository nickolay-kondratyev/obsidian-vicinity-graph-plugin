import { describe, expect, it } from "vitest";
import { FakeLinkProvider } from "./FakeLinkProvider";
import { PathExclusionMatcher } from "./PathExclusionMatcher";
import type { TraversalRoot, TraversalResult } from "./VicinityTraversal";
import { VicinityTraversal } from "./VicinityTraversal";
import type { DepthSettings } from "./types";
import { asDocId, asVaultPath } from "./types";

function root(path: string, depths: Partial<DepthSettings> = {}): TraversalRoot {
	return {
		descriptor: { path: asVaultPath(path) },
		depths: { outgoingDepth: depths.outgoingDepth ?? 1, incomingDepth: depths.incomingDepth ?? 1 },
	};
}

function traverse(provider: FakeLinkProvider, roots: readonly TraversalRoot[]): TraversalResult {
	return new VicinityTraversal(provider).traverse(roots);
}

function traverseExcluding(
	provider: FakeLinkProvider,
	roots: readonly TraversalRoot[],
	patterns: readonly string[],
): TraversalResult {
	return new VicinityTraversal(provider, PathExclusionMatcher.fromPatterns(patterns)).traverse(roots);
}

function nodePaths(result: TraversalResult): string[] {
	return [...result.nodes.keys()].sort();
}

function edgePairs(result: TraversalResult): string[] {
	return result.edges.map((edge) => `${edge.source}->${edge.target}`).sort();
}

// GIVEN a chain a -> b -> c -> d
function chainVault(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }, { path: "d.md" }],
		links: { "a.md": ["b.md"], "b.md": ["c.md"], "c.md": ["d.md"] },
	});
}

describe("VicinityTraversal depth limits on a chain a->b->c->d", () => {
	it("WHEN outgoing depth is 2 THEN traversal stops at c", () => {
		const result = traverse(chainVault(), [root("a.md", { outgoingDepth: 2, incomingDepth: 0 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md", "c.md"]);
	});

	it("WHEN incoming depth is 2 from d THEN traversal walks linkers back to b", () => {
		const result = traverse(chainVault(), [root("d.md", { outgoingDepth: 0, incomingDepth: 2 })]);
		expect(nodePaths(result)).toEqual(["b.md", "c.md", "d.md"]);
	});

	it("WHEN both depths are 0 THEN only the root itself is returned", () => {
		const result = traverse(chainVault(), [root("b.md", { outgoingDepth: 0, incomingDepth: 0 })]);
		expect(nodePaths(result)).toEqual(["b.md"]);
	});

	it("WHEN outgoing and incoming depths differ THEN each direction honors its own limit", () => {
		const result = traverse(chainVault(), [root("c.md", { outgoingDepth: 1, incomingDepth: 2 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md", "c.md", "d.md"]);
	});

	it("WHEN traversing outgoing THEN edges point linker -> linked", () => {
		const result = traverse(chainVault(), [root("a.md", { outgoingDepth: 1, incomingDepth: 0 })]);
		expect(edgePairs(result)).toEqual(["a.md->b.md"]);
	});

	it("WHEN traversing incoming THEN edges still point linker -> linked", () => {
		const result = traverse(chainVault(), [root("d.md", { outgoingDepth: 0, incomingDepth: 1 })]);
		expect(edgePairs(result)).toEqual(["c.md->d.md"]);
	});
});

// GIVEN a diamond a -> b, a -> c, b -> d, c -> d
function diamondVault(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }, { path: "d.md" }],
		links: { "a.md": ["b.md", "c.md"], "b.md": ["d.md"], "c.md": ["d.md"] },
	});
}

describe("VicinityTraversal on a diamond graph", () => {
	it("WHEN d is reachable via two branches THEN it appears as a single node", () => {
		const result = traverse(diamondVault(), [root("a.md", { outgoingDepth: 2, incomingDepth: 0 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md", "c.md", "d.md"]);
	});

	it("WHEN d is reached via both branches THEN both edges into d are kept", () => {
		const result = traverse(diamondVault(), [root("a.md", { outgoingDepth: 2, incomingDepth: 0 })]);
		expect(edgePairs(result)).toEqual(["a.md->b.md", "a.md->c.md", "b.md->d.md", "c.md->d.md"]);
	});

	it("WHEN d was already visited at equal depth THEN it is never re-expanded (single outgoing query)", () => {
		const provider = diamondVault();
		traverse(provider, [root("a.md", { outgoingDepth: 3, incomingDepth: 0 })]);
		expect(provider.outgoingQueryCount(asVaultPath("d.md"))).toBe(1);
	});

	it("WHEN d gets one depth tag per reaching root-direction THEN its depth is the shallowest (BFS order)", () => {
		const result = traverse(diamondVault(), [root("a.md", { outgoingDepth: 3, incomingDepth: 0 })]);
		expect(result.nodes.get(asVaultPath("d.md"))?.depthTags).toEqual([
			{ rootPath: "a.md", direction: "outgoing", depth: 2 },
		]);
	});
});

describe("VicinityTraversal on cycles and bidirectional links", () => {
	// GIVEN a cycle a -> b -> c -> a
	it("WHEN the graph contains a cycle THEN traversal terminates and visits each node once", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }],
			links: { "a.md": ["b.md"], "b.md": ["c.md"], "c.md": ["a.md"] },
		});
		const result = traverse(provider, [root("a.md", { outgoingDepth: 10, incomingDepth: 0 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md", "c.md"]);
	});

	// GIVEN bidirectional links a <-> b
	it("WHEN two notes link each other THEN both directed edges are captured", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "b.md" }],
			links: { "a.md": ["b.md"], "b.md": ["a.md"] },
		});
		const result = traverse(provider, [root("a.md")]);
		expect(edgePairs(result)).toEqual(["a.md->b.md", "b.md->a.md"]);
	});

	it("WHEN the same edge is found by outgoing and incoming BFS THEN it is deduplicated", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "b.md" }],
			links: { "a.md": ["b.md"] },
		});
		const result = traverse(provider, [root("a.md"), root("b.md")]);
		expect(edgePairs(result)).toEqual(["a.md->b.md"]);
	});
});

describe("VicinityTraversal multi-root union", () => {
	// GIVEN two disconnected components: a -> b and p -> q
	function twoIslands(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "b.md" }, { path: "p.md" }, { path: "q.md" }],
			links: { "a.md": ["b.md"], "p.md": ["q.md"] },
		});
	}

	it("WHEN a pinned root is disconnected from MAIN THEN its vicinity is still traversed", () => {
		const result = traverse(twoIslands(), [root("a.md"), root("p.md")]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md", "p.md", "q.md"]);
	});

	it("WHEN a node is reached from two roots THEN it carries a depth tag per root", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "m.md" }, { path: "z.md" }],
			links: { "a.md": ["m.md"], "z.md": ["m.md"] },
		});
		const result = traverse(provider, [root("a.md"), root("z.md")]);
		expect(result.nodes.get(asVaultPath("m.md"))?.depthTags).toEqual([
			{ rootPath: "a.md", direction: "outgoing", depth: 1 },
			{ rootPath: "z.md", direction: "outgoing", depth: 1 },
		]);
	});

	it("WHEN a node is a root and also a neighbor of another root THEN minDepth is 0", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "b.md" }],
			links: { "a.md": ["b.md"] },
		});
		const result = traverse(provider, [root("a.md"), root("b.md")]);
		expect(result.nodes.get(asVaultPath("b.md"))?.minDepth).toBe(0);
	});

	it("WHEN the same path appears as MAIN and as pinned root THEN it is traversed once (first descriptor wins)", () => {
		const provider = chainVault();
		const result = traverse(provider, [root("a.md"), root("a.md", { outgoingDepth: 3 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md"]);
	});

	it("WHEN roots are traversed THEN they are marked central and neighbors are not", () => {
		const result = traverse(chainVault(), [root("a.md")]);
		expect([...result.nodes.values()].map((n) => `${n.path}:${n.isCentral}`).sort()).toEqual([
			"a.md:true",
			"b.md:false",
		]);
	});
});

describe("VicinityTraversal attachments and non-node-bearing files", () => {
	// GIVEN an attachment-heavy note: n.md -> [doc.pdf, one.png, two.png, m.md]
	function attachmentVault(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [
				{ path: "n.md" },
				{ path: "m.md" },
				{ path: "files/doc.pdf" },
				{ path: "img/one.png" },
				{ path: "img/two.png" },
			],
			links: { "n.md": ["files/doc.pdf", "img/one.png", "img/two.png", "m.md"] },
		});
	}

	it("WHEN a note links non-node-bearing files THEN those files never become nodes", () => {
		const result = traverse(attachmentVault(), [root("n.md", { outgoingDepth: 5 })]);
		expect(nodePaths(result)).toEqual(["m.md", "n.md"]);
	});

	it("WHEN a note links attachments THEN they are collected on the linking node", () => {
		const result = traverse(attachmentVault(), [root("n.md")]);
		expect(result.nodes.get(asVaultPath("n.md"))?.attachments.map((a) => a.path)).toEqual([
			"files/doc.pdf",
			"img/one.png",
			"img/two.png",
		]);
	});

	it("WHEN a note has several attachments THEN the first IMAGE is identified", () => {
		const result = traverse(attachmentVault(), [root("n.md")]);
		expect(result.nodes.get(asVaultPath("n.md"))?.firstImagePath).toBe("img/one.png");
	});

	it("WHEN a note has no image attachments THEN firstImagePath is undefined", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "n.md" }, { path: "doc.pdf" }],
			links: { "n.md": ["doc.pdf"] },
		});
		const result = traverse(provider, [root("n.md")]);
		expect(result.nodes.get(asVaultPath("n.md"))?.firstImagePath).toBeUndefined();
	});
});

describe("VicinityTraversal global neighbor exclusion", () => {
	// GIVEN main a.md -> excluded rel/b.md -> c.md, plus a.md -> d.md
	function excludableVault(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "rel/b.md" }, { path: "c.md" }, { path: "d.md" }],
			links: { "a.md": ["rel/b.md", "d.md"], "rel/b.md": ["c.md"] },
		});
	}

	it("WHEN a neighbor matches an exclusion pattern THEN it is absent from the graph", () => {
		const result = traverseExcluding(excludableVault(), [root("a.md", { outgoingDepth: 3 })], ["^rel/"]);
		expect(nodePaths(result)).toEqual(["a.md", "d.md"]);
	});

	it("WHEN an excluded neighbor would bridge to a deeper node THEN that node is not discovered", () => {
		const result = traverseExcluding(excludableVault(), [root("a.md", { outgoingDepth: 3 })], ["^rel/"]);
		expect(nodePaths(result)).not.toContain("c.md");
	});

	it("WHEN a neighbor is excluded THEN it is never expanded through (its links are never queried)", () => {
		const provider = excludableVault();
		traverseExcluding(provider, [root("a.md", { outgoingDepth: 3 })], ["^rel/"]);
		expect(provider.outgoingQueryCount(asVaultPath("rel/b.md"))).toBe(0);
	});

	it("WHEN no edge is recorded to an excluded neighbor THEN the graph has no edge into it", () => {
		const result = traverseExcluding(excludableVault(), [root("a.md", { outgoingDepth: 3 })], ["^rel/"]);
		expect(edgePairs(result)).toEqual(["a.md->d.md"]);
	});

	it("WHEN nothing is excluded THEN the count is zero", () => {
		expect(traverse(excludableVault(), [root("a.md")]).excludedNodeCount).toBe(0);
	});

	it("WHEN one distinct neighbor is excluded THEN the count is one", () => {
		const result = traverseExcluding(excludableVault(), [root("a.md", { outgoingDepth: 3 })], ["^rel/"]);
		expect(result.excludedNodeCount).toBe(1);
	});

	it("WHEN the same excluded neighbor is reached from two roots THEN it is counted once (distinct)", () => {
		// a.md -> rel/x.md <- z.md : rel/x.md is a shared excluded neighbor.
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "z.md" }, { path: "rel/x.md" }],
			links: { "a.md": ["rel/x.md"], "z.md": ["rel/x.md"] },
		});
		const result = traverseExcluding(provider, [root("a.md"), root("z.md")], ["^rel/"]);
		expect(result.excludedNodeCount).toBe(1);
	});

	it("WHEN a ROOT matches an exclusion pattern THEN the root is exempt and still present", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "rel/root.md" }, { path: "n.md" }],
			links: { "rel/root.md": ["n.md"] },
		});
		const result = traverseExcluding(provider, [root("rel/root.md")], ["^rel/"]);
		expect(nodePaths(result)).toEqual(["n.md", "rel/root.md"]);
	});

	it("WHEN a matching path is a pinned root reached as a neighbor of MAIN THEN it stays and is not counted", () => {
		// main.md -> rel/pinned.md, and rel/pinned.md is ALSO a root (pinned).
		const provider = new FakeLinkProvider({
			files: [{ path: "main.md" }, { path: "rel/pinned.md" }],
			links: { "main.md": ["rel/pinned.md"] },
		});
		const result = traverseExcluding(provider, [root("main.md"), root("rel/pinned.md")], ["^rel/"]);
		expect({ paths: nodePaths(result), count: result.excludedNodeCount }).toEqual({
			paths: ["main.md", "rel/pinned.md"],
			count: 0,
		});
	});
});

describe("VicinityTraversal degenerate roots", () => {
	it("WHEN a root path is unknown to the provider THEN it is skipped gracefully", () => {
		const result = traverse(chainVault(), [root("ghost.md")]);
		expect(nodePaths(result)).toEqual([]);
	});

	it("WHEN a root is not node-bearing THEN it is skipped gracefully", () => {
		const provider = new FakeLinkProvider({ files: [{ path: "pic.png" }] });
		const result = traverse(provider, [root("pic.png")]);
		expect(nodePaths(result)).toEqual([]);
	});
});

describe("VicinityTraversal node assembly", () => {
	it("WHEN a root descriptor carries a docid THEN the docid is echoed on the output node", () => {
		const provider = chainVault();
		const roots: TraversalRoot[] = [
			{
				descriptor: { path: asVaultPath("a.md"), docid: asDocId("docid_abc_e") },
				depths: { outgoingDepth: 1, incomingDepth: 1 },
			},
		];
		const result = traverse(provider, roots);
		expect(result.nodes.get(asVaultPath("a.md"))?.docid).toBe("docid_abc_e");
	});

	it("WHEN a node is assembled THEN its title is the basename without extension", () => {
		const provider = new FakeLinkProvider({ files: [{ path: "notes/My Note.md" }] });
		const result = traverse(provider, [root("notes/My Note.md")]);
		expect(result.nodes.get(asVaultPath("notes/My Note.md"))?.title).toBe("My Note");
	});

	it("WHEN a node is assembled THEN it carries its folder and byte size", () => {
		const provider = new FakeLinkProvider({ files: [{ path: "notes/x.md", sizeBytes: 42 }] });
		const result = traverse(provider, [root("notes/x.md")]);
		const node = result.nodes.get(asVaultPath("notes/x.md"));
		expect(`${node?.folder}|${node?.sizeBytes}`).toBe("notes|42");
	});
});

describe("VicinityTraversal display title (step-05 human decision)", () => {
	// GIVEN a root whose provider metadata carries a frontmatter title and a
	// neighbor without one.
	function titledTraversal() {
		const provider = new FakeLinkProvider({
			files: [{ path: "notes/root.md", frontmatterTitle: "Fancy Title" }, { path: "notes/plain.md" }],
			links: { "notes/root.md": ["notes/plain.md"] },
		});
		return new VicinityTraversal(provider).traverse([
			{ descriptor: { path: asVaultPath("notes/root.md") }, depths: { outgoingDepth: 1, incomingDepth: 1 } },
		]);
	}

	it("WHEN metadata has a frontmatter title THEN the node title uses it", () => {
		expect(titledTraversal().nodes.get(asVaultPath("notes/root.md"))?.title).toBe("Fancy Title");
	});

	it("WHEN metadata has no frontmatter title THEN the node title falls back to the basename", () => {
		expect(titledTraversal().nodes.get(asVaultPath("notes/plain.md"))?.title).toBe("plain");
	});
});
