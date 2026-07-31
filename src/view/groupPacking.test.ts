import { describe, expect, it } from "vitest";
import { EngineDefaults, asFolderPath, asVaultPath } from "../engine";
import type { GraphEdge, GraphNode, VicinityGraph } from "../engine";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { GROUP_SIDE_PADDING_PX } from "./constants";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "./elkMapping";
import { folderGroupIdOf, nodeDimensionsPx } from "./graphIdentity";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

/**
 * Packing density of a folder group's INTERIOR (real elkjs, no d3). The ticket
 * "nodes in groups to be tighter together" has no other coverage: every other
 * layout test asserts overlap-freedom, containment or determinism, none of which
 * moves when the interior wastes space.
 *
 * Two failure modes are locked here, both measured against the members' OWN
 * geometry rather than elk's exact pixel output (elk's numbers shift between
 * versions; "did it waste space" does not):
 * - a single row — the degenerate shape a flow layout produces when every member
 *   sits in one layer (a hub and its folder-mates: extremely common in a note
 *   vault). Signature: the box is at least as wide as all members laid end to end.
 * - low fill — how much of the interior the member rectangles actually occupy.
 *
 * HONEST SCOPE. rectpacking ignores intra-group edges, so its box is the same for
 * every link shape while `layered` (the previous interior layout) swings wildly.
 * This 13-member fixture, measured at the shipped 40px member spacing and at the
 * 20px the default briefly sat at:
 *
 * | intra-group links | layered @40 | rectpacking @40 (shipped) | layered @20 | rectpacking @20 |
 * |---|---|---|---|---|
 * | hub-linked | 1734x488 / 0.218 | 702x523 / 0.515 | 1514x488 / 0.251 | 602x483 / 0.660 |
 * | none       |  602x483 / 0.660 | 702x523 / 0.515 |  602x483 / 0.660 | 602x483 / 0.660 |
 * | chain      |  368x1534 / 0.336 | 702x523 / 0.515 | 368x1534 / 0.336 | 602x483 / 0.660 |
 *
 * Read the shipped column against the `layered` one: rectpacking's win is that it
 * is INDIFFERENT to link shape, not that it is the densest cell in the table. The
 * one case `layered` packs better (edge-free, 0.660 vs 0.515) is the price paid
 * for killing the hub strip. Nothing here can PROVE that trade — a floor test
 * cannot see that an old value was higher — so the numbers above are the record.
 */

const GROUP_FOLDER = asFolderPath("notes");
const MEMBER_COUNT = 12;
const HUB_PATH = "notes/hub.md";

/**
 * Deliberately heterogeneous member sizes (the production case: `NodeSizer`
 * derives height from link/size metrics, width from title length) so the packing
 * cannot be satisfied by a uniform grid.
 */
function member(index: number): GraphNode {
	const MIN_MEMBER_PX = 60;
	const MEMBER_PX_SPREAD = 100;
	return makeNode({
		path: asVaultPath(`notes/m${index}.md`),
		folder: GROUP_FOLDER,
		sizePx: MIN_MEMBER_PX + ((index * 37) % MEMBER_PX_SPREAD),
	});
}

function groupedGraph(intraGroupEdges: readonly GraphEdge[]): VicinityGraph {
	return makeGraph({
		nodes: [
			// An outside note anchors the root pass, mirroring a real vicinity.
			makeNode({ path: asVaultPath("root.md"), folder: asFolderPath(""), isCentral: true, isMain: true }),
			makeNode({ path: asVaultPath(HUB_PATH), folder: GROUP_FOLDER, sizePx: 160 }),
			...Array.from({ length: MEMBER_COUNT }, (_, index) => member(index)),
		],
		edges: [makeEdge("root.md", HUB_PATH), ...intraGroupEdges],
	});
}

/**
 * The five members of the real-vault group a human rejected as "obviously
 * non-frugal with space" (`HUMAN_FEEDBACK_screenshot.png` in this ticket's
 * `.ai_out/` folder). Sizes are read back off that screenshot — its image-bearing
 * member sits at the engine's 160px max height, which fixes the screenshot's zoom
 * factor and with it every other member's px size. Titles are the real ones
 * because width is title-derived (`nodeDimensionsPx`), and it is exactly the
 * width SPREAD (111px to the 250px cap) that a row packer wastes space on.
 */
