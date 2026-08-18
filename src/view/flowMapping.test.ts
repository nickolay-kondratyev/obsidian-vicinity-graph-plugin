import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode, NodeContentOverride, NodePreviewPreference, OutlineEntry, ViewSettings } from "../engine";
import { asDocId, asFolderPath, asVaultPath, NODE_CONTENT_OVERRIDES, NODE_PREVIEW_PREFERENCES } from "../engine";
import { OUTLINE_RENDER_LIMIT } from "./constants";
import { edgeClassName, edgeKindClassName, vicinityGraphToFlow, withGroupDimensions, withPositions } from "./flowMapping";
import type { FlowNode, FlowPinFacts, FolderNoteCandidatesLookup, NoteFlowNode, XY } from "./flowMapping";
import { NO_ORPHAN_TRUNCATION } from "./truncationBadges";
import { relationColorSlot } from "./relationColor";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

function noteNode(nodes: readonly FlowNode[], id: string): NoteFlowNode | undefined {
	const found = nodes.find((node) => node.id === id);
	return found?.kind === "note" ? found : undefined;
}

/** No pins at all — the default context for tests that do not exercise pinning. */
const NO_PINS: FlowPinFacts = { globalPinnedDocids: new Set(), localPinnedDocids: new Set() };

/** No folder notes anywhere — the default context for tests that do not exercise label navigation. */
const NO_FOLDER_NOTES: FolderNoteCandidatesLookup = { folderNoteCandidatesOf: () => [] };

/** Default mapping call: nothing pinned, no folder notes. Those cases have their own describes. */
function toFlow(graph: Parameters<typeof vicinityGraphToFlow>[0]) {
	return vicinityGraphToFlow(graph, NO_PINS, NO_FOLDER_NOTES, false);
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
			isGloballyPinned: false,
			isLocallyPinned: false,
			hasSizeOverride: false,
			offersChildNoteCreation: false,
			folder: "",
			outline: [],
			preview: "none",
			imageCount: 0,
			attachmentGroups: [],
		});
	});
});

