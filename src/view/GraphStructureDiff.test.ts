import { describe, expect, it } from "vitest";
import type { ForceLayoutSettings } from "../engine";
import { asVaultPath, FORCE_LAYOUT_RANGES } from "../engine";
import { SIZE_RELAYOUT_THRESHOLD } from "./constants";
import { decideLayout } from "./GraphStructureDiff";
import { NO_RENDERED_LAYOUT } from "./layoutFit";
import type { RenderedLayout } from "./layoutFit";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

describe("decideLayout structural identity", () => {
	// GIVEN a two-node, one-edge graph
	const base = makeGraph({
		nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
		edges: [makeEdge("a.md", "b.md")],
	});

	it("WHEN there is no previous graph THEN it relayouts", () => {
		expect(decideLayout(null, base, SIZE_RELAYOUT_THRESHOLD, NO_RENDERED_LAYOUT)).toBe("relayout");
	});

	it("WHEN node and edge structure are unchanged THEN it reuses the layout", () => {
		const next = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
			edges: [makeEdge("a.md", "b.md")],
		});
		expect(decideLayout(base, next, SIZE_RELAYOUT_THRESHOLD, NO_RENDERED_LAYOUT)).toBe("reuse-layout");
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
		expect(decideLayout(base, next, SIZE_RELAYOUT_THRESHOLD, NO_RENDERED_LAYOUT)).toBe("relayout");
	});

	it("WHEN an edge is added between the same nodes THEN it relayouts", () => {
		const next = makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md") }), makeNode({ path: asVaultPath("b.md") })],
			edges: [makeEdge("a.md", "b.md"), makeEdge("b.md", "a.md")],
		});
		expect(decideLayout(base, next, SIZE_RELAYOUT_THRESHOLD, NO_RENDERED_LAYOUT)).toBe("relayout");
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
		expect(decideLayout(base, next, SIZE_RELAYOUT_THRESHOLD, NO_RENDERED_LAYOUT)).toBe("reuse-layout");
	});
});

describe("decideLayout size-growth exception", () => {
	const previous = makeGraph({
		nodes: [makeNode({ path: asVaultPath("a.md"), sizePx: 50 })],
	});

	function nextWithSize(sizePx: number) {
		return makeGraph({
			nodes: [makeNode({ path: asVaultPath("a.md"), sizePx })],
		});
	}

	it("WHEN a surviving node grew by exactly the threshold THEN it still reuses the layout", () => {
		// +100% of 50 = 100; growth ratio 1.0 is NOT beyond the 1.0 threshold.
		expect(decideLayout(previous, nextWithSize(100), SIZE_RELAYOUT_THRESHOLD, NO_RENDERED_LAYOUT)).toBe("reuse-layout");
	});

	it("WHEN a surviving node grew just beyond the threshold THEN it relayouts", () => {
		expect(decideLayout(previous, nextWithSize(101), SIZE_RELAYOUT_THRESHOLD, NO_RENDERED_LAYOUT)).toBe("relayout");
	});

	it("WHEN a surviving node shrank THEN it reuses the layout", () => {
		expect(decideLayout(previous, nextWithSize(10), SIZE_RELAYOUT_THRESHOLD, NO_RENDERED_LAYOUT)).toBe("reuse-layout");
	});
});

