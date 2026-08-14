import { describe, expect, it } from "vitest";
import type { ElkNode } from "elkjs";
import { EngineDefaults, asFolderPath, asVaultPath } from "../engine";
import { ELK_FORCE_ALGORITHM, GROUP_BOX_PADDING_PX } from "./constants";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { GraphLayoutRunner } from "./GraphLayoutRunner";
import { refineForceRootLayout } from "./d3ForceRefinement";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "./elkMapping";
import { isFolderGroupId } from "./graphIdentity";
import { withContainerAlgorithm } from "./testFixtures/elkContainerAlgorithm";
import { countOverlappingAabbPairs } from "./testFixtures/aabbOverlap";
import type { Aabb } from "./testFixtures/aabbOverlap";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";
import type { ForceLayoutSettings, VicinityGraph } from "../engine";

/**
 * Guards the ticket-04 force-layout threading: the runner must actually FEED
 * the given settings into the d3 refinement (a silently-ignored parameter
 * would fall back to defaults and make every slider a no-op), while omitting
 * the parameter must reproduce the engine-default behavior exactly.
 */

const NEIGHBOR_COUNT = 6;

function fanOutGraph(): VicinityGraph {
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("hub.md"), isCentral: true, isMain: true, minDepth: 0, sizePx: 120 }),
			...Array.from({ length: NEIGHBOR_COUNT }, (_, index) =>
				makeNode({ path: asVaultPath(`n${index}.md`), minDepth: 1, sizePx: 80 }),
			),
		],
		edges: Array.from({ length: NEIGHBOR_COUNT }, (_, index) => makeEdge("hub.md", `n${index}.md`)),
	});
}

async function positionsWith(forceLayout?: ForceLayoutSettings): Promise<ReadonlyMap<string, { x: number; y: number }>> {
	const elkRoot = vicinityGraphToElk(fanOutGraph());
	const laidOut =
		forceLayout === undefined
			? await new GraphLayoutRunner().layout(elkRoot)
			: await new GraphLayoutRunner().layout(elkRoot, forceLayout);
	return extractElkPositions(laidOut);
}

describe("GraphLayoutRunner force-layout threading (ticket-04)", () => {
	it("WHEN the engine-default settings are passed explicitly THEN positions equal the omitted-parameter run (defaults change nothing)", async () => {
		expect(await positionsWith(EngineDefaults.forceLayoutSettings())).toEqual(await positionsWith());
	});

	it("WHEN a non-default link gap is passed THEN the layout differs from the default run (the parameter reaches d3)", async () => {
		const widened = { ...EngineDefaults.forceLayoutSettings(), linkGapPx: 150 };
		expect(await positionsWith(widened)).not.toEqual(await positionsWith());
	});
});

/**
 * Guards the per-container refinement SEAM (recursive GraphLayoutRunner): the
 * runner now recurses into every container and refines each whose elk algorithm
 * is `force`, but with every folder container on `rectpacking` today NOTHING in
 * an interior may move. The reference is the exact pre-recursion algorithm —
 * elk once, then `refineForceRootLayout` on the ROOT only — reconstructed here
 * from its own pieces, so this asserts byte-identity to today's output, group
 * members included (`extractElkPositions` recurses into containers).
 */
function twoFolderGraph(): VicinityGraph {
	const grouped = (folder: string, file: string, minDepth: number): ReturnType<typeof makeNode> =>
		makeNode({ path: asVaultPath(file), folder: asFolderPath(folder), minDepth, sizePx: 80 });
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("hub.md"), isCentral: true, isMain: true, minDepth: 0, sizePx: 120 }),
			grouped("alpha", "alpha/a0.md", 1),
			grouped("alpha", "alpha/a1.md", 1),
			grouped("alpha", "alpha/a2.md", 2),
			grouped("beta", "beta/b0.md", 1),
			grouped("beta", "beta/b1.md", 2),
			makeNode({ path: asVaultPath("loose.md"), minDepth: 1, sizePx: 80 }),
		],
		edges: [
			makeEdge("hub.md", "alpha/a0.md"),
			makeEdge("alpha/a0.md", "alpha/a1.md"),
			makeEdge("alpha/a1.md", "alpha/a2.md"),
			makeEdge("hub.md", "beta/b0.md"),
			makeEdge("beta/b0.md", "beta/b1.md"),
			makeEdge("hub.md", "loose.md"),
		],
	});
}

describe("GraphLayoutRunner per-container refinement seam (rectpacking interiors untouched)", () => {
	it("WHEN a grouped graph lays out THEN every position equals the root-only refinement (recursion is a no-op on rectpacking containers)", async () => {
		const elkRoot = vicinityGraphToElk(twoFolderGraph());
		const actual = extractElkPositions(await new GraphLayoutRunner().layout(elkRoot));
		const rootOnly = refineForceRootLayout(
			await new ElkLayoutRunner().layout(vicinityGraphToElk(twoFolderGraph())),
			EngineDefaults.forceLayoutSettings(),
		);
		expect(actual).toEqual(extractElkPositions(rootOnly));
	});
});

