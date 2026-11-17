import { describe, expect, it } from "vitest";
import { Tags } from "../shared/Tags";
import { MAX_VISIBLE_TAG_CHIPS, tagChipRowOf } from "./tagChips";
import { tagColorTokenOf } from "./tagColor";

const tagsNamed = (...names: string[]) => Tags.distinct(names);
const ALL = ["a", "b", "c", "d", "e", "f", "g"];

describe("tagChipRowOf", () => {
	it("WHEN a note has no leftover tags THEN no chip shows", () => {
		expect(tagChipRowOf([]).chips).toEqual([]);
	});

	it("WHEN a note has fewer tags than the cap THEN every tag is a chip", () => {
		expect(tagChipRowOf(tagsNamed("visit")).chips.map((chip) => chip.label)).toEqual(["#visit"]);
	});

	it("WHEN a note has fewer tags than the cap THEN there is no overflow", () => {
		expect(tagChipRowOf(tagsNamed("visit")).overflow).toBeNull();
	});

	it("WHEN a chip renders THEN it carries the tag's colour token", () => {
		const [todo] = tagsNamed("todo");
		expect(tagChipRowOf(tagsNamed("todo")).chips[0]?.colorToken).toBe(todo && tagColorTokenOf(todo.key));
	});

	it("WHEN a note has more tags than the cap THEN only the cap's worth show as chips", () => {
		expect(tagChipRowOf(tagsNamed(...ALL)).chips).toHaveLength(MAX_VISIBLE_TAG_CHIPS);
	});

	it("WHEN a note has more tags than the cap THEN the overflow counts the rest", () => {
		expect(tagChipRowOf(tagsNamed(...ALL)).overflow?.count).toBe(ALL.length - MAX_VISIBLE_TAG_CHIPS);
	});

	it("WHEN a note has more tags than the cap THEN the overflow names the hidden tags", () => {
		expect(tagChipRowOf(tagsNamed(...ALL)).overflow?.title).toBe(
			ALL.slice(MAX_VISIBLE_TAG_CHIPS).map((name) => `#${name}`).join(" "),
		);
	});
});
