import { describe, expect, it } from "vitest";
import {
	CENTRAL_PROMINENCE_FLOOR_SCORE,
	EngineDefaults,
	ESTIMATED_ATTACHMENT_ROW_PX,
	ESTIMATED_OUTLINE_ENTRY_PX,
	ESTIMATED_TITLE_LINE_PX,
	NODE_REGION_GAP_PX,
	NODE_VERTICAL_CHROME_PX,
	THUMBNAIL_VISIBLE_MIN_NODE_PX,
} from "./constants";
import { FakeLinkProvider } from "./FakeLinkProvider";
import type { FakeVaultSpec } from "./FakeLinkProvider";
import { VicinityTraversal } from "./VicinityTraversal";
import type { NodeSizingView } from "./NodeSizer";
import { NodeSizer } from "./NodeSizer";
import type { OutlineEntry, VaultPath } from "./types";
import { asVaultPath } from "./types";

/**
 * EXPLICIT ALIGNMENT (node-sizing rethink, ticket nid_cx5zoz7ptucg9nxalibv0mbjb_e,
 * owner-decided 2026-08-03): this file previously captured the metric-dial
 * behavior (own-file-size / total-linker-size / backlink-count / outlink-count /
 * depth-decay composition, score normalization, the central maxPx bypass and the
 * preference-independent image floor). The metric dials were REMOVED and the
 * central bypass replaced by a prominence floor, so those tests were replaced —
 * not silently deleted — by the content-fit suite below.
 */

/** The sizer's view knobs at the shipped defaults, with per-test overrides. */
function viewWith(overrides: Partial<NodeSizingView> = {}): NodeSizingView {
	const defaults = EngineDefaults.viewSettings();
	return {
		sizing: defaults.sizing,
		outlineMaxDepth: defaults.outlineMaxDepth,
		nodePreviewPreference: defaults.nodePreviewPreference,
		...overrides,
	};
}

/** Traverses from the given roots (default: every .md file) and sizes the union. */
function sizeAll(
	spec: FakeVaultSpec,
	view: NodeSizingView,
	rootPaths?: readonly string[],
): ReadonlyMap<VaultPath, number> {
	const provider = new FakeLinkProvider(spec);
	const roots = (rootPaths ?? spec.files.map((f) => f.path)).map((path) => ({
		descriptor: { path: asVaultPath(path) },
		depths: { linkDepthOut: 1, embedDepthOut: 1, linkDepthIn: 1 },
	}));
	const traversal = new VicinityTraversal(provider).traverse(roots);
	return NodeSizer.computeSizes(traversal.nodes, view);
}

function sizeOf(sizes: ReadonlyMap<VaultPath, number>, path: string): number {
	const size = sizes.get(asVaultPath(path));
	if (size === undefined) {
		throw new Error(`no size computed for path=[${path}]`);
	}
	return size;
}

function headings(count: number, level = 1): OutlineEntry[] {
	return Array.from({ length: count }, (_, i) => ({ rawText: `H${i + 1}`, level }));
}

const DEFAULTS = EngineDefaults.sizingSettings();
const DEFAULT_CENTRAL_FLOOR_PX = Math.round(
	DEFAULTS.minPx + CENTRAL_PROMINENCE_FLOOR_SCORE * (DEFAULTS.maxPx - DEFAULTS.minPx),
);

