import { describe, expect, it } from "vitest";
import { asVaultPath, asFolderPath } from "../engine";
import { vicinityGraphToFlow, withGroupDimensions } from "./flowMapping";
import type { FlowNode, NoteFlowNode } from "./flowMapping";
import { makeEdge, makeEmbedEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

/**
 * Embed nesting (P3) — the flow-mapping half: nested notes get `parentId =
 * container`, nesting wins over folder grouping (Q4), edges to nested nodes
 * collapse onto the outermost container while intra-tree edges are dropped (Q5),
 * a losing embedder outside the winner's tree keeps its collapsed edge (Q6), and
 * the ordering keeps every parent before its children.
 */

function toFlow(graph: Parameters<typeof vicinityGraphToFlow>[0]) {
	return vicinityGraphToFlow(graph, false);
}

function note(nodes: readonly FlowNode[], id: string): NoteFlowNode | undefined {
	const found = nodes.find((node) => node.id === id);
	return found?.kind === "note" ? found : undefined;
}

describe("vicinityGraphToFlow nesting parentIds", () => {
	it("WHEN a note is embedded THEN it nests inside its container (parentId = container path)", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("hub.md") }), makeNode({ path: asVaultPath("child.md") })],
			edges: [makeEmbedEdge("hub.md", "child.md", 0)],
		});
		expect(note(toFlow(graph).nodes, "child.md")?.parentId).toBe("hub.md");
	});

	it("WHEN a note is a root container THEN it has no parent of its own", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("hub.md") }), makeNode({ path: asVaultPath("child.md") })],
			edges: [makeEmbedEdge("hub.md", "child.md", 0)],
		});
		expect(note(toFlow(graph).nodes, "hub.md")?.parentId).toBeUndefined();
	});

	it("WHEN a nested note shares a folder with its container THEN it LEAVES the folder group (Q4)", () => {
		// notes/a embeds notes/b; b nests under a, so only a remains a plain member —
		// below MIN_GROUP_MEMBER_COUNT, so the folder does not render as a group.
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes") }),
			],
			edges: [makeEmbedEdge("notes/a.md", "notes/b.md", 0)],
		});
		const nodes = toFlow(graph).nodes;
		expect(nodes.some((node) => node.kind === "folder-group")).toBe(false);
		expect(note(nodes, "notes/b.md")?.parentId).toBe("notes/a.md");
	});

	it("WHEN a container is a folder-group member THEN the chain is group → container → nested", () => {
		// Two roots in `notes` (c1, c2) form the group; c1 embeds an outside note n,
		// which nests under c1. So c1 parents to the group, n parents to c1.
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("notes/c1.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("notes/c2.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("ext/n.md"), folder: asFolderPath("ext") }),
			],
			edges: [makeEmbedEdge("notes/c1.md", "ext/n.md", 0)],
		});
		const nodes = toFlow(graph).nodes;
		expect(note(nodes, "notes/c1.md")?.parentId).toBe("folder-group:notes");
		expect(note(nodes, "ext/n.md")?.parentId).toBe("notes/c1.md");
	});
});

