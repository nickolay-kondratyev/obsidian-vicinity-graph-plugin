import { describe, expect, it } from "vitest";
import type { GraphNode } from "../engine";
import { asFolderPath, asVaultPath } from "../engine";
import type { TagKey } from "../shared/Tags";
import { Tags } from "../shared/Tags";
import { UNLIMITED_GROUP_NESTING_DEPTH } from "./folderGrouping";
import type { NodeGroup } from "./grouping";
import { tagColorTokenOf } from "./tagColor";
import type { TagGroupingResult } from "./tagGrouping";
import { deriveTagGroups } from "./tagGrouping";
import { makeNode } from "./testFixtures/graphFixtures";

const NO_EXCLUDED_TAGS: ReadonlySet<TagKey> = new Set();

/** A note `<name>.md` at the vault root carrying the raw `tags`. */
function note(name: string, ...tags: string[]): GraphNode {
	return makeNode({ path: asVaultPath(`${name}.md`), folder: asFolderPath(""), tags: Tags.distinct(tags) });
}

function keyOf(raw: string): TagKey {
	const tag = Tags.parse(raw);
	if (tag === undefined) {
		throw new Error(`fixture tag must parse: raw=[${raw}]`);
	}
	return tag.key;
}

function group(nodes: readonly GraphNode[], depthCap = UNLIMITED_GROUP_NESTING_DEPTH, excluded = NO_EXCLUDED_TAGS): TagGroupingResult {
	return deriveTagGroups(nodes, depthCap, excluded);
}

function topLevelLabels(result: TagGroupingResult): string[] {
	return result.groups.filter((box) => box.parentId === null).map((box) => box.label);
}

/** The ONE box labelled `label` under the box labelled `parentLabel` (null = top level). */
function boxAt(result: TagGroupingResult, parentLabel: string | null, label: string): NodeGroup | undefined {
	const parentId = parentLabel === null ? null : boxAt(result, null, parentLabel)?.id;
	return result.groups.find((box) => box.parentId === parentId && box.label === label);
}

function leftoverNamesOf(result: TagGroupingResult, notePath: string): string[] {
	return result.leftoverTagsOf(notePath).map((tag) => tag.name);
}

/** GIVEN the owner's example (tags-v1 decision 1). */
const OWNER_EXAMPLE = [
	note("note1", "follow-up", "important"),
	note("note2", "follow-up", "important", "vital"),
	note("note3", "follow-up", "important", "vital"),
	note("note4", "vital"),
	note("note5", "vital"),
	note("note6", "visit"),
];
const SHARED_BOX = "#follow-up #important";

