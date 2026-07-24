import { describe, expect, it } from "vitest";
import { EngineDefaults, asVaultPath } from "../engine";
import { GraphLayoutRunner } from "./GraphLayoutRunner";
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
