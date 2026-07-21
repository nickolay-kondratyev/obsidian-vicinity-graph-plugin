import { describe, expect, it } from "vitest";
import { EngineDefaults } from "./constants";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { GraphBuildRequest } from "./NeighborhoodEngine";
import { NeighborhoodEngine } from "./NeighborhoodEngine";
import { largeMixedVault } from "./testFixtures/denseVaultFixtures";
import type { NeighborhoodGraph } from "./types";
import { asVaultPath } from "./types";

/**
 * Step-07 engine-level dense-fixture regression: exercises the full
 * `NeighborhoodEngine.build` pipeline (traverse → size → truncate → assemble) over
 * the committed ~500-node vault, asserting caps, determinism, and a single LOOSE
 * wall-clock ceiling (CLARIFICATION decision #1) — a regression guard, not a
 * micro-benchmark.
 */

/** Engine build request over the ~500-node dense vault, deep enough to reach every node. */
function denseRequest(overrides: Partial<GraphBuildRequest> = {}): GraphBuildRequest {
	return {
		main: { path: asVaultPath(largeMixedVault().mainPath) },
		globalDepths: { outgoingDepth: 2, incomingDepth: 0 },
		globalView: EngineDefaults.viewSettings(),
		...overrides,
	};
}

function buildDense(overrides: Partial<GraphBuildRequest> = {}): NeighborhoodGraph {
	return new NeighborhoodEngine(new FakeLinkProvider(largeMixedVault().spec)).build(denseRequest(overrides));
}

/**
 * Loose wall-clock ceiling for one dense engine build at cap 100. Generous on
 * purpose (machine-independent regression guard, per CLARIFICATION #1); a real
 * regression would blow past it by an order of magnitude.
 */
const DENSE_BUILD_CEILING_MS = 150;

describe("NeighborhoodEngine dense build respects the cap", () => {
	it("WHEN cap is 100 over the ~500-node vault THEN exactly 100 non-centrals render", () => {
		const graph = buildDense({ globalView: { ...EngineDefaults.viewSettings(), nodeCap: 100 } });
		expect(graph.nodes.filter((node) => !node.isCentral)).toHaveLength(100);
	});

	it("WHEN cap is 100 THEN MAIN is always present regardless of the cap", () => {
		const graph = buildDense({ globalView: { ...EngineDefaults.viewSettings(), nodeCap: 100 } });
		expect(graph.nodes.some((node) => node.isMain)).toBe(true);
	});
});

describe("NeighborhoodEngine dense build determinism", () => {
	it("WHEN the same dense request is built twice THEN the graphs are identical", () => {
		const request: Partial<GraphBuildRequest> = { globalView: { ...EngineDefaults.viewSettings(), nodeCap: 100 } };
		expect(buildDense(request)).toEqual(buildDense(request));
	});
});

describe("NeighborhoodEngine runtime cap change end-to-end", () => {
	it("WHEN MAIN's view override lowers then raises the cap THEN the smaller visible set is a subset of the larger", () => {
		const paths = (nodeCap: number): Set<string> =>
			new Set(buildDense({ mainViewOverride: { nodeCap } }).nodes.map((node) => node.path));
		const atThirty = paths(30);
		const atNinety = paths(90);
		expect([...atThirty].every((path) => atNinety.has(path))).toBe(true);
	});
});

describe("NeighborhoodEngine dense build timing (loose regression guard)", () => {
	it("WHEN building the ~500-node vault at cap 100 THEN it completes under the loose ceiling", () => {
		const provider = new FakeLinkProvider(largeMixedVault().spec);
		const engine = new NeighborhoodEngine(provider);
		const request = denseRequest({ globalView: { ...EngineDefaults.viewSettings(), nodeCap: 100 } });
		engine.build(request); // warm-up (module/JIT) so the measured run is steady-state.
		const start = performance.now();
		engine.build(request);
		const elapsedMs = performance.now() - start;
		expect(elapsedMs).toBeLessThan(DENSE_BUILD_CEILING_MS);
	});
});
