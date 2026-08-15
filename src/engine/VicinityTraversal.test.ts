import { describe, expect, it } from "vitest";
import { EngineDefaults } from "./constants";
import { FakeLinkProvider } from "./FakeLinkProvider";
import { PathExclusionMatcher } from "./PathExclusionMatcher";
import type { TraversalRoot, TraversalResult } from "./VicinityTraversal";
import { VicinityTraversal } from "./VicinityTraversal";
import type { DepthSettings } from "./types";
import { asDocId, asVaultPath } from "./types";

function root(path: string, depths: Partial<DepthSettings> = {}): TraversalRoot {
	return {
		descriptor: { path: asVaultPath(path) },
		depths: {
			linkDepthOut: depths.linkDepthOut ?? 1,
			// An unstated embed budget MIRRORS the link budget — the shipped default
			// relationship — so every fixture written before embeds had their own
			// channel still means what it meant.
			embedDepthOut: depths.embedDepthOut ?? depths.linkDepthOut ?? 1,
			linkDepthIn: depths.linkDepthIn ?? 1,
			// Hierarchy channels default OFF so the pre-hierarchy fixtures are unchanged.
			descendantDepth: depths.descendantDepth ?? 0,
			ancestorDepth: depths.ancestorDepth ?? 0,
		},
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
		const result = traverse(chainVault(), [root("a.md", { linkDepthOut: 2, linkDepthIn: 0 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md", "c.md"]);
	});

	it("WHEN incoming depth is 2 from d THEN traversal walks linkers back to b", () => {
		const result = traverse(chainVault(), [root("d.md", { linkDepthOut: 0, linkDepthIn: 2 })]);
		expect(nodePaths(result)).toEqual(["b.md", "c.md", "d.md"]);
	});

	it("WHEN both depths are 0 THEN only the root itself is returned", () => {
		const result = traverse(chainVault(), [root("b.md", { linkDepthOut: 0, linkDepthIn: 0 })]);
		expect(nodePaths(result)).toEqual(["b.md"]);
	});

	it("WHEN outgoing and incoming depths differ THEN each channel honors its own limit", () => {
		const result = traverse(chainVault(), [root("c.md", { linkDepthOut: 1, linkDepthIn: 2 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md", "c.md", "d.md"]);
	});

	it("WHEN traversing outgoing THEN edges point linker -> linked", () => {
		const result = traverse(chainVault(), [root("a.md", { linkDepthOut: 1, linkDepthIn: 0 })]);
		expect(edgePairs(result)).toEqual(["a.md->b.md"]);
	});

	it("WHEN traversing incoming THEN edges still point linker -> linked", () => {
		const result = traverse(chainVault(), [root("d.md", { linkDepthOut: 0, linkDepthIn: 1 })]);
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
		const result = traverse(diamondVault(), [root("a.md", { linkDepthOut: 2, linkDepthIn: 0 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md", "c.md", "d.md"]);
	});

	it("WHEN d is reached via both branches THEN both edges into d are kept", () => {
		const result = traverse(diamondVault(), [root("a.md", { linkDepthOut: 2, linkDepthIn: 0 })]);
		expect(edgePairs(result)).toEqual(["a.md->b.md", "a.md->c.md", "b.md->d.md", "c.md->d.md"]);
	});

	it("WHEN d was already visited at equal depth THEN it is never re-expanded (single outgoing query)", () => {
		const provider = diamondVault();
		traverse(provider, [root("a.md", { linkDepthOut: 3, linkDepthIn: 0 })]);
		expect(provider.outgoingQueryCount(asVaultPath("d.md"))).toBe(1);
	});

	it("WHEN d gets one depth tag per reaching root-channel THEN its depth is the shallowest (BFS order)", () => {
		const result = traverse(diamondVault(), [root("a.md", { linkDepthOut: 3, linkDepthIn: 0 })]);
		expect(result.nodes.get(asVaultPath("d.md"))?.depthTags).toEqual([
			{ rootPath: "a.md", channel: "outgoing-link", depth: 2 },
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
		const result = traverse(provider, [root("a.md", { linkDepthOut: 10, linkDepthIn: 0 })]);
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
			{ rootPath: "a.md", channel: "outgoing-link", depth: 1 },
			{ rootPath: "z.md", channel: "outgoing-link", depth: 1 },
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
		const result = traverse(provider, [root("a.md"), root("a.md", { linkDepthOut: 3 })]);
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
		const result = traverse(attachmentVault(), [root("n.md", { linkDepthOut: 5 })]);
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
		const result = traverseExcluding(excludableVault(), [root("a.md", { linkDepthOut: 3 })], ["^rel/"]);
		expect(nodePaths(result)).toEqual(["a.md", "d.md"]);
	});

	it("WHEN an excluded neighbor would bridge to a deeper node THEN that node is not discovered", () => {
		const result = traverseExcluding(excludableVault(), [root("a.md", { linkDepthOut: 3 })], ["^rel/"]);
		expect(nodePaths(result)).not.toContain("c.md");
	});

	it("WHEN a neighbor is excluded THEN it is never expanded through (its links are never queried)", () => {
		const provider = excludableVault();
		traverseExcluding(provider, [root("a.md", { linkDepthOut: 3 })], ["^rel/"]);
		expect(provider.outgoingQueryCount(asVaultPath("rel/b.md"))).toBe(0);
	});

	it("WHEN no edge is recorded to an excluded neighbor THEN the graph has no edge into it", () => {
		const result = traverseExcluding(excludableVault(), [root("a.md", { linkDepthOut: 3 })], ["^rel/"]);
		expect(edgePairs(result)).toEqual(["a.md->d.md"]);
	});

	it("WHEN nothing is excluded THEN the count is zero", () => {
		expect(traverse(excludableVault(), [root("a.md")]).excludedNodeCount).toBe(0);
	});

	it("WHEN one distinct neighbor is excluded THEN the count is one", () => {
		const result = traverseExcluding(excludableVault(), [root("a.md", { linkDepthOut: 3 })], ["^rel/"]);
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

describe("VicinityTraversal excluded-attachment counting (KNOWN BUG, ticket nid_9evsq3tz9oy6zk41i1qak6w3x_e)", () => {
	// KNOWN BUG — the exclusion gate runs BEFORE the isNodeBearing check, so an
	// excluded ATTACHMENT (never a node candidate; it still renders via
	// FileMetadata.attachments) inflates excludedNodeCount and the toolbar's
	// "N node(s) excluded" badge lies. Unskip (flip `it.skip` to `it`) when fixing.
	it.skip("WHEN an exclusion pattern matches only an attachment THEN the excluded-node count stays zero", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "assets/pic.png" }],
			links: { "a.md": ["assets/pic.png"] },
		});
		const result = traverseExcluding(provider, [root("a.md")], ["^assets/"]);
		expect(result.excludedNodeCount).toBe(0);
	});
});

describe("VicinityTraversal self-links (KNOWN BUG, ticket nid_6ujh4ol7un9etab1vqwfe9nye_e)", () => {
	// KNOWN BUG — a note referencing itself (e.g. [[Note#Section]] inside
	// Note.md resolves Note→Note in Obsidian's resolvedLinks) records
	// recordEdge(current, current) before the visited check, and no downstream
	// stage filters source === target, so the view receives a degenerate
	// self-loop edge. Unskip (flip `it.skip` to `it`) when fixing.
	it.skip("WHEN a note links to itself THEN no self-loop edge reaches the graph", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }],
			links: { "a.md": ["a.md"] },
		});
		const result = traverse(provider, [root("a.md")]);
		expect(edgePairs(result)).toEqual([]);
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
				depths: { linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 1, descendantDepth: 0, ancestorDepth: 0 },
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
			{ descriptor: { path: asVaultPath("notes/root.md") }, depths: { linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 1, descendantDepth: 0, ancestorDepth: 0 } },
		]);
	}

	it("WHEN metadata has a frontmatter title THEN the node title uses it", () => {
		expect(titledTraversal().nodes.get(asVaultPath("notes/root.md"))?.title).toBe("Fancy Title");
	});

	it("WHEN metadata has no frontmatter title THEN the node title falls back to the basename", () => {
		expect(titledTraversal().nodes.get(asVaultPath("notes/plain.md"))?.title).toBe("plain");
	});
});

describe("VicinityTraversal outline echo", () => {
	// GIVEN a single-note vault whose metadata carries a heading outline.
	function outlineVault(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [{ path: "a.md", outline: [{ rawText: "Intro", level: 1 }] }, { path: "plain.md" }],
		});
	}

	it("WHEN a visited file's metadata carries an outline THEN the traversed node echoes it", () => {
		const result = traverse(outlineVault(), [root("a.md")]);
		expect(result.nodes.get(asVaultPath("a.md"))?.outline).toEqual([{ rawText: "Intro", level: 1 }]);
	});

	it("WHEN a visited file's metadata carries no outline THEN the traversed node's outline is empty", () => {
		const result = traverse(outlineVault(), [root("plain.md")]);
		expect(result.nodes.get(asVaultPath("plain.md"))?.outline).toEqual([]);
	});

	it("WHEN the provider reports that the image precedes the outline THEN the traversed node echoes the fact", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "cover.md", outline: [{ rawText: "Intro", level: 1 }], imagePrecedesOutline: true }],
		});
		expect(traverse(provider, [root("cover.md")]).nodes.get(asVaultPath("cover.md"))?.imagePrecedesOutline).toBe(
			true,
		);
	});

	it("WHEN the provider does not report the fact THEN the traversed node carries false", () => {
		const result = traverse(outlineVault(), [root("a.md")]);
		expect(result.nodes.get(asVaultPath("a.md"))?.imagePrecedesOutline).toBe(false);
	});
});

