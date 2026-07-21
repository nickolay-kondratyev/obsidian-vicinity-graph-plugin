import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "./elkMapping";
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
	const laidOut = await new ElkLayoutRunner().layout(vicinityGraphToElk(graph));
	return extractElkPositions(laidOut);
}

describe("elk layout of a real vicinity fixture", () => {
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

describe("elk compound layout of a folder-grouped fixture (step-05)", () => {
	// GIVEN two notes grouped under notes/ plus an ungrouped root note linking in.
	const compoundGraph = makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("root.md"), folder: asFolderPath(""), sizePx: 100 }),
			makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes"), sizePx: 100 }),
			makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes"), sizePx: 100 }),
		],
		edges: [makeEdge("root.md", "notes/a.md"), makeEdge("notes/a.md", "notes/b.md")],
	});

	async function laidOutCompound() {
		return new ElkLayoutRunner().layout(vicinityGraphToElk(compoundGraph));
	}

	it("WHEN laid out THEN the container reports dimensions that wrap its members", async () => {
		const dimensions = extractElkDimensionsById(await laidOutCompound()).get("folder-group:notes");
		// Two 100px members can never fit a container smaller than one member.
		expect((dimensions?.width ?? 0) > 100 && (dimensions?.height ?? 0) >= 100).toBe(true);
	});

	it("WHEN laid out THEN every node AND the container receive absolute positions", async () => {
		const positions = extractElkPositions(await laidOutCompound());
		expect([...positions.keys()].sort()).toEqual(["folder-group:notes", "notes/a.md", "notes/b.md", "root.md"]);
	});

	it("WHEN laid out THEN grouped members do not overlap inside the container", async () => {
		const positions = extractElkPositions(await laidOutCompound());
		expect(positions.get("notes/a.md")).not.toEqual(positions.get("notes/b.md"));
	});
});
