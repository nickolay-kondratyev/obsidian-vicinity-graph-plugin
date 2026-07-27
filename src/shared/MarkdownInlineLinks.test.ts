import { describe, expect, it } from "vitest";
import { MarkdownInlineLinks } from "./MarkdownInlineLinks";

describe("MarkdownInlineLinks.linkTargetsOf", () => {
	it("WHEN the text carries one inline link THEN its destination is returned", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("see [label](note-b.md) for more")).toEqual(["note-b.md"]);
	});

	it("WHEN the text carries several inline links THEN destinations come back in written order", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[x](b.md) then [y](a.md)")).toEqual(["b.md", "a.md"]);
	});

	it("WHEN a link is an embed THEN its destination is returned too (embeds are links)", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("![alt](pic.png)")).toEqual(["pic.png"]);
	});

	it("WHEN the same destination appears twice THEN both occurrences are reported (callers dedupe)", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[x](a.md) and [y](a.md)")).toEqual(["a.md", "a.md"]);
	});

	it("WHEN a destination is percent-encoded THEN it is decoded to the name on disk", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[a](my%20note.md)")).toEqual(["my note.md"]);
	});

	it("WHEN a destination is wrapped in angle brackets THEN the brackets are not part of it", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[a](<my note.md>)")).toEqual(["my note.md"]);
	});

	it("WHEN a destination carries a title THEN only the destination is returned", () => {
		expect(MarkdownInlineLinks.linkTargetsOf('[a](note-b.md "Nice Title")')).toEqual(["note-b.md"]);
	});

	it("WHEN a destination carries a single-quoted title THEN only the destination is returned", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[a](note-b.md 'Nice Title')")).toEqual(["note-b.md"]);
	});

	it("WHEN a destination carries an unencoded space THEN it names no document", () => {
		// CommonMark: a bare (non-angle-bracketed) destination may not contain spaces,
		// so this is not a link at all. Truncating at the space would target `my` and
		// could manufacture an edge to the WRONG note — a phantom edge is worse than
		// a missing one.
		expect(MarkdownInlineLinks.linkTargetsOf("[a](my note.md)")).toEqual([]);
	});

	it("WHEN a destination carries a heading subpath THEN only the document part is returned", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[a](note-b.md#Section)")).toEqual(["note-b.md"]);
	});

	it("WHEN a destination carries a query THEN only the document part is returned", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[a](note-b.md?width=40)")).toEqual(["note-b.md"]);
	});

	it("WHEN a destination is an http URL THEN it names no document and is dropped", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[a](https://example.com)")).toEqual([]);
	});

	it("WHEN a destination carries any other URI scheme THEN it names no document and is dropped", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[a](mailto:someone@example.com)")).toEqual([]);
	});

	it("WHEN a destination is protocol-relative THEN it names no document and is dropped", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[a](//example.com/note.md)")).toEqual([]);
	});

	it("WHEN an encoded colon would look like a URI scheme once decoded THEN the link still counts", () => {
		// The external verdict is taken BEFORE decoding: `note%3Aone.md` is a vault
		// file whose name contains a colon, not a `note:` scheme.
		expect(MarkdownInlineLinks.linkTargetsOf("[a](note%3Aone.md)")).toEqual(["note:one.md"]);
	});

	it("WHEN an encoded hash would look like a subpath once decoded THEN it stays part of the name", () => {
		// Subpath stripping happens BEFORE decoding, so `%23` survives as a literal `#`.
		expect(MarkdownInlineLinks.linkTargetsOf("[a](note%23one.md)")).toEqual(["note#one.md"]);
	});

	it("WHEN a destination carries a malformed percent escape THEN the literal text is kept", () => {
		// `decodeURIComponent` throws on `%.`; the honest answer is the text as written
		// (it simply will not resolve) rather than dropping the link silently.
		expect(MarkdownInlineLinks.linkTargetsOf("[a](100%.md)")).toEqual(["100%.md"]);
	});

	it("WHEN a destination is empty THEN it names no document and is dropped", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("[a]()")).toEqual([]);
	});

	it("WHEN the text carries only a wikilink THEN nothing is returned (that is Wikilinks' job)", () => {
		expect(MarkdownInlineLinks.linkTargetsOf("see [[note-b]] and ![[pic.png]]")).toEqual([]);
	});

	it("WHEN two calls scan different texts THEN neither sees the other's scan position", () => {
		// GIVEN a /g regex's mutable lastIndex — a shared instance would make the
		// SECOND call start mid-string and miss the leading link.
		MarkdownInlineLinks.linkTargetsOf("[a](first.md) [b](second.md)");
		expect(MarkdownInlineLinks.linkTargetsOf("[c](third.md)")).toEqual(["third.md"]);
	});
});