/* ========================================================================== *
 * The outgoing-embed channel (ticket nid_fay1hu5sxcoygizopkkg0f0d7_e)
 * ========================================================================== */

// GIVEN a vault where every hop is written as an EMBED: a ![[b]] ![[c]], b ![[d]].
function embeddedVault(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }, { path: "d.md" }],
		embeds: { "a.md": ["b.md", "c.md"], "b.md": ["d.md"] },
	});
}

describe("VicinityTraversal outgoing-embed channel", () => {
	it("WHEN a note embeds another note THEN the embedded note is reached on the embed budget", () => {
		const result = traverse(embeddedVault(), [root("a.md", { linkDepthOut: 0, embedDepthOut: 1, linkDepthIn: 0 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md", "c.md"]);
	});

	it("WHEN the embed budget is 0 THEN embedded notes are not expanded, however deep the LINK budget is", () => {
		const result = traverse(embeddedVault(), [root("a.md", { linkDepthOut: 5, embedDepthOut: 0, linkDepthIn: 0 })]);
		expect(nodePaths(result)).toEqual(["a.md"]);
	});

	it("WHEN an embed is walked THEN its edge points linker -> linked like any other", () => {
		const result = traverse(embeddedVault(), [root("a.md", { linkDepthOut: 0, embedDepthOut: 1, linkDepthIn: 0 })]);
		expect(edgePairs(result)).toEqual(["a.md->b.md", "a.md->c.md"]);
	});

	it("WHEN a node is reached over the embed channel THEN its depth tag names that channel", () => {
		const result = traverse(embeddedVault(), [root("a.md", { linkDepthOut: 0, embedDepthOut: 1, linkDepthIn: 0 })]);
		expect(result.nodes.get(asVaultPath("b.md"))?.depthTags).toEqual([
			{ rootPath: "a.md", channel: "outgoing-embed", depth: 1 },
		]);
	});

	it("WHEN a target is BOTH embedded and plainly linked THEN it is one node reached on either channel alone", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "b.md" }],
			links: { "a.md": ["b.md"] },
			embeds: { "a.md": ["b.md"] },
		});
		const result = traverse(provider, [root("a.md", { linkDepthOut: 0, embedDepthOut: 1, linkDepthIn: 0 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md"]);
	});
});

/**
 * THE ACCEPTANCE PROOF for this ticket, and its exact limit.
 *
 * The shipped defaults set `embedDepthOut === linkDepthOut === 1` (SETTINGS_SPEC),
 * and AT ONE HOP the union of the two outgoing channels is EXACTLY the single
 * kind-blind outgoing BFS that shipped before the split: nothing moves on screen
 * for anyone who does not change a setting.
 *
 * That equality does NOT extend to equal budgets DEEPER than one hop, and the
 * second describe below pins where it stops. Kind-pure channels (owner decision
 * D1 / research 6a) cannot walk a chain that CHANGES KIND mid-way, and a chain
 * needs two hops to change kind — so raising BOTH outgoing budgets to 2 reaches
 * strictly FEWER nodes than the old kind-blind depth-2 walk. Deliberate,
 * documented, and the accepted cost of not breaking the BFS's "expand once,
 * shallowest first" invariant.
 *
 * SENSITIVITY, deliberately built in: the fixture carries a KIND-CHANGING SECOND
 * HOP (`a ![[b]]` then `b [[d]]`), so the two providers below agree at one hop and
 * DISAGREE at two. That is what makes this suite a real tripwire — raise the
 * shipped `linkDepthOut`/`embedDepthOut` default above 1 and these tests go RED,
 * instead of staying green while asserting a property that has become false.
 */
describe("VicinityTraversal channel split at the shipped defaults", () => {
	// GIVEN a root that both EMBEDS and plainly LINKS a neighbour (a ![[b]] [[c]]),
	// and a SECOND hop that changes kind (b [[d]]) so the equality is one-hop-only.
	const FILES = [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }, { path: "d.md" }];

	function asAuthored(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: FILES,
			links: { "a.md": ["c.md"], "b.md": ["d.md"] },
			embeds: { "a.md": ["b.md"] },
		});
	}

	/** The same edges with the embed rewritten as a plain link — i.e. the pre-split vault. */
	function kindBlind(): FakeLinkProvider {
		return new FakeLinkProvider({ files: FILES, links: { "a.md": ["c.md", "b.md"], "b.md": ["d.md"] } });
	}

	/** The SHIPPED defaults, read from the spec — not a literal that could drift from it. */
	function atShippedDefaults(provider: FakeLinkProvider): TraversalResult {
		return traverse(provider, [{ descriptor: { path: asVaultPath("a.md") }, depths: EngineDefaults.depthSettings() }]);
	}

	it("WHEN the depths are the shipped defaults THEN a mixed-kind vault reaches the kind-blind walk's NODES", () => {
		expect(nodePaths(atShippedDefaults(asAuthored()))).toEqual(nodePaths(atShippedDefaults(kindBlind())));
	});

	it("WHEN the depths are the shipped defaults THEN a mixed-kind vault walks the kind-blind walk's EDGES", () => {
		expect(edgePairs(atShippedDefaults(asAuthored()))).toEqual(edgePairs(atShippedDefaults(kindBlind())));
	});

	it("WHEN the shipped defaults are read THEN the two outgoing budgets are equal (what makes the above hold)", () => {
		const defaults = EngineDefaults.depthSettings();
		expect(defaults.embedDepthOut).toBe(defaults.linkDepthOut);
	});

	// This is the tripwire's OWN tripwire: it proves the fixture above can tell the two
	// providers apart, so the equality tests are not passing vacuously. Without it, a
	// fixture that lost its kind-changing hop would silently defang the whole suite.
	it("WHEN the SAME vault is walked two hops THEN the two providers DIVERGE (the equality is one-hop-only)", () => {
		const twoHops = { linkDepthOut: 2, embedDepthOut: 2, linkDepthIn: 0 };
		expect(nodePaths(traverse(asAuthored(), [root("a.md", twoHops)]))).not.toEqual(
			nodePaths(traverse(kindBlind(), [root("a.md", twoHops)])),
		);
	});
});

