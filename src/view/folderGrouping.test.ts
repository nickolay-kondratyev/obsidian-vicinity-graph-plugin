import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import { deriveFolderGroups, UNLIMITED_GROUP_NESTING_DEPTH } from "./folderGrouping";
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
		const notes = deriveFolderGroups(MIXED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups.find((group) => group.folder === "notes");
		expect(notes?.memberPaths).toEqual(["notes/a.md", "notes/b.md"]);
	});

	it("WHEN a folder holds two nodes THEN its group is top-level (no parent, leaf label)", () => {
		const notes = deriveFolderGroups(MIXED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups.find((group) => group.folder === "notes");
		expect(notes).toMatchObject({ parentFolder: null, leafName: "notes", chainPath: "notes" });
	});

	it("WHEN a folder holds a single node THEN no group is emitted for it", () => {
		const folders = deriveFolderGroups(MIXED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups.map((group) => group.folder);
		expect(folders).not.toContain("solo");
	});

	it("WHEN nodes live at the vault root THEN they never group (no folder identity)", () => {
		const rootPair = [
			makeNode({ path: asVaultPath("a.md"), folder: asFolderPath("") }),
			makeNode({ path: asVaultPath("b.md"), folder: asFolderPath("") }),
		];
		expect(deriveFolderGroups(rootPair, UNLIMITED_GROUP_NESTING_DEPTH).groups).toEqual([]);
	});
});

