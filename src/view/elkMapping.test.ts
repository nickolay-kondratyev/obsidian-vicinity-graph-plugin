import type { ElkNode } from "elkjs";
import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { ELK_GROUP_PADDING, ELK_ROOT_ID } from "./constants";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "./elkMapping";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

describe("vicinityGraphToElk", () => {
	const graph = makeGraph({
		nodes: [makeNode({ path: asVaultPath("a.md"), sizePx: 120 }), makeNode({ path: asVaultPath("b.md") })],
		edges: [makeEdge("a.md", "b.md")],
	});

	it("WHEN mapping THEN the root carries the force algorithm", () => {
		expect(vicinityGraphToElk(graph).layoutOptions?.["elk.algorithm"]).toBe("force");
	});

	it("WHEN mapping THEN the root does NOT request INCLUDE_CHILDREN (force uses SEPARATE_CHILDREN)", () => {
		expect(vicinityGraphToElk(graph).layoutOptions?.["elk.hierarchyHandling"]).toBeUndefined();
	});

	/**
	 * VALUE LOCK on the root force seed's separation, deliberately written as a
	 * LITERAL rather than as `String(ELK_ROOT_SEED_NODE_SPACING_PX)`: importing the
	 * constant would make this test move with the code it is supposed to pin, and
	 * the sibling test below — which only compares the default and customized
	 * mappings to each other — would pass vacuously if the option stopped being
	 * emitted at all. 40 sits ~4x above the measured stranding cliff at 10,
	 * in a band where the final layout is insensitive to the seed (`constants.ts`
	 * `ELK_ROOT_SEED_NODE_SPACING_PX` carries the sweep); if this test fails, the root arrangement changed and `d3ForceStranding.test.ts`
	 * boundary gaps must be re-measured before the new value is accepted.
	 */
	it("WHEN mapping THEN the root seed asks elk for 40px between root-level boxes", () => {
		expect(vicinityGraphToElk(graph).layoutOptions?.["elk.spacing.nodeNode"]).toBe("40");
	});

	/**
	 * BEHAVIOUR CHANGE, stated plainly: this knob used to reach the root seed too
	 * (it asserted "80" here). It no longer does — the root force pass keeps its own
	 * internal seed separation, so tightening group interiors cannot disturb the
	 * root arrangement (`constants.ts` `ELK_ROOT_SEED_NODE_SPACING_PX`, and the
	 * boundary-gap budget in `d3ForceStranding.test.ts` that measured the coupling).
	 * The knob is named "Group member spacing" and now means exactly that.
	 */
	it("WHEN the group-member-spacing setting is customized THEN the ROOT seed spacing is unaffected", () => {
		const custom = makeGraph({
			...graph,
			viewSettings: {
				...graph.viewSettings,
				forceLayout: { ...graph.viewSettings.forceLayout, elkNodeSpacingPx: 80 },
			},
		});
		expect(vicinityGraphToElk(custom).layoutOptions?.["elk.spacing.nodeNode"]).toBe(
			vicinityGraphToElk(graph).layoutOptions?.["elk.spacing.nodeNode"],
		);
	});

	it("WHEN mapping THEN each node becomes a root child sized by its sizePx", () => {
		const child = vicinityGraphToElk(graph).children?.find((candidate) => candidate.id === "a.md");
		expect({ width: child?.width, height: child?.height }).toEqual({ width: 120, height: 120 });
	});

	it("WHEN mapping THEN each edge becomes an elk edge with synthesized id and endpoints", () => {
		expect(vicinityGraphToElk(graph).edges?.[0]).toEqual({
			id: "a.md->b.md",
			sources: ["a.md"],
			targets: ["b.md"],
		});
	});
});

describe("extractElkPositions", () => {
	it("WHEN reading a laid-out flat graph THEN it returns each child's absolute position", () => {
		const laidOut: ElkNode = {
			id: ELK_ROOT_ID,
			children: [
				{ id: "a.md", x: 10, y: 20 },
				{ id: "b.md", x: 30, y: 40 },
			],
		};
		expect(extractElkPositions(laidOut).get("b.md")).toEqual({ x: 30, y: 40 });
	});

	it("WHEN a child is nested THEN its position accumulates the parent offset (compound-ready)", () => {
		const laidOut: ElkNode = {
			id: ELK_ROOT_ID,
			children: [{ id: "folder", x: 100, y: 200, children: [{ id: "a.md", x: 5, y: 6 }] }],
		};
		expect(extractElkPositions(laidOut).get("a.md")).toEqual({ x: 105, y: 206 });
	});
});

