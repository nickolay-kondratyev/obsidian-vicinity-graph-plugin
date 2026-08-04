import { describe, expect, it } from "vitest";
import { asFolderPath, asVaultPath } from "../engine";
import type { GraphNode } from "../engine";
import type { Dimensions, XY } from "./flowMapping";
import { folderGroupIdOf } from "./graphIdentity";
import { NO_RENDERED_LAYOUT, resizedNodesFitRenderedLayout } from "./layoutFit";
import type { RenderedLayout } from "./layoutFit";
import { makeNode } from "./testFixtures/graphFixtures";

/**
 * The geometry half of "a resize only relayouts when it has to"
 * (ticket `nid_9ep12hkmk4zjv2p28emmrhieq_e`). Every node here carries a size
 * override so its box is EXACTLY the number the test states — no label-width
 * estimate in the way.
 */

function sizedNode(path: string, widthPx: number, heightPx: number, folder = ""): GraphNode {
	return makeNode({
		path: asVaultPath(path),
		folder: asFolderPath(folder),
		override: { sizePx: { widthPx, heightPx } },
	});
}

function layoutOf(positions: Record<string, XY>, groupDimensions: Record<string, Dimensions> = {}): RenderedLayout {
	return {
		positions: new Map(Object.entries(positions)),
		groupDimensions: new Map(Object.entries(groupDimensions)),
	};
}

describe("resizedNodesFitRenderedLayout against neighbouring nodes", () => {
	// GIVEN two ungrouped nodes 100px apart on the x axis, "a.md" resized to 100x100.
	const nodes = [sizedNode("a.md", 100, 100), sizedNode("b.md", 100, 100)];
	const resized = new Set(["a.md"]);

	it("WHEN the new box clears its neighbour THEN it fits", () => {
		const layout = layoutOf({
			"a.md": { x: 0, y: 0 },
			"b.md": { x: 200, y: 0 },
		});
		expect(resizedNodesFitRenderedLayout(resized, nodes, layout)).toBe(true);
	});

	it("WHEN the new box overlaps its neighbour THEN it does not fit", () => {
		const layout = layoutOf({
			"a.md": { x: 0, y: 0 },
			"b.md": { x: 90, y: 0 },
		});
		expect(resizedNodesFitRenderedLayout(resized, nodes, layout)).toBe(false);
	});

	it("WHEN the new box only TOUCHES its neighbour's edge THEN it fits", () => {
		// Zero-area contact is not an overlap — see the WHY-NOT on required clearance.
		const layout = layoutOf({
			"a.md": { x: 0, y: 0 },
			"b.md": { x: 100, y: 0 },
		});
		expect(resizedNodesFitRenderedLayout(resized, nodes, layout)).toBe(true);
	});

	it("WHEN the resized node is the ONLY node THEN it fits", () => {
		const layout = layoutOf({ "a.md": { x: 0, y: 0 } });
		expect(resizedNodesFitRenderedLayout(resized, [sizedNode("a.md", 400, 400)], layout)).toBe(true);
	});
});

describe("resizedNodesFitRenderedLayout against folder-group borders", () => {
	// GIVEN a rendered folder group (2+ members) whose elk box is 300x300 at (0,0),
	// with its resized member "a.md" placed 10px inside the top-left corner.
	const folder = "notes";
	const groupId = folderGroupIdOf(asFolderPath(folder));
	const resized = new Set(["a.md"]);
	const groupBox = { [groupId]: { width: 300, height: 300 } };
	const positionsInGroup = {
		[groupId]: { x: 0, y: 0 },
		"a.md": { x: 10, y: 10 },
		"b.md": { x: 10, y: 250 },
	};

	function groupedNodes(resizedWidthPx: number, resizedHeightPx: number): GraphNode[] {
		return [sizedNode("a.md", resizedWidthPx, resizedHeightPx, folder), sizedNode("b.md", 40, 40, folder)];
	}

	it("WHEN the new box stays inside its group border THEN it fits", () => {
		const layout = layoutOf(positionsInGroup, groupBox);
		expect(resizedNodesFitRenderedLayout(resized, groupedNodes(200, 200), layout)).toBe(true);
	});

	it("WHEN the new box spills outside its group border THEN it does not fit", () => {
		// 10 + 295 > 300: the node would hang out of the folder box the layout drew.
		const layout = layoutOf(positionsInGroup, groupBox);
		expect(resizedNodesFitRenderedLayout(resized, groupedNodes(295, 200), layout)).toBe(false);
	});

	it("WHEN the new box swallows a fellow member THEN it does not fit", () => {
		// Still inside the group border, but now sitting on top of "b.md" at y=250.
		const layout = layoutOf(positionsInGroup, groupBox);
		expect(resizedNodesFitRenderedLayout(resized, groupedNodes(200, 280), layout)).toBe(false);
	});

	it("WHEN a group member SHRINKS THEN it fits, leaving the group box oversized", () => {
		// The accepted limitation of ticket `nid_brzatca9hp65cg6w3s4xz27k6_e`, pinned:
		// a smaller box always fits, so the layout (and with it the now-roomy 300x300
		// folder border) is reused until the next structural relayout. See `layoutFit.ts`.
		const layout = layoutOf(positionsInGroup, groupBox);
		expect(resizedNodesFitRenderedLayout(resized, groupedNodes(20, 20), layout)).toBe(true);
	});

	it("WHEN an ungrouped node's new box overlaps ANOTHER folder's group box THEN it does not fit", () => {
		// The group's padding is empty space no note node may grow into.
		// Placed clear of BOTH members (y 150..190) — only the group's own box is hit.
		const nodes = [
			sizedNode("loose.md", 200, 40),
			sizedNode("a.md", 40, 40, folder),
			sizedNode("b.md", 40, 40, folder),
		];
		const layout = layoutOf({ ...positionsInGroup, "loose.md": { x: -100, y: 150 } }, groupBox);
		expect(resizedNodesFitRenderedLayout(new Set(["loose.md"]), nodes, layout)).toBe(false);
	});
});

describe("resizedNodesFitRenderedLayout with geometry it cannot see", () => {
	it("WHEN no layout has been rendered yet THEN it does not fit", () => {
		expect(resizedNodesFitRenderedLayout(new Set(["a.md"]), [sizedNode("a.md", 100, 100)], NO_RENDERED_LAYOUT)).toBe(
			false,
		);
	});

	it("WHEN a NEIGHBOUR has no rendered position THEN it does not fit", () => {
		// An unplaced neighbour could be anywhere — no fit can be promised.
		const nodes = [sizedNode("a.md", 100, 100), sizedNode("b.md", 100, 100)];
		const layout = layoutOf({ "a.md": { x: 0, y: 0 } });
		expect(resizedNodesFitRenderedLayout(new Set(["a.md"]), nodes, layout)).toBe(false);
	});

	it("WHEN a rendered group has no cached box THEN it does not fit", () => {
		const nodes = [sizedNode("a.md", 100, 100, "notes"), sizedNode("b.md", 40, 40, "notes")];
		const groupId = folderGroupIdOf(asFolderPath("notes"));
		const layout = layoutOf({
			[groupId]: { x: 0, y: 0 },
			"a.md": { x: 10, y: 10 },
			"b.md": { x: 10, y: 200 },
		});
		expect(resizedNodesFitRenderedLayout(new Set(["a.md"]), nodes, layout)).toBe(false);
	});
});
