import { describe, expect, it } from "vitest";
import { MarkdownEmbeds } from "./MarkdownEmbeds";
import type { EmbedTargetTitle } from "./MarkdownEmbeds";

/** No note has a frontmatter title — the default for every naming test but the titled one. */
const NO_TITLES: EmbedTargetTitle = () => null;

/**
 * What a markdown renderer SHOWS for the flattened text: backslash escapes are
 * renderer plumbing (see `ASCII_PUNCTUATION`), so every naming test reads the
 * text a user would see. The escaping itself is asserted once, on its own.
 */
function asRendered(markdown: string): string {
	return markdown.replace(/\\(.)/g, "$1");
}

describe("MarkdownEmbeds.flattened", () => {
	it("WHEN an embed names a note THEN it becomes the note's marker", () => {
		expect(asRendered(MarkdownEmbeds.flattened("see ![[Note]] here", NO_TITLES))).toBe("see !<<Note>> here");
	});

	it("WHEN the text has a plain wikilink THEN it is left exactly as written", () => {
		expect(MarkdownEmbeds.flattened("see [[Note]] here", NO_TITLES)).toBe("see [[Note]] here");
	});

	it("WHEN the embed target is a path THEN only its file name names the marker", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[folder/sub/Note]]", NO_TITLES))).toBe("!<<Note>>");
	});

	it("WHEN the embed target spells the .md extension THEN the marker drops it", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[Note.md]]", NO_TITLES))).toBe("!<<Note>>");
	});

	it("WHEN the embed target is an attachment THEN the marker keeps its extension", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[chart.png]]", NO_TITLES))).toBe("!<<chart.png>>");
	});

	it("WHEN the embed carries a subpath THEN the marker names the target, not the subpath", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[Note#Section]]", NO_TITLES))).toBe("!<<Note>>");
	});

	it("WHEN the embed is a same-file section embed THEN its subpath names the marker", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[#Section]]", NO_TITLES))).toBe("!<<Section>>");
	});

	it("WHEN the embed carries an alias THEN the alias names the marker", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[Note#Section|Shown]]", NO_TITLES))).toBe("!<<Shown>>");
	});

	it("WHEN the target has a frontmatter title THEN the title names the marker", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[Note]]", () => "My Title"))).toBe("!<<My Title>>");
	});

	it("WHEN the target has BOTH an alias and a frontmatter title THEN the alias wins (the writer chose it)", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[Note|Shown]]", () => "My Title"))).toBe("!<<Shown>>");
	});

	it("WHEN the pipe carries an image WIDTH THEN it names nothing and the target names the marker", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[chart.png|300]]", NO_TITLES))).toBe("!<<chart.png>>");
	});

	it("WHEN the pipe carries a WIDTHxHEIGHT size THEN it names nothing and the target names the marker", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[chart.png|300x200]]", NO_TITLES))).toBe("!<<chart.png>>");
	});

	it("WHEN a size-shaped pipe sits on a TITLED note THEN the title still names the marker", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[Note|300]]", () => "My Title"))).toBe("!<<My Title>>");
	});

	it("WHEN an alias merely CONTAINS digits THEN it is still a name, not a size", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[Note|Chapter 300]]", NO_TITLES))).toBe("!<<Chapter 300>>");
	});

	it("WHEN a title is resolved THEN it is asked for by the written target, subpath stripped", () => {
		const asked: string[] = [];
		MarkdownEmbeds.flattened("![[folder/Note#Section]]", (linkPath) => {
			asked.push(linkPath);
			return null;
		});
		expect(asked).toEqual(["folder/Note"]);
	});

	it("WHEN a line embeds twice THEN both embeds flatten", () => {
		expect(asRendered(MarkdownEmbeds.flattened("![[One]] and ![[Two]]", NO_TITLES))).toBe("!<<One>> and !<<Two>>");
	});

	it("WHEN the marker is produced THEN its markdown-significant characters are escaped (else the renderer eats `<<Name>>` as HTML)", () => {
		expect(MarkdownEmbeds.flattened("![[Note]]", NO_TITLES)).toBe("\\!\\<\\<Note\\>\\>");
	});

	it("WHEN a display name carries markdown syntax THEN it is escaped too, so it renders literally", () => {
		expect(MarkdownEmbeds.flattened("![[Note|a_b_c]]", NO_TITLES)).toBe("\\!\\<\\<a\\_b\\_c\\>\\>");
	});

	it("WHEN the text has no embed THEN it is returned unchanged", () => {
		expect(MarkdownEmbeds.flattened("plain prose, no links", NO_TITLES)).toBe("plain prose, no links");
	});
});