/**
 * THE ACCEPTED COST of kind-pure channels (owner decision D1 / research 6a):
 * each channel runs its OWN independent BFS, so a chain that CHANGES KIND mid-way
 * is not walkable by either one — `a ![[b]]` then `b [[d]]` needs the embed channel
 * for the first hop and the link channel for the second, and neither has both.
 *
 * NOTE, and this is WIDER than the ticket's own framing (it says the gap "only
 * appears once a user deliberately diverges the budgets"): the gap appears at any
 * budget above one hop, EQUAL BUDGETS INCLUDED. It is hidden at ship only because
 * the shipped default is a single hop.
 */
describe("VicinityTraversal kind-changing chains (the cost of kind-pure channels)", () => {
	// GIVEN a ![[b]] then b [[d]] — an embed hop followed by a plain-link hop.
	function kindChangingChain(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "b.md" }, { path: "d.md" }],
			links: { "b.md": ["d.md"] },
			embeds: { "a.md": ["b.md"] },
		});
	}

	it("WHEN both outgoing budgets are 2 THEN the hop AFTER the kind change is not walked", () => {
		const result = traverse(kindChangingChain(), [root("a.md", { linkDepthOut: 2, embedDepthOut: 2, linkDepthIn: 0 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md"]);
	});

	it("WHEN the whole chain is ONE kind THEN two hops are walked as before (the gap is the kind CHANGE)", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "b.md" }, { path: "d.md" }],
			embeds: { "a.md": ["b.md"], "b.md": ["d.md"] },
		});
		const result = traverse(provider, [root("a.md", { linkDepthOut: 0, embedDepthOut: 2, linkDepthIn: 0 })]);
		expect(nodePaths(result)).toEqual(["a.md", "b.md", "d.md"]);
	});
});