describe("vicinityGraphToFlow create-child-note flag (ticket nid_rt0dyx6chv7fxae4k7q85f53l_e)", () => {
	const graph = makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("Jon/Jon.md"), title: "Jon", isMain: true, isCentral: true }),
			makeNode({ path: asVaultPath("Jon/child.md"), title: "child" }),
		],
	});

	it("WHEN the main is a folder note with an existing folder THEN only the MAIN offers child-note creation", () => {
		const flow = vicinityGraphToFlow(graph, NO_PINS, NO_FOLDER_NOTES, true);
		expect({
			main: noteNode(flow.nodes, "Jon/Jon.md")?.data.offersChildNoteCreation,
			child: noteNode(flow.nodes, "Jon/child.md")?.data.offersChildNoteCreation,
		}).toEqual({ main: true, child: false });
	});

	it("WHEN the main is NOT a folder note THEN no node offers child-note creation", () => {
		const flow = vicinityGraphToFlow(graph, NO_PINS, NO_FOLDER_NOTES, false);
		expect(noteNode(flow.nodes, "Jon/Jon.md")?.data.offersChildNoteCreation).toBe(false);
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

describe("vicinityGraphToFlow pin flags (global vs local split)", () => {
	const DOCID = "docid_n_e";
	function pinFlagsOf(
		flags: { isMain: boolean; isCentral: boolean; docid?: string },
		pinFacts: FlowPinFacts,
	): { isGloballyPinned: boolean; isLocallyPinned: boolean } | undefined {
		const graph = makeGraph({
			nodes: [
				makeNode({
					path: asVaultPath("n.md"),
					isMain: flags.isMain,
					isCentral: flags.isCentral,
					...(flags.docid === undefined ? {} : { docid: asDocId(flags.docid) }),
				}),
			],
		});
		const data = noteNode(vicinityGraphToFlow(graph, pinFacts, NO_FOLDER_NOTES, false).nodes, "n.md")?.data;
		return data === undefined
			? undefined
			: { isGloballyPinned: data.isGloballyPinned, isLocallyPinned: data.isLocallyPinned };
	}

	it("WHEN the node is a regular neighbor with no docid THEN neither flag is set", () => {
		expect(pinFlagsOf({ isMain: false, isCentral: false }, NO_PINS)).toEqual({
			isGloballyPinned: false,
			isLocallyPinned: false,
		});
	});

	it("WHEN a central's docid is in the GLOBAL set THEN only isGloballyPinned is set", () => {
		const pinFacts: FlowPinFacts = { globalPinnedDocids: new Set([DOCID]), localPinnedDocids: new Set() };
		expect(pinFlagsOf({ isMain: false, isCentral: true, docid: DOCID }, pinFacts)).toEqual({
			isGloballyPinned: true,
			isLocallyPinned: false,
		});
	});

	it("WHEN a central's docid is in the LOCAL set THEN only isLocallyPinned is set", () => {
		const pinFacts: FlowPinFacts = { globalPinnedDocids: new Set(), localPinnedDocids: new Set([DOCID]) };
		expect(pinFlagsOf({ isMain: false, isCentral: true, docid: DOCID }, pinFacts)).toEqual({
			isGloballyPinned: false,
			isLocallyPinned: true,
		});
	});

	it("WHEN a central's docid is in BOTH sets THEN both flags are set (a doc can hold both pin kinds)", () => {
		const pinFacts: FlowPinFacts = { globalPinnedDocids: new Set([DOCID]), localPinnedDocids: new Set([DOCID]) };
		expect(pinFlagsOf({ isMain: false, isCentral: true, docid: DOCID }, pinFacts)).toEqual({
			isGloballyPinned: true,
			isLocallyPinned: true,
		});
	});

	it("WHEN MAIN's docid is in the GLOBAL set THEN isGloballyPinned is set (engine skips main-as-pin, the set carries it)", () => {
		const pinFacts: FlowPinFacts = { globalPinnedDocids: new Set([DOCID]), localPinnedDocids: new Set() };
		expect(pinFlagsOf({ isMain: true, isCentral: true, docid: DOCID }, pinFacts)).toEqual({
			isGloballyPinned: true,
			isLocallyPinned: false,
		});
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
		expect(group?.data).toEqual({
			folder: "notes",
			folderName: "notes",
			hiddenCount: 0,
			fullPathLabel: false,
			folderNoteCandidates: [],
		});
	});

	it("WHEN the lookup knows the group's folder THEN its candidates ride the group data (label navigation)", () => {
		const candidatesByFolder = new Map([["notes", ["notes/notes.md", "notes.md"]]]);
		const flow = vicinityGraphToFlow(groupedGraph(), NO_PINS, {
			folderNoteCandidatesOf: (folder) => candidatesByFolder.get(folder) ?? [],
		}, false);
		const group = flow.nodes.find((node) => node.kind === "folder-group");
		expect(group?.data.folderNoteCandidates).toEqual(["notes/notes.md", "notes.md"]);
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

	it("WHEN folderGroupingDepth is 0 THEN no folder-group node is emitted and every note renders flat", () => {
		// The setting-threading tripwire (ticket nid_5vz7mtm2rn6n7nj9cp5mfbslx_e): the
		// mapping must derive its grouping from the STORED dial, not a constant.
		const graph = makeGraph({
			nodes: groupedGraph().nodes,
			viewSettings: { ...groupedGraph().viewSettings, folderGroupingDepth: 0 },
		});
		const flow = toFlow(graph);
		expect({
			groupNodes: flow.nodes.filter((node) => node.kind === "folder-group"),
			memberParentId: noteNode(flow.nodes, "notes/a.md")?.parentId,
		}).toEqual({ groupNodes: [], memberParentId: undefined });
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

/**
 * GIVEN a nesting parent `sql` with NO direct notes, whose visible notes all
 * live in two qualifying subgroups. This is the empty-nesting-parent regression
 * (ticket nid_d44vbnq9o6rhuelfwclx2e34n_e): the flat consumer shipped a phantom
 * EMPTY `sql` box; nesting must render it as a NON-EMPTY container holding its
 * two child group boxes.
 */
function nestedGroupGraph() {
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("sql/joins/a.md"), folder: asFolderPath("sql/joins") }),
			makeNode({ path: asVaultPath("sql/joins/b.md"), folder: asFolderPath("sql/joins") }),
			makeNode({ path: asVaultPath("sql/windows/c.md"), folder: asFolderPath("sql/windows") }),
			makeNode({ path: asVaultPath("sql/windows/d.md"), folder: asFolderPath("sql/windows") }),
		],
		edges: [makeEdge("sql/joins/a.md", "sql/windows/c.md")],
	});
}

describe("vicinityGraphToFlow folder-note candidates on a collapsed chain (R4)", () => {
	it("WHEN a chain `wiki/lang/en` collapses onto its leaf THEN only the DEEPEST folder's candidates are asked for", () => {
		const chainGraph = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("wiki/lang/en/a.md"), folder: asFolderPath("wiki/lang/en") }),
				makeNode({ path: asVaultPath("wiki/lang/en/b.md"), folder: asFolderPath("wiki/lang/en") }),
			],
		});
		const queriedFolders: string[] = [];
		vicinityGraphToFlow(chainGraph, NO_PINS, {
			folderNoteCandidatesOf: (folder) => {
				queriedFolders.push(folder);
				return [];
			},
		}, false);
		expect(queriedFolders).toEqual(["wiki/lang/en"]);
	});
});

