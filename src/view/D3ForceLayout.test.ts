import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { GraphLayoutRunner } from "./GraphLayoutRunner";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "./elkMapping";
import { makeEdge, makeGraph, makeNode, withLayoutMode } from "./testFixtures/graphFixtures";
import type { LayoutMode, VicinityGraph } from "../engine";

/**
 * End-to-end confirmation of the d3-force root refinement behind the `force`
 * layout mode (the new DEFAULT): elk lays out folder-group internals and seeds
 * the root, then d3-force packs the root-level boxes. Runs the real elk + d3
 * engines headless in Node — no React Flow, no DOM.
 */

const HUB_SIZE_PX = 160;
const NEIGHBOR_SIZE_PX = 80;
/** High fan-out mirroring the motivating screenshot (a hub note with dozens of links). */
const NEIGHBOR_COUNT = 24;
const neighborPath = (index: number): string => `n${index}.md`;

/** A central hub with many neighbours, half linking INTO the hub (mixed directions). */
function hubGraph(mode: LayoutMode): VicinityGraph {
	return withLayoutMode(
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
		mode,
	);
}

interface Box {
	readonly path: string;
	readonly x: number;
	readonly y: number;
	readonly side: number;
}

async function laidOutBoxes(graph: VicinityGraph): Promise<readonly Box[]> {
	const positions = extractElkPositions(await new GraphLayoutRunner().layout(vicinityGraphToElk(graph)));
	return graph.nodes.map((node) => {
		const position = positions.get(node.path);
		if (position === undefined) {
			throw new Error(`missing position for ${node.path}`);
		}
		return { path: node.path, ...position, side: node.sizePx };
	});
}

function overlappingPairCount(boxes: readonly Box[]): number {
	let count = 0;
	for (let i = 0; i < boxes.length; i++) {
		for (let j = i + 1; j < boxes.length; j++) {
			const a = boxes[i] as Box;
			const b = boxes[j] as Box;
			if (a.x < b.x + b.side && b.x < a.x + a.side && a.y < b.y + b.side && b.y < a.y + a.side) {
				count += 1;
			}
		}
	}
	return count;
}

function boundingBoxArea(boxes: readonly Box[]): number {
	const width = Math.max(...boxes.map((box) => box.x + box.side)) - Math.min(...boxes.map((box) => box.x));
	const height = Math.max(...boxes.map((box) => box.y + box.side)) - Math.min(...boxes.map((box) => box.y));
	return width * height;
}

describe("d3-force layout of a high fan-out hub (the mode's motivating case)", () => {
	it("WHEN laid out with force THEN every node receives a position", async () => {
		expect((await laidOutBoxes(hubGraph("force"))).length).toBe(NEIGHBOR_COUNT + 1);
	});

	it("WHEN laid out with force THEN no two nodes overlap despite mixed link directions", async () => {
		expect(overlappingPairCount(await laidOutBoxes(hubGraph("force")))).toBe(0);
	});

	it("WHEN laid out with force THEN the vicinity is LESS dispersed than radial (the feature's reason to exist)", async () => {
		const forceArea = boundingBoxArea(await laidOutBoxes(hubGraph("force")));
		const radialArea = boundingBoxArea(await laidOutBoxes(hubGraph("radial")));
		expect(forceArea).toBeLessThan(radialArea);
	});

	it("WHEN laid out with force twice THEN the result is deterministic", async () => {
		expect(await laidOutBoxes(hubGraph("force"))).toEqual(await laidOutBoxes(hubGraph("force")));
	});
});

describe("d3-force layout of a folder-grouped fixture (grouping survives the force mode)", () => {
	// GIVEN an ungrouped root linking into a two-member notes/ group: elk lays
	// out the group INTERNALLY, d3-force only arranges the root-level boxes.
	const groupedForce = withLayoutMode(
		makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("root.md"), folder: asFolderPath(""), minDepth: 0, sizePx: 100 }),
				makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes"), minDepth: 1, sizePx: 100 }),
				makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes"), minDepth: 2, sizePx: 100 }),
			],
			edges: [makeEdge("root.md", "notes/a.md"), makeEdge("notes/a.md", "notes/b.md")],
		}),
		"force",
	);

	async function laidOutGrouped() {
		return new GraphLayoutRunner().layout(vicinityGraphToElk(groupedForce));
	}

	it("WHEN laid out THEN the container still reports dimensions that wrap its members", async () => {
		const dimensions = extractElkDimensionsById(await laidOutGrouped()).get("folder-group:notes");
		expect((dimensions?.width ?? 0) > 100 && (dimensions?.height ?? 0) >= 100).toBe(true);
	});

	it("WHEN laid out THEN every node AND the container receive absolute positions", async () => {
		const positions = extractElkPositions(await laidOutGrouped());
		expect([...positions.keys()].sort()).toEqual(["folder-group:notes", "notes/a.md", "notes/b.md", "root.md"]);
	});

	it("WHEN laid out THEN grouped members stay INSIDE their container box", async () => {
		const laidOut = await laidOutGrouped();
		const positions = extractElkPositions(laidOut);
		const container = positions.get("folder-group:notes") as { x: number; y: number };
		const dims = extractElkDimensionsById(laidOut).get("folder-group:notes") as { width: number; height: number };
		const inside = (["notes/a.md", "notes/b.md"] as const).every((path) => {
			const member = positions.get(path) as { x: number; y: number };
			return (
				member.x >= container.x &&
				member.y >= container.y &&
				member.x + 100 <= container.x + dims.width &&
				member.y + 100 <= container.y + dims.height
			);
		});
		expect(inside).toBe(true);
	});
});

describe("GraphLayoutRunner pass-through for non-force modes", () => {
	it("WHEN mode is layered THEN positions are IDENTICAL to the plain elk runner (no d3 refinement)", async () => {
		const layered = hubGraph("layered");
		const viaGraphRunner = extractElkPositions(await new GraphLayoutRunner().layout(vicinityGraphToElk(layered)));
		const viaElkRunner = extractElkPositions(await new ElkLayoutRunner().layout(vicinityGraphToElk(layered)));
		expect([...viaGraphRunner]).toEqual([...viaElkRunner]);
	});
});
