import { describe, expect, it } from "vitest";
import { EngineDefaults, NEUTRAL_NORMALIZED_VALUE, THUMBNAIL_VISIBLE_MIN_NODE_PX } from "./constants";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { FakeVaultSpec } from "./FakeLinkProvider";
import { VicinityTraversal } from "./VicinityTraversal";
import type { NodeSize } from "./NodeSizer";
import { DepthDecayMetric, NodeSizer } from "./NodeSizer";
import type { NodePreviewPreference, SizeMetricId, SizingSettings, VaultPath, ViewSettings } from "./types";
import { asVaultPath, NODE_PREVIEW_PREFERENCES } from "./types";

/** Sizing settings with exactly the given metrics enabled (weight 1 unless given). */
function sizingWith(enabled: Partial<Record<SizeMetricId, number>>, depthDecayK = 1): SizingSettings {
	const defaults = EngineDefaults.sizingSettings();
	const metrics = Object.fromEntries(
		Object.keys(defaults.metrics).map((id) => [
			id,
			{ enabled: id in enabled, weight: enabled[id as SizeMetricId] ?? 1 },
		]),
	) as SizingSettings["metrics"];
	return { ...defaults, metrics, depthDecayK };
}

/** Traverses every .md file as a root at depth 1 and sizes the union. */
function sizeAll(
	spec: FakeVaultSpec,
	settings: SizingSettings,
	rootPaths?: readonly string[],
): ReadonlyMap<VaultPath, NodeSize> {
	const provider = new FakeLinkProvider(spec);
	const roots = (rootPaths ?? spec.files.map((f) => f.path)).map((path) => ({
		descriptor: { path: asVaultPath(path) },
		depths: { linkDepthOut: 1, linkDepthIn: 1 },
	}));
	const traversal = new VicinityTraversal(provider).traverse(roots);
	return new NodeSizer(provider).computeSizes(traversal.nodes, settings);
}

function score(sizes: ReadonlyMap<VaultPath, NodeSize>, path: string): number | undefined {
	return sizes.get(asVaultPath(path))?.sizeScore;
}

describe("NodeSizer own-file-size metric", () => {
	// GIVEN main.md linking a tiny, a middle and one huge note (log1p normalization)
	const spec: FakeVaultSpec = {
		files: [
			{ path: "main.md", sizeBytes: 10 },
			{ path: "tiny.md", sizeBytes: 10 },
			{ path: "mid.md", sizeBytes: 10_000 },
			{ path: "huge.md", sizeBytes: 100_000_000 },
		],
		links: { "main.md": ["tiny.md", "mid.md", "huge.md"] },
	};

	it("WHEN one note is huge THEN it gets the top normalized score", () => {
		const sizes = sizeAll(spec, sizingWith({ "own-file-size": 1 }), ["main.md"]);
		expect(score(sizes, "huge.md")).toBe(1);
	});

	it("WHEN one note is the smallest THEN it gets the bottom normalized score", () => {
		const sizes = sizeAll(spec, sizingWith({ "own-file-size": 1 }), ["main.md"]);
		expect(score(sizes, "tiny.md")).toBe(0);
	});

	it("WHEN normalization is logarithmic THEN a huge outlier does not flatten the midfield", () => {
		const sizes = sizeAll(spec, sizingWith({ "own-file-size": 1 }), ["main.md"]);
		// Linear normalization would put mid.md at ~0.0001; log1p keeps it meaningfully sized.
		expect(score(sizes, "mid.md")).toBeGreaterThan(0.3);
	});

	it("WHEN all notes are zero-byte THEN every non-central gets the neutral score", () => {
		const sizes = sizeAll(
			{ files: [{ path: "m.md" }, { path: "a.md" }, { path: "b.md" }], links: { "m.md": ["a.md", "b.md"] } },
			sizingWith({ "own-file-size": 1 }),
			["m.md"],
		);
		expect(score(sizes, "a.md")).toBe(NEUTRAL_NORMALIZED_VALUE);
	});

	it("WHEN the graph has a single node THEN it still sizes without NaN (neutral for non-central case is moot; central gets 1)", () => {
		const sizes = sizeAll({ files: [{ path: "solo.md", sizeBytes: 123 }] }, sizingWith({ "own-file-size": 1 }));
		expect(score(sizes, "solo.md")).toBe(1);
	});
});

