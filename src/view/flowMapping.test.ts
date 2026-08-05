import { describe, expect, it } from "vitest";
import type { GraphNode, NodePreviewPreference, OutlineEntry, ViewSettings } from "../engine";
import { asDocId, asFolderPath, asVaultPath, NODE_PREVIEW_PREFERENCES } from "../engine";
import { OUTLINE_RENDER_LIMIT } from "./constants";
import { edgeKindClassName, vicinityGraphToFlow, withGroupDimensions, withPositions } from "./flowMapping";
import type { FlowNode, NoteFlowNode } from "./flowMapping";
import { NO_ORPHAN_TRUNCATION } from "./truncationBadges";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

function noteNode(nodes: readonly FlowNode[], id: string): NoteFlowNode | undefined {
	const found = nodes.find((node) => node.id === id);
	return found?.kind === "note" ? found : undefined;
}

/** Default mapping call: MAIN not pinned. The pinned-MAIN case has its own describe. */
function toFlow(graph: Parameters<typeof vicinityGraphToFlow>[0]) {
	return vicinityGraphToFlow(graph, false);
}

describe("vicinityGraphToFlow nodes", () => {
	const graph = makeGraph({
		nodes: [makeNode({ path: asVaultPath("notes/a.md"), title: "a", isMain: true, isCentral: true, sizePx: 160 })],
	});

	it("WHEN mapping a node THEN the React Flow node id is its vault path", () => {
		expect(toFlow(graph).nodes[0]?.id).toBe("notes/a.md");
	});

	it("WHEN mapping a node THEN width and height are the node's sizePx", () => {
		const node = toFlow(graph).nodes[0];
		expect({ width: node?.width, height: node?.height }).toEqual({ width: 160, height: 160 });
	});

	it("WHEN a title is too long for its square THEN the node widens so the name renders without an ellipsis", () => {
		const longTitle = "a-really-long-note-title-that-cannot-fit-a-small-square";
		const smallGraph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md"), title: longTitle, sizePx: 40 })],
		});
		const node = noteNode(toFlow(smallGraph).nodes, "a.md");
		expect(node?.width).toBeGreaterThan(node?.height ?? 0);
	});

	it("WHEN a long title widens a node THEN its height stays the score-driven size", () => {
		const longTitle = "a-really-long-note-title-that-cannot-fit-a-small-square";
		const smallGraph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md"), title: longTitle, sizePx: 40 })],
		});
		expect(noteNode(toFlow(smallGraph).nodes, "a.md")?.height).toBe(40);
	});

	it("WHEN mapping a node THEN its data carries the step-05 rich payload", () => {
		expect(toFlow(graph).nodes[0]?.data).toEqual({
			path: "notes/a.md",
			title: "a",
			tier: "main",
			isPinned: false,
			hasSizeOverride: false,
			folder: "",
			outline: [],
			preview: "none",
			imageCount: 0,
			attachmentGroups: [],
		});
	});
});

describe("vicinityGraphToFlow per-node size override (drag-to-resize)", () => {
	const overridden = makeGraph({
		nodes: [
			makeNode({
				path: asVaultPath("a.md"),
				title: "a-really-long-note-title-that-cannot-fit-a-small-square",
				sizePx: 40,
				override: { sizePx: { widthPx: 321, heightPx: 87 } },
			}),
		],
	});

	it("WHEN a node carries a size override THEN its box is the override verbatim (label sizing bypassed)", () => {
		const node = noteNode(toFlow(overridden).nodes, "a.md");
		expect({ width: node?.width, height: node?.height }).toEqual({ width: 321, height: 87 });
	});

	it("WHEN a node carries a size override THEN its data says so (the reset-menu fact)", () => {
		expect(noteNode(toFlow(overridden).nodes, "a.md")?.data.hasSizeOverride).toBe(true);
	});

	it("WHEN a node's override has only a content field THEN its box stays computed (no size override)", () => {
		const contentOnly = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md"), sizePx: 40, override: { content: "outline" } })],
		});
		const node = noteNode(toFlow(contentOnly).nodes, "a.md");
		expect({ height: node?.height, hasSizeOverride: node?.data.hasSizeOverride }).toEqual({
			height: 40,
			hasSizeOverride: false,
		});
	});
});

