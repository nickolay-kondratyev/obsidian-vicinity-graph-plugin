import { describe, expect, it } from "vitest";
import type { BacklinkSourceOccurrences, LinkOccurrence, OutgoingLinkOccurrence } from "../engine";
import { asVaultPath } from "../engine";
import { LinkPreviewModels, edgeEndpointDisplayName } from "./linkPreviewModel";

const NOTE = asVaultPath("notes/x.md");
const TARGET_A = asVaultPath("notes/a.md");
const TARGET_B = asVaultPath("notes/b.md");

function occurrenceAt(offset: number | null): LinkOccurrence {
	return {
		offset,
		context:
			offset === null ? null : { shortContext: `line@${offset}`, expandedContext: `block@${offset}`, line: offset },
	};
}

function outgoingAt(offset: number, targetPath = TARGET_A): OutgoingLinkOccurrence {
	return { ...occurrenceAt(offset), targetPath };
}

function backlinksFrom(sourcePath: string, offsets: readonly number[]): BacklinkSourceOccurrences {
	return { sourcePath: asVaultPath(sourcePath), occurrences: offsets.map(occurrenceAt) };
}

const EMPTY_NODE_INPUTS = { path: NOTE, outline: [], outgoing: [], backlinks: [] };

describe("LinkPreviewModels.node grouping and order", () => {
	it("WHEN built THEN the outline is passed through verbatim", () => {
		const outline = [{ rawText: "One", level: 1 }, { rawText: "Two", level: 2 }];
		expect(LinkPreviewModels.node({ ...EMPTY_NODE_INPUTS, outline }).outline).toBe(outline);
	});

	it("WHEN outgoing occurrences are given in document order THEN link rows keep that order", () => {
		const model = LinkPreviewModels.node({
			...EMPTY_NODE_INPUTS,
			outgoing: [outgoingAt(5), outgoingAt(20, TARGET_B), outgoingAt(90)],
		});
		expect(model.linkRows.map((row) => row.occurrence.offset)).toEqual([5, 20, 90]);
	});

	it("WHEN backlink groups arrive in provider order THEN groups are sorted by source path", () => {
		const model = LinkPreviewModels.node({
			...EMPTY_NODE_INPUTS,
			backlinks: [backlinksFrom("zeta.md", [1]), backlinksFrom("alpha.md", [1]), backlinksFrom("mid.md", [1])],
		});
		expect(model.backlinkGroups.map((group) => group.sourcePath)).toEqual([
			asVaultPath("alpha.md"),
			asVaultPath("mid.md"),
			asVaultPath("zeta.md"),
		]);
	});

	it("WHEN a backlink group has several occurrences THEN its rows keep the source's document order", () => {
		const model = LinkPreviewModels.node({
			...EMPTY_NODE_INPUTS,
			backlinks: [backlinksFrom("alpha.md", [7, 40, 300])],
		});
		expect(model.backlinkGroups[0]?.rows.map((row) => row.occurrence.offset)).toEqual([7, 40, 300]);
	});

	it("WHEN both sections have rows THEN rowIds list link rows before backlink rows", () => {
		const model = LinkPreviewModels.node({
			...EMPTY_NODE_INPUTS,
			outgoing: [outgoingAt(5)],
			backlinks: [backlinksFrom("alpha.md", [7])],
		});
		expect(model.rowIds).toEqual(["links:0", "backlink:alpha.md:0"]);
	});

	it("WHEN two backlink sources each contribute rows THEN every row id is unique", () => {
		const model = LinkPreviewModels.node({
			...EMPTY_NODE_INPUTS,
			outgoing: [outgoingAt(5), outgoingAt(6)],
			backlinks: [backlinksFrom("alpha.md", [7, 8]), backlinksFrom("zeta.md", [9])],
		});
		expect(new Set(model.rowIds).size).toBe(model.rowIds.length);
	});

	it("WHEN the note has no occurrences at all THEN rowIds is empty", () => {
		expect(LinkPreviewModels.node(EMPTY_NODE_INPUTS).rowIds).toEqual([]);
	});
});

