import type { ElkNode } from "elkjs";
import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import { ELK_ROOT_ID } from "./constants";
import { extractElkPositions, neighborhoodGraphToElk } from "./elkMapping";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

describe("neighborhoodGraphToElk", () => {
	const graph = makeGraph({
		nodes: [makeNode({ path: asVaultPath("a.md"), sizePx: 120 }), makeNode({ path: asVaultPath("b.md") })],
		edges: [makeEdge("a.md", "b.md")],
	});

	it("WHEN mapping THEN the root carries the layered compound-ready algorithm", () => {
		expect(neighborhoodGraphToElk(graph).layoutOptions?.["elk.algorithm"]).toBe("layered");
	});

	it("WHEN mapping THEN the root requests INCLUDE_CHILDREN hierarchy handling", () => {
		expect(neighborhoodGraphToElk(graph).layoutOptions?.["elk.hierarchyHandling"]).toBe("INCLUDE_CHILDREN");
	});

	it("WHEN mapping THEN each node becomes a root child sized by its sizePx", () => {
		const child = neighborhoodGraphToElk(graph).children?.find((candidate) => candidate.id === "a.md");
		expect({ width: child?.width, height: child?.height }).toEqual({ width: 120, height: 120 });
	});

	it("WHEN mapping THEN each edge becomes an elk edge with synthesized id and endpoints", () => {
		expect(neighborhoodGraphToElk(graph).edges?.[0]).toEqual({
			id: "a.md->b.md",
			sources: ["a.md"],
			targets: ["b.md"],
		});
	});
});

describe("extractElkPositions", () => {
	it("WHEN reading a laid-out flat graph THEN it returns each child's absolute position", () => {
		const laidOut: ElkNode = {
			id: ELK_ROOT_ID,
			children: [
				{ id: "a.md", x: 10, y: 20 },
				{ id: "b.md", x: 30, y: 40 },
			],
		};
		expect(extractElkPositions(laidOut).get("b.md")).toEqual({ x: 30, y: 40 });
	});

	it("WHEN a child is nested THEN its position accumulates the parent offset (compound-ready)", () => {
		const laidOut: ElkNode = {
			id: ELK_ROOT_ID,
			children: [{ id: "folder", x: 100, y: 200, children: [{ id: "a.md", x: 5, y: 6 }] }],
		};
		expect(extractElkPositions(laidOut).get("a.md")).toEqual({ x: 105, y: 206 });
	});
});