describe("deriveTagGroups on the owner's example", () => {
	it("WHEN grouped THEN the top level is the shared-tags box then a vital box", () => {
		expect(topLevelLabels(group(OWNER_EXAMPLE))).toEqual([SHARED_BOX, "#vital"]);
	});

	it("WHEN grouped THEN the shared-tags box directly holds note1 only", () => {
		expect(boxAt(group(OWNER_EXAMPLE), null, SHARED_BOX)?.memberPaths).toEqual(["note1.md"]);
	});

	it("WHEN grouped THEN a vital box nested in the shared-tags box holds note2 and note3", () => {
		expect(boxAt(group(OWNER_EXAMPLE), SHARED_BOX, "#vital")?.memberPaths).toEqual(["note2.md", "note3.md"]);
	});

	it("WHEN grouped THEN the top-level vital box holds note4 and note5", () => {
		expect(boxAt(group(OWNER_EXAMPLE), null, "#vital")?.memberPaths).toEqual(["note4.md", "note5.md"]);
	});

	it("WHEN grouped THEN note6 renders in no box", () => {
		expect(group(OWNER_EXAMPLE).groupIdByMemberPath.has("note6.md")).toBe(false);
	});

	it("WHEN grouped THEN note6's leftover tag is visit", () => {
		expect(leftoverNamesOf(group(OWNER_EXAMPLE), "note6.md")).toEqual(["visit"]);
	});

	it("WHEN grouped THEN a note whose every tag names an enclosing box has no leftover", () => {
		expect(leftoverNamesOf(group(OWNER_EXAMPLE), "note2.md")).toEqual([]);
	});

	it("WHEN grouped THEN every note renders in at most one box", () => {
		const memberships = group(OWNER_EXAMPLE).groups.flatMap((box) => box.memberPaths);
		expect(memberships.length).toBe(new Set(memberships).size);
	});

	it("WHEN grouped THEN the nested and top-level vital boxes have distinct ids", () => {
		const result = group(OWNER_EXAMPLE);
		expect(boxAt(result, SHARED_BOX, "#vital")?.id).not.toBe(boxAt(result, null, "#vital")?.id);
	});

	it("WHEN grouped THEN the nested box's full label spells every tag of its chain", () => {
		expect(boxAt(group(OWNER_EXAMPLE), SHARED_BOX, "#vital")?.fullLabel).toBe("#follow-up #important #vital");
	});

	it("WHEN grouped THEN the multi-tag box's subject names both tags", () => {
		const subject = boxAt(group(OWNER_EXAMPLE), null, SHARED_BOX)?.subject;
		expect(subject?.kind === "tag" ? subject.tags.map((tag) => tag.key) : []).toEqual(["follow-up", "important"]);
	});

	it("WHEN grouped twice THEN both results are equal (deterministic)", () => {
		expect(group(OWNER_EXAMPLE).groups).toEqual(group(OWNER_EXAMPLE).groups);
	});

	it("WHEN grouped THEN every box follows its parent in ancestor-first order", () => {
		const order = group(OWNER_EXAMPLE).groupsAncestorFirst;
		const seen = new Set<string | null>([null]);
		const parentsSeenFirst = order.every((box) => {
			const ok = seen.has(box.parentId);
			seen.add(box.id);
			return ok;
		});
		expect(parentsSeenFirst).toBe(true);
	});

	it("WHEN grouped THEN no box is credited with hidden notes of any folder", () => {
		expect(group(OWNER_EXAMPLE).groupCreditedForHiddenFolder(asFolderPath("anything"))).toBeNull();
	});
});

describe("deriveTagGroups scoring", () => {
	it("WHEN a big shared set covers fewer notes THEN its higher score still wins first (greedy ceiling)", () => {
		const nodes = [note("a", "x", "y", "z"), note("b", "x", "y", "z"), note("c", "x"), note("d", "x")];
		expect(topLevelLabels(group(nodes))).toEqual(["#x #y #z", "#x"]);
	});

	it("WHEN two candidates tie on score THEN the one with more members wins", () => {
		const nodes = [note("a", "p", "q"), note("b", "p", "q"), note("c", "p", "r"), note("d", "p", "r")];
		expect(topLevelLabels(group(nodes))).toEqual(["#p"]);
	});

	it("WHEN overlapping candidates tie on score and members THEN the first tag name wins the shared note", () => {
		const nodes = [note("a", "q"), note("b", "q", "r"), note("c", "r")];
		expect(boxAt(group(nodes), null, "#q")?.memberPaths).toEqual(["a.md", "b.md"]);
	});

	it("WHEN a tag is carried by a single note THEN it never forms a box (2-member floor)", () => {
		expect(group([note("a", "solo"), note("b")]).groups).toEqual([]);
	});
});

