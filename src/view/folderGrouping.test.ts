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
		const notes = deriveFolderGroups(MIXED_NODES).groups.find((group) => group.folder === "notes");
		expect(notes?.memberPaths).toEqual(["notes/a.md", "notes/b.md"]);
	});

	it("WHEN a folder holds two nodes THEN its group is top-level (no parent, leaf label)", () => {
		const notes = deriveFolderGroups(MIXED_NODES).groups.find((group) => group.folder === "notes");
		expect(notes).toMatchObject({ parentFolder: null, leafName: "notes", chainPath: "notes" });
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

/**
 * Descendant qualification: a folder qualifies on its DESCENDANTS, not just direct
 * children — sql/ has two notes spread across sub-leaves that individually hold one.
 */
const DESCENDANT_NODES = [
	makeNode({ path: asVaultPath("sql/joins/inner.md"), folder: asFolderPath("sql/joins") }),
	makeNode({ path: asVaultPath("sql/windows/rank.md"), folder: asFolderPath("sql/windows") }),
];

describe("deriveFolderGroups descendant qualification", () => {
	it("WHEN two notes are descendants across different subfolders THEN the ancestor folder qualifies", () => {
		const folders = deriveFolderGroups(DESCENDANT_NODES).groups.map((group) => group.folder);
		expect(folders).toEqual(["sql"]);
	});

	it("WHEN a lone note sits in a too-small subfolder THEN it is assigned up to the nearest qualifying ancestor", () => {
		const index = deriveFolderGroups(DESCENDANT_NODES).groupFolderByMemberPath;
		expect(index.get("sql/joins/inner.md")).toBe("sql");
	});

	it("WHEN a subfolder holds a single descendant THEN it does not become its own group", () => {
		const folders = deriveFolderGroups(DESCENDANT_NODES).groups.map((group) => group.folder);
		expect(folders).not.toContain("sql/joins");
	});
});

/**
 * Nesting: outer/ holds a direct note AND a qualifying inner/ subfolder, so both
 * render — the inner group nests under the outer.
 */
const NESTED_NODES = [
	makeNode({ path: asVaultPath("outer/top.md"), folder: asFolderPath("outer") }),
	makeNode({ path: asVaultPath("outer/inner/a.md"), folder: asFolderPath("outer/inner") }),
	makeNode({ path: asVaultPath("outer/inner/b.md"), folder: asFolderPath("outer/inner") }),
];

describe("deriveFolderGroups nesting", () => {
	it("WHEN a qualifying subfolder sits inside a qualifying folder THEN both render as groups", () => {
		const folders = deriveFolderGroups(NESTED_NODES).groups.map((group) => group.folder).sort();
		expect(folders).toEqual(["outer", "outer/inner"]);
	});

	it("WHEN a group nests inside another THEN its parentFolder points at the ancestor group", () => {
		const inner = deriveFolderGroups(NESTED_NODES).groups.find((group) => group.folder === "outer/inner");
		expect(inner?.parentFolder).toBe("outer");
	});

	it("WHEN a group nests THEN its chainPath is the leaf name relative to its parent", () => {
		const inner = deriveFolderGroups(NESTED_NODES).groups.find((group) => group.folder === "outer/inner");
		expect(inner?.chainPath).toBe("inner");
	});

	it("WHEN a note sits directly in the outer folder THEN it is a member of the outer group only", () => {
		const outer = deriveFolderGroups(NESTED_NODES).groups.find((group) => group.folder === "outer");
		expect(outer?.memberPaths).toEqual(["outer/top.md"]);
	});
});

/**
 * Redundant-chain collapse: a/b/c holds two leaf notes; a and b each carry nothing
 * but the single chain down to c, so both collapse into one group labelled a/b/c.
 */
const COLLAPSE_NODES = [
	makeNode({ path: asVaultPath("a/b/c/x.md"), folder: asFolderPath("a/b/c") }),
	makeNode({ path: asVaultPath("a/b/c/y.md"), folder: asFolderPath("a/b/c") }),
];

describe("deriveFolderGroups redundant-chain collapse", () => {
	it("WHEN a single-child chain leads to one group THEN only the leaf group survives", () => {
		const folders = deriveFolderGroups(COLLAPSE_NODES).groups.map((group) => group.folder);
		expect(folders).toEqual(["a/b/c"]);
	});

	it("WHEN a chain collapses THEN the surviving group carries the collapsed path label", () => {
		const [group] = deriveFolderGroups(COLLAPSE_NODES).groups;
		expect(group?.chainPath).toBe("a/b/c");
	});

	it("WHEN a chain collapses THEN the surviving group still names its real leaf folder", () => {
		const [group] = deriveFolderGroups(COLLAPSE_NODES).groups;
		expect(group).toMatchObject({ folder: "a/b/c", leafName: "c", parentFolder: null });
	});

	it("WHEN only a mid-chain folder is redundant THEN the collapsed path is relative to the surviving parent", () => {
		// x/ holds a direct note plus x/y/z (two notes); x/y is redundant, collapsing into z.
		const nodes = [
			makeNode({ path: asVaultPath("x/n1.md"), folder: asFolderPath("x") }),
			makeNode({ path: asVaultPath("x/y/z/a.md"), folder: asFolderPath("x/y/z") }),
			makeNode({ path: asVaultPath("x/y/z/b.md"), folder: asFolderPath("x/y/z") }),
		];
		const leaf = deriveFolderGroups(nodes).groups.find((group) => group.folder === "x/y/z");
		expect(leaf).toMatchObject({ parentFolder: "x", chainPath: "y/z" });
	});
});

describe("deriveFolderGroups nearestRenderedAncestorGroupOf seam", () => {
	it("WHEN a folder is itself a rendered group THEN it returns that group", () => {
		const result = deriveFolderGroups(NESTED_NODES);
		expect(result.nearestRenderedAncestorGroupOf(asFolderPath("outer/inner"))?.folder).toBe("outer/inner");
	});

	it("WHEN a folder is a too-small descendant THEN it returns the nearest rendered ancestor", () => {
		const result = deriveFolderGroups(DESCENDANT_NODES);
		expect(result.nearestRenderedAncestorGroupOf(asFolderPath("sql/joins"))?.folder).toBe("sql");
	});

	it("WHEN a folder has no rendered ancestor THEN it returns null (top-level container)", () => {
		const result = deriveFolderGroups(MIXED_NODES);
		expect(result.nearestRenderedAncestorGroupOf(asFolderPath("solo"))).toBeNull();
	});

	it("WHEN a folder collapsed into its child THEN the lookup skips it to a surviving ancestor", () => {
		const result = deriveFolderGroups(COLLAPSE_NODES);
		expect(result.nearestRenderedAncestorGroupOf(asFolderPath("a/b"))).toBeNull();
	});
});

describe("deriveFolderGroups lowestCommonAncestorContainerOf seam", () => {
	it("WHEN both notes render in the same group THEN the LCA container is that group", () => {
		const result = deriveFolderGroups(NESTED_NODES);
		expect(result.lowestCommonAncestorContainerOf("outer/inner/a.md", "outer/inner/b.md")?.folder).toBe(
			"outer/inner",
		);
	});

	it("WHEN notes render in nested groups THEN the LCA container is the shared outer group", () => {
		const result = deriveFolderGroups(NESTED_NODES);
		expect(result.lowestCommonAncestorContainerOf("outer/top.md", "outer/inner/a.md")?.folder).toBe("outer");
	});

	it("WHEN one endpoint is ungrouped THEN the LCA container is the canvas pane (null)", () => {
		const result = deriveFolderGroups(MIXED_NODES);
		expect(result.lowestCommonAncestorContainerOf("solo/only.md", "notes/a.md")).toBeNull();
	});
});

/**
 * GIVEN a THREE-deep grouping tree `A ⊃ A/B ⊃ A/B/C`, each level holding two of its
 * OWN direct notes (so no level collapses). Exercises the "Edge depth into groups"
 * allowance on {@link deriveFolderGroups.projectOntoContainerChildOf}: from a given
 * container the endpoint projects one group deeper per allowance level, or stays the
 * true note once the chain runs out.
 */
const THREE_DEEP_NODES = [
	makeNode({ path: asVaultPath("A/a1.md"), folder: asFolderPath("A") }),
	makeNode({ path: asVaultPath("A/a2.md"), folder: asFolderPath("A") }),
	makeNode({ path: asVaultPath("A/B/b1.md"), folder: asFolderPath("A/B") }),
	makeNode({ path: asVaultPath("A/B/b2.md"), folder: asFolderPath("A/B") }),
	makeNode({ path: asVaultPath("A/B/C/c1.md"), folder: asFolderPath("A/B/C") }),
	makeNode({ path: asVaultPath("A/B/C/c2.md"), folder: asFolderPath("A/B/C") }),
];

describe("deriveFolderGroups projectOntoContainerChildOf depth allowance", () => {
	const result = deriveFolderGroups(THREE_DEEP_NODES);
	const groupA = result.groups.find((group) => group.folder === "A") ?? null;
	const groupABC = result.groups.find((group) => group.folder === "A/B/C") ?? null;

	it("WHEN the allowance is 0 (default) THEN a deep note projects onto the container's DIRECT CHILD", () => {
		// From the canvas pane, that direct child is the outermost group A — today's collapse target.
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", null)?.folder).toBe("A");
	});

	it("WHEN the allowance is 1 THEN the endpoint reaches ONE group deeper than the direct child", () => {
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", null, 1)?.folder).toBe("A/B");
	});

	it("WHEN the allowance reaches the note's own innermost group THEN it projects onto that group box", () => {
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", null, 2)?.folder).toBe("A/B/C");
	});

	it("WHEN the allowance exceeds the chain depth THEN the endpoint stays the true note (null)", () => {
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", null, 3)).toBeNull();
	});

	it("WHEN the allowance is huge THEN the endpoint still just stays the true note (clamped by the chain)", () => {
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", null, 99)).toBeNull();
	});

	it("WHEN the container is an inner group THEN the allowance counts DEPTH BELOW that container", () => {
		// Container A: its direct child on c1's chain is A/B; allowance 1 reaches A/B/C.
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", groupA)?.folder).toBe("A/B");
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", groupA, 1)?.folder).toBe("A/B/C");
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", groupA, 2)).toBeNull();
	});

	it("WHEN the note is a direct leaf member of the container THEN no allowance finds a group", () => {
		// c1 renders directly in A/B/C, so from A/B/C there is no group between them at any depth.
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", groupABC)).toBeNull();
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", groupABC, 5)).toBeNull();
	});
});

describe("deriveFolderGroups determinism", () => {
	it("WHEN deriving twice from the same nodes THEN the group results are identical", () => {
		expect(deriveFolderGroups(MIXED_NODES).groups).toEqual(deriveFolderGroups(MIXED_NODES).groups);
	});

	it("WHEN deriving a nested graph twice THEN the group order is identical (layout/flow sync)", () => {
		expect(deriveFolderGroups(NESTED_NODES).groups).toEqual(deriveFolderGroups(NESTED_NODES).groups);
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
		expect(deriveFolderGroups(denseMultiFolderNodes()).groups).toEqual(
			deriveFolderGroups(denseMultiFolderNodes()).groups,
		);
	});
});
