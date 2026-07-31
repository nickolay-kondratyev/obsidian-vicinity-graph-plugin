import { describe, expect, it } from "vitest";
import { LinkContextSnippets } from "./LinkContextSnippets";

// GIVEN a five-line note; offsets index characters, lines join with "\n".
const FIVE_LINES = ["line one", "line two", "  link line [[Target]]  ", "line four", "line five"].join("\n");
/** Offset of "[[Target]]" inside FIVE_LINES (start of line three is 18). */
const LINK_OFFSET = FIVE_LINES.indexOf("[[Target]]");

describe("LinkContextSnippets.snippetAt", () => {
	it("WHEN the occurrence sits mid-file THEN shortContext is the trimmed occurrence line", () => {
		expect(LinkContextSnippets.snippetAt(FIVE_LINES, LINK_OFFSET).shortContext).toBe("link line [[Target]]");
	});

	it("WHEN the occurrence sits mid-file THEN expandedContext spans ±2 surrounding lines", () => {
		expect(LinkContextSnippets.snippetAt(FIVE_LINES, LINK_OFFSET).expandedContext).toBe(
			["line one", "line two", "  link line [[Target]]  ", "line four", "line five"].join("\n"),
		);
	});

	it("WHEN the link starts the file (offset 0) THEN shortContext is the first line", () => {
		expect(LinkContextSnippets.snippetAt("[[First]] rest\nsecond", 0).shortContext).toBe("[[First]] rest");
	});

	it("WHEN the link starts the file THEN expandedContext has no lines above to include", () => {
		expect(LinkContextSnippets.snippetAt("[[First]]\nsecond\nthird\nfourth", 0).expandedContext).toBe(
			"[[First]]\nsecond\nthird",
		);
	});

	it("WHEN the link ends the file THEN shortContext is the last line", () => {
		const text = "first\nsecond\nends with [[Last]]";
		expect(LinkContextSnippets.snippetAt(text, text.indexOf("[[Last]]")).shortContext).toBe("ends with [[Last]]");
	});

	it("WHEN the offset equals the text length THEN it clamps to the last line instead of throwing", () => {
		expect(LinkContextSnippets.snippetAt("first\nlast line", "first\nlast line".length).shortContext).toBe(
			"last line",
		);
	});

	it("WHEN the offset is past the text length THEN it clamps to the last line instead of throwing", () => {
		expect(LinkContextSnippets.snippetAt("only line", 999).shortContext).toBe("only line");
	});

	it("WHEN one line holds two links THEN both offsets yield the same shortContext", () => {
		const text = "above\n[[One]] and [[Two]]\nbelow";
		const snippets = [text.indexOf("[[One]]"), text.indexOf("[[Two]]")].map(
			(offset) => LinkContextSnippets.snippetAt(text, offset).shortContext,
		);
		expect(snippets).toEqual(["[[One]] and [[Two]]", "[[One]] and [[Two]]"]);
	});

	it("WHEN the file is empty THEN both contexts are empty strings", () => {
		expect(LinkContextSnippets.snippetAt("", 0)).toEqual({ shortContext: "", expandedContext: "" });
	});

	it("WHEN blank lines pad the expanded window THEN the joined snippet is end-trimmed", () => {
		const text = "\n\n[[Link]]\n\n\ntail";
		expect(LinkContextSnippets.snippetAt(text, text.indexOf("[[Link]]")).expandedContext).toBe("[[Link]]");
	});
});
