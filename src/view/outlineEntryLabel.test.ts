import { describe, expect, it } from "vitest";
import { outlineEntryLabel } from "./outlineEntryLabel";

describe("outlineEntryLabel", () => {
	it("WHEN the heading is plain prose THEN the label is that text unchanged", () => {
		expect(outlineEntryLabel("Getting started")).toBe("Getting started");
	});

	it("WHEN the heading contains bold THEN the label drops the asterisks", () => {
		expect(outlineEntryLabel("Status **today**")).toBe("Status today");
	});

	it("WHEN the heading contains a code span THEN the label drops the backticks", () => {
		expect(outlineEntryLabel("The `useMemo` hook")).toBe("The useMemo hook");
	});

	it("WHEN the heading contains a plain wikilink THEN the label is the link target", () => {
		// What Obsidian itself displays for an unaliased link.
		expect(outlineEntryLabel("See [[folder/note]]")).toBe("See folder/note");
	});

	it("WHEN the heading contains an aliased wikilink THEN the label is the alias", () => {
		expect(outlineEntryLabel("See [[note|Alias]]")).toBe("See Alias");
	});

	it("WHEN the heading contains a markdown link THEN the label is the link text", () => {
		expect(outlineEntryLabel("See [Label](https://example.com)")).toBe("See Label");
	});

	it("WHEN the heading contains a snake_case name THEN the label is unchanged", () => {
		// Underscore emphasis is DELIBERATELY not stripped — snake_case identifiers
		// are far more common in headings than underscore italics.
		expect(outlineEntryLabel("The snake_case_name rule")).toBe("The snake_case_name rule");
	});

	it("WHEN stripping would leave an empty string THEN the raw text is returned", () => {
		// An empty markdown link strips to nothing; a blank outline row would be
		// worse than showing the source.
		expect(outlineEntryLabel("[]()")).toBe("[]()");
	});

	it("WHEN the raw heading begins with a stray heading marker THEN the label drops it", () => {
		expect(outlineEntryLabel("## Intro")).toBe("Intro");
	});

	it("WHEN the heading contains a hashtag THEN the label keeps it", () => {
		// The marker strip requires whitespace AFTER the hashes, so a leading tag survives.
		expect(outlineEntryLabel("#project notes")).toBe("#project notes");
	});
});