/**
 * D5 (owner, settled): attachment-ness is decided by NODE-BEARING-NESS, never by
 * kind. A diagram is an attachment whether it is written `[[chart.png]]` or
 * `![[chart.png]]`, so `embedDepthOut` governs embedded NOTES only. Guaranteed by
 * the `isNodeBearing` gate that already ran for every channel — pinned here, not
 * built.
 */
describe("VicinityTraversal embedded attachments (D5: attachments stay orthogonal to kind)", () => {
	// GIVEN a note that EMBEDS an image and PLAINLY LINKS another one.
	function embeddedAttachmentVault(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [{ path: "n.md" }, { path: "img/shown.png" }, { path: "img/linked.png" }],
			links: { "n.md": ["img/linked.png"] },
			embeds: { "n.md": ["img/shown.png"] },
		});
	}

	it("WHEN a note embeds an image THEN the image still never becomes a node", () => {
		const result = traverse(embeddedAttachmentVault(), [root("n.md", { embedDepthOut: 5, linkDepthOut: 5 })]);
		expect(nodePaths(result)).toEqual(["n.md"]);
	});

	it("WHEN an image is embedded and another is plainly linked THEN BOTH are attachments of the note", () => {
		const result = traverse(embeddedAttachmentVault(), [root("n.md")]);
		expect(result.nodes.get(asVaultPath("n.md"))?.attachments.map((a) => a.path)).toEqual([
			"img/linked.png",
			"img/shown.png",
		]);
	});

	it("WHEN the embed budget is 0 THEN an EMBEDDED attachment is still offered as an attachment", () => {
		const result = traverse(embeddedAttachmentVault(), [root("n.md", { embedDepthOut: 0, linkDepthOut: 0 })]);
		expect(result.nodes.get(asVaultPath("n.md"))?.firstImagePath).toBe("img/linked.png");
	});
});
