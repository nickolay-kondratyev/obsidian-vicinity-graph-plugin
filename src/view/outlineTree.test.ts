import { describe, expect, it } from "vitest";
import type { OutlineEntry } from "../engine";
import { buildOutlineTree } from "./outlineTree";
import type { OutlineTreeNode } from "./outlineTree";

function entry(rawText: string, level: number): OutlineEntry {
	return { rawText, level };
}

/** The shape assertions read against: raw heading text plus its children, recursively. */
interface LabelledBranch {
	readonly text: string;
	readonly children: readonly LabelledBranch[];
}

function shapeOf(nodes: readonly OutlineTreeNode[]): readonly LabelledBranch[] {
	return nodes.map((node) => ({ text: node.entry.rawText, children: shapeOf(node.children) }));
}

describe("buildOutlineTree", () => {
	it("WHEN entries are H1, H2, H2 THEN the tree is one root with both children in document order", () => {
		const tree = buildOutlineTree([entry("Intro", 1), entry("Background", 2), entry("Scope", 2)]);

		expect(shapeOf(tree)).toEqual([
			{
				text: "Intro",
				children: [
					{ text: "Background", children: [] },
					{ text: "Scope", children: [] },
				],
			},
		]);
	});

	it("WHEN entries are two H1s THEN the tree has two roots", () => {
		const tree = buildOutlineTree([entry("First", 1), entry("Second", 1)]);

		expect(shapeOf(tree)).toEqual([
			{ text: "First", children: [] },
			{ text: "Second", children: [] },
		]);
	});

	it("WHEN the first entry is an H3 THEN it is a root (no ancestors are invented)", () => {
		const tree = buildOutlineTree([entry("Deep", 3)]);

		expect(shapeOf(tree)).toEqual([{ text: "Deep", children: [] }]);
	});

	it("WHEN levels jump from H1 to H3 THEN the H3 is a direct child of the H1 (no filler node)", () => {
		const tree = buildOutlineTree([entry("Intro", 1), entry("Deep", 3)]);

		expect(shapeOf(tree)).toEqual([{ text: "Intro", children: [{ text: "Deep", children: [] }] }]);
	});

	it("WHEN a shallower heading follows a deeper one THEN it attaches to the nearest shallower ancestor", () => {
		const tree = buildOutlineTree([entry("Intro", 1), entry("Deep", 3), entry("Section", 2)]);

		expect(shapeOf(tree)).toEqual([
			{
				text: "Intro",
				children: [
					{ text: "Deep", children: [] },
					{ text: "Section", children: [] },
				],
			},
		]);
	});

	it("WHEN the entry list is empty THEN the tree is empty", () => {
		expect(buildOutlineTree([])).toEqual([]);
	});
});
