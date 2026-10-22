import { describe, expect, it } from "vitest";
import { NamedLinks } from "./NamedLinks";

/** The offset of the FIRST `[[` in `text` — the fixture's link position, like `cache.links` would report it. */
function wikilinkOffsetIn(text: string): number {
	const offset = text.indexOf("[[");
	if (offset < 0) throw new Error(`fixture has no wikilink: text=[${text}]`);
	return offset;
}

function relationIn(text: string): string | undefined {
	return NamedLinks.relationAt(text, wikilinkOffsetIn(text));
}

describe("NamedLinks.relationAt", () => {
	it("WHEN a name is glued to `::[[` THEN it is the relation", () => {
		expect(relationIn("uses::[[TCP]]")).toBe("uses");
	});

	it("WHEN the name carries a hyphen THEN the whole hyphenated run is the relation", () => {
		expect(relationIn("greatly-improves::[[note2]]")).toBe("greatly-improves");
	});

	it("WHEN a space splits the words before `::` THEN only the glued word is the relation", () => {
		expect(relationIn("greatly improves::[[note2]]")).toBe("improves");
	});

	it("WHEN the link has no `::` prefix THEN there is no relation", () => {
		expect(relationIn("plain mention of [[note2]]")).toBeUndefined();
	});

	it("WHEN a space sits between the name and `::` THEN there is no relation", () => {
		expect(relationIn("uses ::[[TCP]]")).toBeUndefined();
	});

	it("WHEN a space sits between `::` and `[[` THEN there is no relation", () => {
		expect(relationIn("uses:: [[TCP]]")).toBeUndefined();
	});

	it("WHEN the link is an embed (`::![[`) and the offset points at the `!` THEN there is no relation", () => {
		const text = "uses::![[TCP]]";
		expect(NamedLinks.relationAt(text, text.indexOf("!"))).toBeUndefined();
	});

	it("WHEN the offset does not point at `[[` THEN there is no relation", () => {
		expect(NamedLinks.relationAt("uses::[[TCP]]", 0)).toBeUndefined();
	});

	it("WHEN the link starts at offset 0 THEN there is no relation and no crash", () => {
		expect(NamedLinks.relationAt("[[TCP]] first thing", 0)).toBeUndefined();
	});

	it("WHEN the name is non-ASCII THEN Unicode letters count as name characters", () => {
		expect(relationIn("использует::[[TCP]]")).toBe("использует");
	});

	it("WHEN the named link opens a new line THEN the previous line is not consulted", () => {
		expect(relationIn("first line\nuses::[[TCP]]")).toBe("uses");
	});

	it("WHEN the file uses CRLF line endings THEN a named link on a later line still names its relation", () => {
		expect(relationIn("first line\r\nuses::[[TCP]]")).toBe("uses");
	});

	it("WHEN the `::` ends the previous line THEN the link on the next line has no relation", () => {
		expect(relationIn("uses::\n[[TCP]]")).toBeUndefined();
	});

	it("WHEN punctuation precedes the name THEN the name alone is the relation", () => {
		expect(relationIn("(uses::[[TCP]]")).toBe("uses");
	});

	it("WHEN only markup precedes `::` THEN there is no relation", () => {
		expect(relationIn("**x**::[[TCP]]")).toBeUndefined();
	});

	it("WHEN digits and underscores make up the name THEN they are name characters", () => {
		expect(relationIn("rel_2::[[TCP]]")).toBe("rel_2");
	});

	it("WHEN the second link on a line is the named one THEN its own prefix decides", () => {
		const text = "[[A]] then uses::[[B]]";
		expect(NamedLinks.relationAt(text, text.lastIndexOf("[["))).toBe("uses");
	});
});
