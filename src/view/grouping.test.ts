import { describe, expect, it } from "vitest";
import { asFolderPath } from "../engine";
import type { NodeGroup } from "./grouping";
import { asGroupId, deriveGroupTreeLookups, NO_GROUP_COLOR } from "./grouping";

/**
 * GIVEN a tree whose group ids and member paths share NO path prefix — the shape
 * a non-folder grouper (tags) produces. `outer` holds note `x/one.md` and nests
 * `inner`, which holds `y/two.md` + `z/three.md`; `other` is a second top-level
 * box; `loose.md` renders on the canvas pane.
 */
function group(id: string, parentId: string | null, memberPaths: readonly string[]): NodeGroup {
	return {
		id: asGroupId(id),
		parentId: parentId === null ? null : asGroupId(parentId),
		label: id,
		chainLabel: id,
		fullLabel: id,
		memberPaths,
		// A subject is mandatory and "folder" is the only kind today; the lookups never read it.
		subject: { kind: "folder", folder: asFolderPath("unrelated") },
		colorToken: NO_GROUP_COLOR,
	};
}

const OUTER = group("g:outer", null, ["x/one.md"]);
const INNER = group("g:inner", "g:outer", ["y/two.md", "z/three.md"]);
const OTHER = group("g:other", null, ["x/four.md", "y/five.md"]);
// Child listed BEFORE its parent: the lookups must not depend on list order.
const LOOKUPS = deriveGroupTreeLookups([INNER, OUTER, OTHER]);

describe("deriveGroupTreeLookups membership index", () => {
	it("WHEN a note is a member of a group THEN the reverse index maps it to that group's id", () => {
		expect(LOOKUPS.groupIdByMemberPath.get("y/two.md")).toBe(INNER.id);
	});

	it("WHEN a note is in no group THEN the reverse index does not contain it", () => {
		expect(LOOKUPS.groupIdByMemberPath.has("loose.md")).toBe(false);
	});
});

describe("deriveGroupTreeLookups containerChainOf", () => {
	it("WHEN a note sits in a nested group THEN its chain is its own group then each ancestor (deepest first)", () => {
		expect(LOOKUPS.containerChainOf("y/two.md")).toEqual([INNER, OUTER]);
	});

	it("WHEN a note renders on the canvas pane THEN its chain is empty", () => {
		expect(LOOKUPS.containerChainOf("loose.md")).toEqual([]);
	});
});

describe("deriveGroupTreeLookups lowestCommonAncestorContainerOf", () => {
	it("WHEN two notes share a group THEN that group is their container", () => {
		expect(LOOKUPS.lowestCommonAncestorContainerOf("y/two.md", "z/three.md")).toBe(INNER);
	});

	it("WHEN one note is nested below the other's group THEN the outer group is their container", () => {
		expect(LOOKUPS.lowestCommonAncestorContainerOf("x/one.md", "y/two.md")).toBe(OUTER);
	});

	it("WHEN two notes share a path prefix but sit in unrelated groups THEN their container is the canvas pane", () => {
		expect(LOOKUPS.lowestCommonAncestorContainerOf("x/one.md", "x/four.md")).toBeNull();
	});
});

describe("deriveGroupTreeLookups projectOntoContainerChildOf", () => {
	it("WHEN projecting a nested note onto the canvas pane THEN it lands on its top-level ancestor group", () => {
		expect(LOOKUPS.projectOntoContainerChildOf("y/two.md", null)).toBe(OUTER);
	});

	it("WHEN projecting a nested note onto its ancestor group THEN it lands on that group's direct child", () => {
		expect(LOOKUPS.projectOntoContainerChildOf("y/two.md", OUTER)).toBe(INNER);
	});

	it("WHEN the note is a direct member of the container THEN there is no group to reach", () => {
		expect(LOOKUPS.projectOntoContainerChildOf("x/one.md", OUTER)).toBeNull();
	});

	it("WHEN an allowance of 1 is given THEN the endpoint reaches one level deeper", () => {
		expect(LOOKUPS.projectOntoContainerChildOf("y/two.md", null, 1)).toBe(INNER);
	});

	it("WHEN the allowance exceeds the note's chain THEN the endpoint stays the true note", () => {
		expect(LOOKUPS.projectOntoContainerChildOf("x/one.md", null, 1)).toBeNull();
	});
});
