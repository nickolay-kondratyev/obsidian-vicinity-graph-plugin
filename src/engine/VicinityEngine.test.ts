import { describe, expect, it } from "vitest";
import { CENTRAL_PROMINENCE_FLOOR_SCORE, EngineDefaults } from "./constants";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { LinkProvider, OutgoingReference } from "./LinkProvider";
import { OutgoingReferences } from "./LinkProvider";
import type { GraphBuildRequest } from "./VicinityEngine";
import { VicinityEngine } from "./VicinityEngine";
import type { NodePreviewPreference, VaultPath, VicinityGraph, PinnedNodeDescriptor } from "./types";
import { asDocId, asVaultPath } from "./types";

/**
 * GIVEN a small "vault": MAIN hub.md with two neighbors (one attachment-heavy),
 * a second-hop note, and a pinned island disconnected from MAIN.
 */
function fixtureProvider(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [
			{ path: "hub.md", sizeBytes: 500 },
			{ path: "notes/alpha.md", sizeBytes: 2000 },
			{ path: "notes/beta.md", sizeBytes: 100 },
			{ path: "notes/gamma.md", sizeBytes: 50 },
			{ path: "island/pin.md", sizeBytes: 10 },
			{ path: "island/neighbor.md", sizeBytes: 10 },
			{ path: "img/cover.png" },
		],
		links: {
			"hub.md": ["notes/alpha.md", "notes/beta.md"],
			"notes/alpha.md": ["notes/gamma.md", "img/cover.png"],
			"island/pin.md": ["island/neighbor.md"],
		},
	});
}

const PIN: PinnedNodeDescriptor = {
	path: asVaultPath("island/pin.md"),
	docid: asDocId("docid_pin_e"),
	pinTimestamp: 1000,
};

function buildRequest(overrides: Partial<GraphBuildRequest> = {}): GraphBuildRequest {
	return {
		main: { path: asVaultPath("hub.md"), docid: asDocId("docid_hub_e") },
		pinned: [PIN],
		globalDepths: {
			linkDepthOut: 2,
			embedDepthOut: 2,
			linkDepthIn: 1,
			// Named channels OFF: this fixture has no named relations, so they are inert.
			namedDepthOut: 0,
			namedDepthIn: 0,
			// Pinned budgets mirror the active ones so the fixture graph is the same
			// union it was before pinned roots got their own dials.
			pinnedLinkDepthOut: 2,
			pinnedEmbedDepthOut: 2,
			pinnedLinkDepthIn: 1,
			pinnedNamedDepthOut: 0,
			pinnedNamedDepthIn: 0,
			descendantDepth: 0,
			ancestorDepth: 0,
			pinnedDescendantDepth: 0,
			pinnedAncestorDepth: 0,
		},
		globalView: EngineDefaults.viewSettings(),
		...overrides,
	};
}

function build(overrides: Partial<GraphBuildRequest> = {}): VicinityGraph {
	return new VicinityEngine(fixtureProvider()).build(buildRequest(overrides));
}

function node(graph: VicinityGraph, path: string) {
	return graph.nodes.find((candidate) => candidate.path === path);
}

describe("VicinityEngine global node exclusion", () => {
	it("WHEN exclusion is enabled with a matching pattern THEN the neighbor is suppressed and counted", () => {
		const graph = build({ nodeExclusion: { enabled: true, patterns: ["^notes/beta"] } });
		expect({ hasBeta: node(graph, "notes/beta.md") !== undefined, count: graph.excludedNodeCount }).toEqual({
			hasBeta: false,
			count: 1,
		});
	});

	it("WHEN exclusion is DISABLED THEN patterns are ignored (no-op, zero count)", () => {
		const graph = build({ nodeExclusion: { enabled: false, patterns: ["^notes/beta"] } });
		expect({ hasBeta: node(graph, "notes/beta.md") !== undefined, count: graph.excludedNodeCount }).toEqual({
			hasBeta: true,
			count: 0,
		});
	});

	it("WHEN no exclusion config is supplied THEN the count is zero", () => {
		expect(build().excludedNodeCount).toBe(0);
	});

	it("WHEN a pattern matches a pinned ROOT THEN the root stays (roots exempt)", () => {
		const graph = build({ nodeExclusion: { enabled: true, patterns: ["^island/pin"] } });
		expect(node(graph, "island/pin.md")?.isCentral).toBe(true);
	});
});

