import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import { neighborhoodGraphToFlow, withPositions } from "./flowMapping";
import type { FlowNode } from "./flowMapping";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

describe("neighborhoodGraphToFlow nodes", () => {
	const graph = makeGraph({
		nodes: [makeNode({ path: asVaultPath("notes/a.md"), title: "a", isMain: true, isCentral: true, sizePx: 160 })],
	});

	it("WHEN mapping a node THEN the React Flow node id is its vault path", () => {
		expect(neighborhoodGraphToFlow(graph).nodes[0]?.id).toBe("notes/a.md");
	});

	it("WHEN mapping a node THEN width and height are the node's sizePx", () => {
		const node = neighborhoodGraphToFlow(graph).nodes[0];
		expect({ width: node?.width, height: node?.height }).toEqual({ width: 160, height: 160 });
	});

	it("WHEN mapping a node THEN its data carries title, central and main flags", () => {
		expect(neighborhoodGraphToFlow(graph).nodes[0]?.data).toEqual({
			path: "notes/a.md",
			title: "a",
			isCentral: true,
			isMain: true,
			sizePx: 160,
		});
	});
});

describe("neighborhoodGraphToFlow edges", () => {
	const graph = makeGraph({
		nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
		edges: [makeEdge("a.md", "b.md")],
	});

	it("WHEN mapping an edge THEN its id is synthesized as source->target", () => {
		expect(neighborhoodGraphToFlow(graph).edges[0]?.id).toBe("a.md->b.md");
	});
});

describe("withPositions", () => {
	const nodes: readonly FlowNode[] = [
		{
			id: "a.md",
			position: { x: 0, y: 0 },
			width: 100,
			height: 100,
			data: { path: "a.md", title: "a", isCentral: false, isMain: false, sizePx: 100 },
		},
	];

	it("WHEN a position is known THEN it replaces the node's placeholder position", () => {
		const placed = withPositions(nodes, new Map([["a.md", { x: 12, y: 34 }]]));
		expect(placed[0]?.position).toEqual({ x: 12, y: 34 });
	});

	it("WHEN a position is unknown THEN the node is returned unchanged", () => {
		const placed = withPositions(nodes, new Map());
		expect(placed[0]?.position).toEqual({ x: 0, y: 0 });
	});
});
