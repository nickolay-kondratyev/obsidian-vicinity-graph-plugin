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

describe("ObsidianLinkOccurrenceProvider outgoing occurrences", () => {
	it("WHEN a markdown note has cached links THEN occurrences arrive in document order with offsets", async () => {
		const provider = await providerOver(BASE_SPEC);
		const occurrences = await provider.outgoingOccurrences(NOTE);
		expect(occurrences.map(({ targetPath, offset }) => ({ targetPath, offset }))).toEqual([
			{ targetPath: TARGET, offset: TARGET_OFFSET_1 },
			{ targetPath: TARGET, offset: TARGET_OFFSET_2 },
			{ targetPath: OTHER, offset: OTHER_OFFSET },
		]);
	});

	it("WHEN an occurrence has an offset THEN its shortContext is the trimmed occurrence line", async () => {
		const provider = await providerOver(BASE_SPEC);
		const occurrences = await provider.outgoingOccurrences(NOTE);
		expect(occurrences[0]?.context?.shortContext).toBe("links [[Target]] here");
	});

	it("WHEN the source is a canvas THEN its occurrence has null offset and null context", async () => {
		const provider = await providerOver(BASE_SPEC);
		expect(await provider.outgoingOccurrences(BOARD)).toEqual([
			{ targetPath: TARGET, offset: null, context: null },
		]);
	});

	it("WHEN a link is a frontmatter (property) link THEN its occurrence is position-less", async () => {
		const provider = await providerOver({
			...BASE_SPEC,
			fileCaches: { "note.md": { frontmatterLinks: [{ link: "Target" }] } },
			resolvedLinks: { "note.md": { "target.md": 1 } },
		});
		expect(await provider.outgoingOccurrences(NOTE)).toEqual([{ targetPath: TARGET, offset: null, context: null }]);
	});

	it("WHEN the path is unknown to the vault THEN the result is empty, never a throw", async () => {
		const provider = await providerOver(BASE_SPEC);
		expect(await provider.outgoingOccurrences(asVaultPath("missing.md"))).toEqual([]);
	});
});

describe("ObsidianLinkOccurrenceProvider edge-scoped occurrences", () => {
	it("WHEN the note links the target twice THEN both occurrences survive the edge scope", async () => {
		const provider = await providerOver(BASE_SPEC);
		const occurrences = await provider.occurrencesBetween(NOTE, TARGET);
		expect(occurrences.map((occurrence) => occurrence.offset)).toEqual([TARGET_OFFSET_1, TARGET_OFFSET_2]);
	});

	it("WHEN the edge names the other target THEN only its occurrence answers", async () => {
		const provider = await providerOver(BASE_SPEC);
		const occurrences = await provider.occurrencesBetween(NOTE, OTHER);
		expect(occurrences.map((occurrence) => occurrence.offset)).toEqual([OTHER_OFFSET]);
	});
});

describe("ObsidianLinkOccurrenceProvider backlink occurrences", () => {
	const WITH_BACKLINK_POSITIONS: FakeObsidianSpec = {
		...BASE_SPEC,
		backlinkOffsets: { "target.md": { "note.md": [TARGET_OFFSET_1, TARGET_OFFSET_2] } },
	};

	it("WHEN the backlinks API reports positions THEN occurrences group by source with offsets", async () => {
		const provider = await providerOver(WITH_BACKLINK_POSITIONS);
		const groups = await provider.backlinkOccurrences(TARGET);
		expect(
			groups.map((group) => ({
				sourcePath: group.sourcePath,
				offsets: group.occurrences.map((occurrence) => occurrence.offset),
			})),
		).toEqual([
			{ sourcePath: NOTE, offsets: [TARGET_OFFSET_1, TARGET_OFFSET_2] },
			// The canvas source merges in position-less: no markdown context exists there.
			{ sourcePath: BOARD, offsets: [null] },
		]);
	});

	it("WHEN a backlink occurrence has an offset THEN its context comes from the SOURCE note's text", async () => {
		const provider = await providerOver(WITH_BACKLINK_POSITIONS);
		const groups = await provider.backlinkOccurrences(TARGET);
		expect(groups[0]?.occurrences[1]?.context?.shortContext).toBe("again [[Target]] and [[Other]]");
	});

	it("WHEN the backlinks API is absent THEN the fallback yields count-honest position-less occurrences", async () => {
		// No backlinks/backlinkOffsets in the spec ⇒ an install WITHOUT the API.
		const provider = await providerOver(BASE_SPEC);
		const groups = await provider.backlinkOccurrences(TARGET);
		expect(
			groups.map((group) => ({
				sourcePath: group.sourcePath,
				occurrences: group.occurrences,
			})),
		).toEqual([
			{ sourcePath: NOTE, occurrences: [{ offset: null, context: null }, { offset: null, context: null }] },
			{ sourcePath: BOARD, occurrences: [{ offset: null, context: null }] },
		]);
	});

	it("WHEN the path is unknown to the vault THEN the backlink result is empty, never a throw", async () => {
		const provider = await providerOver(BASE_SPEC);
		expect(await provider.backlinkOccurrences(asVaultPath("missing.md"))).toEqual([]);
	});
});
