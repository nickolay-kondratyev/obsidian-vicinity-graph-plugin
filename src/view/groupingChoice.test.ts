import { describe, expect, it } from "vitest";
import type { GraphNode, ViewSettings, VicinityGraph } from "../engine";
import { asFolderPath, asVaultPath } from "../engine";
import { Tags } from "../shared/Tags";
import { deriveGrouping, groupingRequestOf } from "./groupingChoice";
import { makeGraph, makeNode } from "./testFixtures/graphFixtures";

/** GIVEN two notes that share BOTH a folder and a tag, and a third tagged alone. */
function note(path: string, folder: string, ...tags: string[]): GraphNode {
	return makeNode({ path: asVaultPath(path), folder: asFolderPath(folder), tags: Tags.distinct(tags) });
}
const NODES = [note("work/a.md", "work", "todo"), note("work/b.md", "work", "todo"), note("c.md", "", "visit")];

function graphIn(groupingMode: ViewSettings["groupingMode"]): VicinityGraph {
	const graph = makeGraph({ nodes: NODES });
	return { ...graph, viewSettings: { ...graph.viewSettings, groupingMode } };
}

function groupingIn(groupingMode: ViewSettings["groupingMode"]): ReturnType<typeof deriveGrouping> {
	const graph = graphIn(groupingMode);
	return deriveGrouping(graph.nodes, groupingRequestOf(graph));
}

describe("deriveGrouping (the ONE grouper choice point)", () => {
	it("WHEN the mode is folders THEN the boxes are folder boxes", () => {
		expect(groupingIn("folders").groups.map((group) => group.subject.kind)).toEqual(["folder"]);
	});

	it("WHEN the mode is tags THEN the boxes are tag boxes", () => {
		expect(groupingIn("tags").groups.map((group) => group.label)).toEqual(["#todo"]);
	});

	it("WHEN the mode is tags THEN a note's unshared tag is a leftover chip", () => {
		expect(groupingIn("tags").leftoverTagsOf("c.md").map((tag) => tag.name)).toEqual(["visit"]);
	});

	it("WHEN the mode is folders THEN no note has leftover chips", () => {
		expect(groupingIn("folders").leftoverTagsOf("c.md")).toEqual([]);
	});

	it("WHEN the grouping depth is 0 in tags mode THEN no box renders", () => {
		const graph = graphIn("tags");
		const off = { ...graph, viewSettings: { ...graph.viewSettings, folderGroupingDepth: 0 } };
		expect(deriveGrouping(off.nodes, groupingRequestOf(off)).groups).toEqual([]);
	});
});

describe("groupingRequestOf a TAG-FILTERED graph (decision 10)", () => {
	/** GIVEN every note carries the filter tag `#project/alpha` (so also `#project`); two share `#todo`. */
	const FILTERED_NODES = [
		note("a.md", "", "project/alpha", "todo"),
		note("b.md", "", "project/alpha", "todo"),
		note("c.md", "", "project/alpha", "project/alpha/deep"),
		note("d.md", "", "project/alpha", "project/alpha/deep"),
	];
	const filterTag = Tags.parse("#Project/Alpha");
	function filteredGrouping(folderGroupingDepth?: number): ReturnType<typeof deriveGrouping> {
		const graph = makeGraph({ nodes: FILTERED_NODES });
		const filtered: VicinityGraph = {
			...graph,
			viewSettings: {
				...graph.viewSettings,
				groupingMode: "tags",
				folderGroupingDepth: folderGroupingDepth ?? graph.viewSettings.folderGroupingDepth,
			},
			...(filterTag === undefined ? {} : { tagFilter: filterTag.key }),
		};
		return deriveGrouping(filtered.nodes, groupingRequestOf(filtered));
	}

	it("WHEN grouped by tags THEN neither the filter tag nor its parent tag is a box", () => {
		const labels = filteredGrouping().groups.map((group) => group.label);

		expect(labels.filter((label) => label === "#project/alpha" || label === "#project")).toEqual([]);
	});

	it("WHEN grouped by tags THEN a tag nested BELOW the filter tag still makes a box", () => {
		expect(filteredGrouping().groups.map((group) => group.label)).toContain("#project/alpha/deep");
	});

	it("WHEN boxes are off THEN the filter tag is still never a chip", () => {
		const NO_BOXES = 0;

		expect(filteredGrouping(NO_BOXES).leftoverTagsOf("a.md").map((tag) => tag.name)).toEqual(["todo"]);
	});
});
