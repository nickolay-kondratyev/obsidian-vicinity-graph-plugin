import { describe, expect, it } from "vitest";
import { EdgeCounts } from "./EdgeCounts";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { DirectedLink } from "./types";
import { asVaultPath } from "./types";

/**
 * GIVEN the reviewer's frontier scenario: MAIN m.md links two depth-1 siblings
 * a.md and b.md which also link EACH OTHER; a.md additionally links a
 * truncated-away note and an image attachment.
 */
function siblingProvider(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [
			{ path: "m.md" },
			{ path: "a.md" },
			{ path: "b.md" },
			{ path: "hidden.md" },
			{ path: "img.png" },
		],
		links: {
			"m.md": ["a.md", "b.md"],
			"a.md": ["b.md", "hidden.md", "img.png"],
		},
	});
}

/** Walked edges as the truncator would hand them over (hidden.md truncated away). */
const WALKED: readonly DirectedLink[] = [
	{ source: asVaultPath("m.md"), target: asVaultPath("a.md") },
	{ source: asVaultPath("m.md"), target: asVaultPath("b.md") },
];

function siblingEdges(): string[] {
	return EdgeCounts.attach({ walkedVisibleEdges: WALKED, provider: siblingProvider() })
		.map((edge) => `${edge.source}->${edge.target}`)
		.sort();
}

describe("EdgeCounts walked-edge pass-through", () => {
	it("WHEN attaching counts THEN the walked edge set passes through untouched (sibling link stays hidden)", () => {
		expect(siblingEdges()).toEqual(["m.md->a.md", "m.md->b.md"]);
	});

	it("WHEN attaching counts twice over the same input THEN the edge lists are identical (determinism)", () => {
		expect(siblingEdges()).toEqual(siblingEdges());
	});
});

describe("EdgeCounts link counts (step-05, CLARIFICATION Q1)", () => {
	it("WHEN a note declares the same link twice THEN its single edge carries count 2", () => {
		const edges = EdgeCounts.attach({
			walkedVisibleEdges: [{ source: asVaultPath("m.md"), target: asVaultPath("a.md") }],
			provider: new FakeLinkProvider({
				files: [{ path: "m.md" }, { path: "a.md" }],
				links: { "m.md": ["a.md", "a.md"] },
			}),
		});
		expect(edges).toEqual([{ source: "m.md", target: "a.md", count: 2 }]);
	});

	it("WHEN a single link resolves THEN its edge carries count 1", () => {
		const edges = EdgeCounts.attach({ walkedVisibleEdges: WALKED, provider: siblingProvider() });
		expect(edges[0]?.count).toBe(1);
	});

	it("WHEN the provider answers 0 for a walked edge (cache lag) THEN the count is floored at 1", () => {
		const edges = EdgeCounts.attach({
			// A walked pair the provider no longer reports (momentary cache lag).
			walkedVisibleEdges: [{ source: asVaultPath("m.md"), target: asVaultPath("a.md") }],
			provider: new FakeLinkProvider({ files: [{ path: "m.md" }, { path: "a.md" }] }),
		});
		expect(edges[0]?.count).toBe(1);
	});
});