describe("vicinityGraphToFlow nested folder groups", () => {
	function groupNode(nodes: readonly FlowNode[], id: string) {
		const found = nodes.find((node) => node.id === id);
		return found?.kind === "folder-group" ? found : undefined;
	}

	it("WHEN a group nests THEN it carries its parent group's parentId", () => {
		expect(groupNode(toFlow(nestedGroupGraph()).nodes, "folder-group:sql/joins")?.parentId).toBe("folder-group:sql");
	});

	it("WHEN a group is top-level THEN it has no parentId", () => {
		expect(groupNode(toFlow(nestedGroupGraph()).nodes, "folder-group:sql")?.parentId).toBeUndefined();
	});

	it("WHEN a nesting parent has no direct notes THEN its box is NOT empty — the child groups render inside it", () => {
		const nodes = toFlow(nestedGroupGraph()).nodes;
		const nestedUnderSql = nodes.filter((node) => node.parentId === "folder-group:sql").map((node) => node.id);
		expect(nestedUnderSql).toEqual(["folder-group:sql/joins", "folder-group:sql/windows"]);
	});

	it("WHEN a parent group is emitted THEN it precedes its child groups (React Flow parent-first rule)", () => {
		const ids = toFlow(nestedGroupGraph()).nodes.map((node) => node.id);
		expect(ids.indexOf("folder-group:sql")).toBeLessThan(ids.indexOf("folder-group:sql/joins"));
	});

	it("WHEN an edge crosses two sibling subgroups THEN it collapses onto their group boxes", () => {
		const [edge] = toFlow(nestedGroupGraph()).edges;
		expect({ source: edge?.source, target: edge?.target }).toEqual({
			source: "folder-group:sql/joins",
			target: "folder-group:sql/windows",
		});
	});
});

/**
 * GIVEN a THREE-deep grouping tree `A ⊃ A/B ⊃ A/B/C`, each level holding two of
 * its OWN direct notes (so no level collapses) plus a sibling top-level group `P`.
 * Exercises the multi-level parentId chain, absolute↔relative conversion across
 * more than one parent hop, and LCA projection onto the OUTERMOST groups when two
 * notes' only common container is the canvas pane.
 */
function deeplyNestedGraph() {
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("A/a1.md"), folder: asFolderPath("A") }),
			makeNode({ path: asVaultPath("A/a2.md"), folder: asFolderPath("A") }),
			makeNode({ path: asVaultPath("A/B/b1.md"), folder: asFolderPath("A/B") }),
			makeNode({ path: asVaultPath("A/B/b2.md"), folder: asFolderPath("A/B") }),
			makeNode({ path: asVaultPath("A/B/C/c1.md"), folder: asFolderPath("A/B/C") }),
			makeNode({ path: asVaultPath("A/B/C/c2.md"), folder: asFolderPath("A/B/C") }),
			makeNode({ path: asVaultPath("P/p1.md"), folder: asFolderPath("P") }),
			makeNode({ path: asVaultPath("P/p2.md"), folder: asFolderPath("P") }),
		],
		edges: [makeEdge("A/B/C/c1.md", "P/p1.md")],
	});
}

describe("vicinityGraphToFlow deeply nested folder groups", () => {
	it("WHEN groups nest three deep THEN each carries its immediate parent group's parentId", () => {
		const nodes = toFlow(deeplyNestedGraph()).nodes;
		const parentOf = (id: string) => nodes.find((node) => node.id === id)?.parentId;
		expect([parentOf("folder-group:A"), parentOf("folder-group:A/B"), parentOf("folder-group:A/B/C")]).toEqual([
			undefined,
			"folder-group:A",
			"folder-group:A/B",
		]);
	});

	it("WHEN groups nest three deep THEN every ancestor group precedes its descendant (parent-first rule)", () => {
		const ids = toFlow(deeplyNestedGraph()).nodes.map((node) => node.id);
		expect(ids.indexOf("folder-group:A")).toBeLessThan(ids.indexOf("folder-group:A/B"));
		expect(ids.indexOf("folder-group:A/B")).toBeLessThan(ids.indexOf("folder-group:A/B/C"));
	});

	it("WHEN a note is three groups deep THEN it renders in its nearest (innermost) group", () => {
		expect(noteNode(toFlow(deeplyNestedGraph()).nodes, "A/B/C/c1.md")?.parentId).toBe("folder-group:A/B/C");
	});

	it("WHEN an edge's endpoints share only the canvas pane THEN it collapses onto the OUTERMOST groups, not the inner ones", () => {
		const [edge] = toFlow(deeplyNestedGraph()).edges;
		expect({ source: edge?.source, target: edge?.target }).toEqual({
			source: "folder-group:A",
			target: "folder-group:P",
		});
	});

	it("WHEN positions are applied across a multi-hop chain THEN each node is relative to its IMMEDIATE parent only", () => {
		const flow = toFlow(deeplyNestedGraph());
		// Absolute layout coords (extractElkPositions space); each nested box offset from the last.
		const positions = new Map<string, XY>([
			["folder-group:A", { x: 100, y: 100 }],
			["folder-group:A/B", { x: 130, y: 140 }],
			["folder-group:A/B/C", { x: 170, y: 190 }],
			["A/B/C/c1.md", { x: 200, y: 230 }],
		]);
		const positionOf = (id: string) => withPositions(flow.nodes, positions).find((node) => node.id === id)?.position;
		// A/B relative to A; A/B/C relative to A/B; the deep note relative to A/B/C.
		expect(positionOf("folder-group:A/B")).toEqual({ x: 30, y: 40 });
		expect(positionOf("folder-group:A/B/C")).toEqual({ x: 40, y: 50 });
		expect(positionOf("A/B/C/c1.md")).toEqual({ x: 30, y: 40 });
	});
});