describe("NodeSizer link-based metrics", () => {
	// GIVEN hub.md is linked by two notes, spoke.md by none (beyond traversal roots)
	const spec: FakeVaultSpec = {
		files: [
			{ path: "m.md", sizeBytes: 100 },
			{ path: "x.md", sizeBytes: 300 },
			{ path: "hub.md" },
			{ path: "spoke.md" },
			{ path: "pic.png" },
		],
		links: { "m.md": ["hub.md", "spoke.md", "pic.png"], "x.md": ["hub.md"] },
	};

	it("WHEN backlink-count is enabled THEN the most-linked node scores highest", () => {
		const sizes = sizeAll(spec, sizingWith({ "backlink-count": 1 }), ["m.md", "x.md"]);
		expect(score(sizes, "hub.md")).toBe(1);
	});

	it("WHEN total-linker-size is enabled THEN linker byte sizes drive the score", () => {
		// hub is linked by m(100)+x(300)=400 bytes of linkers; spoke by m(100) only.
		const sizes = sizeAll(spec, sizingWith({ "total-linker-size": 1 }), ["m.md", "x.md"]);
		expect((score(sizes, "hub.md") ?? 0) > (score(sizes, "spoke.md") ?? 0)).toBe(true);
	});

	it("WHEN outlink-count is enabled THEN links to attachments do not count", () => {
		// Rooting at hub keeps m.md non-central: m.md links hub, spoke and pic.png,
		// but only its 2 node-bearing outlinks count (x.md has 1, hub.md has 0).
		const sizes = sizeAll(spec, sizingWith({ "outlink-count": 1 }), ["hub.md"]);
		expect(score(sizes, "m.md")).toBe(1);
	});
});

describe("NodeSizer depth-decay metric", () => {
	// GIVEN a chain m -> a -> b traversed from m at depth 2
	const spec: FakeVaultSpec = {
		files: [{ path: "m.md" }, { path: "a.md" }, { path: "b.md" }],
		links: { "m.md": ["a.md"], "a.md": ["b.md"] },
	};

	it("WHEN k=1 THEN a depth-2 node scores 1/(1+2)", () => {
		const provider = new FakeLinkProvider(spec);
		const traversal = new VicinityTraversal(provider).traverse([
			{ descriptor: { path: asVaultPath("m.md") }, depths: { linkDepthOut: 2, linkDepthIn: 0 } },
		]);
		const sizes = new NodeSizer(provider).computeSizes(traversal.nodes, sizingWith({ "depth-decay": 1 }));
		expect(score(sizes, "b.md")).toBeCloseTo(1 / 3);
	});

	it("WHEN k=4 THEN the decay steepens accordingly", () => {
		const provider = new FakeLinkProvider(spec);
		const traversal = new VicinityTraversal(provider).traverse([
			{ descriptor: { path: asVaultPath("m.md") }, depths: { linkDepthOut: 2, linkDepthIn: 0 } },
		]);
		const sizes = new NodeSizer(provider).computeSizes(traversal.nodes, sizingWith({ "depth-decay": 1 }, 4));
		expect(score(sizes, "b.md")).toBeCloseTo(1 / 9);
	});
});

/**
 * `sizePx` becomes a React-Flow node width/height and then a libavoid obstacle —
 * a non-finite one ABORTS the router's wasm module for the whole session. The
 * sizer is therefore TOTAL: no settings object, however hostile, produces a
 * non-finite size. (`depthDecayK = -1` divides `1 / (1 + k * minDepth)` by zero
 * at depth 1.)
 *
 * Honest scope, measured by deleting the clamp and re-running: `k = -1`,
 * `k = NaN`, non-finite `minPx`/`maxPx` and an `Infinity` weight each go RED
 * without it. The `k = Infinity` row does NOT — see the coupling test below for
 * why that scenario was never reachable; it is kept only because the ticket
 * lists it as an acceptance criterion.
 */
