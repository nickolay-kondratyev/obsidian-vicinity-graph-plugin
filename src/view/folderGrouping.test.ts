import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { deriveFolderGroups } from "./folderGrouping";
import { makeNode } from "./testFixtures/graphFixtures";

/** GIVEN a mixed graph: two notes in notes/, a singleton in solo/, one root file. */
const MIXED_NODES = [
	makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes") }),
	makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes") }),
	makeNode({ path: asVaultPath("solo/only.md"), folder: asFolderPath("solo") }),
	makeNode({ path: asVaultPath("root.md"), folder: asFolderPath("") }),
];

describe("deriveFolderGroups 2+ membership rule", () => {
	it("WHEN a folder holds two nodes THEN it becomes a group with both members", () => {
		expect(deriveFolderGroups(MIXED_NODES, true).groups).toEqual([
			{ folder: "notes", memberPaths: ["notes/a.md", "notes/b.md"] },
		]);
	});

	it("WHEN a folder holds a single node THEN no group is emitted for it", () => {
		const folders = deriveFolderGroups(MIXED_NODES, true).groups.map((group) => group.folder);
		expect(folders).not.toContain("solo");
	});

	it("WHEN nodes live at the vault root THEN they never group (no folder identity)", () => {
		const rootPair = [
			makeNode({ path: asVaultPath("a.md"), folder: asFolderPath("") }),
			makeNode({ path: asVaultPath("b.md"), folder: asFolderPath("") }),
		];
		expect(deriveFolderGroups(rootPair, true).groups).toEqual([]);
	});
});

describe("deriveFolderGroups membership index", () => {
	it("WHEN a node is in a rendered group THEN the reverse index maps its path to the folder", () => {
		expect(deriveFolderGroups(MIXED_NODES, true).groupFolderByMemberPath.get("notes/a.md")).toBe("notes");
	});

	it("WHEN a node is a folder singleton THEN the reverse index does not contain it", () => {
		expect(deriveFolderGroups(MIXED_NODES, true).groupFolderByMemberPath.has("solo/only.md")).toBe(false);
	});
});

describe("deriveFolderGroups groupByFolder toggle", () => {
	it("WHEN groupByFolder is off THEN no groups are derived", () => {
		expect(deriveFolderGroups(MIXED_NODES, false).groups).toEqual([]);
	});
});

describe("deriveFolderGroups determinism", () => {
	it("WHEN deriving twice from the same nodes THEN the results are identical", () => {
		expect(deriveFolderGroups(MIXED_NODES, true)).toEqual(deriveFolderGroups(MIXED_NODES, true));
	});
});
