import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import { CanvasParseCache } from "./CanvasParseCache";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import type { FakeObsidianSpec } from "./FakeObsidianPorts";
import { ObsidianLinkOccurrenceProvider } from "./ObsidianLinkOccurrenceProvider";
import { ObsidianLinkProvider } from "./ObsidianLinkProvider";

const NOTE = asVaultPath("note.md");
const TARGET = asVaultPath("target.md");
const OTHER = asVaultPath("other.md");
const BOARD = asVaultPath("board.canvas");

// GIVEN a note whose body links [[Target]] twice and [[Other]] once, on known lines.
const NOTE_TEXT = ["intro line", "links [[Target]] here", "again [[Target]] and [[Other]]", "outro"].join("\n");
const TARGET_OFFSET_1 = NOTE_TEXT.indexOf("[[Target]]");
const TARGET_OFFSET_2 = NOTE_TEXT.indexOf("[[Target]]", TARGET_OFFSET_1 + 1);
const OTHER_OFFSET = NOTE_TEXT.indexOf("[[Other]]");

const BASE_SPEC: FakeObsidianSpec = {
	files: [
		{ path: "note.md", content: NOTE_TEXT },
		{ path: "target.md" },
		{ path: "other.md" },
		// GIVEN a canvas embedding target.md — canvas references carry no markdown position.
		{ path: "board.canvas", content: JSON.stringify({ nodes: [{ type: "file", file: "target.md" }] }) },
	],
	fileCaches: {
		"note.md": {
			links: [
				{ link: "Target", position: { start: { offset: TARGET_OFFSET_1 } } },
				{ link: "Target", position: { start: { offset: TARGET_OFFSET_2 } } },
				{ link: "Other", position: { start: { offset: OTHER_OFFSET } } },
			],
		},
	},
	resolutions: { Target: "target.md", Other: "other.md" },
	resolvedLinks: { "note.md": { "target.md": 2, "other.md": 1 } },
};

async function providerOver(spec: FakeObsidianSpec): Promise<ObsidianLinkOccurrenceProvider> {
	const ports = new FakeObsidianPorts(spec);
	const linkProvider = await ObsidianLinkProvider.create(ports.vault, ports.metadataCache, new CanvasParseCache());
	return new ObsidianLinkOccurrenceProvider(ports.vault, ports.metadataCache, linkProvider);
}

describe("ObsidianLinkOccurrenceProvider edge-scoped occurrences", () => {
	it("WHEN the note links the target twice THEN both occurrences answer in document order with offsets", async () => {
		const provider = await providerOver(BASE_SPEC);
		const occurrences = await provider.occurrencesBetween(NOTE, TARGET);
		expect(occurrences.map((occurrence) => occurrence.offset)).toEqual([TARGET_OFFSET_1, TARGET_OFFSET_2]);
	});

	it("WHEN the edge names the other target THEN only its occurrence answers", async () => {
		const provider = await providerOver(BASE_SPEC);
		const occurrences = await provider.occurrencesBetween(NOTE, OTHER);
		expect(occurrences.map((occurrence) => occurrence.offset)).toEqual([OTHER_OFFSET]);
	});

	it("WHEN an occurrence has an offset THEN its shortContext is the trimmed occurrence line", async () => {
		const provider = await providerOver(BASE_SPEC);
		const occurrences = await provider.occurrencesBetween(NOTE, TARGET);
		expect(occurrences[0]?.context?.shortContext).toBe("links [[Target]] here");
	});

	it("WHEN the source is a canvas THEN its occurrence has null offset and null context", async () => {
		const provider = await providerOver(BASE_SPEC);
		expect(await provider.occurrencesBetween(BOARD, TARGET)).toEqual([{ offset: null, context: null }]);
	});

	it("WHEN a link is a frontmatter (property) link THEN its occurrence is position-less", async () => {
		const provider = await providerOver({
			...BASE_SPEC,
			fileCaches: { "note.md": { frontmatterLinks: [{ link: "Target" }] } },
			resolvedLinks: { "note.md": { "target.md": 1 } },
		});
		expect(await provider.occurrencesBetween(NOTE, TARGET)).toEqual([{ offset: null, context: null }]);
	});

	it("WHEN the source path is unknown to the vault THEN the result is empty, never a throw", async () => {
		const provider = await providerOver(BASE_SPEC);
		expect(await provider.occurrencesBetween(asVaultPath("missing.md"), TARGET)).toEqual([]);
	});
});