const SCREENSHOT_MEMBERS: readonly { readonly title: string; readonly sizePx: number }[] = [
	{ title: "Law of Action", sizePx: 76 },
	{ title: "habits", sizePx: 114 },
	{ title: "Make the Right Thing Automatic", sizePx: 84 },
	{ title: "Asymmetric Risk Reward Situations", sizePx: 83 },
	{ title: "Clear Goals", sizePx: 160 },
];

function screenshotGraph(): VicinityGraph {
	const members = SCREENSHOT_MEMBERS.map((shape, index) =>
		makeNode({
			path: asVaultPath(`notes/s${index}.md`),
			folder: GROUP_FOLDER,
			title: shape.title,
			sizePx: shape.sizePx,
		}),
	);
	return makeGraph({
		nodes: [makeNode({ path: asVaultPath("root.md"), folder: asFolderPath(""), isCentral: true, isMain: true }), ...members],
		// One incoming link, as in the screenshot: the vicinity reaches the folder
		// from outside. Intra-group links are irrelevant — rectpacking ignores them.
		edges: [makeEdge("root.md", "notes/s0.md")],
	});
}

/** Every member links the hub — one flow layer, the pathological single-row shape. */
const hubLinkedEdges = Array.from({ length: MEMBER_COUNT }, (_, index) => makeEdge(HUB_PATH, `notes/m${index}.md`));

/** Members in a line — the opposite extreme: one member per flow layer, a tall thin column. */
const chainEdges = Array.from({ length: MEMBER_COUNT - 1 }, (_, index) =>
	makeEdge(`notes/m${index}.md`, `notes/m${index + 1}.md`),
);

interface GroupGeometry {
	readonly widthPx: number;
	readonly heightPx: number;
	/** Widths of the member rectangles, in elk input order. */
	readonly memberWidthsPx: readonly number[];
	/**
	 * Fraction of the box-minus-side-padding area covered by member rectangles, in
	 * [0,1]. NOT the true member band: the container's TOP padding is larger than its
	 * side padding (`GROUP_TOP_PADDING_PX` reserves the folder-name row), and this
	 * denominator charges only the side padding on both axes. So it under-reports the
	 * real density by ~0.03, which makes every floor below slightly conservative — the
	 * safe direction for a floor. Kept as-is because the floors are calibrated to it;
	 * a denominator change means re-measuring all of them.
	 */
	readonly fillRatio: number;
}

function requireGroupBox(dimensions: ReadonlyMap<string, { width: number; height: number }>): {
	width: number;
	height: number;
} {
	const box = dimensions.get(folderGroupIdOf(GROUP_FOLDER));
	if (box === undefined) {
		throw new Error("the folder group must be laid out as a container");
	}
	return box;
}

async function layOutGroup(graph: VicinityGraph): Promise<GroupGeometry> {
	const laidOut = await new ElkLayoutRunner().layout(vicinityGraphToElk(graph));
	const positions = extractElkPositions(laidOut);
	const box = requireGroupBox(extractElkDimensionsById(laidOut));
	const members = graph.nodes.filter((node) => node.folder === GROUP_FOLDER);
	expect(members.every((node) => positions.has(node.path))).toBe(true);
	const memberRects = members.map((node) => nodeDimensionsPx(node));
	const memberAreaPx = memberRects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
	// The interior is what packing controls; the padding band is fixed overhead.
	const interiorAreaPx = (box.width - 2 * GROUP_SIDE_PADDING_PX) * (box.height - 2 * GROUP_SIDE_PADDING_PX);
	return {
		widthPx: box.width,
		heightPx: box.height,
		memberWidthsPx: memberRects.map((rect) => rect.width),
		fillRatio: memberAreaPx / interiorAreaPx,
	};
}

/**
 * Fill floor for a heterogeneous group at the shipped 40px member spacing.
 * Measured fill is 0.515, so the floor keeps ~13% headroom against elkjs drift.
 * Moved 0.4 -> 0.55 -> 0.45 as the shipped spacing went 40 -> 20 -> 40: spacing IS
 * density, so a floor calibrated at one spacing says nothing at another. What it
 * still catches at 0.45 is a LAYOUT regression — `layered` gives these same
 * members 0.218 (hub-linked) / 0.336 (chain) at this spacing.
 * It does NOT by itself see a regression of the SHIPPED default: the fixture
 * carries its own copy of that value. The mirror is locked by the fixture test
 * below, and the shipped value itself by `SettingsSpec.test.ts`.
 *
 * Deliberately ONE floor for every link shape — see the edge-independence test:
 * rectpacking gives all of them the same box.
 */
const MIN_INTERIOR_FILL_RATIO = 0.45;