describe("vicinityGraphToElk folder-group compounds (step-05)", () => {
	// GIVEN two grouped notes/, one solo singleton, one root file, and edges:
	// intra-group a->b, cross-boundary a->solo, root->a.
	const graph = makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes") }),
			makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes") }),
			makeNode({ path: asVaultPath("solo/only.md"), folder: asFolderPath("solo") }),
			makeNode({ path: asVaultPath("root.md"), folder: asFolderPath("") }),
		],
		edges: [
			makeEdge("notes/a.md", "notes/b.md"),
			makeEdge("notes/a.md", "solo/only.md"),
			makeEdge("root.md", "notes/a.md"),
		],
	});

	function container(): ElkNode | undefined {
		return vicinityGraphToElk(graph).children?.find((child) => child.id === "folder-group:notes");
	}

	it("WHEN a folder groups THEN its members nest under a folder container child", () => {
		expect(container()?.children?.map((child) => child.id)).toEqual(["notes/a.md", "notes/b.md"]);
	});

	it("WHEN a folder groups THEN its members are not root children anymore", () => {
		const rootIds = vicinityGraphToElk(graph).children?.map((child) => child.id);
		expect(rootIds).toEqual(["folder-group:notes", "solo/only.md", "root.md"]);
	});

	it("WHEN a folder groups THEN its container reserves label padding (step-05 group label)", () => {
		expect(container()?.layoutOptions?.["elk.padding"]).toBe(ELK_GROUP_PADDING);
	});

	it("WHEN the group padding is assembled from its numeric parts THEN the elk syntax string is unchanged", () => {
		// The assertion above compares against the constant itself, so it cannot see a
		// change in the STRING. `GROUP_SIDE_PADDING_PX` was extracted out of this literal
		// (it bounds the edge-routing clearance, edge-routing__06) and the string is now
		// BUILT from it — this locks the elk syntax so that extraction cannot silently
		// alter every folder group's layout.
		expect(ELK_GROUP_PADDING).toBe("[top=36.0,left=16.0,bottom=16.0,right=16.0]");
	});

	it("WHEN the group-member-spacing setting is customized THEN the container spacing option carries it (ticket-04 threading)", () => {
		const custom = makeGraph({
			...graph,
			viewSettings: {
				...graph.viewSettings,
				forceLayout: { ...graph.viewSettings.forceLayout, elkNodeSpacingPx: 80 },
			},
		});
		const customContainer = vicinityGraphToElk(custom).children?.find((child) => child.id === "folder-group:notes");
		expect(customContainer?.layoutOptions?.["elk.spacing.nodeNode"]).toBe("80");
	});

	it("WHEN an edge is intra-group THEN it relocates onto the container (elk common-ancestor rule)", () => {
		expect(container()?.edges?.map((edge) => edge.id)).toEqual(["notes/a.md->notes/b.md"]);
	});

	it("WHEN an edge crosses the group boundary THEN it is projected onto the container and stays on the root", () => {
		const rootEdgeIds = vicinityGraphToElk(graph).edges?.map((edge) => edge.id);
		expect(rootEdgeIds).toEqual(["folder-group:notes->solo/only.md", "root.md->folder-group:notes"]);
	});

});

describe("vicinityGraphToElk cross-boundary projection (force SEPARATE_CHILDREN root)", () => {
	// GIVEN a MAIN root (minDepth 0), a grouped notes/ pair (depths 1 and 2), a
	// solo singleton (depth 1); edges: intra-group a->b, root->a, root->b (both
	// project onto the SAME container), and an INCOMING link solo->root.
	const graph = makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("root.md"), folder: asFolderPath(""), isCentral: true, isMain: true, minDepth: 0 }),
			makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes"), minDepth: 1 }),
			makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes"), minDepth: 2 }),
			makeNode({ path: asVaultPath("solo/only.md"), folder: asFolderPath("solo"), minDepth: 1 }),
		],
		edges: [
			makeEdge("notes/a.md", "notes/b.md"),
			makeEdge("root.md", "notes/a.md"),
			makeEdge("root.md", "notes/b.md"),
			makeEdge("solo/only.md", "root.md"),
		],
	});

	it("WHEN mapping THEN the root runs the force algorithm", () => {
		expect(vicinityGraphToElk(graph).layoutOptions?.["elk.algorithm"]).toBe("force");
	});

	it("WHEN mapping THEN the root does NOT request INCLUDE_CHILDREN (force cannot descend)", () => {
		expect(vicinityGraphToElk(graph).layoutOptions?.["elk.hierarchyHandling"]).toBeUndefined();
	});

	it("WHEN mapping THEN containers pack their members internally", () => {
		const container = vicinityGraphToElk(graph).children?.find((child) => child.id === "folder-group:notes");
		expect(container?.layoutOptions).toMatchObject({
			"elk.algorithm": "rectpacking",
			"elk.padding": ELK_GROUP_PADDING,
		});
	});

	it("WHEN edges cross a group boundary THEN they are projected onto the container and deduped", () => {
		// root->a and root->b collapse into ONE root->container edge.
		const rootEdgeIds = vicinityGraphToElk(graph).edges?.map((edge) => edge.id);
		expect(rootEdgeIds).toEqual(["root.md->folder-group:notes", "root.md->solo/only.md"]);
	});

	it("WHEN a link points INTO the centre THEN the layout edge is flipped centre-outward", () => {
		const flipped = vicinityGraphToElk(graph).edges?.find((edge) => edge.id === "root.md->solo/only.md");
		expect(flipped).toEqual({ id: "root.md->solo/only.md", sources: ["root.md"], targets: ["solo/only.md"] });
	});

	// elk's JSON contract: an edge must sit on the closest common ancestor of its
	// endpoints. rectpacking ignores them for placement, but a misplaced edge is
	// still a contract violation.
	it("WHEN mapping THEN intra-group edges still live on their container", () => {
		const container = vicinityGraphToElk(graph).children?.find((child) => child.id === "folder-group:notes");
		expect(container?.edges?.map((edge) => edge.id)).toEqual(["notes/a.md->notes/b.md"]);
	});
});

describe("extractElkDimensionsById", () => {
	it("WHEN a laid-out container reports a size THEN it is extracted by id", () => {
		const laidOut: ElkNode = {
			id: ELK_ROOT_ID,
			children: [{ id: "folder-group:notes", x: 0, y: 0, width: 300, height: 220, children: [] }],
		};
		expect(extractElkDimensionsById(laidOut).get("folder-group:notes")).toEqual({ width: 300, height: 220 });
	});

	it("WHEN a nested child reports a size THEN it is extracted too (leaves echo their input)", () => {
		const laidOut: ElkNode = {
			id: ELK_ROOT_ID,
			children: [{ id: "g", width: 300, height: 220, children: [{ id: "a.md", width: 100, height: 100 }] }],
		};
		expect(extractElkDimensionsById(laidOut).get("a.md")).toEqual({ width: 100, height: 100 });
	});
});