describe("NodeSizer hostile sizing settings (sizePx stays finite)", () => {
	// GIVEN a chain m -> a -> b traversed from m at depth 2 (depths 0, 1, 2)
	const spec: FakeVaultSpec = {
		files: [{ path: "m.md" }, { path: "a.md" }, { path: "b.md" }],
		links: { "m.md": ["a.md"], "a.md": ["b.md"] },
	};

	function everySizePx(settings: SizingSettings): readonly number[] {
		const provider = new FakeLinkProvider(spec);
		const traversal = new VicinityTraversal(provider).traverse([
			{ descriptor: { path: asVaultPath("m.md") }, depths: { linkDepthOut: 2, linkDepthIn: 0 } },
		]);
		const sizes = new NodeSizer(provider).computeSizes(traversal.nodes, settings);
		return [...sizes.values()].map((size) => size.sizePx);
	}

	it.each([
		["k = -1 (the 1 + k * minDepth singularity at depth 1)", -1],
		["k = Infinity", Number.POSITIVE_INFINITY],
		["k = NaN", Number.NaN],
	])("WHEN depth decay has %s THEN every sizePx is finite", (_case, depthDecayK) => {
		expect(everySizePx(sizingWith({ "depth-decay": 1 }, depthDecayK)).every(Number.isFinite)).toBe(true);
	});

	/**
	 * The ticket predicted `k = Infinity` -> `Infinity * 0 = NaN` at the root.
	 * That product is computed but never used: `minDepth === 0` holds for roots
	 * ONLY (neighbours are tagged `currentDepth + 1`), and roots are exactly the
	 * centrals, which bypass metric composition for {@link CENTRAL_SIZE_SCORE}.
	 * This test pins THAT coupling — the thing that would have to break for the
	 * predicted NaN to become reachable.
	 */
	it("WHEN a node is not central THEN its minDepth is at least 1 (no non-central multiplies k by 0)", () => {
		const provider = new FakeLinkProvider(spec);
		const traversal = new VicinityTraversal(provider).traverse([
			{ descriptor: { path: asVaultPath("m.md") }, depths: { linkDepthOut: 2, linkDepthIn: 0 } },
		]);
		const nonCentralDepths = [...traversal.nodes.values()]
			.filter((node) => !node.isCentral)
			.map((node) => node.minDepth)
			.sort();
		expect(nonCentralDepths).toEqual([1, 2]); // a.md, b.md — never 0.
	});

	it.each([
		["minPx", Number.POSITIVE_INFINITY],
		["maxPx", Number.NaN],
	])("WHEN %s is non-finite THEN every sizePx is finite", (field, value) => {
		const settings = { ...sizingWith({ "own-file-size": 1 }), [field]: value };
		expect(everySizePx(settings).every(Number.isFinite)).toBe(true);
	});

	it("WHEN a metric weight is Infinity THEN every sizePx is finite (the weighted average keeps a usable divisor)", () => {
		const settings = sizingWith({ "own-file-size": Number.POSITIVE_INFINITY });
		expect(everySizePx(settings).every(Number.isFinite)).toBe(true);
	});
});

/**
 * The metric's OWN guard, exercised directly because `computeSizes` clamps `k`
 * before construction and so can never reach it (see the class doc). Without
 * these two tests the guard is deletable with the whole suite still green.
 */
describe("DepthDecayMetric is total for an unvetted k", () => {
	// GIVEN the same m -> a -> b chain: minDepth 0, 1, 2.
	const spec: FakeVaultSpec = {
		files: [{ path: "m.md" }, { path: "a.md" }, { path: "b.md" }],
		links: { "m.md": ["a.md"], "a.md": ["b.md"] },
	};

	function decayedValue(k: number, path: string): number | undefined {
		const provider = new FakeLinkProvider(spec);
		const traversal = new VicinityTraversal(provider).traverse([
			{ descriptor: { path: asVaultPath("m.md") }, depths: { linkDepthOut: 2, linkDepthIn: 0 } },
		]);
		return new DepthDecayMetric(k).normalizedValues(traversal.nodes).get(asVaultPath(path));
	}

	it("WHEN k = -1 THEN the depth-1 node's vanishing denominator yields the neutral value, not Infinity", () => {
		expect(decayedValue(-1, "a.md")).toBe(NEUTRAL_NORMALIZED_VALUE);
	});

	it("WHEN k is Infinity THEN the depth-0 node's Infinity * 0 yields the neutral value, not NaN", () => {
		expect(decayedValue(Number.POSITIVE_INFINITY, "m.md")).toBe(NEUTRAL_NORMALIZED_VALUE);
	});
});