describe("NodeSizer central prominence floor (rethink Q2)", () => {
	// GIVEN an EMPTY central note (no outline, no image, no attachments)
	const emptyCentral: FakeVaultSpec = { files: [{ path: "m.md" }, { path: "a.md" }], links: { "m.md": ["a.md"] } };

	it("WHEN an empty note is central THEN it no longer renders at maxPx", () => {
		const sizes = sizeAll(emptyCentral, viewWith(), ["m.md"]);
		expect(sizeOf(sizes, "m.md")).toBeLessThan(DEFAULTS.maxPx);
	});

	it("WHEN an empty note is central THEN it sits exactly at the prominence floor", () => {
		const sizes = sizeAll(emptyCentral, viewWith(), ["m.md"]);
		expect(sizeOf(sizes, "m.md")).toBe(DEFAULT_CENTRAL_FLOOR_PX);
	});

	it("WHEN an empty note is a PINNED central (second root) THEN it gets the same floor", () => {
		// Both roots are centrals; a.md stands in for a pinned, content-empty note.
		const sizes = sizeAll(emptyCentral, viewWith(), ["m.md", "a.md"]);
		expect(sizeOf(sizes, "a.md")).toBe(DEFAULT_CENTRAL_FLOOR_PX);
	});

	it("WHEN a central has a large outline THEN its content-fit grows past the floor", () => {
		const sizes = sizeAll(
			{ files: [{ path: "m.md", outline: headings(8) }] },
			viewWith(),
			["m.md"],
		);
		expect(sizeOf(sizes, "m.md")).toBeGreaterThan(DEFAULT_CENTRAL_FLOOR_PX);
	});

	it("WHEN an empty non-central sits beside an empty central THEN the central is the larger box", () => {
		const sizes = sizeAll(emptyCentral, viewWith(), ["m.md"]);
		expect(sizeOf(sizes, "m.md")).toBeGreaterThan(sizeOf(sizes, "a.md"));
	});
});

describe("NodeSizer content fit (rethink Q1: size follows what the node shows)", () => {
	it("WHEN a note shows only its short title THEN it clamps to minPx", () => {
		const sizes = sizeAll({ files: [{ path: "m.md" }, { path: "a.md" }], links: { "m.md": ["a.md"] } }, viewWith(), [
			"m.md",
		]);
		expect(sizeOf(sizes, "a.md")).toBe(DEFAULTS.minPx);
	});

	it("WHEN a note has more renderable outline entries THEN its node is taller", () => {
		const sizes = sizeAll(
			{
				files: [{ path: "m.md" }, { path: "few.md", outline: headings(2) }, { path: "many.md", outline: headings(5) }],
				links: { "m.md": ["few.md", "many.md"] },
			},
			viewWith(),
			["m.md"],
		);
		expect(sizeOf(sizes, "many.md")).toBeGreaterThan(sizeOf(sizes, "few.md"));
	});

	it("WHEN the outline fit is computed THEN it is title + entries + chrome + gaps exactly", () => {
		const sizes = sizeAll(
			{ files: [{ path: "m.md" }, { path: "a.md", outline: headings(3) }], links: { "m.md": ["a.md"] } },
			viewWith(),
			["m.md"],
		);
		const expected =
			NODE_VERTICAL_CHROME_PX + ESTIMATED_TITLE_LINE_PX + NODE_REGION_GAP_PX + 3 * ESTIMATED_OUTLINE_ENTRY_PX;
		expect(sizeOf(sizes, "a.md")).toBe(expected);
	});

	it("WHEN a note has a huge outline THEN the node clamps at maxPx", () => {
		const sizes = sizeAll(
			{ files: [{ path: "m.md" }, { path: "a.md", outline: headings(40) }], links: { "m.md": ["a.md"] } },
			viewWith(),
			["m.md"],
		);
		expect(sizeOf(sizes, "a.md")).toBe(DEFAULTS.maxPx);
	});

	it("WHEN headings sit deeper than outlineMaxDepth THEN they add no height", () => {
		const spec: FakeVaultSpec = {
			files: [{ path: "m.md" }, { path: "a.md", outline: headings(6, 3) }],
			links: { "m.md": ["a.md"] },
		};
		const shallow = sizeAll(spec, viewWith({ outlineMaxDepth: 2 }), ["m.md"]);
		// Level-3 headings are not renderable at depth 2, so the note is title-only.
		expect(sizeOf(shallow, "a.md")).toBe(DEFAULTS.minPx);
	});

	it("WHEN attachments exist THEN the chip row adds height", () => {
		const sizes = sizeAll(
			{
				files: [{ path: "m.md" }, { path: "a.md", outline: headings(3) }, { path: "doc.pdf" }],
				links: { "m.md": ["a.md"], "a.md": ["doc.pdf"] },
			},
			viewWith(),
			["m.md"],
		);
		const bare =
			NODE_VERTICAL_CHROME_PX + ESTIMATED_TITLE_LINE_PX + NODE_REGION_GAP_PX + 3 * ESTIMATED_OUTLINE_ENTRY_PX;
		expect(sizeOf(sizes, "a.md")).toBe(bare + NODE_REGION_GAP_PX + ESTIMATED_ATTACHMENT_ROW_PX);
	});
});

