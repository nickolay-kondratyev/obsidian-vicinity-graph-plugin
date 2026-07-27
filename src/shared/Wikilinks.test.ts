import { describe, expect, it } from "vitest";
import { Wikilinks } from "./Wikilinks";

describe("Wikilinks.linkTargetsOf", () => {
	it("WHEN the text carries one wikilink THEN its target is returned", () => {
		expect(Wikilinks.linkTargetsOf("see [[note-b]] for more")).toEqual(["note-b"]);
	});

	it("WHEN the text carries several wikilinks THEN targets come back in written order", () => {
		expect(Wikilinks.linkTargetsOf("[[b]] then [[a]]")).toEqual(["b", "a"]);
	});

	it("WHEN a link is an embed THEN its target is returned too (embeds are links)", () => {
		expect(Wikilinks.linkTargetsOf("![[pic.png]]")).toEqual(["pic.png"]);
	});

	it("WHEN a link carries an alias THEN only the pre-pipe target is returned", () => {
		expect(Wikilinks.linkTargetsOf("[[note-b|Nice Title]]")).toEqual(["note-b"]);
	});

	it("WHEN a link carries a heading subpath THEN only the document part is returned", () => {
		expect(Wikilinks.linkTargetsOf("[[note-b#Section]]")).toEqual(["note-b"]);
	});

	it("WHEN a link carries both a subpath and an alias THEN only the document part is returned", () => {
		expect(Wikilinks.linkTargetsOf("[[note-b#Section|Alias]]")).toEqual(["note-b"]);
	});

	it("WHEN a link is a same-file subpath THEN it names no document and is dropped", () => {
		expect(Wikilinks.linkTargetsOf("[[#Section]]")).toEqual([]);
	});

	it("WHEN a target is padded with spaces THEN it is trimmed", () => {
		expect(Wikilinks.linkTargetsOf("[[  note-b  ]]")).toEqual(["note-b"]);
	});

	it("WHEN the same target appears twice THEN both occurrences are reported (callers dedupe)", () => {
		expect(Wikilinks.linkTargetsOf("[[a]] and [[a]]")).toEqual(["a", "a"]);
	});

	it("WHEN the text has no wikilink THEN nothing is returned", () => {
		expect(Wikilinks.linkTargetsOf("plain text with [a](b.md) only")).toEqual([]);
	});

	it("WHEN two calls scan different texts THEN neither sees the other's scan position", () => {
		// GIVEN a /g regex's mutable lastIndex — a shared instance would make the
		// SECOND call start mid-string and miss the leading link.
		Wikilinks.linkTargetsOf("[[first]] [[second]]");
		expect(Wikilinks.linkTargetsOf("[[third]]")).toEqual(["third"]);
	});
});