describe("VicinityEngine per-node override echo", () => {
	// The engine ECHOES a request override onto its output node (like docids) —
	// application is downstream: pixels in the view mapping, content in
	// `nodePreviewKind`.

	it("WHEN the request carries an override for a neighbor THEN that node echoes it", () => {
		const override = { sizePx: { widthPx: 320, heightPx: 180 } };
		const graph = build({ nodeOverrides: new Map([[asVaultPath("notes/alpha.md"), override]]) });
		expect(node(graph, "notes/alpha.md")?.override).toEqual(override);
	});

	it("WHEN the request carries an override for MAIN THEN the central echoes it too (any central)", () => {
		const override = { content: "image" as const };
		const graph = build({ nodeOverrides: new Map([[asVaultPath("hub.md"), override]]) });
		expect(node(graph, "hub.md")?.override).toEqual(override);
	});

	it("WHEN a node has no override THEN the field is ABSENT (never an empty object)", () => {
		expect(node(build(), "notes/alpha.md")).not.toHaveProperty("override");
	});

	it("WHEN an override targets a path outside the vicinity THEN the build is unaffected", () => {
		const graph = build({
			nodeOverrides: new Map([[asVaultPath("elsewhere.md"), { content: "outline" as const }]]),
		});
		expect(graph.nodes.some((candidate) => candidate.override !== undefined)).toBe(false);
	});

	it("WHEN an override is echoed THEN sizePx is untouched (Q4: pixels only, the computed fit is unaffected)", () => {
		// The override wins at the VIEW's `nodeDimensionsPx`; the engine's own
		// content-fit `sizePx` must not be rewritten by it.
		const withOverride = build({
			nodeOverrides: new Map([[asVaultPath("notes/alpha.md"), { sizePx: { widthPx: 900, heightPx: 900 } }]]),
		});
		expect(node(withOverride, "notes/alpha.md")?.sizePx).toBe(node(build(), "notes/alpha.md")?.sizePx);
	});
});

describe("VicinityEngine end-to-end build", () => {
	it("WHEN building THEN the union covers MAIN's vicinity and the disconnected pinned island", () => {
		expect(build().nodes.map((n) => n.path).sort()).toEqual([
			"hub.md",
			"island/neighbor.md",
			"island/pin.md",
			"notes/alpha.md",
			"notes/beta.md",
			"notes/gamma.md",
		]);
	});

	it("WHEN building THEN attachments never appear as nodes", () => {
		expect(node(build(), "img/cover.png")).toBeUndefined();
	});

	it("WHEN building THEN the attachment-heavy note carries its first image", () => {
		expect(node(build(), "notes/alpha.md")?.firstImagePath).toBe("img/cover.png");
	});

	it("WHEN building THEN MAIN's docid is echoed and it is flagged isMain", () => {
		const main = node(build(), "hub.md");
		expect(`${main?.docid}|${main?.isMain}`).toBe("docid_hub_e|true");
	});

	it("WHEN building THEN the pinned root's docid is echoed and it is central but not MAIN", () => {
		const pin = node(build(), "island/pin.md");
		expect(`${pin?.docid}|${pin?.isCentral}|${pin?.isMain}`).toBe("docid_pin_e|true|false");
	});

	it("WHEN building THEN the disconnected pinned root still gets the central prominence floor", () => {
		// EXPLICIT ALIGNMENT (nid_cx5zoz7ptucg9nxalibv0mbjb_e): centrals no longer
		// get maxPx outright — they get a modest named floor over the content fit
		// (Q2), so an empty pinned note stops dominating the canvas.
		const graph = build();
		const { minPx, maxPx } = graph.viewSettings.sizing;
		const floorPx = Math.round(minPx + CENTRAL_PROMINENCE_FLOOR_SCORE * (maxPx - minPx));
		expect(node(graph, "island/pin.md")?.sizePx).toBe(floorPx);
	});

	it("WHEN building THEN depth tags record the second hop from MAIN", () => {
		expect(node(build(), "notes/gamma.md")?.depthTags).toEqual([
			{ rootPath: "hub.md", channel: "outgoing-link", depth: 2 },
		]);
	});

	it("WHEN building THEN edges are directed linker -> linked and complete", () => {
		expect(build().edges.map((e) => `${e.source}->${e.target}`).sort()).toEqual([
			"hub.md->notes/alpha.md",
			"hub.md->notes/beta.md",
			"island/pin.md->island/neighbor.md",
			"notes/alpha.md->notes/gamma.md",
		]);
	});

	it("WHEN a note EMBEDS MAIN and arrives via the kind-blind incoming channel THEN its edge still reads 'embed' (assembly reads provider truth)", () => {
		const graph = new VicinityEngine(
			new FakeLinkProvider({
				files: [{ path: "hub.md" }, { path: "embedder.md" }],
				embeds: { "embedder.md": ["hub.md"] },
			}),
		).build(buildRequest({ pinned: [] }));
		expect(graph.edges).toEqual([{ source: "embedder.md", target: "hub.md", count: 1, kind: "embed", hierarchy: false }]);
	});
});

