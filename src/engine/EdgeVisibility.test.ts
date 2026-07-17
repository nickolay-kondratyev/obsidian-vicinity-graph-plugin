import { describe, expect, it } from "vitest";
import { DEFAULT_EDGE_VISIBILITY, EngineDefaults } from "./constants";
import { EdgeVisibility } from "./EdgeVisibility";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { GraphEdge, VaultPath } from "./types";
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

/** Visible set and walked edges as the truncator would hand them over (hidden.md truncated away). */
const VISIBLE: ReadonlySet<VaultPath> = new Set([asVaultPath("m.md"), asVaultPath("a.md"), asVaultPath("b.md")]);
const WALKED: readonly GraphEdge[] = [
	{ source: asVaultPath("m.md"), target: asVaultPath("a.md") },
	{ source: asVaultPath("m.md"), target: asVaultPath("b.md") },
];

function edgesInMode(mode: "walked-from-center" | "all-edges"): string[] {
	return EdgeVisibility.edgesFor({
		mode,
		visiblePaths: VISIBLE,
		walkedVisibleEdges: WALKED,
		provider: siblingProvider(),
	})
		.map((edge) => `${edge.source}->${edge.target}`)
		.sort();
}

describe("EdgeVisibility defaults", () => {
	it("WHEN no one chose a mode THEN the default is all-edges (TOP_LEVEL decision, flagged to human)", () => {
		expect(DEFAULT_EDGE_VISIBILITY).toBe("all-edges");
	});

	it("WHEN building default view settings THEN they carry the default edge mode", () => {
		expect(EngineDefaults.viewSettings().edgeVisibility).toBe(DEFAULT_EDGE_VISIBILITY);
	});
});

describe("EdgeVisibility walked-from-center mode", () => {
	it("WHEN resolving THEN the walked edge set passes through untouched (sibling link stays hidden)", () => {
		expect(edgesInMode("walked-from-center")).toEqual(["m.md->a.md", "m.md->b.md"]);
	});
});

describe("EdgeVisibility all-edges mode (induced subgraph)", () => {
	it("WHEN two visible siblings link each other THEN their edge appears", () => {
		expect(edgesInMode("all-edges")).toContain("a.md->b.md");
	});

	it("WHEN resolving THEN every walked edge is still present (superset of walked mode)", () => {
		const allEdges = edgesInMode("all-edges");
		expect(edgesInMode("walked-from-center").every((edge) => allEdges.includes(edge))).toBe(true);
	});

	it("WHEN a link points at a truncated-away node THEN no edge appears for it", () => {
		expect(edgesInMode("all-edges")).not.toContain("a.md->hidden.md");
	});

	it("WHEN a link points at an attachment THEN no edge appears for it (attachments are never visible)", () => {
		expect(edgesInMode("all-edges")).not.toContain("a.md->img.png");
	});

	it("WHEN sweeping the sibling fixture THEN the induced edge set is exactly walked + sibling link", () => {
		expect(edgesInMode("all-edges")).toEqual(["a.md->b.md", "m.md->a.md", "m.md->b.md"]);
	});

	it("WHEN a note declares the same link twice THEN the edge is deduplicated", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "m.md" }, { path: "a.md" }],
			links: { "m.md": ["a.md", "a.md"] },
		});
		const edges = EdgeVisibility.edgesFor({
			mode: "all-edges",
			visiblePaths: new Set([asVaultPath("m.md"), asVaultPath("a.md")]),
			walkedVisibleEdges: [],
			provider,
		});
		expect(edges).toEqual([{ source: "m.md", target: "a.md" }]);
	});

	it("WHEN two nodes were discovered by DIFFERENT roots THEN their cross-root link still appears", () => {
		// GIVEN main m.md -> a.md, pinned p.md -> b.md, and a real link a.md -> b.md
		// that no BFS walked (each root stopped at depth 1).
		const provider = new FakeLinkProvider({
			files: [{ path: "m.md" }, { path: "a.md" }, { path: "p.md" }, { path: "b.md" }],
			links: {
				"m.md": ["a.md"],
				"p.md": ["b.md"],
				"a.md": ["b.md"],
			},
		});
		const edges = EdgeVisibility.edgesFor({
			mode: "all-edges",
			visiblePaths: new Set(["m.md", "a.md", "p.md", "b.md"].map(asVaultPath)),
			walkedVisibleEdges: [
				{ source: asVaultPath("m.md"), target: asVaultPath("a.md") },
				{ source: asVaultPath("p.md"), target: asVaultPath("b.md") },
			],
			provider,
		});
		expect(edges.map((edge) => `${edge.source}->${edge.target}`)).toContain("a.md->b.md");
	});

	it("WHEN resolving the same input twice THEN the edge lists are identical (determinism)", () => {
		expect(edgesInMode("all-edges")).toEqual(edgesInMode("all-edges"));
	});
});
