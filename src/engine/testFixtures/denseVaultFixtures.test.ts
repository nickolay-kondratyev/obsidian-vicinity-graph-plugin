import { describe, expect, it } from "vitest";
import { FakeLinkProvider } from "../FakeLinkProvider";
import { traverseFixture } from "./truncationHarness";
import type { DenseFixture } from "./denseVaultFixtures";
import { allDefaultDenseFixtures, hubFanOut, SeededRandom } from "./denseVaultFixtures";

const FIXTURES = allDefaultDenseFixtures();

/** Traverse a fixture deep enough (per its own hint) to reach every node-bearing file. */
function reachedNodeCount(fixture: DenseFixture): number {
	const roots = [fixture.mainPath, ...(fixture.pinnedPaths ?? [])];
	const stages = traverseFixture(fixture.spec, roots, {
		linkDepthOut: fixture.depthToCoverAll,
		linkDepthIn: 0,
	});
	return stages.traversal.nodes.size;
}

describe("denseVaultFixtures construct without declaration gaps", () => {
	// WHY: FakeLinkProvider throws if a link references an undeclared file. This
	// self-test is the guard that the generator always declares every path.
	for (const [name, fixture] of Object.entries(FIXTURES)) {
		it(`WHEN constructing the ${name} fixture THEN FakeLinkProvider does not throw`, () => {
			expect(() => new FakeLinkProvider(fixture.spec)).not.toThrow();
		});
	}
});

describe("denseVaultFixtures reach their declared node-bearing files", () => {
	for (const [name, fixture] of Object.entries(FIXTURES)) {
		it(`WHEN traversing the ${name} fixture to its cover depth THEN every node-bearing file appears`, () => {
			expect(reachedNodeCount(fixture)).toBe(fixture.nodeBearingCount);
		});
	}
});

describe("denseVaultFixtures scale expectations", () => {
	it("WHEN hubFanOut uses defaults THEN it fans out to 200+ spokes", () => {
		// The step doc calls for a hub with 200+ links; assert the shape delivers it.
		expect(hubFanOut().nodeBearingCount).toBeGreaterThan(200);
	});

	it("WHEN largeMixedVault uses defaults THEN it is a ~500-node dense graph", () => {
		expect(FIXTURES.largeMixedVault?.nodeBearingCount).toBeGreaterThanOrEqual(500);
	});
});

describe("denseVaultFixtures determinism", () => {
	it("WHEN the same builder runs twice THEN the specs are structurally identical", () => {
		expect(hubFanOut()).toEqual(hubFanOut());
	});
});

describe("SeededRandom determinism", () => {
	it("WHEN two generators share a seed THEN they emit identical sequences", () => {
		const a = new SeededRandom(42);
		const b = new SeededRandom(42);
		const sequence = (random: SeededRandom): number[] => [random.nextInt(1000), random.nextInt(1000), random.nextInt(1000)];
		expect(sequence(a)).toEqual(sequence(b));
	});
});