/** Settings are GLOBAL-only: one depth dial, one view object, no override layer. */
describe("VicinityEngine settings integration", () => {
	function capped(nodeCap: number): Partial<GraphBuildRequest> {
		return { globalView: { ...EngineDefaults.viewSettings(), nodeCap } };
	}

	it("WHEN the global outgoing depth allows one hop THEN the second hop disappears", () => {
		const graph = build({
			globalDepths: { ...EngineDefaults.depthSettings(), linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 1 },
		});
		expect(node(graph, "notes/gamma.md")).toBeUndefined();
	});

	it("WHEN the global view caps the graph THEN non-centrals are truncated to the cap", () => {
		expect(build(capped(1)).nodes.filter((n) => !n.isCentral)).toHaveLength(1);
	});

	it("WHEN truncation hides nodes THEN hidden counts are reported per folder", () => {
		// Kept non-central: notes/alpha.md (biggest). Hidden: beta+gamma (notes), island/neighbor.md.
		expect([...build(capped(1)).hiddenNodeCountsByFolder.entries()].sort()).toEqual([
			["island", 1],
			["notes", 2],
		]);
	});

	it("WHEN the global view sets a node preview preference THEN the build reports it verbatim", () => {
		const graph = build({
			globalView: { ...EngineDefaults.viewSettings(), nodePreviewPreference: "image" },
		});
		expect(graph.viewSettings.nodePreviewPreference).toBe("image");
	});

	it("WHEN the same request is built twice THEN outputs are identical (determinism)", () => {
		expect(build(capped(2))).toEqual(build(capped(2)));
	});
});