describe("NodeSizer metric composition", () => {
	// GIVEN two metrics with different weights over m -> [a, b]
	const spec: FakeVaultSpec = {
		files: [
			{ path: "m.md" },
			{ path: "a.md", sizeBytes: 1000 }, // big file, no backlinks beyond m
			{ path: "b.md", sizeBytes: 0 },
		],
		links: { "m.md": ["a.md", "b.md"], "b.md": ["a.md"] },
	};

	it("WHEN a metric is toggled off THEN it contributes nothing to the score", () => {
		// own-file-size disabled → only backlink-count counts → a.md (2 backlinks) tops.
		const sizes = sizeAll(spec, sizingWith({ "backlink-count": 1 }), ["m.md"]);
		expect(score(sizes, "a.md")).toBe(1);
	});

	it("WHEN two metrics are weighted THEN the score is the weighted average", () => {
		// b.md: own-file-size 0 (smallest), backlink-count 0.5 (1 of max 2)
		// → (3 * 0 + 1 * 0.5) / (3 + 1) = 0.125.
		const sizes = sizeAll(spec, sizingWith({ "own-file-size": 3, "backlink-count": 1 }), ["m.md"]);
		expect(score(sizes, "b.md")).toBeCloseTo(0.125);
	});

	it("WHEN no metric is enabled THEN non-centrals get the neutral score", () => {
		const sizes = sizeAll(spec, sizingWith({}), ["m.md"]);
		expect(score(sizes, "a.md")).toBe(NEUTRAL_NORMALIZED_VALUE);
	});

	it("WHEN scores map to pixels THEN the pixel range endpoints are honored", () => {
		const settings = { ...sizingWith({ "own-file-size": 1 }), minPx: 10, maxPx: 20 };
		const sizes = sizeAll(spec, settings, ["m.md"]);
		expect(sizes.get(asVaultPath("b.md"))?.sizePx).toBe(10);
	});
});

describe("NodeSizer central sizing", () => {
	it("WHEN a node is central THEN it gets the top score regardless of metrics", () => {
		// m.md is tiny yet central.
		const sizes = sizeAll(
			{
				files: [
					{ path: "m.md", sizeBytes: 0 },
					{ path: "a.md", sizeBytes: 99999 },
				],
				links: { "m.md": ["a.md"] },
			},
			sizingWith({ "own-file-size": 1 }),
			["m.md"],
		);
		expect(score(sizes, "m.md")).toBe(1);
	});

	it("WHEN a pinned central is disconnected from MAIN THEN it still gets central sizing", () => {
		const sizes = sizeAll(
			{
				files: [
					{ path: "main.md", sizeBytes: 10 },
					{ path: "island.md", sizeBytes: 0 },
				],
			},
			sizingWith({ "own-file-size": 1 }),
			["main.md", "island.md"],
		);
		expect(score(sizes, "island.md")).toBe(1);
	});
});

/**
 * A note that HAS an image must be tall enough for the stylesheet to actually
 * reveal its thumbnail — otherwise a low-relevance note's image is simply never
 * shown. The floor is geometry-only (`sizePx`); `sizeScore` stays pure relevance
 * because it also ranks truncation.
 */
