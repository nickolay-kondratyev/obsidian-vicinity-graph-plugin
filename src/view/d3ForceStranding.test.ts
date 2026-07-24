import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { GraphLayoutRunner } from "./GraphLayoutRunner";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "./elkMapping";
import { countOverlappingAabbPairs } from "./testFixtures/aabbOverlap";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";
import type { ElkNode } from "elkjs";
import type { VicinityGraph } from "../engine";

/**
 * Regression test for ticket 03 (force placement quality): a degree-1 leaf
 * linked to a hub note that lives INSIDE a tall folder-group container must not
 * be stranded far from the container. With the old circular `forceCollide`
 * (circumscribed-circle radius) a 192x392 container held every external
 * neighbour >= ~238px from its centre, producing a ~207px boundary gap on the
 * leaf edge — the "Enchiridion" long-crossing-edge symptom. The rectangular
 * (AABB) collide force lets neighbours clear the container's half-extent
 * instead of its diagonal (prototype: gap 207 -> 33).
 */

/**
 * Boundary-gap budget (px) per projected root edge. WHY 100: the AABB-collide
 * pipeline measures 33px on the vault-mirror fixture while the old circular
 * collide measured 207px (see RE_PLAN in the ticket), so 100 sits between them
 * with ~3x margin each way — loose enough to survive benign force tuning, tight
 * enough that a return of container stranding fails loudly.
 */
const D3_FORCE_MAX_BOUNDARY_GAP_PX = 100;

const HUB_SIZE_PX = 160;
const NEIGHBOR_SIZE_PX = 80;
/** Crowd size of the faithful vault mirror (hub with 5 crowd links + 1 leaf). */
const STRANDED_CROWD_COUNT = 5;
const STRANDED_HUB_FOLDER = "p/ep";
const STRANDED_BOOK_FOLDER = "p/ep/book";
const crowdPath = (index: number): string => `crowd${index}.md`;

/**
 * Mirror of the public-vault Enchiridion cluster: `main` links a hub note that
 * shares a folder (=> folder-group container) with a sibling; the hub fans out
 * to a crowd of leaves plus ONE degree-1 leaf in its own singleton folder.
 */
function strandedHubGraph(crowdCount: number): VicinityGraph {
	const crowd = Array.from({ length: crowdCount }, (_, index) =>
		makeNode({ path: asVaultPath(crowdPath(index)), minDepth: 1, sizePx: NEIGHBOR_SIZE_PX }),
	);
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("main.md"), isCentral: true, isMain: true, minDepth: 0, sizePx: 100 }),
			makeNode({
				path: asVaultPath("p/ep/hub.md"),
				folder: asFolderPath(STRANDED_HUB_FOLDER),
				minDepth: 1,
				sizePx: HUB_SIZE_PX,
			}),
			makeNode({
				path: asVaultPath("p/ep/sib.md"),
				folder: asFolderPath(STRANDED_HUB_FOLDER),
				minDepth: 1,
				sizePx: HUB_SIZE_PX,
			}),
			...crowd,
			makeNode({
				path: asVaultPath("p/ep/book/enchiridion.md"),
				folder: asFolderPath(STRANDED_BOOK_FOLDER),
				minDepth: 2,
				sizePx: NEIGHBOR_SIZE_PX,
			}),
		],
		edges: [
			makeEdge("main.md", "p/ep/hub.md"),
			makeEdge("p/ep/hub.md", "p/ep/sib.md"),
			...crowd.map((node) => makeEdge("p/ep/hub.md", node.path)),
			makeEdge("p/ep/hub.md", "p/ep/book/enchiridion.md"),
		],
	});
}

interface StrandedLayout {
	readonly positions: ReadonlyMap<string, { x: number; y: number }>;
	readonly dimensions: ReadonlyMap<string, { width: number; height: number }>;
	/** The PROJECTED root edges — what the d3 forceLink actually acts on. */
	readonly rootEdges: readonly { source: string; target: string }[];
	readonly rootIds: readonly string[];
}