describe("vicinityGraphToFlow docid", () => {
	it("WHEN a central node carries a docid THEN it is forwarded onto the node data", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("n.md"), isCentral: true, docid: asDocId("docid_n_e") })],
		});
		expect(noteNode(toFlow(graph).nodes, "n.md")?.data.docid).toBe("docid_n_e");
	});

	it("WHEN a regular node has no docid THEN the node data omits docid", () => {
		const graph = makeGraph({ nodes: [makeNode({ path: asVaultPath("n.md") })] });
		expect(noteNode(toFlow(graph).nodes, "n.md")?.data.docid).toBeUndefined();
	});
});

describe("vicinityGraphToFlow styling tiers", () => {
	function tierOfFlags(flags: { isMain: boolean; isCentral: boolean }): string | undefined {
		const graph = makeGraph({ nodes: [makeNode({ path: asVaultPath("n.md"), ...flags })] });
		return noteNode(toFlow(graph).nodes, "n.md")?.data.tier;
	}

	it("WHEN the node is MAIN THEN its tier is main", () => {
		expect(tierOfFlags({ isMain: true, isCentral: true })).toBe("main");
	});

	it("WHEN the node is central but not MAIN THEN its tier is pinned-central", () => {
		expect(tierOfFlags({ isMain: false, isCentral: true })).toBe("pinned-central");
	});

	it("WHEN the node is neither THEN its tier is regular", () => {
		expect(tierOfFlags({ isMain: false, isCentral: false })).toBe("regular");
	});
});

describe("vicinityGraphToFlow isPinned fact", () => {
	function isPinnedOf(flags: { isMain: boolean; isCentral: boolean }, mainPinned: boolean): boolean | undefined {
		const graph = makeGraph({ nodes: [makeNode({ path: asVaultPath("n.md"), ...flags })] });
		return noteNode(vicinityGraphToFlow(graph, mainPinned).nodes, "n.md")?.data.isPinned;
	}

	it("WHEN the node is a regular neighbor THEN it is not pinned", () => {
		expect(isPinnedOf({ isMain: false, isCentral: false }, false)).toBe(false);
	});

	it("WHEN the node is a non-MAIN central THEN it is pinned by definition", () => {
		expect(isPinnedOf({ isMain: false, isCentral: true }, false)).toBe(true);
	});

	it("WHEN MAIN is not in the pinned set THEN it is not pinned", () => {
		expect(isPinnedOf({ isMain: true, isCentral: true }, false)).toBe(false);
	});

	it("WHEN MAIN is in the pinned set THEN it is pinned (while still tiering as main)", () => {
		expect(isPinnedOf({ isMain: true, isCentral: true }, true)).toBe(true);
	});
});

describe("vicinityGraphToFlow attachments payload", () => {
	const graph = makeGraph({
		nodes: [
			makeNode({
				path: asVaultPath("n.md"),
				attachments: [
					{ path: asVaultPath("img/a.png"), isImage: true },
					{ path: asVaultPath("doc.pdf"), isImage: false },
					{ path: asVaultPath("img/b.png"), isImage: true },
				],
				firstImagePath: asVaultPath("img/a.png"),
			}),
		],
	});

	it("WHEN a node has images THEN imageCount counts all of them", () => {
		expect(noteNode(toFlow(graph).nodes, "n.md")?.data.imageCount).toBe(2);
	});

	it("WHEN a node has a first image THEN its path is forwarded as the thumbnail candidate", () => {
		expect(noteNode(toFlow(graph).nodes, "n.md")?.data.firstImagePath).toBe("img/a.png");
	});

	it("WHEN a node has attachments THEN the icon strip groups them by extension", () => {
		expect(noteNode(toFlow(graph).nodes, "n.md")?.data.attachmentGroups).toEqual([
			{ extension: "png", count: 2, paths: ["img/a.png", "img/b.png"] },
			{ extension: "pdf", count: 1, paths: ["doc.pdf"] },
		]);
	});
});

