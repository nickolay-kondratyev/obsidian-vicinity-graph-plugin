import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { extractElkPositions, neighborhoodGraphToElk } from "./elkMapping";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

/**
 * End-to-end confirmation that the chosen elk options actually lay out a real
 * fixture (the CLARIFICATION Q1 spike). elkjs runs headless in Node, so this is
 * the real layout engine — no React Flow, no DOM. Mirrors the dev-vault fixture
 * shape: a central note linking two neighbours.
 */
const graph = makeGraph({
	nodes: [
		makeNode({ path: asVaultPath("note1.md"), isCentral: true, isMain: true, sizePx: 160 }),
		makeNode({ path: asVaultPath("note2.md"), sizePx: 80 }),
		makeNode({ path: asVaultPath("note3.md"), sizePx: 80 }),
	],
	edges: [makeEdge("note1.md", "note2.md"), makeEdge("note1.md", "note3.md")],
});

async function layoutPositions() {
	const laidOut = await new ElkLayoutRunner().layout(neighborhoodGraphToElk(graph));
	return extractElkPositions(laidOut);
}

describe("elk layout of a real neighborhood fixture", () => {
	it("WHEN laid out THEN every node receives a position", async () => {
		const positions = await layoutPositions();
		expect(positions.size).toBe(3);
	});

	it("WHEN laid out THEN the two sibling neighbours do not overlap", async () => {
		const positions = await layoutPositions();
		expect(positions.get("note2.md")).not.toEqual(positions.get("note3.md"));
	});

	it("WHEN laid out twice THEN the result is deterministic", async () => {
		const first = await layoutPositions();
		const second = await layoutPositions();
		expect([...second]).toEqual([...first]);
	});
});