describe("deriveTagGroups edge cases", () => {
	it("WHEN no note has tags THEN there are no boxes", () => {
		expect(group([note("a"), note("b")]).groups).toEqual([]);
	});

	it("WHEN every note shares one tag THEN one top-level box holds them all", () => {
		const result = group([note("a", "shared"), note("b", "shared"), note("c", "shared")]);
		expect(result.groups.map((box) => box.memberPaths)).toEqual([["a.md", "b.md", "c.md"]]);
	});

	it("WHEN notes carry nested tags under one parent THEN the parent tag is the top-level box", () => {
		const nodes = [note("a", "project/alpha"), note("b", "project/alpha"), note("c", "project/beta"), note("d", "project/beta")];
		expect(topLevelLabels(group(nodes))).toEqual(["#project"]);
	});

	it("WHEN notes carry nested tags under one parent THEN each child tag boxes inside the parent box", () => {
		const nodes = [note("a", "project/alpha"), note("b", "project/alpha"), note("c", "project/beta"), note("d", "project/beta")];
		const result = group(nodes);
		const nested = result.groups.filter((box) => box.parentId === boxAt(result, null, "#project")?.id).map((box) => box.label);
		expect(nested).toEqual(["#project/alpha", "#project/beta"]);
	});

	it("WHEN a box's set holds a parent tag and its nested child THEN the label drops the implied parent", () => {
		expect(topLevelLabels(group([note("a", "project/alpha"), note("b", "project/alpha")]))).toEqual(["#project/alpha"]);
	});

	it("WHEN a nested tag's parent box encloses the note THEN the nested tag is still a leftover", () => {
		const nodes = [note("a", "project/alpha"), note("b", "project/beta")];
		expect(leftoverNamesOf(group(nodes), "a.md")).toEqual(["project/alpha"]);
	});

	it("WHEN a tag is written in different casings THEN the box label uses the first member's casing", () => {
		expect(topLevelLabels(group([note("a", "Vital"), note("b", "vital")]))).toEqual(["#Vital"]);
	});

	it("WHEN a box has a preset tag THEN its colour is that tag's colour", () => {
		expect(boxAt(group(OWNER_EXAMPLE), null, "#vital")?.colorToken).toBe(tagColorTokenOf(keyOf("vital")));
	});

	it("WHEN a multi-tag box is coloured THEN its first preset label tag decides", () => {
		expect(boxAt(group(OWNER_EXAMPLE), null, SHARED_BOX)?.colorToken).toBe(tagColorTokenOf(keyOf("follow-up")));
	});
});

describe("deriveTagGroups excluded tags", () => {
	const excludeVital: ReadonlySet<TagKey> = new Set([keyOf("vital")]);

	it("WHEN a tag is excluded THEN no box is keyed on it", () => {
		expect(topLevelLabels(group(OWNER_EXAMPLE, UNLIMITED_GROUP_NESTING_DEPTH, excludeVital))).toEqual([SHARED_BOX]);
	});

	it("WHEN a tag is excluded THEN it is not a leftover either", () => {
		expect(leftoverNamesOf(group(OWNER_EXAMPLE, UNLIMITED_GROUP_NESTING_DEPTH, excludeVital), "note4.md")).toEqual([]);
	});

	it("WHEN a parent tag is excluded THEN its nested child tags still box", () => {
		const nodes = [note("a", "project/alpha"), note("b", "project/alpha"), note("c", "project/beta"), note("d", "project/beta")];
		const result = group(nodes, UNLIMITED_GROUP_NESTING_DEPTH, new Set([keyOf("project")]));
		expect(topLevelLabels(result)).toEqual(["#project/alpha", "#project/beta"]);
	});
});

describe("deriveTagGroups depth cap", () => {
	it("WHEN the depth cap is 0 THEN there are no boxes", () => {
		expect(group(OWNER_EXAMPLE, 0).groups).toEqual([]);
	});

	it("WHEN the depth cap is 0 THEN every tag of a note is a leftover", () => {
		expect(leftoverNamesOf(group(OWNER_EXAMPLE, 0), "note2.md")).toEqual(["follow-up", "important", "vital"]);
	});

	it("WHEN the depth cap is 1 THEN the would-be nested box's notes stay in their top-level box", () => {
		expect(boxAt(group(OWNER_EXAMPLE, 1), null, SHARED_BOX)?.memberPaths).toEqual(["note1.md", "note2.md", "note3.md"]);
	});

	it("WHEN the depth cap is 1 THEN no box nests", () => {
		expect(group(OWNER_EXAMPLE, 1).groups.every((box) => box.parentId === null)).toBe(true);
	});

	it("WHEN the depth cap is 1 THEN the would-be nested box's tag becomes a leftover", () => {
		expect(leftoverNamesOf(group(OWNER_EXAMPLE, 1), "note2.md")).toEqual(["vital"]);
	});
});