describe("vicinityGraphToFlow nesting node ordering (React Flow parent-first)", () => {
	it("WHEN nodes are emitted THEN every container precedes its nested subtree", () => {
		// hub → mid → leaf (a chain two deep), emitted parent-first.
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("leaf.md") }),
				makeNode({ path: asVaultPath("mid.md") }),
				makeNode({ path: asVaultPath("hub.md") }),
			],
			edges: [makeEmbedEdge("hub.md", "mid.md", 0), makeEmbedEdge("mid.md", "leaf.md", 0)],
		});
		const ids = toFlow(graph).nodes.map((node) => node.id);
		expect(ids.indexOf("hub.md")).toBeLessThan(ids.indexOf("mid.md"));
		expect(ids.indexOf("mid.md")).toBeLessThan(ids.indexOf("leaf.md"));
	});

	it("WHEN a container sits in a folder group THEN the group precedes the container", () => {
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("notes/c1.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("notes/c2.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("ext/n.md"), folder: asFolderPath("ext") }),
			],
			edges: [makeEmbedEdge("notes/c1.md", "ext/n.md", 0)],
		});
		const ids = toFlow(graph).nodes.map((node) => node.id);
		expect(ids.indexOf("folder-group:notes")).toBeLessThan(ids.indexOf("notes/c1.md"));
		expect(ids.indexOf("notes/c1.md")).toBeLessThan(ids.indexOf("ext/n.md"));
	});

	it("WHEN children have an embed order THEN they are emitted in that order", () => {
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("hub.md") }),
				makeNode({ path: asVaultPath("first.md") }),
				makeNode({ path: asVaultPath("second.md") }),
			],
			// second embedded before first in the SOURCE order would still order by embedOrder.
			edges: [makeEmbedEdge("hub.md", "second.md", 1), makeEmbedEdge("hub.md", "first.md", 0)],
		});
		const ids = toFlow(graph).nodes.map((node) => node.id);
		expect(ids.indexOf("first.md")).toBeLessThan(ids.indexOf("second.md"));
	});
});

describe("vicinityGraphToFlow nesting edge collapse (Q5/Q6)", () => {
	it("WHEN an edge lies inside a nesting tree THEN it is dropped (ancestor↔descendant)", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("hub.md") }), makeNode({ path: asVaultPath("child.md") })],
			edges: [makeEmbedEdge("hub.md", "child.md", 0)],
		});
		expect(toFlow(graph).edges).toHaveLength(0);
	});

	it("WHEN two siblings share a container THEN a link between them is dropped (Q5, no intra-tree edges)", () => {
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("hub.md") }),
				makeNode({ path: asVaultPath("a.md") }),
				makeNode({ path: asVaultPath("b.md") }),
			],
			edges: [
				makeEmbedEdge("hub.md", "a.md", 0),
				makeEmbedEdge("hub.md", "b.md", 1),
				makeEdge("a.md", "b.md"),
			],
		});
		expect(toFlow(graph).edges).toHaveLength(0);
	});

	it("WHEN an outside note links a nested note THEN the edge attaches to the outermost container", () => {
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("hub.md") }),
				makeNode({ path: asVaultPath("child.md") }),
				makeNode({ path: asVaultPath("ext.md") }),
			],
			edges: [makeEmbedEdge("hub.md", "child.md", 0), makeEdge("ext.md", "child.md")],
		});
		const edges = toFlow(graph).edges;
		expect(edges).toHaveLength(1);
		expect({ source: edges[0]?.source, target: edges[0]?.target }).toEqual({ source: "ext.md", target: "hub.md" });
	});

	it("WHEN an edge attaches to a container THEN the link preview keeps the TRUE nested pair", () => {
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("hub.md") }),
				makeNode({ path: asVaultPath("child.md") }),
				makeNode({ path: asVaultPath("ext.md") }),
			],
			edges: [makeEmbedEdge("hub.md", "child.md", 0), makeEdge("ext.md", "child.md")],
		});
		expect(toFlow(graph).edges[0]?.notePairs).toEqual([{ source: "ext.md", target: "child.md" }]);
	});

	it("WHEN an intra-group edge touches a NESTED node THEN it attaches member-root to member-root (matches elk)", () => {
		// notes/c1 + notes/c2 form the group; c1 embeds ext/x. ext/x → notes/c2
		// projects both endpoints onto the SAME group, but the drawn edge must use
		// the member roots (c1 → c2) — exactly what elkMapping hands elk — never
		// the buried nested node.
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("notes/c1.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("notes/c2.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("ext/x.md"), folder: asFolderPath("ext") }),
			],
			edges: [makeEmbedEdge("notes/c1.md", "ext/x.md", 0), makeEdge("ext/x.md", "notes/c2.md")],
		});
		const edges = toFlow(graph).edges;
		expect(edges).toHaveLength(1);
		expect({ source: edges[0]?.source, target: edges[0]?.target }).toEqual({
			source: "notes/c1.md",
			target: "notes/c2.md",
		});
		expect(edges[0]?.notePairs).toEqual([{ source: "ext/x.md", target: "notes/c2.md" }]);
	});

	it("WHEN an intra-group edge joins PLAIN members (no nesting) THEN it stays member-to-member passthrough", () => {
		// The pre-nesting intra-group rule is untouched: c1 → c2 keeps its raw
		// endpoints and its passthrough identity.
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("notes/c1.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("notes/c2.md"), folder: asFolderPath("notes") }),
			],
			edges: [makeEdge("notes/c1.md", "notes/c2.md")],
		});
		const edges = toFlow(graph).edges;
		expect(edges).toHaveLength(1);
		expect({ source: edges[0]?.source, target: edges[0]?.target }).toEqual({
			source: "notes/c1.md",
			target: "notes/c2.md",
		});
	});

	it("WHEN a self-loop sits on a NESTED node THEN it is dropped (wholly inside the tree, Q5)", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("hub.md") }), makeNode({ path: asVaultPath("child.md") })],
			edges: [makeEmbedEdge("hub.md", "child.md", 0), makeEdge("child.md", "child.md")],
		});
		expect(toFlow(graph).edges).toHaveLength(0);
	});

	it("WHEN a losing embedder is OUTSIDE the winner's tree THEN it keeps a collapsed edge to the winner (Q6)", () => {
		// MAIN winner and a regular loser both embed child; child nests under MAIN
		// (precedence). The loser's embed edge collapses onto the winner's tree root.
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("winner.md"), isMain: true, isCentral: true }),
				makeNode({ path: asVaultPath("loser.md") }),
				makeNode({ path: asVaultPath("child.md") }),
			],
			edges: [makeEmbedEdge("winner.md", "child.md", 0), makeEmbedEdge("loser.md", "child.md", 0)],
		});
		const edges = toFlow(graph).edges;
		expect(edges).toHaveLength(1);
		expect({ source: edges[0]?.source, target: edges[0]?.target }).toEqual({
			source: "loser.md",
			target: "winner.md",
		});
		expect(edges[0]?.notePairs).toEqual([{ source: "loser.md", target: "child.md" }]);
	});
});

