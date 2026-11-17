import { describe, expect, it } from "vitest";
import { tagNoteCountsOf } from "./tagNoteCounts";

/** `#name=count`, in picker order — what the assertions compare. */
function summary(notesRawTags: readonly (readonly string[])[]): string[] {
	return tagNoteCountsOf(notesRawTags).map((entry) => `${entry.tag.name}=${entry.noteCount}`);
}

describe("tagNoteCountsOf (the tag picker's list)", () => {
	it("WHEN a tag repeats inside one note THEN that note counts once", () => {
		expect(summary([["#todo", "#todo"]])).toEqual(["todo=1"]);
	});

	it("WHEN a note carries a nested tag THEN its parent counts the note too (what the filter shows)", () => {
		expect(summary([["#project/alpha"], ["#project"]])).toEqual(["project=2", "project/alpha=1"]);
	});

	it("WHEN tags differ only in casing THEN they are one tag named by its first casing", () => {
		expect(summary([["#ToDo"], ["#todo"]])).toEqual(["ToDo=2"]);
	});

	it("WHEN tags are listed THEN the most-used come first, ties by name", () => {
		expect(summary([["#b", "#a"], ["#c"], ["#c"]])).toEqual(["c=2", "a=1", "b=1"]);
	});

	it("WHEN no note carries a tag THEN the list is empty", () => {
		expect(summary([[], []])).toEqual([]);
	});
});
