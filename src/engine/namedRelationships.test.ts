import { describe, expect, it } from "vitest";
import { EngineDefaults } from "./constants";
import { FakeLinkProvider, type FakeVaultSpec } from "./FakeLinkProvider";
import { FakeRelationProvider, type FakeRelationSpec } from "./FakeRelationProvider";
import { VicinityEngine } from "./VicinityEngine";
import type { DepthSettings, GraphEdge, VicinityGraph } from "./types";
import { asVaultPath } from "./types";

/**
 * NAMED RELATIONSHIPS (feature `named-relationships`, ticket
 * `nid_ufbtmywzbsyn2gwrx7bi0ww08_e`) end-to-end through the engine, fixture-tested
 * via `Fake*` providers. Covers the four behaviours the ticket demands: the named
 * channels' own depth budgets, the either-budget UNION (one occurrence served
 * through both a plain and a named channel is still ONE edge), edge LABEL carriage,
 * and per-occurrence REL-NOTE folding.
 *
 * Every depth starts at 0 ({@link ZERO_DEPTHS}) so each test turns on ONLY the
 * budgets it exercises — a graph's reach is then attributable to one dial.
 */
const ZERO_DEPTHS: DepthSettings = {
	linkDepthOut: 0,
	embedDepthOut: 0,
	linkDepthIn: 0,
	namedDepthOut: 0,
	namedDepthIn: 0,
	descendantDepth: 0,
	ancestorDepth: 0,
	pinnedLinkDepthOut: 0,
	pinnedEmbedDepthOut: 0,
	pinnedLinkDepthIn: 0,
	pinnedNamedDepthOut: 0,
	pinnedNamedDepthIn: 0,
	pinnedDescendantDepth: 0,
	pinnedAncestorDepth: 0,
};

function graphOf(
	spec: FakeVaultSpec,
	relSpec: FakeRelationSpec,
	depthOverrides: Partial<DepthSettings>,
	main = "a.md",
): VicinityGraph {
	return new VicinityEngine(new FakeLinkProvider(spec), new FakeRelationProvider(relSpec)).build({
		main: { path: asVaultPath(main) },
		globalDepths: { ...ZERO_DEPTHS, ...depthOverrides },
		globalView: EngineDefaults.viewSettings(),
	});
}

function paths(graph: VicinityGraph): string[] {
	return graph.nodes.map((node) => node.path).sort();
}

function edge(graph: VicinityGraph, source: string, target: string): GraphEdge | undefined {
	return graph.edges.find((candidate) => candidate.source === source && candidate.target === target);
}

/** A chain a→b→c→d where every hop is a NAMED link (`supports`) — no plain-only links. */
const NAMED_CHAIN: FakeVaultSpec = {
	files: [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }, { path: "d.md" }],
	named: {
		"a.md": [{ target: "b.md", name: "supports" }],
		"b.md": [{ target: "c.md", name: "supports" }],
		"c.md": [{ target: "d.md", name: "supports" }],
	},
};

describe("named channel depth budgets", () => {
	it("WHEN the named budget reaches deeper than the link budget THEN the deeper nodes are discovered via it", () => {
		const graph = graphOf(NAMED_CHAIN, {}, { linkDepthOut: 1, namedDepthOut: 3 });
		expect(paths(graph)).toEqual(["a.md", "b.md", "c.md", "d.md"]);
	});

	it("WHEN only the named budget is set (link budget 0) THEN named links traverse under it ALONE", () => {
		const graph = graphOf(NAMED_CHAIN, {}, { linkDepthOut: 0, namedDepthOut: 2 });
		expect(paths(graph)).toEqual(["a.md", "b.md", "c.md"]);
	});

	it("WHEN the named budget is 0 THEN a named link still traverses as a plain link (a named link is still a link)", () => {
		const graph = graphOf(NAMED_CHAIN, {}, { linkDepthOut: 1, namedDepthOut: 0 });
		expect(paths(graph)).toEqual(["a.md", "b.md"]);
	});

	it("WHEN the named-INCOMING budget is set THEN named linkers are discovered against the link-in flow", () => {
		const graph = graphOf(NAMED_CHAIN, {}, { linkDepthIn: 0, namedDepthIn: 2 }, "d.md");
		expect(paths(graph)).toEqual(["b.md", "c.md", "d.md"]);
	});
});

describe("either-budget union: one physical occurrence, one edge", () => {
	const SINGLE_NAMED: FakeVaultSpec = {
		files: [{ path: "a.md" }, { path: "b.md" }],
		named: { "a.md": [{ target: "b.md", name: "supports" }] },
	};

	it("WHEN one named link is reachable through BOTH the link and named budgets THEN it is ONE edge, count 1, one label", () => {
		// Both budgets reach b; the occurrence must still count once and be labelled once.
		const graph = graphOf(SINGLE_NAMED, {}, { linkDepthOut: 1, namedDepthOut: 1 });
		const ab = edge(graph, "a.md", "b.md");
		expect({ count: ab?.count, relations: ab?.relations }).toEqual({ count: 1, relations: [{ name: "supports" }] });
	});

	it("WHEN a named EMBED is reached only via the named budget THEN the edge kind stays embed", () => {
		const namedEmbed: FakeVaultSpec = {
			files: [{ path: "a.md" }, { path: "b.md" }],
			named: { "a.md": [{ target: "b.md", name: "supports", embed: true }] },
		};
		const ab = edge(graphOf(namedEmbed, {}, { embedDepthOut: 0, namedDepthOut: 1 }), "a.md", "b.md");
		expect({ kind: ab?.kind, relations: ab?.relations }).toEqual({ kind: "embed", relations: [{ name: "supports" }] });
	});
});