describe("decideLayout size-override commit (drag-to-resize)", () => {
	// GIVEN two nodes whose boxes are pinned by overrides in BOTH builds (so the label
	// estimate plays no part), laid out side by side 100px apart: "a.md" at the origin
	// with a 100x100 box, "b.md" starting at x=200.
	const NEIGHBOUR_X = 200;
	function graphWithOverride(widthPx: number, heightPx: number) {
		return makeGraph({
			nodes: [
				makeNode({
					path: asVaultPath("a.md"),
					override: { sizePx: { widthPx, heightPx } },
				}),
				makeNode({
					path: asVaultPath("b.md"),
					override: { sizePx: { widthPx: 100, heightPx: 100 } },
				}),
			],
		});
	}
	const previous = graphWithOverride(100, 100);
	const rendered: RenderedLayout = {
		positions: new Map([
			["a.md", { x: 0, y: 0 }],
			["b.md", { x: NEIGHBOUR_X, y: 0 }],
		]),
		groupDimensions: new Map(),
	};

	it("WHEN a committed resize still fits where the node sits THEN it reuses the layout", () => {
		// The point of ticket nid_9ep12hkmk4zjv2p28emmrhieq_e: a resize with room to
		// spare must not re-arrange (and re-fit) the whole graph around it.
		expect(decideLayout(previous, graphWithOverride(150, 150), SIZE_RELAYOUT_THRESHOLD, rendered)).toBe("reuse-layout");
	});

	it("WHEN a committed resize now overlaps a neighbour THEN it relayouts", () => {
		expect(decideLayout(previous, graphWithOverride(250, 100), SIZE_RELAYOUT_THRESHOLD, rendered)).toBe("relayout");
	});

	it("WHEN a committed resize grew far beyond the growth threshold but still fits THEN it reuses the layout", () => {
		// +300% in height, nothing below it: the threshold damps PASSIVE growth only,
		// so it must not relayout a resize the fit rule has already cleared.
		expect(decideLayout(previous, graphWithOverride(100, 400), SIZE_RELAYOUT_THRESHOLD, rendered)).toBe("reuse-layout");
	});

	it("WHEN a fitting resize coincides with ANOTHER node's passive growth beyond the threshold THEN it relayouts", () => {
		// The threshold is skipped for the RESIZED node, never for the rebuild: a
		// blanket skip (any resize disarms the threshold) passes every other case here.
		// "b.md" grows +102% while sitting clear of the resized "a.md" — so the fit
		// rule says yes and the relayout can only come from the threshold.
		const PASSIVE_PREVIOUS_PX = 50;
		const PASSIVE_NEXT_PX = 101;
		function withPassiveGrower(overridePx: number, passivePx: number) {
			return makeGraph({
				nodes: [
					makeNode({
						path: asVaultPath("a.md"),
						override: { sizePx: { widthPx: overridePx, heightPx: overridePx } },
					}),
					makeNode({ path: asVaultPath("b.md"), sizePx: passivePx }),
				],
			});
		}
		expect(
			decideLayout(
				withPassiveGrower(100, PASSIVE_PREVIOUS_PX),
				withPassiveGrower(150, PASSIVE_NEXT_PX),
				SIZE_RELAYOUT_THRESHOLD,
				rendered,
			),
		).toBe("relayout");
	});

	it("WHEN a committed resize shrank the node THEN it reuses the layout", () => {
		// A smaller box can collide with nothing; the gap it leaves is the user's own doing.
		expect(decideLayout(previous, graphWithOverride(30, 30), SIZE_RELAYOUT_THRESHOLD, rendered)).toBe("reuse-layout");
	});

	it("WHEN a resize commits a box IDENTICAL to the stored one THEN it reuses the layout", () => {
		// Values, not identity: a rebuild re-reads `data.json` into a fresh object
		// every time, so an identity check would relayout on every unrelated rebuild.
		expect(decideLayout(previous, graphWithOverride(100, 100), SIZE_RELAYOUT_THRESHOLD, NO_RENDERED_LAYOUT)).toBe(
			"reuse-layout",
		);
	});

	it("WHEN a node GAINS a size override that no longer fits THEN it relayouts", () => {
		const unoverridden = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("a.md") }),
				makeNode({
					path: asVaultPath("b.md"),
					override: { sizePx: { widthPx: 100, heightPx: 100 } },
				}),
			],
		});
		expect(decideLayout(unoverridden, graphWithOverride(250, 100), SIZE_RELAYOUT_THRESHOLD, rendered)).toBe("relayout");
	});

	it("WHEN 'Reset size' CLEARS a node's override THEN it reuses the layout", () => {
		// The computed box is usually SMALLER, so it fits by construction — the hole it
		// leaves behind is not worth re-arranging the whole graph for.
		const unoverridden = makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("a.md") }),
				makeNode({
					path: asVaultPath("b.md"),
					override: { sizePx: { widthPx: 100, heightPx: 100 } },
				}),
			],
		});
		expect(decideLayout(previous, unoverridden, SIZE_RELAYOUT_THRESHOLD, rendered)).toBe("reuse-layout");
	});

	it("WHEN there is no rendered geometry to judge the new box against THEN it relayouts", () => {
		// Conservative: a fit that cannot be verified is not claimed.
		expect(decideLayout(previous, graphWithOverride(150, 150), SIZE_RELAYOUT_THRESHOLD, NO_RENDERED_LAYOUT)).toBe(
			"relayout",
		);
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
		expect(decideLayout(previous, next, 1.0, NO_RENDERED_LAYOUT)).toBe("relayout");
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
					forceLayout: {
						...previous.viewSettings.forceLayout,
						[field]: bumpedPastRangeMax,
					},
				},
			});
			expect(decideLayout(previous, next, 1.0, NO_RENDERED_LAYOUT)).toBe("relayout");
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
		expect(decideLayout(previous, next, 1.0, NO_RENDERED_LAYOUT)).toBe("reuse-layout");
	});
});
