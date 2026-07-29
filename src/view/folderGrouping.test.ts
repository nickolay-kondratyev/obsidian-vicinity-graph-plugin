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
		expect(deriveFolderGroups(MIXED_NODES).groups).toEqual([
			{ folder: "notes", memberPaths: ["notes/a.md", "notes/b.md"] },
		]);
	});

	it("WHEN a folder holds a single node THEN no group is emitted for it", () => {
		const folders = deriveFolderGroups(MIXED_NODES).groups.map((group) => group.folder);
		expect(folders).not.toContain("solo");
	});

	it("WHEN nodes live at the vault root THEN they never group (no folder identity)", () => {
		const rootPair = [
			makeNode({ path: asVaultPath("a.md"), folder: asFolderPath("") }),
			makeNode({ path: asVaultPath("b.md"), folder: asFolderPath("") }),
		];
		expect(deriveFolderGroups(rootPair).groups).toEqual([]);
	});
});

describe("deriveFolderGroups membership index", () => {
	it("WHEN a node is in a rendered group THEN the reverse index maps its path to the folder", () => {
		expect(deriveFolderGroups(MIXED_NODES).groupFolderByMemberPath.get("notes/a.md")).toBe("notes");
	});

	it("WHEN a node is a folder singleton THEN the reverse index does not contain it", () => {
		expect(deriveFolderGroups(MIXED_NODES).groupFolderByMemberPath.has("solo/only.md")).toBe(false);
	});
});

describe("deriveFolderGroups determinism", () => {
	it("WHEN deriving twice from the same nodes THEN the results are identical", () => {
		expect(deriveFolderGroups(MIXED_NODES)).toEqual(deriveFolderGroups(MIXED_NODES));
	});
});

/**
 * Step-07 dense folder scenario: one graph carrying the full membership matrix at
 * scale — a 1-member folder, a 2-member folder, a many-member (dozens) folder, and
 * vault-root files — to guard the 2+ rule and determinism against realistic breadth.
 */
const MANY_MEMBER_COUNT = 40;

function denseMultiFolderNodes() {
	const nodes = [
		makeNode({ path: asVaultPath("single/only.md"), folder: asFolderPath("single") }),
		makeNode({ path: asVaultPath("duo/a.md"), folder: asFolderPath("duo") }),
		makeNode({ path: asVaultPath("duo/b.md"), folder: asFolderPath("duo") }),
		makeNode({ path: asVaultPath("rootOne.md"), folder: asFolderPath("") }),
		makeNode({ path: asVaultPath("rootTwo.md"), folder: asFolderPath("") }),
	];
	for (let i = 0; i < MANY_MEMBER_COUNT; i++) {
		const index = String(i).padStart(2, "0");
		nodes.push(makeNode({ path: asVaultPath(`many/m${index}.md`), folder: asFolderPath("many") }));
	}
	return nodes;
}

describe("deriveFolderGroups dense 1/2/many membership matrix", () => {
	it("WHEN folders of size 1, 2 and many coexist THEN only the 2+ folders become groups", () => {
		const folders = deriveFolderGroups(denseMultiFolderNodes()).groups.map((group) => group.folder).sort();
		expect(folders).toEqual(["duo", "many"]);
	});

	it("WHEN a folder holds dozens of members THEN the group lists every one of them", () => {
		const many = deriveFolderGroups(denseMultiFolderNodes()).groups.find((group) => group.folder === "many");
		expect(many?.memberPaths).toHaveLength(MANY_MEMBER_COUNT);
	});

	it("WHEN the single-member and root folders are present THEN neither is grouped", () => {
		const folders = deriveFolderGroups(denseMultiFolderNodes()).groups.map((group) => group.folder as string);
		expect(folders.includes("single") || folders.includes("")).toBe(false);
	});

	it("WHEN deriving the dense graph twice THEN the results are identical (layout/flow sync)", () => {
		expect(deriveFolderGroups(denseMultiFolderNodes())).toEqual(deriveFolderGroups(denseMultiFolderNodes()));
	});
});