/** GIVEN two grouped notes/, one solo/ singleton, one root file. */
function groupedGraph() {
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes") }),
			makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes") }),
			makeNode({ path: asVaultPath("solo/only.md"), folder: asFolderPath("solo") }),
			makeNode({ path: asVaultPath("root.md"), folder: asFolderPath("") }),
		],
	});
}

describe("vicinityGraphToFlow folder groups", () => {
	it("WHEN a folder has 2+ members THEN a folder-group node is emitted with label data", () => {
		const group = toFlow(groupedGraph()).nodes.find((node) => node.kind === "folder-group");
		expect(group?.data).toEqual({ folder: "notes", folderName: "notes", hiddenCount: 0 });
	});

	it("WHEN groups are emitted THEN they precede their children (React Flow parent-first rule)", () => {
		const ids = toFlow(groupedGraph()).nodes.map((node) => node.id);
		expect(ids.indexOf("folder-group:notes")).toBeLessThan(ids.indexOf("notes/a.md"));
	});

	it("WHEN a node is a group member THEN it carries the group's parentId", () => {
		expect(noteNode(toFlow(groupedGraph()).nodes, "notes/a.md")?.parentId).toBe(
			"folder-group:notes",
		);
	});

	it("WHEN a node is ungrouped THEN it has no parentId", () => {
		expect(noteNode(toFlow(groupedGraph()).nodes, "solo/only.md")?.parentId).toBeUndefined();
	});

	it("WHEN a rendered group's folder has hidden nodes THEN the group carries the +N badge count", () => {
		const graph = makeGraph({
			nodes: groupedGraph().nodes,
			hiddenNodeCountsByFolder: new Map([[asFolderPath("notes"), 4]]),
		});
		const group = toFlow(graph).nodes.find((node) => node.kind === "folder-group");
		expect(group?.data.hiddenCount).toBe(4);
	});
});

describe("vicinityGraphToFlow edges", () => {
	const graph = makeGraph({
		nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
		edges: [makeEdge("a.md", "b.md")],
	});

	it("WHEN mapping an edge THEN its id is synthesized as source->target", () => {
		expect(toFlow(graph).edges[0]?.id).toBe("a.md->b.md");
	});

	it("WHEN an edge carries a link count THEN it is forwarded to the flow edge", () => {
		const counted = makeGraph({ nodes: graph.nodes, edges: [makeEdge("a.md", "b.md", 3)] });
		expect(toFlow(counted).edges[0]?.count).toBe(3);
	});

	it("WHEN only one direction exists THEN the edge has no opposite", () => {
		expect(toFlow(graph).edges[0]?.hasOpposite).toBe(false);
	});

	it("WHEN both directions exist THEN each edge of the pair is flagged hasOpposite", () => {
		const bidirectional = makeGraph({
			nodes: graph.nodes,
			edges: [makeEdge("a.md", "b.md"), makeEdge("b.md", "a.md")],
		});
		expect(toFlow(bidirectional).edges.map((edge) => edge.hasOpposite)).toEqual([true, true]);
	});
});

/**
 * GIVEN an ungrouped hub linking to two members of the `notes` group. The fan of
 * per-member edges must collapse onto ONE edge to the `folder-group:notes` box.
 */
function collapsedGraph() {
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("hub.md"), folder: asFolderPath("") }),
			makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes") }),
			makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes") }),
		],
		edges: [makeEdge("hub.md", "notes/a.md"), makeEdge("hub.md", "notes/b.md")],
	});
}

