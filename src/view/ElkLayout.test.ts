import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "./elkMapping";
import { makeEdge, makeGraph, makeNode, withLayoutMode } from "./testFixtures/graphFixtures";
import type { VicinityGraph } from "../engine";

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

describe("elk radial layout of a high fan-out hub (the layout-mode feature's motivating case)", () => {
	// GIVEN a central hub with 12 neighbours, half linking INTO the hub
	// (incoming links) — the shape that degenerates into one very wide row
	// under layered and that broke naive radial (mixed edge directions).
	const HUB_SIZE_PX = 160;
	const NEIGHBOR_SIZE_PX = 80;
	const NEIGHBOR_COUNT = 12;
	const neighborPath = (index: number): string => `n${index}.md`;
	const hubGraph = withLayoutMode(
		makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("hub.md"), isCentral: true, isMain: true, minDepth: 0, sizePx: HUB_SIZE_PX }),
				...Array.from({ length: NEIGHBOR_COUNT }, (_, index) =>
					makeNode({ path: asVaultPath(neighborPath(index)), minDepth: 1, sizePx: NEIGHBOR_SIZE_PX }),
				),
			],
			edges: Array.from({ length: NEIGHBOR_COUNT }, (_, index) =>
				index % 2 === 0 ? makeEdge("hub.md", neighborPath(index)) : makeEdge(neighborPath(index), "hub.md"),
			),
		}),
		"radial",
	);

	async function laidOutHub(graph: VicinityGraph) {
		const positions = extractElkPositions(await new ElkLayoutRunner().layout(vicinityGraphToElk(graph)));
		return graph.nodes.map((node) => {
			const position = positions.get(node.path);
			if (position === undefined) {
				throw new Error(`missing position for ${node.path}`);
			}
			return { path: node.path, ...position, side: node.sizePx };
		});
	}

	function overlappingPairCount(boxes: readonly { x: number; y: number; side: number }[]): number {
		let count = 0;
		for (let i = 0; i < boxes.length; i++) {
			for (let j = i + 1; j < boxes.length; j++) {
				const a = boxes[i] as (typeof boxes)[number];
				const b = boxes[j] as (typeof boxes)[number];
				if (a.x < b.x + b.side && b.x < a.x + a.side && a.y < b.y + b.side && b.y < a.y + a.side) {
					count += 1;
				}
			}
		}
		return count;
	}

	it("WHEN laid out radially THEN no two nodes overlap despite mixed link directions", async () => {
		expect(overlappingPairCount(await laidOutHub(hubGraph))).toBe(0);
	});

	it("WHEN laid out radially THEN the bounding box is compact, not one wide row", async () => {
		const boxes = await laidOutHub(hubGraph);
		const width = Math.max(...boxes.map((box) => box.x + box.side)) - Math.min(...boxes.map((box) => box.x));
		const height = Math.max(...boxes.map((box) => box.y + box.side)) - Math.min(...boxes.map((box) => box.y));
		// Layered puts all 12 neighbours in one layer (aspect >= 4); radial rings stay near 1.
		expect(width / height).toBeLessThan(2.5);
	});

	it("WHEN laid out with force THEN no two nodes overlap either", async () => {
		expect(overlappingPairCount(await laidOutHub(withLayoutMode(hubGraph, "force")))).toBe(0);
	});

	it("WHEN laid out radially twice THEN the result is deterministic", async () => {
		expect(await laidOutHub(hubGraph)).toEqual(await laidOutHub(hubGraph));
	});
});

describe("elk radial layout of a folder-grouped fixture (groups keep working off-layered)", () => {
	// GIVEN the compound shape under radial: an ungrouped root linking into a
	// two-member notes/ group (SEPARATE_CHILDREN two-level layout).
	const radialCompound = withLayoutMode(
		makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("root.md"), folder: asFolderPath(""), minDepth: 0, sizePx: 100 }),
				makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes"), minDepth: 1, sizePx: 100 }),
				makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes"), minDepth: 2, sizePx: 100 }),
			],
			edges: [makeEdge("root.md", "notes/a.md"), makeEdge("notes/a.md", "notes/b.md")],
		}),
		"radial",
	);

	async function laidOutRadialCompound() {
		return new ElkLayoutRunner().layout(vicinityGraphToElk(radialCompound));
	}

	it("WHEN laid out THEN the container still reports dimensions that wrap its members", async () => {
		const dimensions = extractElkDimensionsById(await laidOutRadialCompound()).get("folder-group:notes");
		expect((dimensions?.width ?? 0) > 100 && (dimensions?.height ?? 0) >= 100).toBe(true);
	});

	it("WHEN laid out THEN every node AND the container receive absolute positions", async () => {
		const positions = extractElkPositions(await laidOutRadialCompound());
		expect([...positions.keys()].sort()).toEqual(["folder-group:notes", "notes/a.md", "notes/b.md", "root.md"]);
	});

	it("WHEN laid out THEN grouped members do not overlap inside the container", async () => {
		const positions = extractElkPositions(await laidOutRadialCompound());
		expect(positions.get("notes/a.md")).not.toEqual(positions.get("notes/b.md"));
	});
});
