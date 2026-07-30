import { describe, expect, it } from "vitest";
import { Wikilinks } from "./Wikilinks";

/**
 * The kind-blind view of {@link Wikilinks.harvestedLinksOf} — these cases pin
 * WHICH targets are harvested; the KIND cases live in their own describe below.
 */
function targetsOf(text: string): readonly string[] {
	return Wikilinks.harvestedLinksOf(text).map((link) => link.linkText);
}

describe("Wikilinks.harvestedLinksOf targets", () => {
	it("WHEN the text carries one wikilink THEN its target is returned", () => {
		expect(targetsOf("see [[note-b]] for more")).toEqual(["note-b"]);
	});

	it("WHEN the text carries several wikilinks THEN targets come back in written order", () => {
		expect(targetsOf("[[b]] then [[a]]")).toEqual(["b", "a"]);
	});

	it("WHEN a link is an embed THEN its target is returned too (embeds are links)", () => {
		expect(targetsOf("![[pic.png]]")).toEqual(["pic.png"]);
	});

	it("WHEN a link carries an alias THEN only the pre-pipe target is returned", () => {
		expect(targetsOf("[[note-b|Nice Title]]")).toEqual(["note-b"]);
	});

	it("WHEN a link carries a heading subpath THEN only the document part is returned", () => {
		expect(targetsOf("[[note-b#Section]]")).toEqual(["note-b"]);
	});

	it("WHEN a link carries both a subpath and an alias THEN only the document part is returned", () => {
		expect(targetsOf("[[note-b#Section|Alias]]")).toEqual(["note-b"]);
	});

	it("WHEN a link is a same-file subpath THEN it names no document and is dropped", () => {
		expect(targetsOf("[[#Section]]")).toEqual([]);
	});

	it("WHEN a target is padded with spaces THEN it is trimmed", () => {
		expect(targetsOf("[[  note-b  ]]")).toEqual(["note-b"]);
	});

	it("WHEN the same target appears twice THEN both occurrences are reported (callers dedupe)", () => {
		expect(targetsOf("[[a]] and [[a]]")).toEqual(["a", "a"]);
	});

	it("WHEN the text has no wikilink THEN nothing is returned", () => {
		expect(targetsOf("plain text with [a](b.md) only")).toEqual([]);
	});

	it("WHEN two calls scan different texts THEN neither sees the other's scan position", () => {
		// GIVEN a /g regex's mutable lastIndex — a shared instance would make the
		// SECOND call start mid-string and miss the leading link.
		targetsOf("[[first]] [[second]]");
		expect(targetsOf("[[third]]")).toEqual(["third"]);
	});
});

/**
 * The embed marker is CAPTURED, so `![[x]]` and `[[x]]` are distinguishable —
 * the Stage-1 seam behind a separate depth budget for embedded links.
 */
describe("Wikilinks.harvestedLinksOf kinds", () => {
	function kindsOf(text: string): readonly string[] {
		return Wikilinks.harvestedLinksOf(text).map((link) => link.kind);
	}

	it("WHEN a wikilink is written plainly THEN its kind is link", () => {
		expect(kindsOf("see [[note-b]]")).toEqual(["link"]);
	});

	it("WHEN a wikilink carries the embed marker THEN its kind is embed", () => {
		expect(kindsOf("![[pic.png]]")).toEqual(["embed"]);
	});

	it("WHEN an embed and a plain link name the SAME target THEN each keeps its own kind", () => {
		expect(kindsOf("![[a]] and [[a]]")).toEqual(["embed", "link"]);
	});

	it("WHEN an embed carries an alias and a subpath THEN the target still resolves and the kind stays embed", () => {
		expect(Wikilinks.harvestedLinksOf("![[note-b#Section|Alias]]")).toEqual([
			{ linkText: "note-b", kind: "embed" },
		]);
	});
});