async function layoutStranded(graph: VicinityGraph): Promise<StrandedLayout> {
	const elkRoot = vicinityGraphToElk(graph);
	const laidOut = await new GraphLayoutRunner().layout(elkRoot);
	return {
		positions: extractElkPositions(laidOut),
		dimensions: extractElkDimensionsById(laidOut),
		rootEdges: (elkRoot.edges ?? []).map((edge: NonNullable<ElkNode["edges"]>[number]) => ({
			source: edge.sources[0] as string,
			target: edge.targets[0] as string,
		})),
		rootIds: (laidOut.children ?? []).map((child) => child.id),
	};
}

function centerOf(layout: StrandedLayout, id: string): { x: number; y: number } {
	const position = layout.positions.get(id);
	const dims = layout.dimensions.get(id);
	if (position === undefined || dims === undefined) {
		throw new Error(`missing layout data for ${id}`);
	}
	return { x: position.x + dims.width / 2, y: position.y + dims.height / 2 };
}

/**
 * Boundary gap of a root edge: rendered free space between the two boxes'
 * RECTANGLE boundaries along the centre-to-centre segment. Unlike an
 * edge-length ratio normalised by the circumscribed radius, this detects
 * container stranding: a neighbour held off a tall container's circumscribed
 * circle shows a large gap even though the normalised ratio reads ~1.
 */
function boundaryGapPx(layout: StrandedLayout, sourceId: string, targetId: string): number {
	const source = centerOf(layout, sourceId);
	const target = centerOf(layout, targetId);
	const dist = Math.hypot(target.x - source.x, target.y - source.y);
	if (dist === 0) {
		return 0;
	}
	const ux = Math.abs((target.x - source.x) / dist);
	const uy = Math.abs((target.y - source.y) / dist);
	// Distance from a box centre to its rectangle boundary along the edge direction.
	const extentAlongEdge = (id: string): number => {
		const dims = layout.dimensions.get(id);
		if (dims === undefined) {
			throw new Error(`missing dims for ${id}`);
		}
		return Math.min(
			ux > 0 ? dims.width / 2 / ux : Number.POSITIVE_INFINITY,
			uy > 0 ? dims.height / 2 / uy : Number.POSITIVE_INFINITY,
		);
	};
	return dist - extentAlongEdge(sourceId) - extentAlongEdge(targetId);
}

function worstBoundaryGapPx(layout: StrandedLayout): number {
	return Math.max(...layout.rootEdges.map((edge) => boundaryGapPx(layout, edge.source, edge.target)));
}

function overlappingRootPairCount(layout: StrandedLayout): number {
	const boxes = layout.rootIds.map((id) => {
		const position = layout.positions.get(id);
		const dims = layout.dimensions.get(id);
		if (position === undefined || dims === undefined) {
			throw new Error(`missing layout data for ${id}`);
		}
		return { x: position.x, y: position.y, width: dims.width, height: dims.height };
	});
	return countOverlappingAabbPairs(boxes);
}

describe("d3-force stranding around a folder-grouped hub (ticket 03 Enchiridion mirror)", () => {
	it("WHEN a folder-grouped hub fans out to a crowd plus one degree-1 leaf THEN no projected root edge is stranded beyond the boundary-gap budget", async () => {
		const layout = await layoutStranded(strandedHubGraph(STRANDED_CROWD_COUNT));
		expect(worstBoundaryGapPx(layout)).toBeLessThanOrEqual(D3_FORCE_MAX_BOUNDARY_GAP_PX);
	});

	it("WHEN the stranded-hub fixture is laid out THEN no two root-level boxes overlap", async () => {
		const layout = await layoutStranded(strandedHubGraph(STRANDED_CROWD_COUNT));
		expect(overlappingRootPairCount(layout)).toBe(0);
	});
});