describe("VicinityEngine walked-edge semantics (CLARIFICATION Q5)", () => {
	/** GIVEN MAIN hub.md whose two depth-1 siblings link each other. */
	function siblingBuild(overrides: Partial<GraphBuildRequest> = {}): VicinityGraph {
		const provider = new FakeLinkProvider({
			files: [{ path: "hub.md" }, { path: "a.md" }, { path: "b.md" }],
			links: {
				"hub.md": ["a.md", "b.md"],
				"a.md": ["b.md"],
			},
		});
		return new VicinityEngine(provider).build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { ...EngineDefaults.depthSettings(), linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 0 },
			globalView: EngineDefaults.viewSettings(),
			...overrides,
		});
	}

	function edgeStrings(graph: VicinityGraph): string[] {
		return graph.edges.map((e) => `${e.source}->${e.target}`).sort();
	}

	it("WHEN the walk never reaches a sibling link THEN that link is not an edge", () => {
		expect(edgeStrings(siblingBuild())).toEqual(["hub.md->a.md", "hub.md->b.md"]);
	});

	// The lever the edge-routing e2e fixtures use to render sibling chords: depth,
	// not a visibility mode — a second hop WALKS the sibling link.
	it("WHEN the walk reaches the sibling link at depth 2 THEN it becomes an edge", () => {
		const graph = siblingBuild({
			globalDepths: { ...EngineDefaults.depthSettings(), linkDepthOut: 2, embedDepthOut: 2, linkDepthIn: 0 },
		});
		expect(edgeStrings(graph)).toEqual(["a.md->b.md", "hub.md->a.md", "hub.md->b.md"]);
	});

	/**
	 * "Show cross links" ON, over the SAME one-hop fixture: the sibling link a.md → b.md
	 * is never walked (b.md is discovered from hub.md, and a.md is not expanded further),
	 * so it is exactly the link the toggle exists to reveal.
	 */
	describe("with cross links ON", () => {
		/** `showCrossLinks` is forced LAST, so a caller may override any OTHER view field. */
		function crossLinkBuild(overrides: Partial<GraphBuildRequest> = {}): VicinityGraph {
			return siblingBuild({
				...overrides,
				globalView: { ...EngineDefaults.viewSettings(), ...overrides.globalView, showCrossLinks: true },
			});
		}

		function paths(graph: VicinityGraph): string[] {
			return graph.nodes.map((n) => n.path).sort();
		}

		it("WHEN a link joins two visible nodes the walk never traversed THEN it becomes an edge", () => {
			expect(edgeStrings(crossLinkBuild())).toContain("a.md->b.md");
		});

		it("WHEN cross links are ON THEN every walked edge still renders", () => {
			expect(edgeStrings(crossLinkBuild())).toEqual(["a.md->b.md", "hub.md->a.md", "hub.md->b.md"]);
		});

		// The ticket's explicit requirement: cross links widen EDGES only. Truncation and
		// the distance-to-MAIN ranking keep running on the walked edge set — so the cap
		// here is one that REALLY truncates (2 non-centrals, cap 1); under an unreached
		// cap both sides are trivially the whole vault and the test could not fail.
		it("WHEN cross links are ON under a truncating cap THEN the visible node set is exactly OFF's", () => {
			const capped = { globalView: { ...EngineDefaults.viewSettings(), nodeCap: 1 } };
			expect({ on: paths(crossLinkBuild(capped)), off: paths(siblingBuild(capped)) }).toEqual({
				on: ["a.md", "hub.md"],
				off: ["a.md", "hub.md"],
			});
		});

		it("WHEN cross links are ON THEN an excluded neighbor is still absent from the edges", () => {
			// Exclusion keeps b.md out of `visiblePaths`, which is the ONLY reason the sweep
			// cannot re-admit it — a user-visible guarantee worth a tripwire on the new path.
			const graph = crossLinkBuild({ nodeExclusion: { enabled: true, patterns: ["^b\\.md"] } });
			expect(edgeStrings(graph)).toEqual(["hub.md->a.md"]);
		});
	});
});

/**
 * The superset contract at its weakest point: walked edges from the INCOMING channel
 * come from `getIncomingLinks`, while the sweep reads `getOutgoingLinks`. In
 * `ObsidianLinkProvider` those are two independent authorities (backlinks vs. the file
 * cache), and the file cache degrades during Obsidian's boot window — so the two CAN
 * disagree, and the toggle must not turn that disagreement into a LOST edge.
 */
describe("VicinityEngine cross links never drop a walked edge", () => {
	/** A provider whose outgoing channel has gone blind for `blindSource` (boot window). */
	class OutgoingBlindProvider implements LinkProvider {
		constructor(
			private readonly delegate: LinkProvider,
			private readonly blindSource: VaultPath,
		) {}

		getOutgoingReferences(path: VaultPath): readonly OutgoingReference[] {
			return path === this.blindSource ? [] : this.delegate.getOutgoingReferences(path);
		}

		getOutgoingLinks(path: VaultPath): readonly VaultPath[] {
			return OutgoingReferences.targetsOf(this.getOutgoingReferences(path));
		}

		getIncomingLinks(path: VaultPath): readonly VaultPath[] {
			return this.delegate.getIncomingLinks(path);
		}

		getChildNotes(path: VaultPath): readonly VaultPath[] {
			return this.delegate.getChildNotes(path);
		}

		getParentNote(path: VaultPath): VaultPath | undefined {
			return this.delegate.getParentNote(path);
		}

		getFileMetadata(path: VaultPath) {
			return this.delegate.getFileMetadata(path);
		}

		getLinkCount(source: VaultPath, target: VaultPath): number {
			return this.delegate.getLinkCount(source, target);
		}
	}

	/** GIVEN backlinks still report linker.md → hub.md, but linker.md's cache is empty. */
	function divergentBuild(showCrossLinks: boolean): VicinityGraph {
		const provider = new OutgoingBlindProvider(
			new FakeLinkProvider({
				files: [{ path: "hub.md" }, { path: "out.md" }, { path: "linker.md" }],
				links: { "hub.md": ["out.md"], "linker.md": ["hub.md"] },
			}),
			asVaultPath("linker.md"),
		);
		return new VicinityEngine(provider).build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { ...EngineDefaults.depthSettings(), linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 1 },
			globalView: { ...EngineDefaults.viewSettings(), showCrossLinks },
		});
	}

	function edgeStrings(graph: VicinityGraph): string[] {
		return graph.edges.map((e) => `${e.source}->${e.target}`).sort();
	}

	it("WHEN a backlink-walked edge is invisible to the outgoing channel THEN turning cross links ON keeps it", () => {
		expect(edgeStrings(divergentBuild(true))).toEqual(["hub.md->out.md", "linker.md->hub.md"]);
	});

	it("WHEN cross links are OFF THEN that same backlink-walked edge is present (the baseline ON must match)", () => {
		expect(edgeStrings(divergentBuild(false))).toEqual(["hub.md->out.md", "linker.md->hub.md"]);
	});
});

