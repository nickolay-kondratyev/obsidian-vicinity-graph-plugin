import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { Tags } from "../shared/Tags";
import type { Tag } from "../shared/Tags";
import { GraphModeCopy, GraphModes, NOTE_GRAPH_MODE } from "./graphMode";
import { makeGraph, makeNode } from "./testFixtures/graphFixtures";

function tag(raw: string): Tag {
	const parsed = Tags.parse(raw);
	if (parsed === undefined) {
		throw new Error(`fixture bug: [${raw}] is not a tag`);
	}
	return parsed;
}

describe("GraphModes.statusOf", () => {
	it("WHEN note mode has a graph THEN the status names the MAIN note's title", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("hub.md"), isMain: true, title: "Hub" })],
		});

		expect(GraphModes.statusOf(NOTE_GRAPH_MODE, graph)).toEqual({ kind: "note", noteTitle: "Hub" });
	});

	it("WHEN note mode has no graph THEN the status has no title", () => {
		expect(GraphModes.statusOf(NOTE_GRAPH_MODE, null)).toEqual({ kind: "note", noteTitle: null });
	});

	it("WHEN tag mode truncated notes THEN the count includes the hidden ones", () => {
		const graph = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
			hiddenNodeCountsByFolder: new Map([
				[asFolderPath("x"), 3],
				[asFolderPath("y"), 1],
			]),
		});

		expect(GraphModes.statusOf(GraphModes.tag(tag("#t")), graph)).toMatchObject({ noteCount: 6 });
	});

	it("WHEN tag mode has no graph THEN the count is zero", () => {
		expect(GraphModes.statusOf(GraphModes.tag(tag("#t")), null)).toMatchObject({ kind: "tag", noteCount: 0 });
	});
});

describe("GraphModes.same", () => {
	it("WHEN two tag modes differ only by casing THEN they are the same mode", () => {
		expect(GraphModes.same(GraphModes.tag(tag("#Todo")), GraphModes.tag(tag("#todo")))).toBe(true);
	});

	it("WHEN two tag modes name different tags THEN they differ", () => {
		expect(GraphModes.same(GraphModes.tag(tag("#a")), GraphModes.tag(tag("#b")))).toBe(false);
	});

	it("WHEN one mode is note and the other tag THEN they differ", () => {
		expect(GraphModes.same(NOTE_GRAPH_MODE, GraphModes.tag(tag("#a")))).toBe(false);
	});
});

describe("GraphModes saved state", () => {
	it("WHEN a tag mode is saved and read back THEN it is the same tag with its casing", () => {
		const mode = GraphModes.tag(tag("#Project/Alpha"));

		expect(GraphModes.fromSaved(GraphModes.toSaved(mode))).toEqual(mode);
	});

	it("WHEN note mode is saved and read back THEN it is note mode", () => {
		expect(GraphModes.fromSaved(GraphModes.toSaved(NOTE_GRAPH_MODE))).toEqual(NOTE_GRAPH_MODE);
	});

	it("WHEN the saved value is absent THEN no mode is read", () => {
		expect(GraphModes.fromSaved(undefined)).toBeUndefined();
	});

	it("WHEN the saved tag is empty THEN no mode is read", () => {
		expect(GraphModes.fromSaved({ kind: "tag", tag: "#" })).toBeUndefined();
	});

	it("WHEN the saved kind is unknown THEN no mode is read", () => {
		expect(GraphModes.fromSaved({ kind: "folder" })).toBeUndefined();
	});
});

describe("GraphModeCopy.summary", () => {
	it("WHEN in note mode with a title THEN it names the note", () => {
		expect(GraphModeCopy.summary({ kind: "note", noteTitle: "Hub" })).toBe("Vicinity of Hub");
	});

	it("WHEN in note mode without a title THEN it still names the mode", () => {
		expect(GraphModeCopy.summary({ kind: "note", noteTitle: null })).toBe("Vicinity of the active note");
	});

	it("WHEN in tag mode THEN it names the tag and the note count", () => {
		expect(GraphModeCopy.summary({ kind: "tag", tag: tag("#Todo"), noteCount: 12 })).toBe("Tagged #Todo · 12 notes");
	});

	it("WHEN exactly one note is tagged THEN the count is singular", () => {
		expect(GraphModeCopy.summary({ kind: "tag", tag: tag("#todo"), noteCount: 1 })).toBe("Tagged #todo · 1 note");
	});
});
