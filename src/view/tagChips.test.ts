import { describe, expect, it } from "vitest";
import { Tags } from "../shared/Tags";
import {
	MAX_VISIBLE_TAG_CHIPS,
	TAG_CHIP_ELLIPSIS_CHARS,
	TAG_CHIP_MIN_PREFIX_CHARS,
	TAG_CHIP_ROW_MIN_WIDTH_PX,
	tagChipRowOf,
	tagChipRowWidthPx,
} from "./tagChips";
import type { TagChipRow } from "./tagChips";
import { tagColorTokenOf } from "./tagColor";

const tagsNamed = (...names: string[]) => Tags.distinct(names);
const ALL = ["a", "b", "c", "d", "e", "f", "g"];
/** Wide enough that only the count cap ever folds a chip. */
const WIDE_NODE_PX = 2000;
/** A node too narrow for the row: the row falls back to its own minimum width. */
const NARROW_NODE_PX = 60;
/** Long tags, the owner screenshot's shape: three of them cannot all fit a narrow note's row. */
const LONG = ["reference", "meeting-notes", "project-alpha", "later"];

const wide = (...names: string[]): TagChipRow => tagChipRowOf(tagsNamed(...names), WIDE_NODE_PX);
const narrow = (...names: string[]): TagChipRow => tagChipRowOf(tagsNamed(...names), NARROW_NODE_PX);

describe("tagChipRowOf", () => {
	it("WHEN a note has no leftover tags THEN no chip shows", () => {
		expect(tagChipRowOf([], WIDE_NODE_PX).chips).toEqual([]);
	});

	it("WHEN a note has fewer tags than the cap THEN every tag is a chip", () => {
		expect(wide("visit").chips.map((chip) => chip.label)).toEqual(["#visit"]);
	});

	it("WHEN a note has fewer tags than the cap THEN there is no overflow", () => {
		expect(wide("visit").overflow).toBeNull();
	});

	it("WHEN a chip renders THEN it carries the tag's colour token", () => {
		const [todo] = tagsNamed("todo");
		expect(wide("todo").chips[0]?.colorToken).toBe(todo && tagColorTokenOf(todo.key));
	});

	it("WHEN a note has more tags than the cap THEN only the cap's worth show as chips", () => {
		expect(wide(...ALL).chips).toHaveLength(MAX_VISIBLE_TAG_CHIPS);
	});

	it("WHEN a note has more tags than the cap THEN the overflow counts the rest", () => {
		expect(wide(...ALL).overflow?.count).toBe(ALL.length - MAX_VISIBLE_TAG_CHIPS);
	});

	it("WHEN a note has more tags than the cap THEN the overflow names the hidden tags", () => {
		expect(wide(...ALL).overflow?.title).toBe(
			ALL.slice(MAX_VISIBLE_TAG_CHIPS).map((name) => `#${name}`).join(" "),
		);
	});
});

describe("tagChipRowOf on a narrow note (chips fold rather than shrink to a bare #…)", () => {
	it("WHEN long tags cannot all fit at their readable minimum THEN fewer chips show than the cap", () => {
		expect(narrow(...LONG).chips.length).toBeLessThan(MAX_VISIBLE_TAG_CHIPS);
	});

	it("WHEN long tags fold THEN the +N chip counts every tag not shown", () => {
		const row = narrow(...LONG);
		expect(row.overflow?.count).toBe(LONG.length - row.chips.length);
	});

	it("WHEN long tags fold THEN the +N chip names every tag not shown", () => {
		const row = narrow(...LONG);
		expect(row.overflow?.title).toBe(
			LONG.slice(row.chips.length).map((name) => `#${name}`).join(" "),
		);
	});

	it("WHEN long tags fold THEN at least one chip still shows (the row is never just +N while one fits)", () => {
		expect(narrow(...LONG).chips.length).toBeGreaterThan(0);
	});

	it("WHEN a long tag shows THEN it may shrink no further than the readable prefix (# plus the minimum characters)", () => {
		expect(narrow(...LONG).chips[0]?.minPrefixChars).toBe(TAG_CHIP_MIN_PREFIX_CHARS);
	});

	it("WHEN a tag is no longer than the readable prefix THEN its chip never shrinks", () => {
		expect(narrow("ux").chips[0]?.minPrefixChars).toBeNull();
	});

	it("WHEN a tag is no longer than the readable prefix plus the ellipsis THEN its chip never shrinks (shrinking would not narrow it)", () => {
		const justPastPrefix = "d".repeat(TAG_CHIP_MIN_PREFIX_CHARS - 1 + TAG_CHIP_ELLIPSIS_CHARS);
		expect(narrow(justPastPrefix).chips[0]?.minPrefixChars).toBeNull();
	});

	it("WHEN short tags fit the row THEN every one of them shows despite the narrow note", () => {
		expect(narrow("a", "b", "c").chips).toHaveLength(3);
	});
});

describe("tagChipRowWidthPx (mirrors the chip row's CSS max-width)", () => {
	it("WHEN the note is wider than the row minimum THEN the row may be as wide as the note", () => {
		expect(tagChipRowWidthPx(WIDE_NODE_PX)).toBe(WIDE_NODE_PX);
	});

	it("WHEN the note is narrower than the row minimum THEN the row keeps its minimum width", () => {
		expect(tagChipRowWidthPx(NARROW_NODE_PX)).toBe(TAG_CHIP_ROW_MIN_WIDTH_PX);
	});
});
