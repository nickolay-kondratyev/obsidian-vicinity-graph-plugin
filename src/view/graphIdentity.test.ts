import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { estimateNodeLabelWidthPx } from "./constants";
import { breadcrumbFolderOf, nodeDimensionsPx } from "./graphIdentity";
import { makeNode } from "./testFixtures/graphFixtures";

const LONG_TITLE = "a-really-long-note-title-that-cannot-fit-a-small-square";

describe("nodeDimensionsPx", () => {
	it("WHEN the title fits the score-driven square THEN width and height both equal sizePx", () => {
		const node = makeNode({ title: "a", sizePx: 160 });
		expect(nodeDimensionsPx(node, undefined)).toEqual({ width: 160, height: 160 });
	});

	it("WHEN the title is too long for the square THEN width grows to fit the label", () => {
		const node = makeNode({ title: LONG_TITLE, sizePx: 40 });
		expect(nodeDimensionsPx(node, undefined).width).toBe(estimateNodeLabelWidthPx(LONG_TITLE, undefined));
	});

	it("WHEN the title is too long for the square THEN height stays the score-driven size", () => {
		const node = makeNode({ title: LONG_TITLE, sizePx: 40 });
		expect(nodeDimensionsPx(node, undefined).height).toBe(40);
	});

	it("WHEN a long name forces growth THEN width may exceed the engine max size", () => {
		const node = makeNode({ title: LONG_TITLE, sizePx: 160 });
		expect(nodeDimensionsPx(node, undefined).width).toBeGreaterThan(160);
	});

	it("WHEN an ungrouped singleton shows a folder breadcrumb THEN the folder is included in the width", () => {
		const node = makeNode({ title: "note", sizePx: 40 });
		const withFolder = nodeDimensionsPx(node, "my-folder").width;
		const withoutFolder = nodeDimensionsPx(node, undefined).width;
		expect(withFolder).toBeGreaterThan(withoutFolder);
	});
});

describe("breadcrumbFolderOf", () => {
	it("WHEN a node is an ungrouped singleton in a folder THEN it shows the folder-name breadcrumb", () => {
		const node = makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("deep/notes") });
		expect(breadcrumbFolderOf(node, false)).toBe("notes");
	});

	it("WHEN a node is grouped THEN it shows no breadcrumb (its group box carries folder identity)", () => {
		const node = makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes") });
		expect(breadcrumbFolderOf(node, true)).toBeUndefined();
	});

	it("WHEN a node lives at the vault root THEN it shows no breadcrumb", () => {
		const node = makeNode({ path: asVaultPath("a.md"), folder: asFolderPath("") });
		expect(breadcrumbFolderOf(node, false)).toBeUndefined();
	});
});
