import { describe, expect, it } from "vitest";
import { MarkdownEmbeds } from "./MarkdownEmbeds";
import { asRendered } from "./testFixtures/renderedMarkdown";

describe("MarkdownEmbeds.flattened", () => {
	it("WHEN an embed names a note THEN it renders as its own raw wikilink text", () => {
		expect(asRendered(MarkdownEmbeds.flattened("see ![[Note]] here"))).toBe("see ![[Note]] here");
	});

	it("WHEN the text has a plain wikilink THEN it is left exactly as written", () => {
		expect(MarkdownEmbeds.flattened("see [[Note]] here")).toBe("see [[Note]] here");
	});

	it("WHEN the embed target is a path THEN the whole path is kept as written", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[folder/sub/Note]]"))).toBe("![[folder/sub/Note]]");
	});

	it("WHEN the embed target spells the .md extension THEN it is kept as written", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[Note.md]]"))).toBe("![[Note.md]]");
	});

	it("WHEN the embed target is an attachment THEN it is kept as written", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[chart.png]]"))).toBe("![[chart.png]]");
	});

	it("WHEN the embed carries a subpath THEN the subpath is kept as written", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[Note#Section]]"))).toBe("![[Note#Section]]");
	});

	it("WHEN the embed is a same-file section embed THEN it is kept as written", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[#Section]]"))).toBe("![[#Section]]");
	});

	it("WHEN the embed carries an alias THEN the alias is kept as written", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[Note#Section|Shown]]"))).toBe("![[Note#Section|Shown]]");
	});

	it("WHEN the pipe carries an image size THEN it is kept as written", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[chart.png|300x200]]"))).toBe("![[chart.png|300x200]]");
	});

	it("WHEN a line embeds twice THEN both embeds render as raw text", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[One]] and ![[Two]]"))).toBe("![[One]] and ![[Two]]");
	});

	it("WHEN an embed is escaped THEN every markdown-significant character is escaped (else the renderer expands it)", () => {
		expect(MarkdownEmbeds.flattened("![[Note]]")).toBe("\\!\\[\\[Note\\]\\]");
	});

	it("WHEN an embed's text carries markdown syntax THEN it is escaped too, so it renders literally", () => {
		expect(MarkdownEmbeds.flattened("![[Note|a_b_c]]")).toBe("\\!\\[\\[Note\\|a\\_b\\_c\\]\\]");
	});

	it("WHEN an unclosed `![[` opens a line THEN the following lines are not swallowed", () => {
		// The expanded snippet is MULTI-line and this transform REWRITES what it
		// matches, so an over-matching matcher would delete the reader's prose.
		const stray = "![[stray\nkept prose\nclosed on another line ]] tail";
		expect(MarkdownEmbeds.flattened(stray)).toBe(stray);
	});

	it("WHEN the text has no embed THEN it is returned unchanged", () => {
		expect(MarkdownEmbeds.flattened("plain prose, no links")).toBe("plain prose, no links");
	});
});