/**
 * The graph with its "Edge depth into groups" allowance set — the ONE setting these
 * render-only tests vary. Everything else in `viewSettings` stays at the fixture default.
 */
function withEdgeDepth(graph: ReturnType<typeof makeGraph>, edgeDepthIntoGroups: number) {
	return { ...graph, viewSettings: { ...graph.viewSettings, edgeDepthIntoGroups } };
}

describe("vicinityGraphToFlow edge depth into groups (render-only pierce projection)", () => {
	// deeplyNestedGraph()'s single edge runs A/B/C/c1.md → P/p1.md, sharing only the canvas pane.
	function endpointsAt(edgeDepthIntoGroups: number) {
		const [edge] = toFlow(withEdgeDepth(deeplyNestedGraph(), edgeDepthIntoGroups)).edges;
		return { source: edge?.source, target: edge?.target };
	}

	it("WHEN the allowance is 0 THEN edges are byte-identical to today (outermost group boxes)", () => {
		// The exact expectation the depth-less test above asserts — pinned here at the default.
		expect(endpointsAt(0)).toEqual({ source: "folder-group:A", target: "folder-group:P" });
	});

	it("WHEN the allowance is 1 THEN the deep endpoint terminates one nested group box in", () => {
		// Source reaches A/B (one level past A); P's chain is only one deep, so it stays the true note.
		expect(endpointsAt(1)).toEqual({ source: "folder-group:A/B", target: "P/p1.md" });
	});

	it("WHEN the allowance reaches the innermost group THEN the edge terminates at that group box", () => {
		expect(endpointsAt(2)).toEqual({ source: "folder-group:A/B/C", target: "P/p1.md" });
	});

	it("WHEN the allowance exceeds every chain THEN the edge terminates at the true notes on both ends", () => {
		expect(endpointsAt(3)).toEqual({ source: "A/B/C/c1.md", target: "P/p1.md" });
	});

	it("WHEN a note is the true endpoint THEN the collapsed edge's flyout still names the real note pair", () => {
		const [edge] = toFlow(withEdgeDepth(deeplyNestedGraph(), 1)).edges;
		expect(edge?.notePairs).toEqual([{ source: "A/B/C/c1.md", target: "P/p1.md", hierarchy: false }]);
	});
});

/**
 * GIVEN two 2-deep branches under a shared root `A` (`A/L/LL` and `A/R/RR`), each level
 * carrying its own direct notes so nothing collapses. An edge between the two innermost
 * notes has `A` as its LCA container, so BOTH endpoints project — the both-endpoints-deep
 * case — and a reverse edge exercises the bidirectional/count merge at the deeper level.
 */
function bothDeepGraph(edges: readonly GraphEdge[]) {
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("A/a1.md"), folder: asFolderPath("A") }),
			makeNode({ path: asVaultPath("A/a2.md"), folder: asFolderPath("A") }),
			makeNode({ path: asVaultPath("A/L/l1.md"), folder: asFolderPath("A/L") }),
			makeNode({ path: asVaultPath("A/L/l2.md"), folder: asFolderPath("A/L") }),
			makeNode({ path: asVaultPath("A/L/LL/ll1.md"), folder: asFolderPath("A/L/LL") }),
			makeNode({ path: asVaultPath("A/L/LL/ll2.md"), folder: asFolderPath("A/L/LL") }),
			makeNode({ path: asVaultPath("A/R/r1.md"), folder: asFolderPath("A/R") }),
			makeNode({ path: asVaultPath("A/R/r2.md"), folder: asFolderPath("A/R") }),
			makeNode({ path: asVaultPath("A/R/RR/rr1.md"), folder: asFolderPath("A/R/RR") }),
			makeNode({ path: asVaultPath("A/R/RR/rr2.md"), folder: asFolderPath("A/R/RR") }),
		],
		edges,
	});
}