describe("deriveFolderGroups membership index", () => {
	it("WHEN a node is in a rendered group THEN the reverse index maps its path to the folder", () => {
		expect(deriveFolderGroups(MIXED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groupFolderByMemberPath.get("notes/a.md")).toBe("notes");
	});

	it("WHEN a node is a folder singleton THEN the reverse index does not contain it", () => {
		expect(deriveFolderGroups(MIXED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groupFolderByMemberPath.has("solo/only.md")).toBe(false);
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
		const folders = deriveFolderGroups(DESCENDANT_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups.map((group) => group.folder);
		expect(folders).toEqual(["sql"]);
	});

	it("WHEN a lone note sits in a too-small subfolder THEN it is assigned up to the nearest qualifying ancestor", () => {
		const index = deriveFolderGroups(DESCENDANT_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groupFolderByMemberPath;
		expect(index.get("sql/joins/inner.md")).toBe("sql");
	});

	it("WHEN a subfolder holds a single descendant THEN it does not become its own group", () => {
		const folders = deriveFolderGroups(DESCENDANT_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups.map((group) => group.folder);
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
		const folders = deriveFolderGroups(NESTED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups.map((group) => group.folder).sort();
		expect(folders).toEqual(["outer", "outer/inner"]);
	});

	it("WHEN a group nests inside another THEN its parentFolder points at the ancestor group", () => {
		const inner = deriveFolderGroups(NESTED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups.find((group) => group.folder === "outer/inner");
		expect(inner?.parentFolder).toBe("outer");
	});

	it("WHEN a group nests THEN its chainPath is the leaf name relative to its parent", () => {
		const inner = deriveFolderGroups(NESTED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups.find((group) => group.folder === "outer/inner");
		expect(inner?.chainPath).toBe("inner");
	});

	it("WHEN a note sits directly in the outer folder THEN it is a member of the outer group only", () => {
		const outer = deriveFolderGroups(NESTED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups.find((group) => group.folder === "outer");
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
		const folders = deriveFolderGroups(COLLAPSE_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups.map((group) => group.folder);
		expect(folders).toEqual(["a/b/c"]);
	});

	it("WHEN a chain collapses THEN the surviving group carries the collapsed path label", () => {
		const [group] = deriveFolderGroups(COLLAPSE_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups;
		expect(group?.chainPath).toBe("a/b/c");
	});

	it("WHEN a chain collapses THEN the surviving group still names its real leaf folder", () => {
		const [group] = deriveFolderGroups(COLLAPSE_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups;
		expect(group).toMatchObject({ folder: "a/b/c", leafName: "c", parentFolder: null });
	});

	it("WHEN only a mid-chain folder is redundant THEN the collapsed path is relative to the surviving parent", () => {
		// x/ holds a direct note plus x/y/z (two notes); x/y is redundant, collapsing into z.
		const nodes = [
			makeNode({ path: asVaultPath("x/n1.md"), folder: asFolderPath("x") }),
			makeNode({ path: asVaultPath("x/y/z/a.md"), folder: asFolderPath("x/y/z") }),
			makeNode({ path: asVaultPath("x/y/z/b.md"), folder: asFolderPath("x/y/z") }),
		];
		const leaf = deriveFolderGroups(nodes, UNLIMITED_GROUP_NESTING_DEPTH).groups.find((group) => group.folder === "x/y/z");
		expect(leaf).toMatchObject({ parentFolder: "x", chainPath: "y/z" });
	});
});

describe("deriveFolderGroups nearestRenderedAncestorGroupOf seam", () => {
	it("WHEN a folder is itself a rendered group THEN it returns that group", () => {
		const result = deriveFolderGroups(NESTED_NODES, UNLIMITED_GROUP_NESTING_DEPTH);
		expect(result.nearestRenderedAncestorGroupOf(asFolderPath("outer/inner"))?.folder).toBe("outer/inner");
	});

	it("WHEN a folder is a too-small descendant THEN it returns the nearest rendered ancestor", () => {
		const result = deriveFolderGroups(DESCENDANT_NODES, UNLIMITED_GROUP_NESTING_DEPTH);
		expect(result.nearestRenderedAncestorGroupOf(asFolderPath("sql/joins"))?.folder).toBe("sql");
	});

	it("WHEN a folder has no rendered ancestor THEN it returns null (top-level container)", () => {
		const result = deriveFolderGroups(MIXED_NODES, UNLIMITED_GROUP_NESTING_DEPTH);
		expect(result.nearestRenderedAncestorGroupOf(asFolderPath("solo"))).toBeNull();
	});

	it("WHEN a folder collapsed into its child THEN the lookup skips it to a surviving ancestor", () => {
		const result = deriveFolderGroups(COLLAPSE_NODES, UNLIMITED_GROUP_NESTING_DEPTH);
		expect(result.nearestRenderedAncestorGroupOf(asFolderPath("a/b"))).toBeNull();
	});
});

describe("deriveFolderGroups lowestCommonAncestorContainerOf seam", () => {
	it("WHEN both notes render in the same group THEN the LCA container is that group", () => {
		const result = deriveFolderGroups(NESTED_NODES, UNLIMITED_GROUP_NESTING_DEPTH);
		expect(result.lowestCommonAncestorContainerOf("outer/inner/a.md", "outer/inner/b.md")?.folder).toBe(
			"outer/inner",
		);
	});

	it("WHEN notes render in nested groups THEN the LCA container is the shared outer group", () => {
		const result = deriveFolderGroups(NESTED_NODES, UNLIMITED_GROUP_NESTING_DEPTH);
		expect(result.lowestCommonAncestorContainerOf("outer/top.md", "outer/inner/a.md")?.folder).toBe("outer");
	});

	it("WHEN one endpoint is ungrouped THEN the LCA container is the canvas pane (null)", () => {
		const result = deriveFolderGroups(MIXED_NODES, UNLIMITED_GROUP_NESTING_DEPTH);
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
	const result = deriveFolderGroups(THREE_DEEP_NODES, UNLIMITED_GROUP_NESTING_DEPTH);
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
		expect(deriveFolderGroups(MIXED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups).toEqual(deriveFolderGroups(MIXED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups);
	});

	it("WHEN deriving a nested graph twice THEN the group order is identical (layout/flow sync)", () => {
		expect(deriveFolderGroups(NESTED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups).toEqual(deriveFolderGroups(NESTED_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups);
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
		const folders = deriveFolderGroups(denseMultiFolderNodes(), UNLIMITED_GROUP_NESTING_DEPTH).groups.map((group) => group.folder).sort();
		expect(folders).toEqual(["duo", "many"]);
	});

	it("WHEN a folder holds dozens of members THEN the group lists every one of them", () => {
		const many = deriveFolderGroups(denseMultiFolderNodes(), UNLIMITED_GROUP_NESTING_DEPTH).groups.find((group) => group.folder === "many");
		expect(many?.memberPaths).toHaveLength(MANY_MEMBER_COUNT);
	});

	it("WHEN the single-member and root folders are present THEN neither is grouped", () => {
		const folders = deriveFolderGroups(denseMultiFolderNodes(), UNLIMITED_GROUP_NESTING_DEPTH).groups.map((group) => group.folder as string);
		expect(folders.includes("single") || folders.includes("")).toBe(false);
	});

	it("WHEN deriving the dense graph twice THEN the results are identical (layout/flow sync)", () => {
		expect(deriveFolderGroups(denseMultiFolderNodes(), UNLIMITED_GROUP_NESTING_DEPTH).groups).toEqual(
			deriveFolderGroups(denseMultiFolderNodes(), UNLIMITED_GROUP_NESTING_DEPTH).groups,
		);
	});
});

/**
 * Max rendered-nesting-depth cap (plan `nid_yyugpoh3gv8ip24cizvgrs4w4_e`, Q1):
 * groups deeper than the cap merge into their depth-cap ancestor, members fall
 * up, and every lookup seam reflects the merged tree — so relationships that
 * collapsed into a deep group's boundary resurface at the shallower level.
 */
describe("deriveFolderGroups depth cap of 0", () => {
	it("WHEN the cap is 0 THEN no groups render at all", () => {
		expect(deriveFolderGroups(THREE_DEEP_NODES, 0).groups).toEqual([]);
	});

	it("WHEN the cap is 0 THEN the member index is empty (every note renders flat)", () => {
		expect(deriveFolderGroups(THREE_DEEP_NODES, 0).groupFolderByMemberPath.size).toBe(0);
	});

	it("WHEN the cap is 0 THEN nearestRenderedAncestorGroupOf finds nothing", () => {
		const result = deriveFolderGroups(THREE_DEEP_NODES, 0);
		expect(result.nearestRenderedAncestorGroupOf(asFolderPath("A/B/C"))).toBeNull();
	});

	it("WHEN the cap is 0 THEN two same-folder notes share only the canvas pane (edges resurface note-to-note)", () => {
		const result = deriveFolderGroups(THREE_DEEP_NODES, 0);
		expect(result.lowestCommonAncestorContainerOf("A/B/C/c1.md", "A/B/C/c2.md")).toBeNull();
	});

	it("WHEN the cap is 0 THEN projection from the canvas pane reaches no group (true note endpoint)", () => {
		const result = deriveFolderGroups(THREE_DEEP_NODES, 0);
		expect(result.projectOntoContainerChildOf("A/B/C/c1.md", null)).toBeNull();
	});
});

describe("deriveFolderGroups depth cap of 1", () => {
	const capped = deriveFolderGroups(THREE_DEEP_NODES, 1);

	it("WHEN the cap is 1 THEN only the top-level group survives", () => {
		expect(capped.groups.map((group) => group.folder)).toEqual(["A"]);
	});

	it("WHEN deep groups merge away THEN their members fall up into the surviving ancestor in graph-node order", () => {
		const groupA = capped.groups.find((group) => group.folder === "A");
		expect(groupA?.memberPaths).toEqual([
			"A/a1.md",
			"A/a2.md",
			"A/B/b1.md",
			"A/B/b2.md",
			"A/B/C/c1.md",
			"A/B/C/c2.md",
		]);
	});

	it("WHEN a deep group merges away THEN the member index maps its notes to the surviving ancestor", () => {
		expect(capped.groupFolderByMemberPath.get("A/B/C/c1.md")).toBe("A");
	});

	it("WHEN a merged-away group's folder is looked up THEN the nearest rendered ancestor is the survivor", () => {
		expect(capped.nearestRenderedAncestorGroupOf(asFolderPath("A/B/C"))?.folder).toBe("A");
	});

	it("WHEN two notes' old LCA group merged away THEN the LCA is the shallower surviving container", () => {
		// Uncapped their LCA is A/B/C; with only A surviving, the edge collapses no further than A.
		expect(capped.lowestCommonAncestorContainerOf("A/B/C/c1.md", "A/B/C/c2.md")?.folder).toBe("A");
	});

	it("WHEN a note's chain lost its deep groups THEN projection inside the survivor reaches the true note", () => {
		// Uncapped this reached A/B; with the deep groups gone, c1 is a direct leaf member of A.
		const groupA = capped.groups.find((group) => group.folder === "A") ?? null;
		expect(capped.projectOntoContainerChildOf("A/B/C/c1.md", groupA)).toBeNull();
	});
});

describe("deriveFolderGroups depth cap counts RENDERED levels", () => {
	it("WHEN a single-child chain collapsed into one box THEN that box counts as ONE level", () => {
		// a/b/c renders as one box labelled a/b/c, so a cap of 1 keeps it.
		expect(deriveFolderGroups(COLLAPSE_NODES, 1).groups.map((group) => group.folder)).toEqual(["a/b/c"]);
	});

	it("WHEN a mid-chain collapse puts a group at rendered depth 2 THEN a cap of 1 merges it up", () => {
		// x ⊃ x/y/z (x/y collapsed): x/y/z is rendered depth 2 despite folder depth 3.
		const nodes = [
			makeNode({ path: asVaultPath("x/n1.md"), folder: asFolderPath("x") }),
			makeNode({ path: asVaultPath("x/y/z/a.md"), folder: asFolderPath("x/y/z") }),
			makeNode({ path: asVaultPath("x/y/z/b.md"), folder: asFolderPath("x/y/z") }),
		];
		const capped = deriveFolderGroups(nodes, 1);
		expect(capped.groups.map((group) => group.folder)).toEqual(["x"]);
	});

	it("WHEN a mid-chain collapse puts a group at rendered depth 2 THEN a cap of 2 keeps it", () => {
		const nodes = [
			makeNode({ path: asVaultPath("x/n1.md"), folder: asFolderPath("x") }),
			makeNode({ path: asVaultPath("x/y/z/a.md"), folder: asFolderPath("x/y/z") }),
			makeNode({ path: asVaultPath("x/y/z/b.md"), folder: asFolderPath("x/y/z") }),
		];
		const capped = deriveFolderGroups(nodes, 2);
		expect(capped.groups.map((group) => group.folder).sort()).toEqual(["x", "x/y/z"]);
	});
});

describe("deriveFolderGroups depth cap at or above the tree depth", () => {
	it("WHEN the cap equals the rendered tree depth THEN the result matches the unlimited one", () => {
		expect(deriveFolderGroups(THREE_DEEP_NODES, 3).groups).toEqual(
			deriveFolderGroups(THREE_DEEP_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups,
		);
	});

	it("WHEN the cap exceeds the rendered tree depth THEN the result matches the unlimited one", () => {
		expect(deriveFolderGroups(THREE_DEEP_NODES, 20).groups).toEqual(
			deriveFolderGroups(THREE_DEEP_NODES, UNLIMITED_GROUP_NESTING_DEPTH).groups,
		);
	});

	it("WHEN a cap keeps part of the tree THEN surviving inner groups keep their own members only", () => {
		// Cap 2 on the three-deep tree: A/B survives and absorbs A/B/C's members; A keeps its own.
		const capped = deriveFolderGroups(THREE_DEEP_NODES, 2);
		const groupAB = capped.groups.find((group) => group.folder === "A/B");
		expect(groupAB?.memberPaths).toEqual(["A/B/b1.md", "A/B/b2.md", "A/B/C/c1.md", "A/B/C/c2.md"]);
	});

	it("WHEN a cap keeps part of the tree THEN the old deep LCA moves to the deepest survivor", () => {
		const capped = deriveFolderGroups(THREE_DEEP_NODES, 2);
		expect(capped.lowestCommonAncestorContainerOf("A/B/C/c1.md", "A/B/C/c2.md")?.folder).toBe("A/B");
	});
});
