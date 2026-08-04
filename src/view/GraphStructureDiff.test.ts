import { describe, expect, it } from "vitest";
import type { ForceLayoutSettings } from "../engine";
import { asVaultPath, FORCE_LAYOUT_RANGES } from "../engine";
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

	it("WHEN two builds differ ONLY in nodePreviewPreference THEN it reuses the layout", () => {
		// The tripwire for the Preview pill: flipping it must stay a data-only
		// refresh. What this pins is that nobody adds a
		// `previous.viewSettings.nodePreviewPreference !== next…` trigger to
		// `decideLayout` — the fixture's sizePx is fixed, so a future coupling of
		// node SIZE to the preview would slip past HERE; that half is pinned where
		// sizes are produced: `NodeSizer.test.ts`, `VicinityEngine.test.ts` and
		// `flowMapping.test.ts`.
		const next = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
			edges: [makeEdge("a.md", "b.md")],
			viewSettings: { ...base.viewSettings, nodePreviewPreference: "image" },
		});
		expect(decideLayout(base, next, SIZE_RELAYOUT_THRESHOLD)).toBe("reuse-layout");
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

describe("decideLayout size-override growth (drag-to-resize commit)", () => {
	// GIVEN a node whose box is pinned by an override in BOTH builds, so the label
	// estimate plays no part and the growth ratio is exactly the override's.
	function graphWithOverride(widthPx: number, heightPx: number) {
		return makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md"), override: { sizePx: { widthPx, heightPx } } })],
		});
	}
	const previous = graphWithOverride(100, 100);

	it("WHEN a committed resize grew the HEIGHT just beyond the threshold THEN it relayouts", () => {
		expect(decideLayout(previous, graphWithOverride(100, 201), SIZE_RELAYOUT_THRESHOLD)).toBe("relayout");
	});

	it("WHEN a committed resize grew the WIDTH just beyond the threshold THEN it relayouts", () => {
		// Width growth alone must count: the raw engine sizePx is unchanged here.
		expect(decideLayout(previous, graphWithOverride(201, 100), SIZE_RELAYOUT_THRESHOLD)).toBe("relayout");
	});

	it("WHEN a committed resize stays within the threshold THEN it STILL relayouts", () => {
		// The whole point of the override rule: the growth threshold is for PASSIVE
		// engine growth, and a sub-threshold resize used to keep the stale positions
		// (grown node overlapping its neighbours / spilling out of its group box).
		expect(decideLayout(previous, graphWithOverride(200, 200), SIZE_RELAYOUT_THRESHOLD)).toBe("relayout");
	});

	it("WHEN a committed resize shrank the node THEN it relayouts", () => {
		expect(decideLayout(previous, graphWithOverride(30, 30), SIZE_RELAYOUT_THRESHOLD)).toBe("relayout");
	});

	it("WHEN a resize commits a box IDENTICAL to the stored one THEN it reuses the layout", () => {
		// Values, not identity: a rebuild re-reads `data.json` into a fresh object
		// every time, so an identity check would relayout on every unrelated rebuild.
		expect(decideLayout(previous, graphWithOverride(100, 100), SIZE_RELAYOUT_THRESHOLD)).toBe("reuse-layout");
	});

	it("WHEN a node GAINS a size override THEN it relayouts", () => {
		const unoverridden = makeGraph({ nodes: [makeNode({ path: asVaultPath("a.md") })] });
		expect(decideLayout(unoverridden, graphWithOverride(100, 100), SIZE_RELAYOUT_THRESHOLD)).toBe("relayout");
	});

	it("WHEN 'Reset size' CLEARS a node's override THEN it relayouts", () => {
		// The computed box is usually SMALLER, so the threshold never fired here and
		// the reset left a hole in the layout where the big box had been.
		const unoverridden = makeGraph({ nodes: [makeNode({ path: asVaultPath("a.md") })] });
		expect(decideLayout(previous, unoverridden, SIZE_RELAYOUT_THRESHOLD)).toBe("relayout");
	});
});

describe("decideLayout force-layout tuning change (ticket-04 live sliders)", () => {
	const nodes = [makeNode({ path: asVaultPath("a.md") })];
	const previous = makeGraph({ nodes });

	it("WHEN only a force-layout value changed THEN a relayout is forced (sliders must take effect live)", () => {
		const next = makeGraph({
			nodes,
			viewSettings: {
				...previous.viewSettings,
				forceLayout: { ...previous.viewSettings.forceLayout, linkGapPx: 90 },
			},
		});
		expect(decideLayout(previous, next, 1.0)).toBe("relayout");
	});

	// Every field, not just one: guards the comparison against silently dropping a
	// field (review finding — a missed field means that slider never takes effect).
	it.each(Object.keys(FORCE_LAYOUT_RANGES) as (keyof ForceLayoutSettings)[])(
		"WHEN only the %s force-layout field changed THEN a relayout is forced",
		(field) => {
			const bumpedPastRangeMax = FORCE_LAYOUT_RANGES[field].max + 1; // differs from ANY in-range value
			const next = makeGraph({
				nodes,
				viewSettings: {
					...previous.viewSettings,
					forceLayout: { ...previous.viewSettings.forceLayout, [field]: bumpedPastRangeMax },
				},
			});
			expect(decideLayout(previous, next, 1.0)).toBe("relayout");
		},
	);

	it("WHEN force-layout values are equal but the object identity differs THEN the layout is still reused", () => {
		const next = makeGraph({
			nodes,
			viewSettings: {
				...previous.viewSettings,
				forceLayout: { ...previous.viewSettings.forceLayout },
			},
		});
		expect(decideLayout(previous, next, 1.0)).toBe("reuse-layout");
	});
});