describe("vicinityGraphToFlow group-collapsed edges", () => {
	it("WHEN many members link from one node THEN the fan collapses to a single edge to the group box", () => {
		const edges = toFlow(collapsedGraph()).edges;
		expect(edges).toHaveLength(1);
	});

	it("WHEN edges collapse onto a group THEN the edge connects the node to the group box", () => {
		const [edge] = toFlow(collapsedGraph()).edges;
		expect({ source: edge?.source, target: edge?.target }).toEqual({
			source: "hub.md",
			target: "folder-group:notes",
		});
	});

	it("WHEN member edges collapse THEN the count is the SUM of their link counts", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [makeEdge("hub.md", "notes/a.md", 2), makeEdge("hub.md", "notes/b.md", 3)],
		});
		expect(toFlow(graph).edges[0]?.count).toBe(5);
	});

	it("WHEN only one direction crosses the group boundary THEN the collapsed edge is not bidirectional", () => {
		expect(toFlow(collapsedGraph()).edges[0]?.bidirectional).toBe(false);
	});

	it("WHEN opposite directions cross the same group THEN they collapse to ONE bidirectional edge", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [makeEdge("hub.md", "notes/a.md"), makeEdge("notes/b.md", "hub.md")],
		});
		const edges = toFlow(graph).edges;
		expect(edges).toHaveLength(1);
		expect(edges[0]?.bidirectional).toBe(true);
	});

	it("WHEN both directions cross the group THEN the collapsed count sums both", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [makeEdge("hub.md", "notes/a.md"), makeEdge("notes/b.md", "hub.md")],
		});
		expect(toFlow(graph).edges[0]?.count).toBe(2);
	});

	it("WHEN an edge is intra-group THEN it stays member-to-member (no group self-loop)", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [makeEdge("notes/a.md", "notes/b.md")],
		});
		const edges = toFlow(graph).edges;
		expect(edges).toEqual([
			{
				id: "notes/a.md->notes/b.md",
				source: "notes/a.md",
				target: "notes/b.md",
				notePairs: [{ source: "notes/a.md", target: "notes/b.md" }],
				count: 1,
				kind: "link",
				hasOpposite: false,
				bidirectional: false,
			},
		]);
	});

	it("WHEN a passthrough edge maps THEN its notePairs is exactly its own note pair", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
			edges: [makeEdge("a.md", "b.md")],
		});
		expect(toFlow(graph).edges[0]?.notePairs).toEqual([{ source: "a.md", target: "b.md" }]);
	});

	it("WHEN member edges collapse THEN notePairs lists every contributing pair in first-seen order", () => {
		expect(toFlow(collapsedGraph()).edges[0]?.notePairs).toEqual([
			{ source: "hub.md", target: "notes/a.md" },
			{ source: "hub.md", target: "notes/b.md" },
		]);
	});

	it("WHEN both directions collapse onto one edge THEN notePairs keeps each pair's own direction", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [makeEdge("hub.md", "notes/a.md"), makeEdge("notes/b.md", "hub.md")],
		});
		expect(toFlow(graph).edges[0]?.notePairs).toEqual([
			{ source: "hub.md", target: "notes/a.md" },
			{ source: "notes/b.md", target: "hub.md" },
		]);
	});

	it("WHEN a two-way pair collapses THEN the emitted orientation is the first-seen direction", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [makeEdge("notes/a.md", "hub.md"), makeEdge("hub.md", "notes/b.md")],
		});
		// First-seen edge is notes/a.md -> hub.md, so the group is the source.
		expect(toFlow(graph).edges[0]?.source).toBe("folder-group:notes");
	});
});