/**
 * A cross link is an edge like any other, so its `xN` badge comes from the SAME
 * `provider.getLinkCount` path — there is no second multiplicity authority.
 */
describe("VicinityEngine cross-link edge counts", () => {
	// GIVEN hub.md links a.md and b.md, and a.md links b.md TWICE (never walked at depth 1).
	function crossLinkCounts(): Record<string, number> {
		const provider = new FakeLinkProvider({
			files: [{ path: "hub.md" }, { path: "a.md" }, { path: "b.md" }],
			links: { "hub.md": ["a.md", "b.md"], "a.md": ["b.md", "b.md"] },
		});
		const graph = new VicinityEngine(provider).build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { ...EngineDefaults.depthSettings(), linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 0 },
			globalView: { ...EngineDefaults.viewSettings(), showCrossLinks: true },
		});
		return Object.fromEntries(graph.edges.map((edge) => [`${edge.source}->${edge.target}`, edge.count]));
	}

	it("WHEN a cross-linked pair carries N parallel links THEN its edge carries count N", () => {
		expect(crossLinkCounts()["a.md->b.md"]).toBe(2);
	});
});

describe("VicinityEngine edge link counts (step-05, CLARIFICATION Q1)", () => {
	// GIVEN hub.md links twin.md twice and solo.md once.
	function duplicateLinkEngine(): VicinityEngine {
		return new VicinityEngine(
			new FakeLinkProvider({
				files: [{ path: "hub.md" }, { path: "twin.md" }, { path: "solo.md" }],
				links: { "hub.md": ["twin.md", "solo.md", "twin.md"] },
			}),
		);
	}

	function edgeCounts(): Record<string, number> {
		const graph = duplicateLinkEngine().build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { ...EngineDefaults.depthSettings(), linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 1 },
			globalView: EngineDefaults.viewSettings(),
		});
		return Object.fromEntries(graph.edges.map((edge) => [`${edge.source}->${edge.target}`, edge.count]));
	}

	it("WHEN a build walks a double link THEN that edge carries count 2", () => {
		expect(edgeCounts()).toEqual({ "hub.md->twin.md": 2, "hub.md->solo.md": 1 });
	});
});

/**
 * The GLOBAL-only depth contract at the pinned central, END-TO-END (proves the
 * BFS actually walks a pinned root to the global depth, not just that a number
 * was passed): X's chain X → x1 → x2 → x3 has neighbors at hops 1/2/3, and X is
 * NOT main — the depth it uses is the one global dial, whoever is MAIN.
 */
