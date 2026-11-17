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