describe("vicinityGraphToFlow edge kinds (stage-2 embed rendering)", () => {
	it("WHEN a passthrough edge carries an engine kind THEN it is forwarded to the flow edge", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
			edges: [makeEdge("a.md", "b.md", 1, "embed")],
		});
		expect(toFlow(graph).edges[0]?.kind).toBe("embed");
	});

	it("WHEN collapsed contributors AGREE on a kind THEN the collapsed edge keeps it", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [makeEdge("hub.md", "notes/a.md", 1, "embed"), makeEdge("hub.md", "notes/b.md", 1, "embed")],
		});
		expect(toFlow(graph).edges[0]?.kind).toBe("embed");
	});

	it("WHEN collapsed contributors MIX kinds THEN the collapsed edge unions them to 'both'", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [makeEdge("hub.md", "notes/a.md", 1, "link"), makeEdge("hub.md", "notes/b.md", 1, "embed")],
		});
		expect(toFlow(graph).edges[0]?.kind).toBe("both");
	});

	it("WHEN mapping each kind to its CSS hook THEN the three kinds get three distinct classes", () => {
		const classes = [edgeKindClassName("link"), edgeKindClassName("embed"), edgeKindClassName("both")];
		expect(classes).toEqual([
			"vicinity-graph-edge--kind-link",
			"vicinity-graph-edge--kind-embed",
			"vicinity-graph-edge--kind-both",
		]);
	});
});

describe("vicinityGraphToFlow snapshot extras", () => {
	it("WHEN nothing was hidden THEN the orphan truncation is the shared zero constant", () => {
		expect(toFlow(groupedGraph()).orphanTruncation).toBe(NO_ORPHAN_TRUNCATION);
	});

	it("WHEN a folder without a rendered group has hidden nodes THEN they surface as orphan truncation", () => {
		const graph = makeGraph({
			nodes: groupedGraph().nodes,
			hiddenNodeCountsByFolder: new Map([[asFolderPath("gone"), 2]]),
		});
		expect(toFlow(graph).orphanTruncation).toEqual({
			totalHiddenCount: 2,
			breakdown: [{ folder: "gone", hiddenCount: 2 }],
		});
	});
});

describe("withPositions", () => {
	const nodes: readonly FlowNode[] = [
		{
			id: "a.md",
			kind: "note",
			position: { x: 0, y: 0 },
			width: 100,
			height: 100,
			data: {
				path: "a.md",
				title: "a",
				tier: "regular",
				isPinned: false,
				hasSizeOverride: false,
				folder: "",
				outline: [],
				preview: "none",
				imageCount: 0,
				attachmentGroups: [],
			},
		},
	];

	it("WHEN a position is known THEN it replaces the node's placeholder position", () => {
		const placed = withPositions(nodes, new Map([["a.md", { x: 12, y: 34 }]]));
		expect(placed[0]?.position).toEqual({ x: 12, y: 34 });
	});

	it("WHEN a position is unknown THEN the node is returned unchanged", () => {
		const placed = withPositions(nodes, new Map());
		expect(placed[0]?.position).toEqual({ x: 0, y: 0 });
	});

	it("WHEN a node has a parent THEN its position becomes parent-relative (React Flow subflow)", () => {
		const flow = toFlow(groupedGraph());
		const positions = new Map([
			["folder-group:notes", { x: 100, y: 50 }],
			["notes/a.md", { x: 130, y: 90 }],
		]);
		expect(withPositions(flow.nodes, positions).find((node) => node.id === "notes/a.md")?.position).toEqual({
			x: 30,
			y: 40,
		});
	});

	it("WHEN a group node is placed THEN its own position stays absolute (top-level)", () => {
		const flow = toFlow(groupedGraph());
		const positions = new Map([["folder-group:notes", { x: 100, y: 50 }]]);
		expect(
			withPositions(flow.nodes, positions).find((node) => node.id === "folder-group:notes")?.position,
		).toEqual({ x: 100, y: 50 });
	});
});

describe("withGroupDimensions", () => {
	const flow = toFlow(groupedGraph());

	it("WHEN elk sized a group THEN the group node adopts that width and height", () => {
		const sized = withGroupDimensions(flow.nodes, new Map([["folder-group:notes", { width: 300, height: 220 }]]));
		const group = sized.find((node) => node.kind === "folder-group");
		expect({ width: group?.width, height: group?.height }).toEqual({ width: 300, height: 220 });
	});

	it("WHEN dimensions exist for a note id THEN the note keeps its engine-driven size", () => {
		const sized = withGroupDimensions(flow.nodes, new Map([["notes/a.md", { width: 999, height: 999 }]]));
		expect(sized.find((node) => node.id === "notes/a.md")?.width).toBe(100);
	});
});

