import { describe, expect, it } from "vitest";
import { asDocId, asFolderPath, asVaultPath } from "../engine";
import { vicinityGraphToFlow, withGroupDimensions, withPositions } from "./flowMapping";
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

	it("WHEN an ungrouped singleton has a folder THEN its width reserves room for the folder breadcrumb", () => {
		function widthOf(title: string, folder: string): number | undefined {
			const singleGraph = makeGraph({
				nodes: [makeNode({ path: asVaultPath(`${folder}/a.md`), title, folder: asFolderPath(folder), sizePx: 40 })],
			});
			return noteNode(toFlow(singleGraph).nodes, `${folder}/a.md`)?.width;
		}
		// A long folder name must widen the node even when the title itself is short.
		expect(widthOf("a", "a-long-folder-name-that-needs-room")).toBeGreaterThan(40);
	});

	it("WHEN mapping a node THEN its data carries the step-05 rich payload", () => {
		expect(toFlow(graph).nodes[0]?.data).toEqual({
			path: "notes/a.md",
			title: "a",
			tier: "main",
			isPinned: false,
			sizePx: 160,
			sizeScore: 0.5,
			folder: "",
			imageCount: 0,
			attachmentGroups: [],
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

	it("WHEN groupByFolder is off THEN no folder-group nodes are emitted", () => {
		const graph = makeGraph({
			nodes: groupedGraph().nodes,
			viewSettings: { ...groupedGraph().viewSettings, groupByFolder: false },
		});
		expect(toFlow(graph).nodes.every((node) => node.kind === "note")).toBe(true);
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

describe("vicinityGraphToFlow breadcrumb titles", () => {
	it("WHEN a node is an ungrouped folder singleton THEN it carries its folder name as breadcrumb", () => {
		expect(noteNode(toFlow(groupedGraph()).nodes, "solo/only.md")?.data.breadcrumbFolder).toBe(
			"solo",
		);
	});

	it("WHEN a node is grouped THEN it has no breadcrumb (the group shows the folder)", () => {
		expect(
			noteNode(toFlow(groupedGraph()).nodes, "notes/a.md")?.data.breadcrumbFolder,
		).toBeUndefined();
	});

	it("WHEN a node lives at the vault root THEN it has no breadcrumb", () => {
		expect(noteNode(toFlow(groupedGraph()).nodes, "root.md")?.data.breadcrumbFolder).toBeUndefined();
	});

	it("WHEN a breadcrumb is emitted for a nested folder THEN only the folder NAME is used", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("projects/alpha/x.md"), folder: asFolderPath("projects/alpha") })],
		});
		expect(noteNode(toFlow(graph).nodes, "projects/alpha/x.md")?.data.breadcrumbFolder).toBe(
			"alpha",
		);
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
			{ id: "notes/a.md->notes/b.md", source: "notes/a.md", target: "notes/b.md", count: 1, hasOpposite: false, bidirectional: false },
		]);
	});

	it("WHEN groupByFolder is off THEN edges are NOT projected onto groups", () => {
		const graph = makeGraph({
			nodes: collapsedGraph().nodes,
			edges: collapsedGraph().edges,
			viewSettings: { ...collapsedGraph().viewSettings, groupByFolder: false },
		});
		const edges = toFlow(graph).edges;
		expect(edges.map((edge) => ({ source: edge.source, target: edge.target }))).toEqual([
			{ source: "hub.md", target: "notes/a.md" },
			{ source: "hub.md", target: "notes/b.md" },
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

describe("vicinityGraphToFlow snapshot extras", () => {
	it("WHEN mapping THEN the resolved groupByFolder setting is forwarded", () => {
		expect(toFlow(groupedGraph()).groupByFolder).toBe(true);
	});

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
				sizePx: 100,
				sizeScore: 0.5,
				folder: "",
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