describe("VicinityEngine pinned-central depth exploration", () => {
	function chainProvider(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [
				{ path: "y.md" },
				{ path: "z.md" },
				{ path: "x.md" },
				{ path: "x1.md" },
				{ path: "x2.md" },
				{ path: "x3.md" },
			],
			links: { "x.md": ["x1.md"], "x1.md": ["x2.md"], "x2.md": ["x3.md"] },
		});
	}

	const X_PIN: PinnedNodeDescriptor = {
		path: asVaultPath("x.md"),
		docid: asDocId("docid_x_e"),
		pinTimestamp: 1,
	};

	/** Build with MAIN=`mainPath` and ONE global outgoing depth for every root. */
	function build(mainPath: string, globalOutgoing: number): VicinityGraph {
		return new VicinityEngine(chainProvider()).build({
			main: { path: asVaultPath(mainPath) },
			pinned: [X_PIN],
			globalDepths: {
				linkDepthOut: globalOutgoing,
				embedDepthOut: globalOutgoing,
				linkDepthIn: 0,
				namedDepthOut: 0,
				namedDepthIn: 0,
				descendantDepth: 0,
				ancestorDepth: 0,
				pinnedLinkDepthOut: globalOutgoing,
				pinnedEmbedDepthOut: globalOutgoing,
				pinnedLinkDepthIn: 0,
				pinnedNamedDepthOut: 0,
				pinnedNamedDepthIn: 0,
				pinnedDescendantDepth: 0,
				pinnedAncestorDepth: 0,
			},
			globalView: { ...EngineDefaults.viewSettings(), nodeCap: 100 },
		});
	}

	it("WHEN the global outgoing depth is 3 THEN the pinned central reaches x3 at depth 3", () => {
		expect(node(build("y.md", 3), "x3.md")?.depthTags).toEqual([
			{ rootPath: "x.md", channel: "outgoing-link", depth: 3 },
		]);
	});

	it("WHEN the global outgoing depth is 1 THEN x2 and x3 are out of the pinned central's reach", () => {
		const graph = build("y.md", 1);
		expect({ x1: node(graph, "x1.md") !== undefined, x2: node(graph, "x2.md"), x3: node(graph, "x3.md") }).toEqual({
			x1: true,
			x2: undefined,
			x3: undefined,
		});
	});

	it("WHEN MAIN changes THEN the pinned central's reach is unchanged (no per-MAIN depth memory)", () => {
		// The CONCRETE tag, not a comparison against the other build: with two
		// `?.depthTags` sides a pinned root that stopped being walked at all would
		// leave both `undefined` and keep this green — a silent fallback.
		expect(node(build("z.md", 3), "x3.md")?.depthTags).toEqual([
			{ rootPath: "x.md", channel: "outgoing-link", depth: 3 },
		]);
	});
});

/**
 * The active/pinned depth split (ticket `nid_ts4rx2pfo6o18verzk07z16g8_e`):
 * MAIN traverses with the base budgets, every pinned root with the `pinned*`
 * budgets, and a pinned note that IS the active note follows the active dials
 * (MAIN-first dedupe — the assembler also drops such a pin before the engine).
 */
describe("VicinityEngine active-vs-pinned depth budgets", () => {
	/** Two independent chains: MAIN m.md → m1 → m2, pinned x.md → x1 → x2. */
	function twoChainProvider(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [
				{ path: "m.md" },
				{ path: "m1.md" },
				{ path: "m2.md" },
				{ path: "x.md" },
				{ path: "x1.md" },
				{ path: "x2.md" },
			],
			links: { "m.md": ["m1.md"], "m1.md": ["m2.md"], "x.md": ["x1.md"], "x1.md": ["x2.md"] },
		});
	}

	function buildSplit(activeOutgoing: number, pinnedOutgoing: number, pinnedPath = "x.md"): VicinityGraph {
		return new VicinityEngine(twoChainProvider()).build({
			main: { path: asVaultPath("m.md") },
			pinned: [{ path: asVaultPath(pinnedPath), docid: asDocId("docid_split_pin_e"), pinTimestamp: 1 }],
			globalDepths: {
				linkDepthOut: activeOutgoing,
				embedDepthOut: 0,
				linkDepthIn: 0,
				namedDepthOut: 0,
				namedDepthIn: 0,
				descendantDepth: 0,
				ancestorDepth: 0,
				pinnedLinkDepthOut: pinnedOutgoing,
				pinnedEmbedDepthOut: 0,
				pinnedLinkDepthIn: 0,
				pinnedNamedDepthOut: 0,
				pinnedNamedDepthIn: 0,
				pinnedDescendantDepth: 0,
				pinnedAncestorDepth: 0,
			},
			globalView: EngineDefaults.viewSettings(),
		});
	}

	it("WHEN the pinned outgoing depth is 0 THEN the pinned root expands nothing while MAIN's chain is walked", () => {
		const graph = buildSplit(2, 0);
		expect(graph.nodes.map((n) => n.path).sort()).toEqual(["m.md", "m1.md", "m2.md", "x.md"]);
	});

	it("WHEN the pinned outgoing depth EXCEEDS the active one THEN only the pinned chain reaches its second hop", () => {
		const graph = buildSplit(1, 2);
		expect(graph.nodes.map((n) => n.path).sort()).toEqual(["m.md", "m1.md", "x.md", "x1.md", "x2.md"]);
	});

	it("WHEN the active note is ALSO pinned THEN it traverses with the ACTIVE budgets, not the pinned ones", () => {
		// Pinned budget 0 would freeze m.md if the pin's depths won; the concrete
		// second hop proves the active dials drive it.
		const graph = buildSplit(2, 0, "m.md");
		expect(graph.nodes.map((n) => n.path).sort()).toEqual(["m.md", "m1.md", "m2.md"]);
	});
});

