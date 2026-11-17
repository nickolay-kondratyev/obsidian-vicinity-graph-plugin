import { describe, expect, it } from "vitest";
import { BodyHashtags } from "./BodyHashtags";

/** The name of the tag at `offset` in `line`, or `undefined` — what the assertions compare. */
function tagNameAt(line: string, offset: number): string | undefined {
	return BodyHashtags.at(line, offset)?.name;
}

describe("BodyHashtags.at (the tag under a right-click, over one line of text)", () => {
	const LINE = "Plan #project/alpha and #todo.";

	it("WHEN the offset is inside a tag THEN that tag is returned", () => {
		expect(tagNameAt(LINE, LINE.indexOf("alpha"))).toBe("project/alpha");
	});

	it("WHEN the offset is on the # THEN the tag is returned", () => {
		expect(tagNameAt(LINE, LINE.indexOf("#todo"))).toBe("todo");
	});

	it("WHEN the offset is right after the tag's last character THEN the tag is returned", () => {
		expect(tagNameAt(LINE, LINE.indexOf("#todo") + "#todo".length)).toBe("todo");
	});

	it("WHEN the offset is in plain text THEN there is no tag", () => {
		expect(tagNameAt(LINE, LINE.indexOf("and"))).toBeUndefined();
	});

	it("WHEN the line has two tags THEN the one under the offset wins", () => {
		expect(tagNameAt(LINE, LINE.indexOf("#todo") + 2)).toBe("todo");
	});

	it("WHEN punctuation follows a tag THEN it ends the tag", () => {
		expect(tagNameAt("see #todo, then", 6)).toBe("todo");
	});

	it("WHEN the tag starts the line THEN it is a tag", () => {
		expect(tagNameAt("#idea first", 1)).toBe("idea");
	});

	it("WHEN the # follows a non-space character THEN it is not a tag (a heading link, a URL fragment)", () => {
		expect(tagNameAt("[[Note#Heading]]", 8)).toBeUndefined();
	});

	it("WHEN the # is followed by a space THEN it is a heading marker, not a tag", () => {
		expect(tagNameAt("# Heading", 0)).toBeUndefined();
	});

	it("WHEN the tag body is only digits THEN it is not a tag (Obsidian requires a non-digit)", () => {
		expect(tagNameAt("issue #123 here", 8)).toBeUndefined();
	});

	it("WHEN the tag mixes digits and letters THEN it is a tag", () => {
		expect(tagNameAt("version #v2", 9)).toBe("v2");
	});

	it("WHEN the tag uses dashes, underscores and non-ASCII letters THEN they are part of it", () => {
		expect(tagNameAt("a #follow-up_ünïcode b", 4)).toBe("follow-up_ünïcode");
	});

	it("WHEN the tag keeps its casing THEN the key is lower-cased (Obsidian tags are case-insensitive)", () => {
		expect(BodyHashtags.at("#ToDo", 2)?.key).toBe("todo");
	});
});