/**
 * Guards the box REFIT of force-mode containers (ticket
 * nid_7abfje1vus15rx9hzmpel9jin_e): the d3 interior refinement moves a
 * container's children, so without a refit the elk-computed container box is
 * stale and members render OUTSIDE their group border. After the refit, every
 * container box must wrap its refined children with the declared group padding,
 * bottom-up, so parents always arrange final child boxes.
 */
function nestedEdgedGraph(): VicinityGraph {
	const grouped = (folder: string, file: string): ReturnType<typeof makeNode> =>
		makeNode({ path: asVaultPath(file), folder: asFolderPath(folder), minDepth: 1, sizePx: 80 });
	const chainIn = (folder: string, tag: string, count: number): ReturnType<typeof makeEdge>[] =>
		Array.from({ length: count - 1 }, (_, i) => makeEdge(`${folder}/${tag}${i}.md`, `${folder}/${tag}${i + 1}.md`));
	const membersIn = (folder: string, tag: string, count: number): ReturnType<typeof makeNode>[] =>
		Array.from({ length: count }, (_, i) => grouped(folder, `${folder}/${tag}${i}.md`));
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("hub.md"), isCentral: true, isMain: true, minDepth: 0, sizePx: 120 }),
			...membersIn("sql/joins", "j", 5),
			...membersIn("sql/windows", "w", 5),
		],
		edges: [
			makeEdge("hub.md", "sql/joins/j0.md"),
			makeEdge("sql/joins/j0.md", "sql/windows/w0.md"),
			...chainIn("sql/joins", "j", 5),
			...chainIn("sql/windows", "w", 5),
		],
	});
}

interface LaidOutRects {
	readonly absoluteRectOf: (id: string) => Aabb;
	readonly containers: readonly ElkNode[]; // every folder-group container, with laid-out children
	readonly laidOutRoot: ElkNode;
}

async function layoutWithForceInteriors(): Promise<LaidOutRects> {
	const elkRoot = withContainerAlgorithm(vicinityGraphToElk(nestedEdgedGraph()), ELK_FORCE_ALGORITHM);
	const laidOutRoot = await new GraphLayoutRunner().layout(elkRoot);
	const positions = extractElkPositions(laidOutRoot);
	const dims = extractElkDimensionsById(laidOutRoot);
	const absoluteRectOf = (id: string): Aabb => {
		const p = positions.get(id);
		const d = dims.get(id);
		if (p === undefined || d === undefined) throw new Error(`no laid-out rect for id=[${id}]`);
		return { x: p.x, y: p.y, width: d.width, height: d.height };
	};
	const containers: ElkNode[] = [];
	const collect = (node: ElkNode): void => {
		for (const child of node.children ?? []) {
			if (isFolderGroupId(child.id)) containers.push(child);
			collect(child);
		}
	};
	collect(laidOutRoot);
	return { absoluteRectOf, containers, laidOutRoot };
}

describe("GraphLayoutRunner force-interior box refit", () => {
	it("WHEN containers run force THEN every child lies inside its container's box (nothing pokes through the group border)", async () => {
		const { absoluteRectOf, containers } = await layoutWithForceInteriors();
		const violations: string[] = [];
		for (const container of containers) {
			const box = absoluteRectOf(container.id);
			for (const child of container.children ?? []) {
				const r = absoluteRectOf(child.id);
				const inside =
					r.x >= box.x && r.y >= box.y && r.x + r.width <= box.x + box.width && r.y + r.height <= box.y + box.height;
				if (!inside) violations.push(`${child.id} outside ${container.id}`);
			}
		}
		expect(violations).toEqual([]);
	});

	it("WHEN containers run force THEN each container box wraps its children's bbox with exactly the group padding", async () => {
		const pad = GROUP_BOX_PADDING_PX;
		const TOLERANCE_PX = 0.5;
		const { absoluteRectOf, containers } = await layoutWithForceInteriors();
		const violations: string[] = [];
		for (const container of containers) {
			const box = absoluteRectOf(container.id);
			const rects = (container.children ?? []).map((child) => absoluteRectOf(child.id));
			if (rects.length === 0) continue;
			const minX = Math.min(...rects.map((r) => r.x));
			const minY = Math.min(...rects.map((r) => r.y));
			const maxX = Math.max(...rects.map((r) => r.x + r.width));
			const maxY = Math.max(...rects.map((r) => r.y + r.height));
			const insets = [
				["left", minX - box.x, pad.left],
				["top", minY - box.y, pad.top],
				["right", box.x + box.width - maxX, pad.right],
				["bottom", box.y + box.height - maxY, pad.bottom],
			] as const;
			for (const [side, actual, declared] of insets) {
				if (Math.abs(actual - declared) > TOLERANCE_PX) {
					violations.push(`${container.id} ${side} inset ${actual.toFixed(1)} != ${declared}`);
				}
			}
		}
		expect(violations).toEqual([]);
	});

	it("WHEN containers run force THEN no two siblings overlap at any level (parents arrange the REFIT boxes)", async () => {
		const { absoluteRectOf, containers, laidOutRoot } = await layoutWithForceInteriors();
		const levels = [laidOutRoot, ...containers];
		const overlapsPerLevel = levels.map((level) =>
			countOverlappingAabbPairs((level.children ?? []).map((child) => absoluteRectOf(child.id))),
		);
		expect(overlapsPerLevel).toEqual(levels.map(() => 0));
	});
});