/**
 * The "no thumbnail refetch storm on rebuild" guarantee (step-07 perf pass) is
 * emergent, not explicit: `NoteNode` re-renders on every rebuild (fresh `data`
 * object) but its `thumbnailUrl` is `useMemo`'d off the PRIMITIVE
 * `data.firstImagePath` string, so an unchanged path recomputes to the same URL
 * and React reconciles the <img> to the same `src` — no new network request.
 * These tests pin the mapping-side half of that contract: `firstImagePath` is a
 * plain string (a stable useMemo key), identical across independent rebuilds of
 * an unchanged node. A future refactor that made it an object (fresh reference
 * each rebuild) would break the memo and re-trigger fetches — and fail here.
 */
describe("vicinityGraphToFlow thumbnail key stability (no-refetch-storm contract)", () => {
	function imageNode() {
		return makeNode({
			path: asVaultPath("n.md"),
			attachments: [{ path: asVaultPath("img/a.png"), isImage: true }],
			firstImagePath: asVaultPath("img/a.png"),
		});
	}

	it("WHEN a node has a thumbnail THEN firstImagePath is a primitive string (a stable useMemo key)", () => {
		const data = noteNode(toFlow(makeGraph({ nodes: [imageNode()] })).nodes, "n.md")?.data;
		expect(typeof data?.firstImagePath).toBe("string");
	});

	it("WHEN the same node is rebuilt THEN firstImagePath is string-equal across independent mappings", () => {
		const first = noteNode(toFlow(makeGraph({ nodes: [imageNode()] })).nodes, "n.md");
		const second = noteNode(toFlow(makeGraph({ nodes: [imageNode()] })).nodes, "n.md");
		expect(second?.data.firstImagePath).toBe(first?.data.firstImagePath);
	});

	it("WHEN a node has no image THEN firstImagePath is absent (thumbnailUrl resolves to null, no <img> mounts)", () => {
		const data = noteNode(toFlow(makeGraph({ nodes: [makeNode({ path: asVaultPath("n.md") })] })).nodes, "n.md")?.data;
		expect(data?.firstImagePath).toBeUndefined();
	});
});

/**
 * The outline reaches the node as a FLAT, raw, depth-filtered, budget-capped
 * array. Tree shape, labels and markup are the outline component's business —
 * this is the whole contract between the mapping and the UI.
 */