/**
 * Fill floor for {@link SCREENSHOT_MEMBERS} — the packing lock on the human's
 * actual complaint. Measured 0.505 when the screenshot was taken, 0.587 while the
 * member spacing was 20px, and 0.509 now that it is back to 40px.
 *
 * HONEST SCOPE, stated plainly: at the shipped 40px this floor can no longer say
 * "denser than the rejected screenshot" — the rejected screenshot's own density
 * was 0.505, and 40px spacing puts a well-packed interior right back at it. The
 * density win came from the spacing, and the spacing was deliberately given back
 * for breathing room. What survives is the layout lock: 0.45 fails a flow-layout
 * regression (0.218 / 0.336 above) and keeps ~12% headroom for elkjs drift.
 *
 * WHY a floor this low is right at all: even at 20px a PERFECT packer of these
 * five rectangles reaches only ~0.63 (measured with a skyline packer sweep) — the
 * gaps themselves are area. The floor tracks that ceiling, it does not describe
 * an achievable ideal.
 */
const MIN_SCREENSHOT_FILL_RATIO = 0.45;

describe("folder-group interior packing", () => {
	/**
	 * Every fill floor in this file is measured at the fixture's member spacing, so
	 * the floors only speak about the SHIPPED layout while the fixture keeps mirroring
	 * the shipped default. This test is that mirror — without it the two can drift
	 * apart silently and the floors quietly start guarding a spacing nobody gets.
	 */
	it("WHEN measuring packing THEN the fixture's member spacing mirrors the shipped default", () => {
		expect(makeGraph().viewSettings.forceLayout.elkNodeSpacingPx).toBe(
			EngineDefaults.forceLayoutSettings().elkNodeSpacingPx,
		);
	});

	it("WHEN the group holds the rejected screenshot's five members THEN the interior is densely filled", async () => {
		const geometry = await layOutGroup(screenshotGraph());
		expect(geometry.fillRatio).toBeGreaterThan(MIN_SCREENSHOT_FILL_RATIO);
	});

	it("WHEN every member links a hub member THEN the group is not laid out as a single row", async () => {
		const geometry = await layOutGroup(groupedGraph(hubLinkedEdges));
		const endToEndWidthPx = geometry.memberWidthsPx.reduce((sum, width) => sum + width, 0);
		expect(geometry.widthPx).toBeLessThan(endToEndWidthPx);
	});

	it("WHEN every member links a hub member THEN the interior is densely filled", async () => {
		const geometry = await layOutGroup(groupedGraph(hubLinkedEdges));
		expect(geometry.fillRatio).toBeGreaterThan(MIN_INTERIOR_FILL_RATIO);
	});

	it("WHEN the group has no intra-group edges THEN it is not laid out as a single row", async () => {
		const geometry = await layOutGroup(groupedGraph([]));
		const endToEndWidthPx = geometry.memberWidthsPx.reduce((sum, width) => sum + width, 0);
		expect(geometry.widthPx).toBeLessThan(endToEndWidthPx);
	});

	it("WHEN the group has no intra-group edges THEN the interior is densely filled", async () => {
		const geometry = await layOutGroup(groupedGraph([]));
		expect(geometry.fillRatio).toBeGreaterThan(MIN_INTERIOR_FILL_RATIO);
	});

	/**
	 * The durable property behind the whole change: the box no longer depends on
	 * how members happen to link each other, so no link shape can degenerate it
	 * (a flow layout gives these same members 1734x488, 602x483 and 368x1534).
	 * The flip side, stated plainly: the edge-free case no longer gets its own
	 * better-than-average packing either.
	 */
	it("WHEN the same members carry hub, chain or no intra-group links THEN the group box is identical", async () => {
		const [hub, chain, edgeFree] = await Promise.all([
			layOutGroup(groupedGraph(hubLinkedEdges)),
			layOutGroup(groupedGraph(chainEdges)),
			layOutGroup(groupedGraph([])),
		]);
		expect([
			[chain.widthPx, chain.heightPx],
			[edgeFree.widthPx, edgeFree.heightPx],
		]).toEqual([
			[hub.widthPx, hub.heightPx],
			[hub.widthPx, hub.heightPx],
		]);
	});

	it("WHEN laid out twice THEN the group box is identical (determinism)", async () => {
		const first = await layOutGroup(groupedGraph(hubLinkedEdges));
		const second = await layOutGroup(groupedGraph(hubLinkedEdges));
		expect([second.widthPx, second.heightPx]).toEqual([first.widthPx, first.heightPx]);
	});
});
