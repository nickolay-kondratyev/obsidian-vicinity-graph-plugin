import { describe, expect, it } from "vitest";
import { MarkdownInlineLinks } from "./MarkdownInlineLinks";

/**
 * The kind-blind view of {@link MarkdownInlineLinks.harvestedLinksOf} — these cases pin
 * WHICH targets are harvested; the KIND cases live in their own describe below.
 */
function targetsOf(text: string): readonly string[] {
	return MarkdownInlineLinks.harvestedLinksOf(text).map((link) => link.linkText);
}

describe("MarkdownInlineLinks.harvestedLinksOf targets", () => {
	it("WHEN the text carries one inline link THEN its destination is returned", () => {
		expect(targetsOf("see [label](note-b.md) for more")).toEqual(["note-b.md"]);
	});

	it("WHEN the text carries several inline links THEN destinations come back in written order", () => {
		expect(targetsOf("[x](b.md) then [y](a.md)")).toEqual(["b.md", "a.md"]);
	});

	it("WHEN a link is an embed THEN its destination is returned too (embeds are links)", () => {
		expect(targetsOf("![alt](pic.png)")).toEqual(["pic.png"]);
	});

	it("WHEN the same destination appears twice THEN both occurrences are reported (callers dedupe)", () => {
		expect(targetsOf("[x](a.md) and [y](a.md)")).toEqual(["a.md", "a.md"]);
	});

	it("WHEN a destination is percent-encoded THEN it is decoded to the name on disk", () => {
		expect(targetsOf("[a](my%20note.md)")).toEqual(["my note.md"]);
	});

	it("WHEN a destination is wrapped in angle brackets THEN the brackets are not part of it", () => {
		expect(targetsOf("[a](<my note.md>)")).toEqual(["my note.md"]);
	});

	it("WHEN a destination carries a title THEN only the destination is returned", () => {
		expect(targetsOf('[a](note-b.md "Nice Title")')).toEqual(["note-b.md"]);
	});

	it("WHEN a destination carries a single-quoted title THEN only the destination is returned", () => {
		expect(targetsOf("[a](note-b.md 'Nice Title')")).toEqual(["note-b.md"]);
	});

	it("WHEN a destination carries an unencoded space THEN it names no document", () => {
		// CommonMark: a bare (non-angle-bracketed) destination may not contain spaces,
		// so this is not a link at all. Truncating at the space would target `my` and
		// could manufacture an edge to the WRONG note — a phantom edge is worse than
		// a missing one.
		expect(targetsOf("[a](my note.md)")).toEqual([]);
	});

	it("WHEN a destination carries a heading subpath THEN only the document part is returned", () => {
		expect(targetsOf("[a](note-b.md#Section)")).toEqual(["note-b.md"]);
	});

	it("WHEN a destination carries a query THEN only the document part is returned", () => {
		expect(targetsOf("[a](note-b.md?width=40)")).toEqual(["note-b.md"]);
	});

	it("WHEN a destination is an http URL THEN it names no document and is dropped", () => {
		expect(targetsOf("[a](https://example.com)")).toEqual([]);
	});

	it("WHEN a destination carries any other URI scheme THEN it names no document and is dropped", () => {
		expect(targetsOf("[a](mailto:someone@example.com)")).toEqual([]);
	});

	it("WHEN a destination is protocol-relative THEN it names no document and is dropped", () => {
		expect(targetsOf("[a](//example.com/note.md)")).toEqual([]);
	});

	it("WHEN an encoded colon would look like a URI scheme once decoded THEN the link still counts", () => {
		// The external verdict is taken BEFORE decoding: `note%3Aone.md` is a vault
		// file whose name contains a colon, not a `note:` scheme.
		expect(targetsOf("[a](note%3Aone.md)")).toEqual(["note:one.md"]);
	});

	it("WHEN an encoded hash would look like a subpath once decoded THEN it stays part of the name", () => {
		// Subpath stripping happens BEFORE decoding, so `%23` survives as a literal `#`.
		expect(targetsOf("[a](note%23one.md)")).toEqual(["note#one.md"]);
	});

	it("WHEN a destination carries a malformed percent escape THEN the literal text is kept", () => {
		// `decodeURIComponent` throws on `%.`; the honest answer is the text as written
		// (it simply will not resolve) rather than dropping the link silently.
		expect(targetsOf("[a](100%.md)")).toEqual(["100%.md"]);
	});

	it("WHEN a destination is empty THEN it names no document and is dropped", () => {
		expect(targetsOf("[a]()")).toEqual([]);
	});

	it("WHEN an inline link's LABEL is split by a single newline THEN it is still a link", () => {
		// Real Obsidian indexes this — CommonMark lets an inline link's label span a
		// single line ending (observed by `e2e/canvasMarkdownLinkIndexing.e2e.ts`),
		// so excluding the newline (the wikilink rule) would DROP a real edge here.
		expect(targetsOf("[foo\nbar](note-b.md)")).toEqual(["note-b.md"]);
	});

	it("WHEN an inline link's destination sits on its own line inside the parens THEN it is still a link", () => {
		// CommonMark allows a line ending between `(` and the destination; core
		// indexes it (same e2e observation).
		expect(targetsOf("[x](\nnote-b.md\n)")).toEqual(["note-b.md"]);
	});

	it("WHEN an inline link's label is split by a BLANK line THEN it names no document", () => {
		// A blank line is a paragraph break: it ENDS the inline, so `[foo` and
		// `bar](note-b.md)` are not one link. Real Obsidian indexes nothing here
		// (`blankLabel=false` in the e2e observation) — matching it would be a phantom edge.
		expect(targetsOf("[foo\n\nbar](note-b.md)")).toEqual([]);
	});

	it("WHEN a blank line falls inside the destination parens THEN it names no document", () => {
		expect(targetsOf("[x](\n\nnote-b.md\n)")).toEqual([]);
	});

	it("WHEN the text carries only a wikilink THEN nothing is returned (that is Wikilinks' job)", () => {
		expect(targetsOf("see [[note-b]] and ![[pic.png]]")).toEqual([]);
	});

	it("WHEN two calls scan different texts THEN neither sees the other's scan position", () => {
		// GIVEN a /g regex's mutable lastIndex — a shared instance would make the
		// SECOND call start mid-string and miss the leading link.
		targetsOf("[a](first.md) [b](second.md)");
		expect(targetsOf("[c](third.md)")).toEqual(["third.md"]);
	});
});

/** Same seam as {@link Wikilinks}: `![](x)` is an embed, `[](x)` is a plain link. */
describe("MarkdownInlineLinks.harvestedLinksOf kinds", () => {
	function kindsOf(text: string): readonly string[] {
		return MarkdownInlineLinks.harvestedLinksOf(text).map((link) => link.kind);
	}

	it("WHEN an inline link is written plainly THEN its kind is link", () => {
		expect(kindsOf("see [label](note-b.md)")).toEqual(["link"]);
	});

	it("WHEN an inline link carries the embed marker THEN its kind is embed", () => {
		expect(kindsOf("![alt](pic.png)")).toEqual(["embed"]);
	});

	it("WHEN an embed and a plain link name the SAME destination THEN each keeps its own kind", () => {
		expect(kindsOf("![a](x.md) then [b](x.md)")).toEqual(["embed", "link"]);
	});
});
