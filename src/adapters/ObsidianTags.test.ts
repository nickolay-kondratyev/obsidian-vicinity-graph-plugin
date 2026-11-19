import { describe, expect, it } from "vitest";
import { ObsidianTags } from "./ObsidianTags";

/**
 * The raw tags Obsidian's `getAllTags` reports for one cached note, mirrored
 * (behavior read from the shipped 1.12.4 and 1.12.7 builds): frontmatter `tags`
 * first, then body hashtags in document order.
 */
describe("ObsidianTags.rawTagsOf", () => {
	it("WHEN the note has body hashtags THEN they are reported as written", () => {
		expect(ObsidianTags.rawTagsOf({ tags: [{ tag: "#todo" }, { tag: "#Project/Alpha" }] })).toEqual([
			"#todo",
			"#Project/Alpha",
		]);
	});

	it("WHEN frontmatter `tags` is a list THEN each entry is reported with a # prefix", () => {
		expect(ObsidianTags.rawTagsOf({ frontmatter: { tags: ["idea", "#done"] } })).toEqual(["#idea", "#done"]);
	});

	it("WHEN frontmatter `tags` is a single string THEN it is reported as one tag", () => {
		expect(ObsidianTags.rawTagsOf({ frontmatter: { tags: "idea" } })).toEqual(["#idea"]);
	});

	it("WHEN the frontmatter key is cased differently (`Tags`) THEN it is still read", () => {
		expect(ObsidianTags.rawTagsOf({ frontmatter: { Tags: ["idea"] } })).toEqual(["#idea"]);
	});

	it("WHEN the frontmatter key is the singular `tag` THEN it is ignored (Obsidian reads only `tags`)", () => {
		expect(ObsidianTags.rawTagsOf({ frontmatter: { tag: "idea" } })).toEqual([]);
	});

	it("WHEN a frontmatter entry contains a space THEN it is dropped", () => {
		expect(ObsidianTags.rawTagsOf({ frontmatter: { tags: ["two words", "ok"] } })).toEqual(["#ok"]);
	});

	it("WHEN a frontmatter entry is not a string THEN it is dropped", () => {
		expect(ObsidianTags.rawTagsOf({ frontmatter: { tags: [2024, "ok"] } })).toEqual(["#ok"]);
	});

	it("WHEN both frontmatter and body carry tags THEN frontmatter tags come first", () => {
		expect(ObsidianTags.rawTagsOf({ frontmatter: { tags: ["fm"] }, tags: [{ tag: "#body" }] })).toEqual([
			"#fm",
			"#body",
		]);
	});

	it("WHEN the note has no cache entry THEN it has no tags", () => {
		expect(ObsidianTags.rawTagsOf(null)).toEqual([]);
	});
});
