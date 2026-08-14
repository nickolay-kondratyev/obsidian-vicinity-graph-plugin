import { describe, expect, it } from "vitest";
import { EngineDefaults, asFolderPath, asVaultPath } from "../engine";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { GraphLayoutRunner } from "./GraphLayoutRunner";
import { refineForceRootLayout } from "./d3ForceRefinement";
import { extractElkPositions, vicinityGraphToElk } from "./elkMapping";
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