describe("vicinityGraphToFlow outline mapping", () => {
	const SIX_LEVELS: readonly OutlineEntry[] = [
		{ rawText: "H1", level: 1 },
		{ rawText: "H2", level: 2 },
		{ rawText: "H3", level: 3 },
		{ rawText: "H6", level: 6 },
	];

	function outlineOf(outline: readonly OutlineEntry[], outlineMaxDepth: number) {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("n.md"), outline })],
			viewSettings: { ...makeGraph().viewSettings, outlineMaxDepth },
		});
		return noteNode(toFlow(graph).nodes, "n.md")?.data.outline;
	}

	it("WHEN outlineMaxDepth is 2 THEN entries deeper than level 2 are dropped", () => {
		expect(outlineOf(SIX_LEVELS, 2)?.map((entry) => entry.level)).toEqual([1, 2]);
	});

	it("WHEN outlineMaxDepth is 2 THEN the surviving entries keep document order", () => {
		expect(outlineOf(SIX_LEVELS, 2)?.map((entry) => entry.rawText)).toEqual(["H1", "H2"]);
	});

	it("WHEN outlineMaxDepth is 6 THEN every level survives", () => {
		expect(outlineOf(SIX_LEVELS, 6)?.map((entry) => entry.level)).toEqual([1, 2, 3, 6]);
	});

	it("WHEN a node has more surviving entries than the render budget THEN only the first OUTLINE_RENDER_LIMIT map", () => {
		const many = Array.from({ length: OUTLINE_RENDER_LIMIT + 5 }, (_unused, index) => ({
			rawText: `H${index}`,
			level: 1,
		}));
		expect(outlineOf(many, 2)?.length).toBe(OUTLINE_RENDER_LIMIT);
	});

	it("WHEN entries deeper than the cap outnumber the budget THEN the shallow ones still map (filter runs BEFORE slice)", () => {
		const deepThenShallow: readonly OutlineEntry[] = [
			...Array.from({ length: OUTLINE_RENDER_LIMIT + 5 }, (_unused, index) => ({
				rawText: `deep-${index}`,
				level: 4,
			})),
			{ rawText: "shallow", level: 1 },
		];
		expect(outlineOf(deepThenShallow, 2)?.map((entry) => entry.rawText)).toEqual(["shallow"]);
	});

	it("WHEN the engine node has an empty outline THEN the mapped outline is [] (never undefined)", () => {
		expect(outlineOf([], 2)).toEqual([]);
	});

	it("WHEN a node has BOTH an outline and a first image THEN firstImagePath is still mapped", () => {
		const graph = makeGraph({
			nodes: [
				makeNode({
					path: asVaultPath("n.md"),
					outline: [{ rawText: "Intro", level: 1 }],
					attachments: [{ path: asVaultPath("img/a.png"), isImage: true }],
					firstImagePath: asVaultPath("img/a.png"),
				}),
			],
		});
		expect(noteNode(toFlow(graph).nodes, "n.md")?.data.firstImagePath).toBe("img/a.png");
	});
});

/**
 * Which preview region a node claims is decided HERE, from the depth-filtered
 * outline — not in the React component, and not from the engine's raw outline.
 */
describe("vicinityGraphToFlow preview decision", () => {
	const IMAGE = asVaultPath("img/a.png");

	function mappedData(node: Partial<GraphNode>, view: Partial<ViewSettings> = {}) {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("n.md"), ...node })],
			viewSettings: { ...makeGraph().viewSettings, ...view },
		});
		return noteNode(toFlow(graph).nodes, "n.md")?.data;
	}

	function previewOf(node: Partial<GraphNode>, view: Partial<ViewSettings> = {}) {
		return mappedData(node, view)?.preview;
	}

	/** A node carrying both regions, with the image ABOVE the first heading. */
	function coverNode(): Partial<GraphNode> {
		return {
			outline: [{ rawText: "Intro", level: 1 }],
			attachments: [{ path: IMAGE, isImage: true }],
			firstImagePath: IMAGE,
			imagePrecedesOutline: true,
		};
	}

	it("WHEN the preference is Auto AND a node's image precedes its outline THEN the mapped preview is the thumbnail", () => {
		expect(previewOf(coverNode(), { nodePreviewPreference: "auto" })).toBe("thumbnail");
	});

	it("WHEN the preference is Auto AND a CENTRAL's image does NOT precede its outline THEN the mapped preview is the outline", () => {
		// EXPLICIT ALIGNMENT (nid_k2pa8khm6ugozmhkd6nlbdrq6_e): document position
		// decides only where the outline is on offer at all, i.e. on a central.
		expect(
			previewOf({ ...coverNode(), isCentral: true, imagePrecedesOutline: false }, { nodePreviewPreference: "auto" }),
		).toBe("outline");
	});

	it("WHEN the preference is Auto AND an ordinary neighbour's image does NOT precede its outline THEN the mapped preview is STILL the thumbnail", () => {
		expect(previewOf({ ...coverNode(), imagePrecedesOutline: false }, { nodePreviewPreference: "auto" })).toBe(
			"thumbnail",
		);
	});

	it("WHEN the preference is Auto AND an ordinary neighbour has an outline but no image THEN the mapped preview is none", () => {
		expect(previewOf({ outline: [{ rawText: "Intro", level: 1 }] }, { nodePreviewPreference: "auto" })).toBe("none");
	});

	it("WHEN the preference is Auto AND a CENTRAL has an outline but no image THEN the mapped preview is the outline", () => {
		expect(
			previewOf({ outline: [{ rawText: "Intro", level: 1 }], isCentral: true }, { nodePreviewPreference: "auto" }),
		).toBe("outline");
	});

	it("WHEN the preference is Outline AND a node's image precedes its outline THEN the mapped preview is the outline", () => {
		expect(previewOf(coverNode(), { nodePreviewPreference: "outline" })).toBe("outline");
	});

	it("WHEN the preference is Image AND a node has both THEN the mapped preview is the thumbnail", () => {
		expect(previewOf({ ...coverNode(), imagePrecedesOutline: false }, { nodePreviewPreference: "image" })).toBe(
			"thumbnail",
		);
	});

	it("WHEN the preference is Image THEN the node's outline entries are STILL mapped (a decision never deletes data)", () => {
		const data = mappedData({ ...coverNode(), imagePrecedesOutline: false }, { nodePreviewPreference: "image" });
		expect(data?.outline).toEqual([{ rawText: "Intro", level: 1 }]);
	});

	it("WHEN outlineMaxDepth drops every heading AND the node has an image THEN the preview is the thumbnail", () => {
		// The POST-filter count decides: an outline nobody can see must not claim
		// the slot, or the node renders an empty box.
		const deepOnly: Partial<GraphNode> = { ...coverNode(), outline: [{ rawText: "Deep", level: 4 }] };
		expect(previewOf({ ...deepOnly, imagePrecedesOutline: false }, { outlineMaxDepth: 2 })).toBe("thumbnail");
	});

	it("WHEN outlineMaxDepth drops every heading AND the node has no image THEN the preview is none", () => {
		expect(previewOf({ outline: [{ rawText: "Deep", level: 4 }] }, { outlineMaxDepth: 2 })).toBe("none");
	});
});