describe("vicinityGraphToFlow edge depth into groups (both endpoints deep)", () => {
	it("WHEN the allowance is 0 THEN both endpoints collapse onto the LCA's direct child groups", () => {
		const graph = bothDeepGraph([makeEdge("A/L/LL/ll1.md", "A/R/RR/rr1.md")]);
		const [edge] = toFlow(withEdgeDepth(graph, 0)).edges;
		expect({ source: edge?.source, target: edge?.target }).toEqual({
			source: "folder-group:A/L",
			target: "folder-group:A/R",
		});
	});

	it("WHEN the allowance is 1 THEN BOTH endpoints terminate one group box deeper", () => {
		const graph = bothDeepGraph([makeEdge("A/L/LL/ll1.md", "A/R/RR/rr1.md")]);
		const [edge] = toFlow(withEdgeDepth(graph, 1)).edges;
		expect({ source: edge?.source, target: edge?.target }).toEqual({
			source: "folder-group:A/L/LL",
			target: "folder-group:A/R/RR",
		});
	});

	it("WHEN opposing edges collapse onto a deeper projected pair THEN they still merge (count + bidirectional)", () => {
		const graph = bothDeepGraph([
			makeEdge("A/L/LL/ll1.md", "A/R/RR/rr1.md", 2),
			makeEdge("A/R/RR/rr1.md", "A/L/LL/ll1.md", 3),
		]);
		const edges = toFlow(withEdgeDepth(graph, 1)).edges;
		expect(edges).toHaveLength(1);
		expect(edges[0]).toMatchObject({ count: 5, bidirectional: true });
	});
});

/**
 * GIVEN two notes in `A/B/C` and nothing else visible: `A` and `A/B` each hold
 * exactly one qualifying child group, so the redundant chain collapses (D2.4)
 * onto ONE surviving group whose folder is `A/B/C` — leaf name `C`, chain path
 * `A/B/C`. The "Full folder path" label setting (A1) chooses between the two.
 */
function collapsedChainGraph() {
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("A/B/C/x.md"), folder: asFolderPath("A/B/C") }),
			makeNode({ path: asVaultPath("A/B/C/y.md"), folder: asFolderPath("A/B/C") }),
		],
	});
}

function collapsedChainGroup(graph: Parameters<typeof vicinityGraphToFlow>[0]) {
	return toFlow(graph).nodes.find((node) => node.kind === "folder-group");
}