describe("vicinityGraphToFlow merged rendered pairs (raw + projected edges on ONE pair)", () => {
	// React Flow keys edges by id, so two rendered edges must never share a
	// source->target pair: when a nesting-projected edge lands on the same
	// rendered pair as a raw engine edge, they merge into ONE collapsed edge.

	it("WHEN a plain member edge coincides with a nested-projected edge THEN ONE collapsed edge carries both true pairs", () => {
		// notes/c1 + notes/c2 group; c1 embeds ext/x. Raw c1 → c2 AND projected
		// x → c2 both render between the member roots c1 and c2.
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("notes/c1.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("notes/c2.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("ext/x.md"), folder: asFolderPath("ext") }),
			],
			edges: [
				makeEmbedEdge("notes/c1.md", "ext/x.md", 0),
				makeEdge("notes/c1.md", "notes/c2.md"),
				makeEdge("ext/x.md", "notes/c2.md"),
			],
		});
		const edges = toFlow(graph).edges;
		expect(edges).toHaveLength(1);
		expect(edges[0]?.notePairs).toEqual([
			{ source: "notes/c1.md", target: "notes/c2.md" },
			{ source: "ext/x.md", target: "notes/c2.md" },
		]);
	});

	it("WHEN a raw edge to a container coincides with an edge projected ONTO that container THEN one edge renders", () => {
		// ext → hub (raw) and ext → child (projects to ext → hub) share the pair.
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("hub.md") }),
				makeNode({ path: asVaultPath("child.md") }),
				makeNode({ path: asVaultPath("ext.md") }),
			],
			edges: [
				makeEmbedEdge("hub.md", "child.md", 0),
				makeEdge("ext.md", "hub.md"),
				makeEdge("ext.md", "child.md"),
			],
		});
		const edges = toFlow(graph).edges;
		expect(edges).toHaveLength(1);
		expect(edges[0]?.count).toBe(2);
	});

	it("WHEN the raw and projected contributors disagree on direction THEN the merged edge is bidirectional", () => {
		// hub → ext raw; ext → child projects to ext → hub — opposite directions
		// union into one double-arrowed edge, never two overlapping edges.
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("hub.md") }),
				makeNode({ path: asVaultPath("child.md") }),
				makeNode({ path: asVaultPath("ext.md") }),
			],
			edges: [
				makeEmbedEdge("hub.md", "child.md", 0),
				makeEdge("hub.md", "ext.md"),
				makeEdge("ext.md", "child.md"),
			],
		});
		const edges = toFlow(graph).edges;
		expect(edges).toHaveLength(1);
		expect(edges[0]?.bidirectional).toBe(true);
	});
});

