import { describe, expect, it } from "vitest";
import { EngineDefaults, NEUTRAL_NORMALIZED_VALUE } from "./constants";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { FakeVaultSpec } from "./FakeLinkProvider";
import { VicinityTraversal } from "./VicinityTraversal";
import type { NodeSize } from "./NodeSizer";
import { NodeSizer } from "./NodeSizer";
import type { SizeMetricId, SizingSettings, VaultPath } from "./types";
import { asVaultPath } from "./types";

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
		depths: { outgoingDepth: 1, incomingDepth: 1 },
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
			{ descriptor: { path: asVaultPath("m.md") }, depths: { outgoingDepth: 2, incomingDepth: 0 } },
		]);
		const sizes = new NodeSizer(provider).computeSizes(traversal.nodes, sizingWith({ "depth-decay": 1 }));
		expect(score(sizes, "b.md")).toBeCloseTo(1 / 3);
	});

	it("WHEN k=4 THEN the decay steepens accordingly", () => {
		const provider = new FakeLinkProvider(spec);
		const traversal = new VicinityTraversal(provider).traverse([
			{ descriptor: { path: asVaultPath("m.md") }, depths: { outgoingDepth: 2, incomingDepth: 0 } },
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
 * at depth 1; `k = Infinity` makes `Infinity * 0 = NaN` at the root.)
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
			{ descriptor: { path: asVaultPath("m.md") }, depths: { outgoingDepth: 2, incomingDepth: 0 } },
		]);
		const sizes = new NodeSizer(provider).computeSizes(traversal.nodes, settings);
		return [...sizes.values()].map((size) => size.sizePx);
	}

	it.each([
		["k = -1 (the 1 + k * minDepth singularity at depth 1)", -1],
		["k = Infinity (Infinity * 0 = NaN at the root)", Number.POSITIVE_INFINITY],
		["k = NaN", Number.NaN],
	])("WHEN depth decay has %s THEN every sizePx is finite", (_case, depthDecayK) => {
		expect(everySizePx(sizingWith({ "depth-decay": 1 }, depthDecayK)).every(Number.isFinite)).toBe(true);
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