describe("vicinityGraphToFlow collapsed-chain group label (groupLabelFullPath)", () => {
	it("WHEN the label setting is OFF (default) THEN a collapsed chain shows its LEAF folder name", () => {
		expect(collapsedChainGroup(collapsedChainGraph())?.data.folderName).toBe("C");
	});

	it("WHEN the label setting is ON THEN a collapsed chain shows its FULL path", () => {
		const graph = makeGraph({
			nodes: collapsedChainGraph().nodes,
			viewSettings: { ...makeGraph().viewSettings, groupLabelFullPath: true },
		});
		expect(collapsedChainGroup(graph)?.data.folderName).toBe("A/B/C");
	});

	it("WHEN the label setting is ON THEN the tooltip folder path is unchanged (full vault path)", () => {
		const graph = makeGraph({
			nodes: collapsedChainGraph().nodes,
			viewSettings: { ...makeGraph().viewSettings, groupLabelFullPath: true },
		});
		expect(collapsedChainGroup(graph)?.data.folder).toBe("A/B/C");
	});

	it("WHEN the label setting is ON THEN a NON-collapsed group is unaffected (leaf === chain)", () => {
		const graph = makeGraph({
			nodes: groupedGraph().nodes,
			viewSettings: { ...makeGraph().viewSettings, groupLabelFullPath: true },
		});
		expect(collapsedChainGroup(graph)?.data.folderName).toBe("notes");
	});

	it("WHEN the label setting is OFF (default) THEN fullPathLabel is false (leaf keeps trailing truncation)", () => {
		expect(collapsedChainGroup(collapsedChainGraph())?.data.fullPathLabel).toBe(false);
	});

	it("WHEN the label setting is ON THEN fullPathLabel is true (path front-truncates)", () => {
		const graph = makeGraph({
			nodes: collapsedChainGraph().nodes,
			viewSettings: { ...makeGraph().viewSettings, groupLabelFullPath: true },
		});
		expect(collapsedChainGroup(graph)?.data.fullPathLabel).toBe(true);
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
				notePairs: [{ source: "notes/a.md", target: "notes/b.md", hierarchy: false }],
				count: 1,
				kind: "link",
				hierarchy: false,
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
		expect(toFlow(graph).edges[0]?.notePairs).toEqual([{ source: "a.md", target: "b.md", hierarchy: false }]);
	});

	it("WHEN member edges collapse THEN notePairs lists every contributing pair in first-seen order", () => {
		expect(toFlow(collapsedGraph()).edges[0]?.notePairs).toEqual([
			{ source: "hub.md", target: "notes/a.md", hierarchy: false },
			{ source: "hub.md", target: "notes/b.md", hierarchy: false },
		]);
	});

	it("WHEN both directions collapse onto one edge THEN notePairs keeps each pair's own direction", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [makeEdge("hub.md", "notes/a.md"), makeEdge("notes/b.md", "hub.md")],
		});
		expect(toFlow(graph).edges[0]?.notePairs).toEqual([
			{ source: "hub.md", target: "notes/a.md", hierarchy: false },
			{ source: "notes/b.md", target: "hub.md", hierarchy: false },
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

describe("vicinityGraphToFlow folder-note hierarchy edges", () => {
	function twoNodeGraph(edge: GraphEdge) {
		return makeGraph({
			nodes: [makeNode({ path: asVaultPath("Jon.md") }), makeNode({ path: asVaultPath("Jon/child.md") })],
			edges: [edge],
		});
	}

	it("WHEN a passthrough edge carries the hierarchy relation THEN the flow edge carries it too", () => {
		const edge = makeEdge("Jon.md", "Jon/child.md", 0, "link", true);
		expect(toFlow(twoNodeGraph(edge)).edges[0]?.hierarchy).toBe(true);
	});

	it("WHEN a passthrough edge carries the hierarchy relation THEN its note pair carries it", () => {
		const edge = makeEdge("Jon.md", "Jon/child.md", 0, "link", true);
		expect(toFlow(twoNodeGraph(edge)).edges[0]?.notePairs).toEqual([
			{ source: "Jon.md", target: "Jon/child.md", hierarchy: true },
		]);
	});

	it("WHEN a collapsed edge unions a hierarchy contributor THEN the collapsed edge is hierarchy", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [makeEdge("hub.md", "notes/a.md", 1, "link", false), makeEdge("hub.md", "notes/b.md", 0, "link", true)],
		});
		expect(toFlow(graph).edges[0]?.hierarchy).toBe(true);
	});

	it("WHEN a pure hierarchy edge (count 0) maps THEN edgeClassName adds the dashed hook", () => {
		const edge = makeEdge("Jon.md", "Jon/child.md", 0, "link", true);
		expect(edgeClassName(toFlow(twoNodeGraph(edge)).edges[0]!)).toBe(
			"vicinity-graph-edge--kind-link vicinity-graph-edge--hierarchy",
		);
	});

	it("WHEN a MERGED edge (hierarchy + count >= 1) maps THEN edgeClassName stays the plain kind class", () => {
		const edge = makeEdge("Jon.md", "Jon/child.md", 2, "link", true);
		expect(edgeClassName(toFlow(twoNodeGraph(edge)).edges[0]!)).toBe("vicinity-graph-edge--kind-link");
	});

	it("WHEN a plain link edge maps THEN edgeClassName is the kind class with no hierarchy hook", () => {
		const edge = makeEdge("Jon.md", "Jon/child.md", 1, "link", false);
		expect(edgeClassName(toFlow(twoNodeGraph(edge)).edges[0]!)).toBe("vicinity-graph-edge--kind-link");
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
				isGloballyPinned: false,
				isLocallyPinned: false,
				hasSizeOverride: false,
				offersChildNoteCreation: false,
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

	// The per-node content override (the hover gear) sits IN FRONT of the chooser:
	// it REPLACES the global preference for that node only.
	it("WHEN a node overrides content to Outline AND the global is Image THEN the mapped preview is the outline", () => {
		expect(
			previewOf(
				{ ...coverNode(), imagePrecedesOutline: false, override: { content: "outline" } },
				{ nodePreviewPreference: "image" },
			),
		).toBe("outline");
	});

	it("WHEN a node overrides content to Image AND the global is Outline THEN the mapped preview is the thumbnail", () => {
		expect(
			previewOf({ ...coverNode(), override: { content: "image" } }, { nodePreviewPreference: "outline" }),
		).toBe("thumbnail");
	});

	it("WHEN a node overrides content to Title only THEN the mapped preview is none, regardless of the global", () => {
		expect(previewOf({ ...coverNode(), override: { content: "title-only" } }, { nodePreviewPreference: "image" })).toBe(
			"none",
		);
	});

	it("WHEN a node has NO content override THEN the mapped preview follows the global preference (Inherit)", () => {
		expect(previewOf(coverNode(), { nodePreviewPreference: "image" })).toBe("thumbnail");
	});

	it("WHEN a node overrides content THEN its data echoes the override (the gear's checked-state fact)", () => {
		expect(mappedData({ ...coverNode(), override: { content: "outline" } })?.contentOverride).toBe("outline");
	});

	it("WHEN a node has NO content override THEN its data carries no contentOverride (Inherit is absence)", () => {
		expect(mappedData(coverNode())?.contentOverride).toBeUndefined();
	});
});

describe("vicinityGraphToFlow duplicate-image de-dup (nid_ivt836nuelyse1c0epp86d36z_e)", () => {
	const IMAGE = asVaultPath("img/shared.png");

	/** A note that (alone) would render IMAGE as its thumbnail — Auto, no outline. */
	function imageNode(path: string, folder: string): GraphNode {
		return makeNode({
			path: asVaultPath(path),
			folder: asFolderPath(folder),
			attachments: [{ path: IMAGE, isImage: true }],
			firstImagePath: IMAGE,
		});
	}

	function previewOf(nodes: readonly GraphNode[], id: string) {
		return noteNode(toFlow(makeGraph({ nodes })).nodes, id)?.data.preview;
	}

	it("WHEN two nodes would render the SAME image THEN the one higher in the folder hierarchy keeps the thumbnail", () => {
		const nodes = [imageNode("deep/loser.md", "deep"), imageNode("winner.md", "")];
		expect(previewOf(nodes, "winner.md")).toBe("thumbnail");
	});

	it("WHEN two nodes would render the SAME image THEN the lower one does NOT display the image", () => {
		const nodes = [imageNode("deep/loser.md", "deep"), imageNode("winner.md", "")];
		expect(previewOf(nodes, "deep/loser.md")).toBe("none");
	});

	it("WHEN the loser has its OWN outline THEN it falls back to that outline rather than the shared image", () => {
		// Global preference Image: BOTH nodes would show the thumbnail; suppression
		// hands the loser back to its outline (the preview ladder without the image).
		const outline = [{ rawText: "Intro", level: 1 }];
		const nodes = [
			{ ...imageNode("deep/loser.md", "deep"), outline },
			{ ...imageNode("winner.md", ""), outline },
		];
		const graph = makeGraph({ nodes, viewSettings: { ...makeGraph().viewSettings, nodePreviewPreference: "image" } });
		expect(noteNode(toFlow(graph).nodes, "deep/loser.md")?.data.preview).toBe("outline");
		expect(noteNode(toFlow(graph).nodes, "winner.md")?.data.preview).toBe("thumbnail");
	});

	it("WHEN two nodes render DIFFERENT images THEN both keep their thumbnails", () => {
		const other = asVaultPath("img/other.png");
		const second = { ...imageNode("b.md", ""), attachments: [{ path: other, isImage: true }], firstImagePath: other };
		const nodes = [imageNode("a.md", ""), second];
		expect(previewOf(nodes, "a.md")).toBe("thumbnail");
		expect(previewOf(nodes, "b.md")).toBe("thumbnail");
	});

	it("WHEN the suppressed node still carries the image path THEN the mapping reported it (a decision never deletes data)", () => {
		const nodes = [imageNode("deep/loser.md", "deep"), imageNode("winner.md", "")];
		expect(noteNode(toFlow(makeGraph({ nodes })).nodes, "deep/loser.md")?.data.firstImagePath).toBe(IMAGE);
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

/**
 * The same invariant for the PER-NODE content override (the hover gear): flipping
 * one node's content override changes only which region it renders, never its box —
 * so the rebuild after a gear flip reuses layout instead of relaying out (the
 * acceptance criterion "flip does not trigger relayout"). The sizer reads the
 * GLOBAL preference only, so this holds even though a preference flip CAN relayout.
 */
describe("vicinityGraphToFlow node geometry ignores the per-node content override", () => {
	const IMAGE = asVaultPath("img/cover.png");

	function boxesUnderOverride(content: NodeContentOverride | undefined) {
		const nodes = [
			makeNode({
				path: asVaultPath("a.md"),
				sizePx: 160,
				outline: [{ rawText: "Intro", level: 1 }],
				attachments: [{ path: IMAGE, isImage: true }],
				firstImagePath: IMAGE,
				imagePrecedesOutline: true,
				...(content === undefined ? {} : { override: { content } }),
			}),
		];
		const graph = makeGraph({ nodes });
		return toFlow(graph).nodes.map((node) => ({ id: node.id, width: node.width, height: node.height }));
	}

	it("WHEN a node's content override varies THEN its flow box keeps the same width and height", () => {
		const baseline = boxesUnderOverride(undefined);
		const choices: (NodeContentOverride | undefined)[] = [undefined, ...NODE_CONTENT_OVERRIDES];
		const actual = Object.fromEntries(choices.map((c) => [String(c), boxesUnderOverride(c)]));
		expect(actual).toEqual(Object.fromEntries(choices.map((c) => [String(c), baseline])));
	});
});

describe("vicinityGraphToFlow named-relationship labels (ticket nid_wnagjm2j144u0jsgixpcmmpar_e)", () => {
	function twoNodes() {
		return [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })];
	}

	it("WHEN a passthrough edge carries relation labels THEN the flow edge carries the same union", () => {
		const graph = makeGraph({
			nodes: twoNodes(),
			edges: [{ ...makeEdge("a.md", "b.md"), relations: [{ name: "supports" }, { name: "refutes", qualifier: "weakly" }] }],
		});
		expect(toFlow(graph).edges[0]?.relations).toEqual([
			{ label: { name: "supports" }, direction: "forward" },
			{ label: { name: "refutes", qualifier: "weakly" }, direction: "forward" },
		]);
	});

	it("WHEN a passthrough edge carries relation labels THEN its note pair carries them for the flyout", () => {
		const graph = makeGraph({
			nodes: twoNodes(),
			edges: [{ ...makeEdge("a.md", "b.md"), relations: [{ name: "supports" }] }],
		});
		expect(toFlow(graph).edges[0]?.notePairs).toEqual([
			{ source: "a.md", target: "b.md", hierarchy: false, relations: [{ name: "supports" }] },
		]);
	});

	it("WHEN an edge carries no relation labels THEN the flow edge has no relations key", () => {
		const graph = makeGraph({ nodes: twoNodes(), edges: [makeEdge("a.md", "b.md")] });
		expect(toFlow(graph).edges[0]?.relations).toBeUndefined();
	});

	it("WHEN a rel-note label maps THEN its rel-note target survives to the flow edge", () => {
		const graph = makeGraph({
			nodes: twoNodes(),
			edges: [{ ...makeEdge("a.md", "b.md"), relations: [{ name: "he supports", relNoteTarget: asVaultPath("rel/he-supports.md") }] }],
		});
		expect(toFlow(graph).edges[0]?.relations).toEqual([
			{ label: { name: "he supports", relNoteTarget: "rel/he-supports.md" }, direction: "forward" },
		]);
	});

	it("WHEN collapsed edges carry relations THEN the flow edge unions them deduped in first-seen order", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [
				{ ...makeEdge("hub.md", "notes/a.md"), relations: [{ name: "supports" }] },
				{ ...makeEdge("hub.md", "notes/b.md"), relations: [{ name: "supports" }, { name: "cites" }] },
			],
		});
		// "supports" appears on both contributors — deduped to one; "cites" follows it.
		// Both point hub → group, so both are forward.
		expect(toFlow(graph).edges[0]?.relations).toEqual([
			{ label: { name: "supports" }, direction: "forward" },
			{ label: { name: "cites" }, direction: "forward" },
		]);
	});

	it("WHEN collapsed edges carry relations THEN each note pair keeps only its OWN labels", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [
				{ ...makeEdge("hub.md", "notes/a.md"), relations: [{ name: "supports" }] },
				{ ...makeEdge("hub.md", "notes/b.md"), relations: [{ name: "cites" }] },
			],
		});
		expect(toFlow(graph).edges[0]?.notePairs).toEqual([
			{ source: "hub.md", target: "notes/a.md", hierarchy: false, relations: [{ name: "supports" }] },
			{ source: "hub.md", target: "notes/b.md", hierarchy: false, relations: [{ name: "cites" }] },
		]);
	});

	it("WHEN a collapsed edge unions OPPOSING named pairs THEN each label keeps its own direction", () => {
		// hub → group fixes the forward orientation; the group → hub pair is backward.
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: [
				{ ...makeEdge("hub.md", "notes/a.md"), relations: [{ name: "supports" }] },
				{ ...makeEdge("notes/b.md", "hub.md"), relations: [{ name: "cites" }] },
			],
		});
		const edge = toFlow(graph).edges[0];
		expect(edge?.bidirectional).toBe(true);
		expect(edge?.relations).toEqual([
			{ label: { name: "supports" }, direction: "forward" },
			{ label: { name: "cites" }, direction: "backward" },
		]);
	});

	it("WHEN an edge's names all share one hue THEN edgeClassName adds that colour hook (ticket nid_adesjb4clls56623vdu773ubg_e)", () => {
		const graph = makeGraph({
			nodes: twoNodes(),
			edges: [{ ...makeEdge("a.md", "b.md"), relations: [{ name: "supports" }, { name: "supports", qualifier: "weakly" }] }],
		});
		expect(edgeClassName(toFlow(graph).edges[0]!)).toBe(
			`vicinity-graph-edge--kind-link vicinity-graph-edge--relation-color-${relationColorSlot("supports")}`,
		);
	});

	it("WHEN an edge mixes relation hues THEN edgeClassName omits the colour hook (line stays neutral)", () => {
		const graph = makeGraph({
			nodes: twoNodes(),
			edges: [{ ...makeEdge("a.md", "b.md"), relations: [{ name: "supports" }, { name: "contradicts" }] }],
		});
		expect(edgeClassName(toFlow(graph).edges[0]!)).toBe("vicinity-graph-edge--kind-link");
	});

	it("WHEN an edge carries no relations THEN edgeClassName has no colour hook", () => {
		const graph = makeGraph({ nodes: twoNodes(), edges: [makeEdge("a.md", "b.md")] });
		expect(edgeClassName(toFlow(graph).edges[0]!)).toBe("vicinity-graph-edge--kind-link");
	});
});
