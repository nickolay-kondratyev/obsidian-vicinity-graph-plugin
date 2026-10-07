import { describe, expect, it } from "vitest";
import { asVaultPath, directedLinkKey } from "../engine";
import type { DirectedLink } from "../engine";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import type { FakeObsidianSpec } from "./FakeObsidianPorts";
import { ObsidianSyntaxRelationshipProvider } from "./ObsidianSyntaxRelationshipProvider";

const NOTE = asVaultPath("note.md");
const X = asVaultPath("x.md");
const Y = asVaultPath("y.md");
const BOARD = asVaultPath("board.canvas");

// GIVEN a note naming its links to X with two keys (one repeated), linking Y plainly, and a
// frontmatter link to Y (frontmatter keys never name relationships).
const NOTE_TEXT = ["---", "related: \"[[Y]]\"", "---", "improves:: [[X]]", "see [[Y]]", "- blocks:: [[X]]", "again (improves:: [[X]])"].join("\n");

/** Offsets of every `[[X]]` / `[[Y]]` occurrence in the body, in order. */
function offsetsOf(text: string, link: string): number[] {
	const offsets: number[] = [];
	for (let at = text.indexOf(link); at >= 0; at = text.indexOf(link, at + 1)) {
		offsets.push(at);
	}
	return offsets;
}

const X_OFFSETS = offsetsOf(NOTE_TEXT, "[[X]]");
const Y_BODY_OFFSET = NOTE_TEXT.indexOf("see [[Y]]") + "see ".length;

const BASE_SPEC: FakeObsidianSpec = {
	files: [{ path: "note.md", content: NOTE_TEXT }, { path: "x.md" }, { path: "y.md" }, { path: "board.canvas" }],
	fileCaches: {
		"note.md": {
			links: [
				...X_OFFSETS.map((offset) => ({ link: "X", original: "[[X]]", position: { start: { offset } } })),
				{ link: "Y", original: "[[Y]]", position: { start: { offset: Y_BODY_OFFSET } } },
			],
			frontmatterLinks: [{ link: "Y" }],
		},
	},
	resolutions: { X: "x.md", Y: "y.md" },
};

/** A vault port that counts `cachedRead` calls, over the fake ports. */
function providerOver(spec: FakeObsidianSpec): { provider: ObsidianSyntaxRelationshipProvider; reads: string[] } {
	const ports = new FakeObsidianPorts(spec);
	const reads: string[] = [];
	const vault = {
		...ports.vault,
		cachedRead: (file: Parameters<typeof ports.vault.cachedRead>[0]) => {
			reads.push(file.path);
			return ports.vault.cachedRead(file);
		},
	};
	return { provider: new ObsidianSyntaxRelationshipProvider(vault, ports.metadataCache), reads };
}

async function namesFor(pairs: readonly DirectedLink[], spec = BASE_SPEC): Promise<ReadonlyMap<string, readonly string[]>> {
	return (await providerOver(spec).provider.syntaxNamesFor(pairs)).names;
}

/**
 * The note as it reads right after an id was written into its frontmatter, while
 * Obsidian's link cache still holds the offsets of {@link NOTE_TEXT}.
 */
const LAGGING_CACHE_SPEC: FakeObsidianSpec = {
	...BASE_SPEC,
	files: [{ path: "note.md", content: `---\nid: abc\n---\n${NOTE_TEXT}` }, { path: "x.md" }, { path: "y.md" }],
};

describe("ObsidianSyntaxRelationshipProvider", () => {
	it("WHEN the note names its links to a target THEN the distinct names answer in note order", async () => {
		const names = await namesFor([{ source: NOTE, target: X }]);
		expect(names.get(directedLinkKey(NOTE, X))).toEqual(["improves", "blocks"]);
	});

	it("WHEN the note links a target only plainly or in frontmatter THEN that pair has no entry", async () => {
		const names = await namesFor([{ source: NOTE, target: Y }]);
		expect(names.has(directedLinkKey(NOTE, Y))).toBe(false);
	});

	it("WHEN a pair is not requested THEN it is not answered", async () => {
		const names = await namesFor([{ source: NOTE, target: Y }]);
		expect(names.has(directedLinkKey(NOTE, X))).toBe(false);
	});

	it("WHEN the REVERSE pair is requested THEN the source's names do not answer it (directed)", async () => {
		const names = await namesFor([{ source: X, target: NOTE }]);
		expect(names.size).toBe(0);
	});

	it("WHEN the source is a canvas THEN it is never read", async () => {
		const { provider, reads } = providerOver(BASE_SPEC);
		await provider.syntaxNamesFor([{ source: BOARD, target: X }]);
		expect(reads).toEqual([]);
	});

	it("WHEN none of a note's links reach a requested target THEN the note is never read", async () => {
		const { provider, reads } = providerOver(BASE_SPEC);
		await provider.syntaxNamesFor([{ source: NOTE, target: BOARD }]);
		expect(reads).toEqual([]);
	});

	it("WHEN several pairs share a source THEN the source is read once", async () => {
		const { provider, reads } = providerOver(BASE_SPEC);
		await provider.syntaxNamesFor([
			{ source: NOTE, target: X },
			{ source: NOTE, target: Y },
		]);
		expect(reads).toEqual(["note.md"]);
	});

	it("WHEN the note was read in full THEN no source is unread", async () => {
		const read = await providerOver(BASE_SPEC).provider.syntaxNamesFor([{ source: NOTE, target: X }]);
		expect(read.unreadSources).toEqual(new Set());
	});

	it("WHEN the link cache lags the note's text THEN the source is reported unread", async () => {
		const read = await providerOver(LAGGING_CACHE_SPEC).provider.syntaxNamesFor([{ source: NOTE, target: X }]);
		expect(read.unreadSources).toEqual(new Set([NOTE]));
	});

	it("WHEN the link cache lags the note's text THEN none of its names are guessed", async () => {
		const names = await namesFor([{ source: NOTE, target: X }], LAGGING_CACHE_SPEC);
		expect(names.size).toBe(0);
	});

	it("WHEN the source path is not in the vault THEN it answers empty", async () => {
		const names = await namesFor([{ source: asVaultPath("ghost.md"), target: X }]);
		expect(names.size).toBe(0);
	});
});
