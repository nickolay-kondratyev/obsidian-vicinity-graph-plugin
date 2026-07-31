import { describe, expect, it } from "vitest";
import { CrossLinkSweep } from "./CrossLinkSweep";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { DirectedLink, VaultPath } from "./types";
import { asVaultPath } from "./types";

/**
 * GIVEN the frontier scenario the "Show cross links" setting exists for: MAIN m.md
 * links two depth-1 siblings a.md and b.md, which also link EACH OTHER; a.md
 * additionally links a truncated-away note and an image attachment.
 */
function siblingProvider(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [{ path: "m.md" }, { path: "a.md" }, { path: "b.md" }, { path: "hidden.md" }, { path: "img.png" }],
		links: {
			"m.md": ["a.md", "b.md"],
			"a.md": ["b.md", "hidden.md", "img.png"],
		},
	});
}

/** The post-truncation node set: hidden.md was capped away, img.png is an attachment. */
function visiblePaths(): ReadonlySet<VaultPath> {
	return new Set([asVaultPath("m.md"), asVaultPath("a.md"), asVaultPath("b.md")]);
}

function sweptPairs(walkedVisibleEdges: readonly DirectedLink[] = []): string[] {
	return CrossLinkSweep.inducedPairs({ walkedVisibleEdges, visiblePaths: visiblePaths(), provider: siblingProvider() })
		.map((pair) => `${pair.source}->${pair.target}`)
		.sort();
}

describe("CrossLinkSweep induced subgraph", () => {
	it("WHEN two visible nodes link each other and the walk never traversed it THEN the pair is swept up", () => {
		expect(sweptPairs()).toContain("a.md->b.md");
	});

	it("WHEN a visible node links a node truncation removed THEN that pair is not swept up", () => {
		expect(sweptPairs()).not.toContain("a.md->hidden.md");
	});

	it("WHEN a visible node links an attachment THEN that pair is not swept up (attachments are never nodes)", () => {
		expect(sweptPairs()).not.toContain("a.md->img.png");
	});

	it("WHEN the sweep runs THEN it emits exactly the links between visible nodes", () => {
		expect(sweptPairs()).toEqual(["a.md->b.md", "m.md->a.md", "m.md->b.md"]);
	});

	it("WHEN a source declares the same link twice THEN the pair is emitted once (count comes from EdgeAssembly)", () => {
		const pairs = CrossLinkSweep.inducedPairs({
			walkedVisibleEdges: [],
			visiblePaths: new Set([asVaultPath("m.md"), asVaultPath("a.md")]),
			provider: new FakeLinkProvider({
				files: [{ path: "m.md" }, { path: "a.md" }],
				links: { "m.md": ["a.md", "a.md"] },
			}),
		});
		expect(pairs).toEqual([{ source: "m.md", target: "a.md" }]);
	});

	// THE superset contract: a walked edge the outgoing channel cannot see (the
	// incoming channel is a different provider authority) must survive the toggle.
	it("WHEN a walked edge is invisible to the outgoing channel THEN the sweep still emits it", () => {
		const walked: DirectedLink = { source: asVaultPath("b.md"), target: asVaultPath("m.md") };
		expect(sweptPairs([walked])).toContain("b.md->m.md");
	});

	it("WHEN a walked edge is ALSO induced THEN it is emitted once (the seed dedupes)", () => {
		const walked: DirectedLink = { source: asVaultPath("m.md"), target: asVaultPath("a.md") };
		expect(sweptPairs([walked])).toEqual(["a.md->b.md", "m.md->a.md", "m.md->b.md"]);
	});
});