describe("edge label carriage", () => {
	it("WHEN a pair carries several named relations THEN the edge carries ALL of them (count matches occurrences)", () => {
		const spec: FakeVaultSpec = {
			files: [{ path: "a.md" }, { path: "b.md" }],
			named: {
				"a.md": [
					{ target: "b.md", name: "supports" },
					{ target: "b.md", name: "refines" },
				],
			},
		};
		const ab = edge(graphOf(spec, {}, { namedDepthOut: 1 }), "a.md", "b.md");
		expect({ count: ab?.count, names: ab?.relations?.map((relation) => relation.name) }).toEqual({
			count: 2,
			names: ["supports", "refines"],
		});
	});

	it("WHEN a named relation carries a qualifier THEN the label carries it too", () => {
		const spec: FakeVaultSpec = {
			files: [{ path: "a.md" }, { path: "b.md" }],
			named: { "a.md": [{ target: "b.md", name: "supports", qualifier: "loosely" }] },
		};
		const ab = edge(graphOf(spec, {}, { namedDepthOut: 1 }), "a.md", "b.md");
		expect(ab?.relations).toEqual([{ name: "supports", qualifier: "loosely" }]);
	});

	it("WHEN two labels differ only in where a space falls (name-vs-qualifier boundary) THEN both survive dedup", () => {
		// `supports strongly` (one name) and `supports` + qualifier `strongly` are DISTINCT
		// labels that a naive space-joined identity would collapse into one — a real label loss.
		const spec: FakeVaultSpec = {
			files: [{ path: "a.md" }, { path: "b.md" }],
			named: {
				"a.md": [
					{ target: "b.md", name: "supports strongly" },
					{ target: "b.md", name: "supports", qualifier: "strongly" },
				],
			},
		};
		const ab = edge(graphOf(spec, {}, { namedDepthOut: 1 }), "a.md", "b.md");
		expect(ab?.relations).toEqual([
			{ name: "supports strongly" },
			{ name: "supports", qualifier: "strongly" },
		]);
	});

	it("WHEN the relation is a REL-NOTE form THEN the label carries the resolved rel-note target", () => {
		const spec: FakeVaultSpec = {
			files: [{ path: "a.md" }, { path: "b.md" }, { path: "he supports.md" }],
			named: { "a.md": [{ target: "b.md", relNote: "he supports.md" }] },
		};
		// The rel-note NAME occurrence folds away; the STATEMENT edge a→b keeps its label.
		const ab = edge(graphOf(spec, { relNoteFolds: { "a.md": ["he supports.md"] } }, { namedDepthOut: 1 }), "a.md", "b.md");
		expect(ab?.relations).toEqual([{ name: "he supports", relNoteTarget: "he supports.md" }]);
	});
});

describe("rel-note folding (per-occurrence)", () => {
	it("WHEN a rel note appears ONLY as a relationship name THEN it is not a node", () => {
		const spec: FakeVaultSpec = {
			files: [{ path: "a.md" }, { path: "b.md" }, { path: "he supports.md" }],
			named: { "a.md": [{ target: "b.md", relNote: "he supports.md" }] },
		};
		const graph = graphOf(spec, { relNoteFolds: { "a.md": ["he supports.md"] } }, { linkDepthOut: 5, namedDepthOut: 5 });
		expect(paths(graph)).toEqual(["a.md", "b.md"]);
	});

	it("WHEN a rel note appears ONLY as a relationship name THEN there is no edge to it", () => {
		const spec: FakeVaultSpec = {
			files: [{ path: "a.md" }, { path: "b.md" }, { path: "he supports.md" }],
			named: { "a.md": [{ target: "b.md", relNote: "he supports.md" }] },
		};
		const graph = graphOf(spec, { relNoteFolds: { "a.md": ["he supports.md"] } }, { linkDepthOut: 5, namedDepthOut: 5 });
		expect(edge(graph, "a.md", "he supports.md")).toBeUndefined();
	});

	it("WHEN a rel note ALSO has a plain link from the source THEN it stays a node with the plain occurrence counted", () => {
		const spec: FakeVaultSpec = {
			files: [{ path: "a.md" }, { path: "b.md" }, { path: "he supports.md" }],
			// One PLAIN link plus the rel-note NAME occurrence ⇒ base 2, fold 1, remaining 1.
			links: { "a.md": ["he supports.md"] },
			named: { "a.md": [{ target: "b.md", relNote: "he supports.md" }] },
		};
		const graph = graphOf(spec, { relNoteFolds: { "a.md": ["he supports.md"] } }, { linkDepthOut: 1, namedDepthOut: 1 });
		expect(edge(graph, "a.md", "he supports.md")?.count).toBe(1);
	});

	it("WHEN two statements name the same rel note THEN both name occurrences fold (per-occurrence accounting)", () => {
		const spec: FakeVaultSpec = {
			files: [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }, { path: "he supports.md" }],
			// One plain link + two rel-note NAME occurrences ⇒ base 3, fold 2, remaining 1.
			links: { "a.md": ["he supports.md"] },
			named: {
				"a.md": [
					{ target: "b.md", relNote: "he supports.md" },
					{ target: "c.md", relNote: "he supports.md" },
				],
			},
		};
		const graph = graphOf(
			spec,
			{ relNoteFolds: { "a.md": ["he supports.md", "he supports.md"] } },
			{ linkDepthOut: 1, namedDepthOut: 1 },
		);
		expect(edge(graph, "a.md", "he supports.md")?.count).toBe(1);
	});
});
