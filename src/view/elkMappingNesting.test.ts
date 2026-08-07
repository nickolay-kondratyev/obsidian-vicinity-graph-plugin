import type { ElkNode } from "elkjs";
import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "./elkMapping";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { makeEdge, makeEmbedEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

/**
 * Embed nesting (P3) — the elk-mapping half: a container becomes a COMPOUND elk
 * node whose nested children stack vertically, its box auto-sizes to hold them
 * plus its own-content top band, and intra-tree edges never reach elk. The real
 * elk run (elkjs is headless under Node) proves the sizing/position extraction.
 */

/** Depth-first search for the elk node with `id`, or undefined. */
function findElk(node: ElkNode, id: string): ElkNode | undefined {
	if (node.id === id) {
		return node;
	}
	for (const child of node.children ?? []) {
		const found = findElk(child, id);
		if (found !== undefined) {
			return found;
		}
	}
	return undefined;
}

/** The elk node whose `children` array directly contains `id`, or undefined. */
function parentOfElk(node: ElkNode, id: string): ElkNode | undefined {
	for (const child of node.children ?? []) {
		if (child.id === id) {
			return node;
		}
		const deeper = parentOfElk(child, id);
		if (deeper !== undefined) {
			return deeper;
		}
	}
	return undefined;
}

const nestedGraph = () =>
	makeGraph({
		nodes: [makeNode({ path: asVaultPath("hub.md"), sizePx: 120 }), makeNode({ path: asVaultPath("child.md") })],
		edges: [makeEmbedEdge("hub.md", "child.md", 0)],
	});

describe("vicinityGraphToElk nesting structure", () => {
	it("WHEN a note embeds another THEN it becomes a compound elk node holding the nested child", () => {
		const root = vicinityGraphToElk(nestedGraph());
		expect(parentOfElk(root, "child.md")?.id).toBe("hub.md");
	});

	it("WHEN a note embeds another THEN the nested child is NOT a direct root child", () => {
		const root = vicinityGraphToElk(nestedGraph());
		expect(root.children?.some((child) => child.id === "child.md")).toBe(false);
	});

	it("WHEN a container is built THEN it lays its children out vertically (layered DOWN)", () => {
		const container = findElk(vicinityGraphToElk(nestedGraph()), "hub.md");
		expect(container?.layoutOptions?.["elk.algorithm"]).toBe("layered");
		expect(container?.layoutOptions?.["elk.direction"]).toBe("DOWN");
	});

	it("WHEN two children nest THEN an ordering chain edge links them so the stack keeps order", () => {
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("hub.md") }),
				makeNode({ path: asVaultPath("a.md") }),
				makeNode({ path: asVaultPath("b.md") }),
			],
			edges: [makeEmbedEdge("hub.md", "a.md", 0), makeEmbedEdge("hub.md", "b.md", 1)],
		});
		const container = findElk(vicinityGraphToElk(graph), "hub.md");
		expect(container?.edges).toEqual([
			expect.objectContaining({ sources: ["a.md"], targets: ["b.md"] }),
		]);
	});

	it("WHEN an edge lies inside the nesting tree THEN it reaches elk NOWHERE (dropped, Q5)", () => {
		// hub → child is intra-tree: not on the container (only the ordering chain is),
		// not on the root.
		const root = vicinityGraphToElk(nestedGraph());
		const container = findElk(root, "hub.md");
		const edgeIds = [...(root.edges ?? []), ...(container?.edges ?? [])].map((edge) => edge.id);
		expect(edgeIds).not.toContain("hub.md->child.md");
	});

	it("WHEN an outside note links a nested note THEN a projected root edge points at the container", () => {
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("hub.md") }),
				makeNode({ path: asVaultPath("child.md") }),
				makeNode({ path: asVaultPath("ext.md") }),
			],
			edges: [makeEmbedEdge("hub.md", "child.md", 0), makeEdge("ext.md", "child.md")],
		});
		const rootEdges = vicinityGraphToElk(graph).edges ?? [];
		const endpoints = rootEdges.flatMap((edge) => [...(edge.sources ?? []), ...(edge.targets ?? [])]);
		expect(endpoints).toContain("hub.md");
		expect(endpoints).not.toContain("child.md");
	});
});

describe("vicinityGraphToElk nesting layout (real elk)", () => {
	it("WHEN elk lays out a container THEN its box is larger than its own content (wraps the child)", async () => {
		const laidOut = await new ElkLayoutRunner().layout(vicinityGraphToElk(nestedGraph()));
		const container = extractElkDimensionsById(laidOut).get("hub.md");
		// Own content height was 120; the box must grow to also hold the child stack.
		expect(container?.height ?? 0).toBeGreaterThan(120);
	});

	it("WHEN elk lays out a container THEN the nested child gets an absolute position (extractElkPositions covers it)", async () => {
		const laidOut = await new ElkLayoutRunner().layout(vicinityGraphToElk(nestedGraph()));
		expect(extractElkPositions(laidOut).has("child.md")).toBe(true);
	});

	it("WHEN elk stacks the child THEN it sits BELOW the container's reserved own-content band", async () => {
		const laidOut = await new ElkLayoutRunner().layout(vicinityGraphToElk(nestedGraph()));
		const positions = extractElkPositions(laidOut);
		const hub = positions.get("hub.md");
		const child = positions.get("child.md");
		// Child's absolute top is below the container's own-content height (120px).
		expect((child?.y ?? 0) - (hub?.y ?? 0)).toBeGreaterThanOrEqual(120);
	});

	it("WHEN a container lives inside a folder group THEN elk lays out the whole group→container→nested chain", async () => {
		// notes/c1 and notes/c2 group; c1 embeds ext/n (nested). elk must place all
		// four boxes without error and give the deeply-nested note a position.
		const graph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("notes/c1.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("notes/c2.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("ext/n.md"), folder: asFolderPath("ext") }),
			],
			edges: [makeEmbedEdge("notes/c1.md", "ext/n.md", 0)],
		});
		const positions = extractElkPositions(await new ElkLayoutRunner().layout(vicinityGraphToElk(graph)));
		for (const id of ["notes/c1.md", "notes/c2.md", "ext/n.md", "folder-group:notes"]) {
			expect(positions.has(id)).toBe(true);
		}
	});
});