describe("NodeSizer image-bearing height floor", () => {
	// GIVEN a hub whose small neighbour embeds an image and whose big one does not
	const spec: FakeVaultSpec = {
		files: [
			{ path: "m.md", sizeBytes: 10 },
			{ path: "withImage.md", sizeBytes: 0 },
			{ path: "pic.png" },
			{ path: "plain.md", sizeBytes: 5000 },
		],
		links: { "m.md": ["withImage.md", "plain.md"], "withImage.md": ["pic.png"] },
	};

	function pxOf(settings: SizingSettings, path: string): number | undefined {
		return sizeAll(spec, settings, ["m.md"]).get(asVaultPath(path))?.sizePx;
	}

	const bottomScoring = { ...sizingWith({ "own-file-size": 1 }), minPx: 40, maxPx: 160 };

	it("WHEN a bottom-scoring note has an image THEN its height is floored at the thumbnail threshold", () => {
		expect(pxOf(bottomScoring, "withImage.md")).toBe(THUMBNAIL_VISIBLE_MIN_NODE_PX);
	});

	it("WHEN a bottom-scoring note has NO image THEN its height stays the score-driven minimum", () => {
		const sizes = sizeAll(
			{ ...spec, files: spec.files.map((f) => (f.path === "plain.md" ? { ...f, sizeBytes: 0 } : f)) },
			bottomScoring,
			["m.md"],
		);
		expect(sizes.get(asVaultPath("plain.md"))?.sizePx).toBe(bottomScoring.minPx);
	});

	it("WHEN the floor exceeds the user's maxPx THEN the node is capped at maxPx", () => {
		const cramped = { ...bottomScoring, maxPx: THUMBNAIL_VISIBLE_MIN_NODE_PX - 20 };
		expect(pxOf(cramped, "withImage.md")).toBe(cramped.maxPx);
	});

	it("WHEN an image note already scores above the floor THEN its height is untouched", () => {
		const tall = { ...bottomScoring, minPx: THUMBNAIL_VISIBLE_MIN_NODE_PX + 20 };
		expect(pxOf(tall, "withImage.md")).toBe(tall.minPx);
	});

	it("WHEN sizing settings are inverted (minPx > maxPx) THEN the floor never shrinks an image node", () => {
		// `clampSizingSettings` bounds each field independently, so minPx > maxPx is
		// reachable at the engine boundary — the floor must stay a floor there.
		const inverted = { ...bottomScoring, minPx: THUMBNAIL_VISIBLE_MIN_NODE_PX + 40, maxPx: 50 };
		expect(pxOf(inverted, "withImage.md")).toBe(inverted.minPx);
	});

	it("WHEN an image note is central THEN it keeps the full central height", () => {
		const sizes = sizeAll(
			{
				files: [{ path: "m.md" }, { path: "pic.png" }],
				links: { "m.md": ["pic.png"] },
			},
			bottomScoring,
			["m.md"],
		);
		expect(sizes.get(asVaultPath("m.md"))?.sizePx).toBe(bottomScoring.maxPx);
	});

	it("WHEN a bottom-scoring note has an image THEN its sizeScore stays the composed relevance", () => {
		// The floor is geometry: promoting the score would also promote the node in
		// truncation ranking (NodePriorityChain), which it must not.
		expect(score(sizeAll(spec, bottomScoring, ["m.md"]), "withImage.md")).toBe(0);
	});
});

/**
 * CLARIFICATION requirement 3 of `node-content-preference`: flipping the node
 * preview pill re-renders node CONTENT only. If `sizePx` ever moved with the
 * preference, every flip would cross `SIZE_RELAYOUT_THRESHOLD` and force a full
 * relayout instead of the data-only refresh the pill promises.
 *
 * WHY-NOT in `GraphStructureDiff.test.ts`: that fixture hands `decideLayout` its
 * sizes, so a coupling introduced INSIDE the sizer slips straight past it. The
 * invariant belongs where `sizePx` is produced.
 *
 * To make this bite rather than pass vacuously, the settings object handed to
 * `computeSizes` deliberately CARRIES the preference: a future sizer that widens
 * its parameter to read it goes red here instead of shipping.
 */
describe("NodeSizer node preview preference independence", () => {
	// GIVEN a hub whose neighbours differ in file size, so sizes actually spread
	const spec: FakeVaultSpec = {
		files: [
			{ path: "m.md", sizeBytes: 10 },
			{ path: "a.md", sizeBytes: 5000 },
			{ path: "b.md", sizeBytes: 0 },
		],
		links: { "m.md": ["a.md", "b.md"], "b.md": ["a.md"] },
	};

	function sizesUnderPreference(preference: NodePreviewPreference): readonly NodeSize[] {
		const viewSettings: ViewSettings = { ...EngineDefaults.viewSettings(), nodePreviewPreference: preference };
		const settings = { ...viewSettings.sizing, nodePreviewPreference: viewSettings.nodePreviewPreference };
		return [...sizeAll(spec, settings, ["m.md"]).values()];
	}

	it("WHEN only nodePreviewPreference varies THEN every node keeps the same sizeScore and sizePx", () => {
		const baseline = sizesUnderPreference(NODE_PREVIEW_PREFERENCES[0]);
		// Keyed by preference so a failure names the offending value.
		const actual = Object.fromEntries(NODE_PREVIEW_PREFERENCES.map((p) => [p, sizesUnderPreference(p)]));
		expect(actual).toEqual(Object.fromEntries(NODE_PREVIEW_PREFERENCES.map((p) => [p, baseline])));
	});
});
