import { describe, expect, it } from "vitest";
import type { LinkOccurrence } from "../engine";
import { asVaultPath } from "../engine";
import type { EdgePairOccurrences, EdgePreviewInputs } from "./linkPreviewModel";
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

/** A pair with `hierarchy` defaulted off — most tests exercise link-only pairs. */
type PairInput = Omit<EdgePairOccurrences, "hierarchy"> & { readonly hierarchy?: boolean };

/** Edge inputs with one endpoint-name/direction default per test's GIVEN. */
function edgeInputs(pairs: readonly PairInput[]): EdgePreviewInputs {
	return {
		sourceName: "x",
		targetName: "notes",
		bidirectional: false,
		pairs: pairs.map((pair) => ({ ...pair, hierarchy: pair.hierarchy ?? false })),
	};
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

describe("LinkPreviewModels.edge folder relations", () => {
	const JON = asVaultPath("Jon.md");
	const CHILD = asVaultPath("Jon/child-of-jon.md");

	it("WHEN a pure hierarchy pair is given THEN it names the folder note, folder and child", () => {
		const model = LinkPreviewModels.edge(
			edgeInputs([{ sourcePath: JON, targetPath: CHILD, occurrences: [], hierarchy: true }]),
		);
		expect(model.folderRelations).toEqual([
			{ folderNoteName: "Jon.md", folderName: "Jon", childName: "child-of-jon.md" },
		]);
	});

	it("WHEN an inside-style folder note is the source THEN the child's own folder is named", () => {
		const model = LinkPreviewModels.edge(
			edgeInputs([
				{
					sourcePath: asVaultPath("Jon/Jon.md"),
					targetPath: asVaultPath("Jon/child.md"),
					occurrences: [],
					hierarchy: true,
				},
			]),
		);
		expect(model.folderRelations).toEqual([
			{ folderNoteName: "Jon.md", folderName: "Jon", childName: "child.md" },
		]);
	});

	it("WHEN a merged pair also has occurrences THEN it appears in BOTH rows and folder relations", () => {
		const model = LinkPreviewModels.edge(
			edgeInputs([{ sourcePath: JON, targetPath: CHILD, occurrences: [occurrenceAt(3)], hierarchy: true }]),
		);
		expect({ rowCount: model.rowIds.length, relationCount: model.folderRelations.length }).toEqual({
			rowCount: 1,
			relationCount: 1,
		});
	});

	it("WHEN a pair carries no hierarchy relation THEN it contributes no folder relation", () => {
		const model = LinkPreviewModels.edge(
			edgeInputs([{ sourcePath: NOTE, targetPath: TARGET_A, occurrences: [occurrenceAt(3)] }]),
		);
		expect(model.folderRelations).toEqual([]);
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
