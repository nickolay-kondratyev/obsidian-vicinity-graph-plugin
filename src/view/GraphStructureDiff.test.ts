import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import { SIZE_RELAYOUT_THRESHOLD } from "./constants";
import { decideLayout } from "./GraphStructureDiff";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

describe("decideLayout structural identity", () => {
	// GIVEN a two-node, one-edge graph
	const base = makeGraph({
		nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
		edges: [makeEdge("a.md", "b.md")],
	});

	it("WHEN there is no previous graph THEN it relayouts", () => {
		expect(decideLayout(null, base, SIZE_RELAYOUT_THRESHOLD)).toBe("relayout");
	});

	it("WHEN node and edge structure are unchanged THEN it reuses the layout", () => {
		const next = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
			edges: [makeEdge("a.md", "b.md")],
		});
		expect(decideLayout(base, next, SIZE_RELAYOUT_THRESHOLD)).toBe("reuse-layout");
	});

	it("WHEN a node is added THEN it relayouts", () => {
		const next = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("a.md") }),
				makeNode({ path: asVaultPath("b.md") }),
				makeNode({ path: asVaultPath("c.md") }),
			],
			edges: [makeEdge("a.md", "b.md")],
		});
		expect(decideLayout(base, next, SIZE_RELAYOUT_THRESHOLD)).toBe("relayout");
	});

	it("WHEN an edge is added between the same nodes THEN it relayouts", () => {
		const next = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
			edges: [makeEdge("a.md", "b.md"), makeEdge("b.md", "a.md")],
		});
		expect(decideLayout(base, next, SIZE_RELAYOUT_THRESHOLD)).toBe("relayout");
	});
});

describe("decideLayout size-growth exception", () => {
	const previous = makeGraph({ nodes: [makeNode({ path: asVaultPath("a.md"), sizePx: 50 })] });

	function nextWithSize(sizePx: number) {
		return makeGraph({ nodes: [makeNode({ path: asVaultPath("a.md"), sizePx })] });
	}

	it("WHEN a surviving node grew by exactly the threshold THEN it still reuses the layout", () => {
		// +100% of 50 = 100; growth ratio 1.0 is NOT beyond the 1.0 threshold.
		expect(decideLayout(previous, nextWithSize(100), SIZE_RELAYOUT_THRESHOLD)).toBe("reuse-layout");
	});

	it("WHEN a surviving node grew just beyond the threshold THEN it relayouts", () => {
		expect(decideLayout(previous, nextWithSize(101), SIZE_RELAYOUT_THRESHOLD)).toBe("relayout");
	});

	it("WHEN a surviving node shrank THEN it reuses the layout", () => {
		expect(decideLayout(previous, nextWithSize(10), SIZE_RELAYOUT_THRESHOLD)).toBe("reuse-layout");
	});
});

describe("decideLayout groupByFolder flip (step-05)", () => {
	it("WHEN only groupByFolder changed THEN a relayout is forced (group nodes appear/disappear)", () => {
		const nodes = [makeNode({ path: asVaultPath("a.md") })];
		const previous = makeGraph({ nodes });
		const next = makeGraph({ nodes, viewSettings: { ...previous.viewSettings, groupByFolder: false } });
		expect(decideLayout(previous, next, 1.0)).toBe("relayout");
	});
});

describe("decideLayout layoutMode switch", () => {
	it("WHEN only layoutMode changed THEN a relayout is forced (same structure, different arrangement)", () => {
		const nodes = [makeNode({ path: asVaultPath("a.md") })];
		const previous = makeGraph({ nodes });
		const next = makeGraph({ nodes, viewSettings: { ...previous.viewSettings, layoutMode: "radial" } });
		expect(decideLayout(previous, next, 1.0)).toBe("relayout");
	});
});
