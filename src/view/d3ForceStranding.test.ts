import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { GraphLayoutRunner } from "./GraphLayoutRunner";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "./elkMapping";
import { rectExtentAlong } from "./forceRectLink";
import { folderGroupIdOf } from "./graphIdentity";
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
/**
 * Small square + long title => a node much wider than tall, so its folder group
 * comes out LANDSCAPE. Realistic: `NodeSizer` takes height from link/size
 * metrics and width from title length (capped at 250px).
 */
const WIDE_MEMBER_SIZE_PX = 40;
const WIDE_MEMBER_TITLE = "a deliberately long note title that saturates the label width cap";
/** Crowd size of the faithful vault mirror (hub with 5 crowd links + 1 leaf). */
const STRANDED_CROWD_COUNT = 5;
const STRANDED_HUB_FOLDER = "p/ep";
const STRANDED_BOOK_FOLDER = "p/ep/book";
const crowdPath = (index: number): string => `crowd${index}.md`;

/**
 * Shape of the two notes that make up the folder-group container, which is what
 * decides whether that container is portrait or landscape: node width is
 * `max(sizePx, labelWidth(title))` capped at 250px, node height is `sizePx`.
 * The same shape is used for both members — this fixture only cares about their
 * geometry, never their text.
 */
interface GroupMemberShape {
	readonly sizePx: number;
	readonly title: string;
}

/** Two 160px squares — the vault-mirror shape; packs into a PORTRAIT container. */
const SQUARE_GROUP_MEMBERS: GroupMemberShape = { sizePx: HUB_SIZE_PX, title: "note" };

/** Two 250x40 strips — packs into a LANDSCAPE container even at `elk.aspectRatio` 0.75. */
const WIDE_GROUP_MEMBERS: GroupMemberShape = { sizePx: WIDE_MEMBER_SIZE_PX, title: WIDE_MEMBER_TITLE };

/**
 * Mirror of the public-vault Enchiridion cluster: `main` links a hub note that
 * shares a folder (=> folder-group container) with a sibling; the hub fans out
 * to a crowd of leaves plus ONE degree-1 leaf in its own singleton folder.
 */
function strandedHubGraph(crowdCount: number, members: GroupMemberShape = SQUARE_GROUP_MEMBERS): VicinityGraph {
	const crowd = Array.from({ length: crowdCount }, (_, index) =>
		makeNode({ path: asVaultPath(crowdPath(index)), minDepth: 1, sizePx: NEIGHBOR_SIZE_PX }),
	);
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("main.md"), isCentral: true, isMain: true, minDepth: 0, sizePx: 100 }),
			makeNode({
				path: asVaultPath("p/ep/hub.md"),
				title: members.title,
				folder: asFolderPath(STRANDED_HUB_FOLDER),
				minDepth: 1,
				sizePx: members.sizePx,
			}),
			makeNode({
				path: asVaultPath("p/ep/sib.md"),
				title: members.title,
				folder: asFolderPath(STRANDED_HUB_FOLDER),
				minDepth: 1,
				sizePx: members.sizePx,
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
	/** The PROJECTED root edges — what the link force actually acts on. */
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
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const dist = Math.hypot(dx, dy);
	if (dist === 0) {
		return 0;
	}
	// Same projected extent the link force rests at — measuring with a different
	// formula would test the measurement, not the layout.
	const extentAlongEdge = (id: string): number => {
		const dims = layout.dimensions.get(id);
		if (dims === undefined) {
			throw new Error(`missing dims for ${id}`);
		}
		return rectExtentAlong({ halfWidth: dims.width / 2, halfHeight: dims.height / 2 }, dx, dy);
	};
	return dist - extentAlongEdge(sourceId) - extentAlongEdge(targetId);
}

/**
 * READ BEFORE REUSING THIS METRIC (ticket nid_nvk25n73l5hahwdx9o8rmoyl4_e).
 * The worst boundary gap is a REGRESSION SIGNAL on the two fixtures this suite
 * pins — it is NOT a general layout-quality score, for two measured reasons:
 *
 * 1. DEGREE-BLIND. On high-degree star fixtures it reports 22-24 "stranded"
 *    edges at EVERY root seed spacing: a hub physically cannot seat all its
 *    neighbours within the budget, so the number says nothing about quality
 *    there. It only means something where the fixture's degrees allow seating.
 * 2. CHAOTIC IN THE SEED. The d3 refinement is chaotically sensitive to its
 *    input arrangement: a +-4px nudge to `ELK_ROOT_SEED_NODE_SPACING_PX`
 *    (36..44) moves this metric as much as or MORE than the whole 5..200 sweep
 *    does (466..1032px vs 455..789px on the 26-box vault mirror). Any future
 *    root-pass tuning MUST be judged on a DISTRIBUTION over many fixtures —
 *    a single reading is noise.
 *
 * Evidence + reusable sweep harness: `.ai_out/root-seed-spacing/
 * nid_zvoay26y4y9h1e2p2b1y9glfk_e_2026-07-30T00-28-34PDT/` (`seed-sweep/`).
 * The seed constant's own doc (`constants.ts`) carries the same conclusion.
 */
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

/**
 * The same cluster with a LANDSCAPE container, which the portrait fixture above
 * cannot reach. WHY this matters: the budget above holds partly because that
 * fixture's container happens to be taller than wide. `elk.aspectRatio` only
 * makes portrait LIKELY (it is a soft goal of elk's width-approximation step),
 * so the coupling would otherwise be invisible.
 *
 * This case used to FAIL (113px worst gap) because d3's `forceLink` resolves a
 * resting distance once, direction-blind, and it was fed the SMALLER half-extent:
 * a horizontally-linked neighbour of a wide box still had to clear its half-WIDTH
 * and was pushed out along the long axis. `forceRectLink` rests at the extents
 * PROJECTED onto the live link direction instead — 73px here.
 */
describe("d3-force stranding around a LANDSCAPE folder-group container", () => {
	const landscapeLayout = (): Promise<StrandedLayout> =>
		layoutStranded(strandedHubGraph(STRANDED_CROWD_COUNT, WIDE_GROUP_MEMBERS));

	function containerAspectRatio(layout: StrandedLayout): number {
		const dims = layout.dimensions.get(folderGroupIdOf(asFolderPath(STRANDED_HUB_FOLDER)));
		if (dims === undefined) {
			throw new Error("the folder-group container is missing from the layout");
		}
		return dims.width / dims.height;
	}

	// Guards the fixture itself: without this, the budget test below could pass
	// on a portrait container for some unrelated reason.
	it("WHEN the group members are wide strips THEN the container really is landscape", async () => {
		expect(containerAspectRatio(await landscapeLayout())).toBeGreaterThan(1);
	});

	it("WHEN the folder-group container is LANDSCAPE THEN no projected root edge is stranded beyond the boundary-gap budget", async () => {
		expect(worstBoundaryGapPx(await landscapeLayout())).toBeLessThanOrEqual(D3_FORCE_MAX_BOUNDARY_GAP_PX);
	});
});
