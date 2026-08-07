import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import { deriveNestingForest } from "./embedNesting";
import { makeEmbedEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

/**
 * BDD coverage of the embed-nesting forest (ticket
 * nid_1moqnutin09drbiyxkd3l7r5k_e). Each origin-ticket scenario is one behavior:
 * precedence (central > pinned > regular), the never-nested constraints, ties,
 * SCC-excluded cycles, and embedOrder child ordering.
 */

/** Container (direct embedder) chosen for a rendered node, or undefined when standalone. */
function containerOf(graph: Parameters<typeof deriveNestingForest>[0], path: string): string | undefined {
	return deriveNestingForest(graph).nestingByPath.get(path)?.containerPath;
}

/** Outermost container (tree root) of a rendered node — itself when standalone. */
function outermostOf(graph: Parameters<typeof deriveNestingForest>[0], path: string): string | undefined {
	return deriveNestingForest(graph).nestingByPath.get(path)?.outermostPath;
}

/** Ordered nested children of a rendered node. */
function childrenOf(graph: Parameters<typeof deriveNestingForest>[0], path: string): readonly string[] {
	return deriveNestingForest(graph).nestingByPath.get(path)?.childPaths ?? [];
}

const main = (path: string) => makeNode({ path: asVaultPath(path), isCentral: true, isMain: true });
const pinned = (path: string, minDepth = 1) =>
	makeNode({ path: asVaultPath(path), isCentral: true, isMain: false, minDepth });
const regular = (path: string, minDepth = 1) => makeNode({ path: asVaultPath(path), minDepth });

describe("deriveNestingForest embed chain", () => {
	// GIVEN n1 embeds n2 embeds n3 (a linear embed chain).
	const chain = makeGraph({
		nodes: [main("n1.md"), regular("n2.md"), regular("n3.md")],
		edges: [makeEmbedEdge("n1.md", "n2.md", 0), makeEmbedEdge("n2.md", "n3.md", 0)],
	});

	it("WHEN a note embeds a note that embeds a note THEN the deepest note's container is its direct embedder", () => {
		expect(containerOf(chain, "n3.md")).toBe("n2.md");
	});

	it("WHEN a linear embed chain nests THEN the outermost container of every link is the chain head", () => {
		expect(outermostOf(chain, "n3.md")).toBe("n1.md");
	});

	it("WHEN a note is a nesting-tree root THEN its own outermost container is itself", () => {
		expect(outermostOf(chain, "n1.md")).toBe("n1.md");
	});
});

describe("deriveNestingForest precedence", () => {
	it("WHEN a node is embedded by main, a pin and a regular THEN main wins the container", () => {
		const graph = makeGraph({
			nodes: [main("m.md"), pinned("p.md"), regular("r.md"), regular("child.md")],
			edges: [
				makeEmbedEdge("m.md", "child.md", 0),
				makeEmbedEdge("p.md", "child.md", 0),
				makeEmbedEdge("r.md", "child.md", 0),
			],
		});
		expect(containerOf(graph, "child.md")).toBe("m.md");
	});

	it("WHEN a node is embedded by a pin and a regular THEN the pin beats the regular", () => {
		const graph = makeGraph({
			nodes: [pinned("p.md"), regular("r.md"), regular("child.md")],
			edges: [makeEmbedEdge("p.md", "child.md", 0), makeEmbedEdge("r.md", "child.md", 0)],
		});
		expect(containerOf(graph, "child.md")).toBe("p.md");
	});

	it("WHEN two same-rank embedders tie THEN the smaller minDepth wins", () => {
		const graph = makeGraph({
			nodes: [regular("near.md", 1), regular("far.md", 3), regular("child.md")],
			edges: [makeEmbedEdge("far.md", "child.md", 0), makeEmbedEdge("near.md", "child.md", 0)],
		});
		expect(containerOf(graph, "child.md")).toBe("near.md");
	});

	it("WHEN two same-rank same-depth embedders tie THEN lexicographic path breaks it", () => {
		const graph = makeGraph({
			nodes: [regular("b.md", 2), regular("a.md", 2), regular("child.md")],
			edges: [makeEmbedEdge("b.md", "child.md", 0), makeEmbedEdge("a.md", "child.md", 0)],
		});
		expect(containerOf(graph, "child.md")).toBe("a.md");
	});
});

describe("deriveNestingForest never-nested constraints", () => {
	it("WHEN the main node is embedded by another node THEN main is never nested", () => {
		const graph = makeGraph({
			nodes: [main("m.md"), regular("r.md")],
			edges: [makeEmbedEdge("r.md", "m.md", 0)],
		});
		expect(containerOf(graph, "m.md")).toBeUndefined();
	});

	it("WHEN a pinned node is embedded only by a regular node THEN it renders standalone", () => {
		const graph = makeGraph({
			nodes: [pinned("p.md"), regular("r.md")],
			edges: [makeEmbedEdge("r.md", "p.md", 0)],
		});
		expect(containerOf(graph, "p.md")).toBeUndefined();
	});

	it("WHEN a pinned node is embedded by main THEN it may nest under main", () => {
		const graph = makeGraph({
			nodes: [main("m.md"), pinned("p.md")],
			edges: [makeEmbedEdge("m.md", "p.md", 0)],
		});
		expect(containerOf(graph, "p.md")).toBe("m.md");
	});

	it("WHEN a pinned node is embedded by another pin THEN it may nest under that pin", () => {
		const graph = makeGraph({
			nodes: [pinned("outer.md"), pinned("inner.md")],
			edges: [makeEmbedEdge("outer.md", "inner.md", 0)],
		});
		expect(containerOf(graph, "inner.md")).toBe("outer.md");
	});
});

describe("deriveNestingForest losing embedder", () => {
	// GIVEN main and a regular both embed the child; main wins.
	const graph = makeGraph({
		nodes: [main("m.md"), regular("r.md"), regular("child.md")],
		edges: [makeEmbedEdge("m.md", "child.md", 0), makeEmbedEdge("r.md", "child.md", 0)],
	});

	it("WHEN an embedder loses the container race THEN it does not claim the child as a nested child", () => {
		expect(childrenOf(graph, "r.md")).not.toContain("child.md");
	});

	it("WHEN an embedder loses the container race THEN the winner owns the nested child", () => {
		expect(childrenOf(graph, "m.md")).toContain("child.md");
	});
});

describe("deriveNestingForest cycles are SCC-excluded", () => {
	const mutual = (edges: ReturnType<typeof makeEmbedEdge>[]) =>
		makeGraph({ nodes: [regular("a.md"), regular("b.md")], edges });
	const abEdges = [makeEmbedEdge("a.md", "b.md", 0), makeEmbedEdge("b.md", "a.md", 0)];

	it("WHEN two notes mutually embed THEN neither nests (a→b order)", () => {
		const graph = mutual(abEdges);
		expect(containerOf(graph, "a.md")).toBeUndefined();
		expect(containerOf(graph, "b.md")).toBeUndefined();
	});

	it("WHEN two notes mutually embed THEN neither nests regardless of edge input order (b→a first)", () => {
		const graph = mutual([abEdges[1]!, abEdges[0]!]);
		expect(containerOf(graph, "a.md")).toBeUndefined();
		expect(containerOf(graph, "b.md")).toBeUndefined();
	});

	it("WHEN a note inside an embed cycle is embedded from outside the cycle THEN it nests under the outsider", () => {
		const graph = makeGraph({
			nodes: [regular("out.md"), regular("a.md"), regular("b.md")],
			edges: [
				makeEmbedEdge("a.md", "b.md", 0),
				makeEmbedEdge("b.md", "a.md", 0),
				makeEmbedEdge("out.md", "a.md", 0),
			],
		});
		expect(containerOf(graph, "a.md")).toBe("out.md");
	});

	it("WHEN a note inside an embed cycle also has an outside embedder THEN the intra-cycle edge still nests nothing", () => {
		const graph = makeGraph({
			nodes: [regular("out.md"), regular("a.md"), regular("b.md")],
			edges: [
				makeEmbedEdge("a.md", "b.md", 0),
				makeEmbedEdge("b.md", "a.md", 0),
				makeEmbedEdge("out.md", "a.md", 0),
			],
		});
		expect(containerOf(graph, "b.md")).toBeUndefined();
	});

	it("WHEN a note embeds itself THEN it never nests", () => {
		const graph = makeGraph({
			nodes: [regular("self.md")],
			edges: [makeEmbedEdge("self.md", "self.md", 0)],
		});
		expect(containerOf(graph, "self.md")).toBeUndefined();
	});
});

describe("deriveNestingForest child order", () => {
	it("WHEN a container embeds children THEN they are ordered by embedOrder, not path", () => {
		// c1 comes first by path but second by embedOrder — embedOrder must win.
		const graph = makeGraph({
			nodes: [main("m.md"), regular("c1.md"), regular("c2.md")],
			edges: [makeEmbedEdge("m.md", "c1.md", 1), makeEmbedEdge("m.md", "c2.md", 0)],
		});
		expect(childrenOf(graph, "m.md")).toEqual(["c2.md", "c1.md"]);
	});

	it("WHEN two children share an embedOrder THEN lexicographic path breaks the tie", () => {
		const graph = makeGraph({
			nodes: [main("m.md"), regular("b.md"), regular("a.md")],
			edges: [makeEmbedEdge("m.md", "b.md", 0), makeEmbedEdge("m.md", "a.md", 0)],
		});
		expect(childrenOf(graph, "m.md")).toEqual(["a.md", "b.md"]);
	});
});

describe("deriveNestingForest edge kinds", () => {
	it("WHEN an embedder relates as 'both' (embeds AND links) THEN it still nests the target", () => {
		const graph = makeGraph({
			nodes: [main("m.md"), regular("child.md")],
			edges: [makeEmbedEdge("m.md", "child.md", 0, "both")],
		});
		expect(containerOf(graph, "child.md")).toBe("m.md");
	});

	it("WHEN a pair is a plain link (kind 'link') THEN it never nests", () => {
		const graph = makeGraph({
			nodes: [main("m.md"), regular("child.md")],
			// A plain-link edge carries no embedOrder and must not create nesting.
			edges: [{ source: asVaultPath("m.md"), target: asVaultPath("child.md"), count: 1, kind: "link" }],
		});
		expect(containerOf(graph, "child.md")).toBeUndefined();
	});
});

describe("deriveNestingForest determinism", () => {
	it("WHEN deriving twice from the same graph THEN the forests are identical", () => {
		const graph = makeGraph({
			nodes: [main("m.md"), regular("c1.md"), regular("c2.md")],
			edges: [makeEmbedEdge("m.md", "c1.md", 1), makeEmbedEdge("m.md", "c2.md", 0)],
		});
		expect(deriveNestingForest(graph)).toEqual(deriveNestingForest(graph));
	});
});