/**
 * The view-layer half of the invariant pinned engine-side in `NodeSizer.test.ts`
 * / `VicinityEngine.test.ts`: flipping the Preview pill must stay a data-only
 * refresh. `vicinityGraphToFlow` has the preference in scope (it decides
 * `data.preview`) AND sets each flow node's box, so "image previews need a
 * taller node" is the most plausible way node geometry starts moving with the
 * pill — which would cross `SIZE_RELAYOUT_THRESHOLD` and force a full relayout.
 */
describe("vicinityGraphToFlow node geometry ignores the node preview preference", () => {
	const IMAGE = asVaultPath("img/cover.png");

	// GIVEN nodes that differ in size AND carry both preview regions, so the
	// mapped preview really does change as the preference flips.
	const nodes = [
		makeNode({
			path: asVaultPath("a.md"),
			sizePx: 160,
			outline: [{ rawText: "Intro", level: 1 }],
			attachments: [{ path: IMAGE, isImage: true }],
			firstImagePath: IMAGE,
			imagePrecedesOutline: true,
		}),
		makeNode({ path: asVaultPath("folder/b.md"), folder: asFolderPath("folder"), sizePx: 40 }),
	];

	function boxesUnderPreference(preference: NodePreviewPreference) {
		const graph = makeGraph({
			nodes,
			viewSettings: { ...makeGraph().viewSettings, nodePreviewPreference: preference },
		});
		return toFlow(graph).nodes.map((node) => ({ id: node.id, width: node.width, height: node.height }));
	}

	it("WHEN only nodePreviewPreference varies THEN every flow node keeps the same width and height", () => {
		const baseline = boxesUnderPreference(NODE_PREVIEW_PREFERENCES[0]);
		// Keyed by preference so a failure names the offending value.
		const actual = Object.fromEntries(NODE_PREVIEW_PREFERENCES.map((p) => [p, boxesUnderPreference(p)]));
		expect(actual).toEqual(Object.fromEntries(NODE_PREVIEW_PREFERENCES.map((p) => [p, baseline])));
	});
});
