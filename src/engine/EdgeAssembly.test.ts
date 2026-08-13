import { describe, expect, it } from "vitest";
import { EdgeAssembly } from "./EdgeAssembly";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { DirectedLink, EdgeKind } from "./types";
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
	return EdgeAssembly.attach({ visibleEdges: WALKED, provider: siblingProvider() })
		.map((edge) => `${edge.source}->${edge.target}`)
		.sort();
}

describe("EdgeAssembly walked-edge pass-through", () => {
	it("WHEN assembling edges THEN the walked edge set passes through untouched (sibling link stays hidden)", () => {
		expect(siblingEdges()).toEqual(["m.md->a.md", "m.md->b.md"]);
	});

	it("WHEN assembling twice over the same input THEN the edge lists are identical (determinism)", () => {
		expect(siblingEdges()).toEqual(siblingEdges());
	});
});

describe("EdgeAssembly link counts (step-05, CLARIFICATION Q1)", () => {
	it("WHEN a note declares the same link twice THEN its single edge carries count 2", () => {
		const edges = EdgeAssembly.attach({
			visibleEdges: [{ source: asVaultPath("m.md"), target: asVaultPath("a.md") }],
			provider: new FakeLinkProvider({
				files: [{ path: "m.md" }, { path: "a.md" }],
				links: { "m.md": ["a.md", "a.md"] },
			}),
		});
		expect(edges).toEqual([{ source: "m.md", target: "a.md", count: 2, kind: "link", hierarchy: false }]);
	});

	it("WHEN a single link resolves THEN its edge carries count 1", () => {
		const edges = EdgeAssembly.attach({ visibleEdges: WALKED, provider: siblingProvider() });
		expect(edges[0]?.count).toBe(1);
	});

	it("WHEN the provider answers 0 for a walked edge (cache lag) THEN the count is floored at 1", () => {
		const edges = EdgeAssembly.attach({
			// A walked pair the provider no longer reports (momentary cache lag).
			visibleEdges: [{ source: asVaultPath("m.md"), target: asVaultPath("a.md") }],
			provider: new FakeLinkProvider({ files: [{ path: "m.md" }, { path: "a.md" }] }),
		});
		expect(edges[0]?.count).toBe(1);
	});
});

/**
 * GIVEN one source relating to three targets three different ways: plainly
 * linked only, embedded only, and BOTH embedded and plainly linked.
 */
function threeKindsProvider(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [{ path: "m.md" }, { path: "linked.md" }, { path: "embedded.md" }, { path: "both.md" }],
		links: { "m.md": ["linked.md", "both.md"] },
		embeds: { "m.md": ["embedded.md", "both.md"] },
	});
}

function assembledKindOf(target: string): EdgeKind | undefined {
	const edges = EdgeAssembly.attach({
		visibleEdges: [{ source: asVaultPath("m.md"), target: asVaultPath(target) }],
		provider: threeKindsProvider(),
	});
	return edges[0]?.kind;
}

describe("EdgeAssembly edge kind summary (stage-2 embed rendering)", () => {
	it("WHEN a pair is plainly linked only THEN its edge kind is 'link'", () => {
		expect(assembledKindOf("linked.md")).toBe("link");
	});

	it("WHEN a pair is embedded only THEN its edge kind is 'embed'", () => {
		expect(assembledKindOf("embedded.md")).toBe("embed");
	});

	it("WHEN a pair is BOTH embedded and plainly linked THEN its edge kind is 'both' (deliberate summary, not a race)", () => {
		expect(assembledKindOf("both.md")).toBe("both");
	});

	it("WHEN the provider reports NO reference for a walked pair (cache lag) THEN the kind falls back to 'link'", () => {
		const edges = EdgeAssembly.attach({
			visibleEdges: [{ source: asVaultPath("m.md"), target: asVaultPath("a.md") }],
			provider: new FakeLinkProvider({ files: [{ path: "m.md" }, { path: "a.md" }] }),
		});
		expect(edges[0]?.kind).toBe("link");
	});

	it("WHEN a source has many assembled edges THEN its reference list is fetched once (per-source cache)", () => {
		const provider = threeKindsProvider();
		EdgeAssembly.attach({
			visibleEdges: [
				{ source: asVaultPath("m.md"), target: asVaultPath("linked.md") },
				{ source: asVaultPath("m.md"), target: asVaultPath("embedded.md") },
				{ source: asVaultPath("m.md"), target: asVaultPath("both.md") },
			],
			provider,
		});
		expect(provider.outgoingQueryCount(asVaultPath("m.md"))).toBe(1);
	});
});