describe("vicinityGraphToFlow nesting node data + sizing", () => {
	it("WHEN a note embeds another THEN its data marks it a container", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("hub.md") }), makeNode({ path: asVaultPath("child.md") })],
			edges: [makeEmbedEdge("hub.md", "child.md", 0)],
		});
		expect(note(toFlow(graph).nodes, "hub.md")?.data.isContainer).toBe(true);
		expect(note(toFlow(graph).nodes, "hub.md")?.data.isNested).toBe(false);
	});

	it("WHEN a note is embedded THEN its data marks it nested", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("hub.md") }), makeNode({ path: asVaultPath("child.md") })],
			edges: [makeEmbedEdge("hub.md", "child.md", 0)],
		});
		expect(note(toFlow(graph).nodes, "child.md")?.data.isNested).toBe(true);
		expect(note(toFlow(graph).nodes, "child.md")?.data.isContainer).toBe(false);
	});

	it("WHEN a nested note has a stored size override THEN it advertises NO effective override (Q8: ignored while nested)", () => {
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("hub.md") }),
				makeNode({
					path: asVaultPath("child.md"),
					override: { sizePx: { widthPx: 300, heightPx: 300 } },
				}),
			],
			edges: [makeEmbedEdge("hub.md", "child.md", 0)],
		});
		const child = note(toFlow(graph).nodes, "child.md");
		expect(child?.data.hasSizeOverride).toBe(false);
		// Its box is content-fit (the 300px override is ignored while nested).
		expect(child?.height).not.toBe(300);
	});
});

describe("withGroupDimensions sizes embed containers", () => {
	it("WHEN elk sized a container THEN its note node takes the wrapped dimensions", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("hub.md") }), makeNode({ path: asVaultPath("child.md") })],
			edges: [makeEmbedEdge("hub.md", "child.md", 0)],
		});
		const sized = withGroupDimensions(toFlow(graph).nodes, new Map([["hub.md", { width: 400, height: 700 }]]));
		expect({ width: note(sized, "hub.md")?.width, height: note(sized, "hub.md")?.height }).toEqual({
			width: 400,
			height: 700,
		});
	});

	it("WHEN a leaf child gets an elk dimension THEN withGroupDimensions leaves it at its mapping box", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("hub.md") }), makeNode({ path: asVaultPath("child.md"), sizePx: 120 })],
			edges: [makeEmbedEdge("hub.md", "child.md", 0)],
		});
		const before = note(toFlow(graph).nodes, "child.md")?.height;
		const sized = withGroupDimensions(toFlow(graph).nodes, new Map([["child.md", { width: 999, height: 999 }]]));
		expect(note(sized, "child.md")?.height).toBe(before);
	});
});