describe("VicinityEngine outline pass-through", () => {
	it("WHEN a graph is built THEN each output node carries its file's outline", () => {
		// GIVEN a hub linking one note that declares an outline (the spread-through guard:
		// GraphNode gets `outline` only because VicinityEngine copies the traversed node).
		const provider = new FakeLinkProvider({
			files: [{ path: "hub.md" }, { path: "child.md", outline: [{ rawText: "Intro", level: 1 }] }],
			links: { "hub.md": ["child.md"] },
		});
		const graph = new VicinityEngine(provider).build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { ...EngineDefaults.depthSettings(), linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 0 },
			globalView: EngineDefaults.viewSettings(),
		});
		expect(graph.nodes.find((candidate) => candidate.path === "child.md")?.outline).toEqual([
			{ rawText: "Intro", level: 1 },
		]);
	});

	it("WHEN a traversed node carries imagePrecedesOutline THEN the output node carries it too", () => {
		// The same spread-through guard as `outline`: the view's preview rule reads
		// this fact off GraphNode, so a dropped echo would silently change previews.
		const provider = new FakeLinkProvider({
			files: [
				{ path: "hub.md" },
				{ path: "cover.md", outline: [{ rawText: "Intro", level: 1 }], imagePrecedesOutline: true },
			],
			links: { "hub.md": ["cover.md"] },
		});
		const graph = new VicinityEngine(provider).build({
			main: { path: asVaultPath("hub.md") },
			globalDepths: { ...EngineDefaults.depthSettings(), linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 0 },
			globalView: EngineDefaults.viewSettings(),
		});
		expect(graph.nodes.find((candidate) => candidate.path === "cover.md")?.imagePrecedesOutline).toBe(true);
	});
});

/**
 * The `globalView -> NodeSizer` seam under CONTENT-FIT sizing: the preview
 * preference legitimately reaches sizing now (node-sizing rethink Q1 — the old
 * preference-independence rule is superseded, see {@link NodeSizer}'s docstring),
 * because the box must fit the region the preference actually renders. A flip is
 * therefore EXPECTED to relayout, not a data-only refresh — this pins that the
 * seam still carries the preference through, so a future refactor that routes
 * only `viewSettings.sizing` (dropping the preference) surfaces HERE.
 */
describe("VicinityEngine sizing follows the node preview preference", () => {
	function sizeUnder(preference: NodePreviewPreference, path: string): number | undefined {
		return node(build({ globalView: { ...EngineDefaults.viewSettings(), nodePreviewPreference: preference } }), path)
			?.sizePx;
	}

	it("WHEN Title only hides a node's content THEN its box shrinks below what an image preview needs", () => {
		// `notes/alpha.md` carries an image, so Image fits a thumbnail slot; Title
		// only renders the bare title, so its content-fit floor is strictly smaller.
		const titleOnly = sizeUnder("title-only", "notes/alpha.md");
		const image = sizeUnder("image", "notes/alpha.md");
		expect(titleOnly !== undefined && image !== undefined && titleOnly < image).toBe(true);
	});
});
