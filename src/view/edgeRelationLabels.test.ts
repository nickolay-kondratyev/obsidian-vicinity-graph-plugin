import { describe, expect, it } from "vitest";
import type { EdgePathGeometry } from "./edgeGeometry";
import type { DirectedRelationLabel } from "./flowMapping";
import type { RelationLabelStack } from "./edgeRelationLabels";
import { DIRECTION_STACK_BIAS, MAX_RELATION_LABELS_PER_STACK, planRelationLabelStacks } from "./edgeRelationLabels";

/** The display texts a stack's chips carry, dropping the colour-keying name half. */
function texts(stack: RelationLabelStack | undefined): readonly string[] {
	return (stack?.names ?? []).map((chip) => chip.text);
}

/**
 * BDD coverage for the pure multi-name edge-label planner. Positioning is glance
 * geometry (validated visually by e2e); here we pin the RULES: truncation, the
 * one-stack vs two-stack split, and which arrowhead each direction anchors beside.
 */

/** Geometry with a distinct value per anchor so a test can tell which one a stack used. */
function geometry(overrides: Partial<EdgePathGeometry> = {}): EdgePathGeometry {
	return {
		path: "M 0,0 L 100,0",
		labelX: 50,
		labelY: 50,
		arrowX: 100,
		arrowY: 10,
		arrowAngleDeg: 0,
		sourceArrowX: 0,
		sourceArrowY: 90,
		sourceArrowAngleDeg: 180,
		...overrides,
	};
}

function forward(name: string): DirectedRelationLabel {
	return { label: { name }, direction: "forward" };
}

function backward(name: string): DirectedRelationLabel {
	return { label: { name }, direction: "backward" };
}

describe("planRelationLabelStacks", () => {
	it("WHEN there are no relations THEN it plans no stacks", () => {
		expect(planRelationLabelStacks([], geometry())).toEqual([]);
	});

	it("WHEN all names go one way THEN a single stack sits at the edge midpoint", () => {
		const stacks = planRelationLabelStacks([forward("supports"), forward("cites")], geometry());
		expect(stacks).toEqual([
			{
				direction: "forward",
				x: 50,
				y: 50,
				names: [
					{ text: "supports", name: "supports" },
					{ text: "cites", name: "cites" },
				],
			},
		]);
	});

	it("WHEN a one-way name carries a qualifier THEN the stack shows the [X] display form", () => {
		const stacks = planRelationLabelStacks(
			[{ label: { name: "refutes", qualifier: "but weakly" }, direction: "forward" }],
			geometry(),
		);
		expect(texts(stacks[0])).toEqual(["refutes [X] but weakly"]);
	});

	it("WHEN a name carries a qualifier THEN the chip name stays the BARE name (so a qualifier can't shift the hue)", () => {
		const stacks = planRelationLabelStacks(
			[{ label: { name: "refutes", qualifier: "but weakly" }, direction: "forward" }],
			geometry(),
		);
		expect(stacks[0]?.names[0]?.name).toBe("refutes");
	});

	it("WHEN a stack has more names than the cap THEN the extras fold into a +N overflow chip", () => {
		const names = ["a", "b", "c", "d", "e"];
		const [stack] = planRelationLabelStacks(names.map(forward), geometry());
		expect(texts(stack)).toEqual(["a", "b", "c"]);
		expect(stack?.overflow?.count).toBe(2);
		expect(stack?.overflow?.badgeText).toBe("+2");
		expect(stack?.overflow?.title).toContain("d, e");
	});

	it("WHEN names go BOTH ways THEN forward names anchor beside the target arrowhead", () => {
		const stacks = planRelationLabelStacks([forward("supports"), backward("cites")], geometry());
		const forwardStack = stacks.find((stack) => stack.direction === "forward");
		expect(texts(forwardStack)).toEqual(["supports"]);
		// Biased halfway from midpoint (50,50) toward the target arrowhead (100,10).
		expect(forwardStack).toMatchObject({
			x: 50 + (100 - 50) * DIRECTION_STACK_BIAS,
			y: 50 + (10 - 50) * DIRECTION_STACK_BIAS,
		});
	});

	it("WHEN names go BOTH ways THEN backward names anchor beside the source arrowhead", () => {
		const stacks = planRelationLabelStacks([forward("supports"), backward("cites")], geometry());
		const backwardStack = stacks.find((stack) => stack.direction === "backward");
		expect(texts(backwardStack)).toEqual(["cites"]);
		// Biased halfway from midpoint (50,50) toward the source arrowhead (0,90).
		expect(backwardStack).toMatchObject({
			x: 50 + (0 - 50) * DIRECTION_STACK_BIAS,
			y: 50 + (90 - 50) * DIRECTION_STACK_BIAS,
		});
	});

	it("WHEN both directions overflow THEN each stack truncates independently", () => {
		const relations = [
			...["a", "b", "c", "d"].map(forward),
			...["w", "x", "y", "z"].map(backward),
		];
		const stacks = planRelationLabelStacks(relations, geometry());
		expect(stacks.map((stack) => stack.names.length)).toEqual([MAX_RELATION_LABELS_PER_STACK, MAX_RELATION_LABELS_PER_STACK]);
		expect(stacks.every((stack) => stack.overflow?.count === 1)).toBe(true);
	});
});