/** Edge inputs with one endpoint-name/direction default per test's GIVEN. */
function edgeInputs(
	pairs: Parameters<typeof LinkPreviewModels.edge>[0]["pairs"],
): Parameters<typeof LinkPreviewModels.edge>[0] {
	return { sourceName: "x", targetName: "notes", bidirectional: false, pairs };
}

describe("LinkPreviewModels.edge", () => {
	it("WHEN a pair's occurrences are given in document order THEN its rows keep that order", () => {
		const model = LinkPreviewModels.edge(
			edgeInputs([
				{ sourcePath: NOTE, targetPath: TARGET_A, occurrences: [occurrenceAt(3), occurrenceAt(null), occurrenceAt(50)] },
			]),
		);
		expect(model.pairs[0]?.rows.map((row) => row.occurrence.offset)).toEqual([3, null, 50]);
	});

	it("WHEN pairs arrive in engine order THEN groups are sorted by (source, target) path", () => {
		const model = LinkPreviewModels.edge(
			edgeInputs([
				{ sourcePath: NOTE, targetPath: TARGET_B, occurrences: [] },
				{ sourcePath: TARGET_A, targetPath: NOTE, occurrences: [] },
				{ sourcePath: NOTE, targetPath: TARGET_A, occurrences: [] },
			]),
		);
		expect(model.pairs.map((pair) => `${pair.sourcePath}->${pair.targetPath}`)).toEqual([
			"notes/a.md->notes/x.md",
			"notes/x.md->notes/a.md",
			"notes/x.md->notes/b.md",
		]);
	});

	it("WHEN built THEN rowIds mirror every pair's rows in display order", () => {
		const model = LinkPreviewModels.edge(
			edgeInputs([
				{ sourcePath: NOTE, targetPath: TARGET_A, occurrences: [occurrenceAt(3), occurrenceAt(50)] },
				{ sourcePath: NOTE, targetPath: TARGET_B, occurrences: [occurrenceAt(9)] },
			]),
		);
		expect(model.rowIds).toEqual(["edge:0:0", "edge:0:1", "edge:1:0"]);
	});

	it("WHEN several pairs each contribute rows THEN every row id is unique", () => {
		const model = LinkPreviewModels.edge(
			edgeInputs([
				{ sourcePath: NOTE, targetPath: TARGET_A, occurrences: [occurrenceAt(3)] },
				{ sourcePath: NOTE, targetPath: TARGET_B, occurrences: [occurrenceAt(3)] },
			]),
		);
		expect(new Set(model.rowIds).size).toBe(model.rowIds.length);
	});

	it("WHEN the endpoint names and direction are given THEN the model carries them verbatim", () => {
		const model = LinkPreviewModels.edge({ sourceName: "hub", targetName: "notes", bidirectional: true, pairs: [] });
		expect({ sourceName: model.sourceName, targetName: model.targetName, bidirectional: model.bidirectional }).toEqual({
			sourceName: "hub",
			targetName: "notes",
			bidirectional: true,
		});
	});

	it("WHEN no pair has occurrences THEN rowIds is empty", () => {
		expect(
			LinkPreviewModels.edge(edgeInputs([{ sourcePath: NOTE, targetPath: TARGET_A, occurrences: [] }])).rowIds,
		).toEqual([]);
	});
});

describe("edgeEndpointDisplayName", () => {
	it("WHEN the endpoint is a note path THEN the note title is used", () => {
		expect(edgeEndpointDisplayName("notes/x.md")).toBe("x");
	});

	it("WHEN the endpoint is a folder-group id THEN the folder name is used", () => {
		expect(edgeEndpointDisplayName("folder-group:sub/notes")).toBe("notes");
	});
});