describe("NodeSizer thumbnail sizing (preview-kind driven — preference-independence superseded by design)", () => {
	const imageNote: FakeVaultSpec = {
		files: [{ path: "m.md" }, { path: "a.md" }, { path: "pic.png" }],
		links: { "m.md": ["a.md"], "a.md": ["pic.png"] },
	};

	it("WHEN a note's preview is its thumbnail THEN the node reaches the CSS reveal threshold", () => {
		const sizes = sizeAll(imageNote, viewWith(), ["m.md"]);
		expect(sizeOf(sizes, "a.md")).toBe(THUMBNAIL_VISIBLE_MIN_NODE_PX);
	});

	it("WHEN maxPx is below the reveal threshold THEN the explicit maximum still wins", () => {
		const sizes = sizeAll(imageNote, viewWith({ sizing: { minPx: 40, maxPx: 100 } }), ["m.md"]);
		expect(sizeOf(sizes, "a.md")).toBe(100);
	});

	it("WHEN the preference resolves the preview to the outline THEN no thumbnail space is reserved", () => {
		// The note offers BOTH; preference `outline` wins the slot, so the node
		// sizes to its outline, not to the thumbnail reveal. (The old rule —
		// reserve space whenever an image EXISTS — was preference-independent by
		// design; that rule is superseded: size follows displayed content.)
		const sizes = sizeAll(
			{
				files: [{ path: "m.md" }, { path: "a.md", outline: headings(2), imagePrecedesOutline: true }, { path: "pic.png" }],
				links: { "m.md": ["a.md"], "a.md": ["pic.png"] },
			},
			viewWith({ nodePreviewPreference: "outline" }),
			["m.md"],
		);
		const expected =
			NODE_VERTICAL_CHROME_PX +
			ESTIMATED_TITLE_LINE_PX +
			NODE_REGION_GAP_PX +
			2 * ESTIMATED_OUTLINE_ENTRY_PX +
			NODE_REGION_GAP_PX +
			ESTIMATED_ATTACHMENT_ROW_PX;
		expect(sizeOf(sizes, "a.md")).toBe(expected);
	});
});

describe("NodeSizer totality under hostile settings", () => {
	it("WHEN minPx and maxPx are inverted THEN maxPx is raised and every size stays finite", () => {
		const sizes = sizeAll(
			{ files: [{ path: "m.md" }, { path: "a.md" }], links: { "m.md": ["a.md"] } },
			viewWith({ sizing: { minPx: 200, maxPx: 40 } }),
			["m.md"],
		);
		// clampSizingSettings raises maxPx to minPx: everything sizes to 200.
		expect([sizeOf(sizes, "m.md"), sizeOf(sizes, "a.md")]).toEqual([200, 200]);
	});

	it("WHEN a sizing dial is NaN THEN the spec default repairs it (no NaN geometry)", () => {
		const sizes = sizeAll(
			{ files: [{ path: "m.md" }] },
			viewWith({ sizing: { minPx: Number.NaN, maxPx: Number.NaN } }),
			["m.md"],
		);
		expect(Number.isFinite(sizeOf(sizes, "m.md"))).toBe(true);
	});
});
