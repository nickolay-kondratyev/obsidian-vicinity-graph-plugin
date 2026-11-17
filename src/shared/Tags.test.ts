import { describe, expect, it } from "vitest";
import type { Tag } from "./Tags";
import { Tags } from "./Tags";

/**
 * The tag rules, tested from raw strings alone (tags-v1, ticket
 * `nid_mr42m1k8cmyeusemmvmxuuaxb_e`): identity is case-insensitive with the `#`
 * stripped, display casing is kept, and nesting follows Obsidian's own tag search.
 */

function tag(raw: string): Tag {
	const parsed = Tags.parse(raw);
	if (parsed === undefined) {
		throw new Error(`test fixture bug: [${raw}] is not a tag`);
	}
	return parsed;
}

describe("Tags.parse", () => {
	it("WHEN the raw tag has a leading # THEN the key drops it", () => {
		expect(tag("#project").key).toBe("project");
	});

	it("WHEN the raw tag has no leading # (frontmatter style) THEN the key is the same", () => {
		expect(tag("project").key).toBe(tag("#project").key);
	});

	it("WHEN two raw tags differ only by case THEN their keys are equal", () => {
		expect(tag("#Project/Alpha").key).toBe(tag("#project/alpha").key);
	});

	it("WHEN the raw tag is mixed case THEN its display name keeps that casing", () => {
		expect(tag("#Project/Alpha").name).toBe("Project/Alpha");
	});

	it("WHEN the raw tag is padded with whitespace THEN the padding is dropped", () => {
		expect(tag("  #todo ").name).toBe("todo");
	});

	it("WHEN the raw tag is only a # THEN it is not a tag", () => {
		expect(Tags.parse("#")).toBeUndefined();
	});

	it("WHEN the raw tag is blank THEN it is not a tag", () => {
		expect(Tags.parse("   ")).toBeUndefined();
	});
});

describe("Tags.distinct", () => {
	it("WHEN the same tag appears in different casings THEN it is kept once, first casing winning", () => {
		expect(Tags.distinct(["#Todo", "todo", "#TODO"])).toEqual([tag("#Todo")]);
	});

	it("WHEN tags are distinct THEN their first-seen order is kept", () => {
		expect(Tags.distinct(["#b", "#a", "#c"]).map((each) => each.key)).toEqual(["b", "a", "c"]);
	});

	it("WHEN a raw entry is not a tag THEN it is dropped", () => {
		expect(Tags.distinct(["#", "#a"]).map((each) => each.key)).toEqual(["a"]);
	});

	it("WHEN a nested tag is listed THEN its parent is NOT added (expansion is a separate rule)", () => {
		expect(Tags.distinct(["#project/alpha"]).map((each) => each.key)).toEqual(["project/alpha"]);
	});
});

describe("Tags.withAncestors", () => {
	it("WHEN a tag is nested THEN every ancestor is added, outermost first, before the tag", () => {
		expect(Tags.withAncestors([tag("#a/b/c")]).map((each) => each.key)).toEqual(["a", "a/b", "a/b/c"]);
	});

	it("WHEN an ancestor is added THEN its display name is the prefix of the nested tag's name", () => {
		expect(Tags.withAncestors([tag("#Project/Alpha")])[0]?.name).toBe("Project");
	});

	it("WHEN a tag is not nested THEN it is returned alone", () => {
		expect(Tags.withAncestors([tag("#todo")])).toEqual([tag("#todo")]);
	});

	it("WHEN two tags share an ancestor THEN the ancestor appears once", () => {
		expect(Tags.withAncestors([tag("#p/a"), tag("#p/b")]).map((each) => each.key)).toEqual(["p", "p/a", "p/b"]);
	});

	it("WHEN the note also carries the parent tag itself THEN it appears once with the note's own casing", () => {
		expect(Tags.withAncestors([tag("#PROJECT"), tag("#project/alpha")]).map((each) => each.name)).toEqual([
			"PROJECT",
			"project/alpha",
		]);
	});
});

describe("Tags.isSameOrNestedUnder (Obsidian tag-search semantics)", () => {
	it("WHEN the tags are equal THEN it matches", () => {
		expect(Tags.isSameOrNestedUnder(tag("#project").key, tag("#project").key)).toBe(true);
	});

	it("WHEN the tag differs only by case THEN it matches", () => {
		expect(Tags.isSameOrNestedUnder(tag("#Project").key, tag("#project").key)).toBe(true);
	});

	it("WHEN the tag is nested under the other THEN it matches", () => {
		expect(Tags.isSameOrNestedUnder(tag("#project/alpha/x").key, tag("#project").key)).toBe(true);
	});

	it("WHEN the tag is the PARENT of the other THEN it does not match", () => {
		expect(Tags.isSameOrNestedUnder(tag("#project").key, tag("#project/alpha").key)).toBe(false);
	});

	it("WHEN the tag only shares a name prefix (no `/` boundary) THEN it does not match", () => {
		expect(Tags.isSameOrNestedUnder(tag("#projects").key, tag("#project").key)).toBe(false);
	});
});
