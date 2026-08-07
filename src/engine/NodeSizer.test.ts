import { describe, expect, it } from "vitest";
import {
	ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX,
	CENTRAL_NODE_VERTICAL_CHROME_PX,
	CENTRAL_PROMINENCE_FLOOR_SCORE,
	EngineDefaults,
	ESTIMATED_ATTACHMENT_ROW_PX,
	ESTIMATED_OUTLINE_ENTRY_PX,
	ESTIMATED_THUMBNAIL_SLOT_PX,
	ESTIMATED_TITLE_LINE_PX,
	ESTIMATED_VIDEO_HERO_SLOT_PX,
	NODE_REGION_GAP_PX,
	NODE_VERTICAL_CHROME_PX,
	PREVIEW_SLOT_REVEAL_CONTENT_BOX_PX,
	PREVIEW_VISIBLE_MIN_NODE_PX,
	THUMBNAIL_PREVIEW_TITLE_LINE_CLAMP,
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
		externalPreviews: defaults.externalPreviews,
		...overrides,
	};
}

/**
 * EXPLICIT ALIGNMENT (ticket nid_k2pa8khm6ugozmhkd6nlbdrq6_e, owner-decided
 * 2026-08-05): under the Auto preference the outline is a CENTRAL's affordance —
 * an ordinary neighbour's Auto ladder is image → title only. Every case that
 * measures a NON-central node's outline HEIGHT therefore states the Outline
 * preference, so it keeps measuring the arithmetic it was written for instead of
 * silently becoming a title-only node. The tier rule itself is captured by its
 * own cases (below, and in `nodePreviewKind.test.ts`), never smuggled in here.
 */
function outlineShowingView(overrides: Partial<NodeSizingView> = {}): NodeSizingView {
	return viewWith({ nodePreviewPreference: "outline", ...overrides });
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
				files: [{ path: "m.md" }, { path: "few.md", outline: headings(6) }, { path: "many.md", outline: headings(8) }],
				links: { "m.md": ["few.md", "many.md"] },
			},
			outlineShowingView(),
			["m.md"],
		);
		expect(sizeOf(sizes, "many.md")).toBeGreaterThan(sizeOf(sizes, "few.md"));
	});

	it("WHEN the outline fit is computed THEN it is title + entries + chrome + gaps exactly", () => {
		// Six entries: the summed fit is ABOVE the CSS reveal floor, so this case
		// measures the arithmetic and not the floor (which owns its own tests below).
		const sizes = sizeAll(
			{ files: [{ path: "m.md" }, { path: "a.md", outline: headings(6) }], links: { "m.md": ["a.md"] } },
			outlineShowingView(),
			["m.md"],
		);
		const expected =
			NODE_VERTICAL_CHROME_PX + ESTIMATED_TITLE_LINE_PX + NODE_REGION_GAP_PX + 6 * ESTIMATED_OUTLINE_ENTRY_PX;
		expect(sizeOf(sizes, "a.md")).toBe(expected);
	});

	it("WHEN a note has a huge outline THEN the node clamps at maxPx", () => {
		const sizes = sizeAll(
			{ files: [{ path: "m.md" }, { path: "a.md", outline: headings(40) }], links: { "m.md": ["a.md"] } },
			outlineShowingView(),
			["m.md"],
		);
		expect(sizeOf(sizes, "a.md")).toBe(DEFAULTS.maxPx);
	});

	it("WHEN headings sit deeper than outlineMaxDepth THEN they add no height", () => {
		const spec: FakeVaultSpec = {
			files: [{ path: "m.md" }, { path: "a.md", outline: headings(6, 3) }],
			links: { "m.md": ["a.md"] },
		};
		const shallow = sizeAll(spec, outlineShowingView({ outlineMaxDepth: 2 }), ["m.md"]);
		// Level-3 headings are not renderable at depth 2, so the note is title-only.
		expect(sizeOf(shallow, "a.md")).toBe(DEFAULTS.minPx);
	});

	it("WHEN attachments exist THEN the chip row adds height", () => {
		const sizes = sizeAll(
			{
				files: [{ path: "m.md" }, { path: "a.md", outline: headings(5) }, { path: "doc.pdf" }],
				links: { "m.md": ["a.md"], "a.md": ["doc.pdf"] },
			},
			outlineShowingView(),
			["m.md"],
		);
		// Five entries: the summed fit clears the reveal floor and, WITH the chip
		// row, still stays under maxPx — so this measures the added row alone.
		const bare =
			NODE_VERTICAL_CHROME_PX + ESTIMATED_TITLE_LINE_PX + NODE_REGION_GAP_PX + 5 * ESTIMATED_OUTLINE_ENTRY_PX;
		expect(sizeOf(sizes, "a.md")).toBe(bare + NODE_REGION_GAP_PX + ESTIMATED_ATTACHMENT_ROW_PX);
	});
});

/**
 * The regions the sizer counts are painted by `graph-view.css` only above their
 * container-query rungs, so a bare region SUM can land in a band where the node
 * is taller than its title yet shows nothing more — dead space plus a preview
 * the user never sees. These cases pin the floor that closes that band;
 * `src/view/nodeDensityThresholds.test.ts` pins the numbers to the stylesheet.
 */
describe("NodeSizer reveal floors (a counted region must be a PAINTED region)", () => {
	const oneHeadingNote: FakeVaultSpec = {
		files: [{ path: "m.md" }, { path: "a.md", outline: headings(1) }],
		links: { "m.md": ["a.md"] },
	};

	it("WHEN a note's outline is too short to reach the CSS reveal THEN the node is floored at it", () => {
		const sizes = sizeAll(oneHeadingNote, outlineShowingView(), ["m.md"]);
		expect(sizeOf(sizes, "a.md")).toBe(PREVIEW_VISIBLE_MIN_NODE_PX);
	});

	it("WHEN maxPx sits below the preview reveal THEN the explicit maximum still wins over the floor", () => {
		const sizes = sizeAll(oneHeadingNote, outlineShowingView({ sizing: { minPx: 40, maxPx: 100 } }), ["m.md"]);
		expect(sizeOf(sizes, "a.md")).toBe(100);
	});

	it("WHEN a title-only note carries an attachment THEN the node is floored at the chip row's reveal", () => {
		const sizes = sizeAll(
			{ files: [{ path: "m.md" }, { path: "a.md" }, { path: "doc.pdf" }], links: { "m.md": ["a.md"], "a.md": ["doc.pdf"] } },
			viewWith(),
			["m.md"],
		);
		expect(sizeOf(sizes, "a.md")).toBe(ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX);
	});

	it("WHEN the floored node is a CENTRAL THEN the floor covers its 2px accent border too", () => {
		// A central's ring makes its content box 2px shorter at the same sizePx, so
		// the ordinary 122px floor would leave it 2px UNDER the container query and
		// paint no outline at all — the dead space this floor exists to prevent.
		const sizes = sizeAll({ files: [{ path: "m.md", outline: headings(1) }] }, viewWith(), ["m.md"]);
		expect(sizeOf(sizes, "m.md")).toBe(PREVIEW_SLOT_REVEAL_CONTENT_BOX_PX + CENTRAL_NODE_VERTICAL_CHROME_PX);
	});

	it("WHEN a note shows NO preview and NO attachments THEN no floor applies", () => {
		const sizes = sizeAll({ files: [{ path: "m.md" }, { path: "a.md" }], links: { "m.md": ["a.md"] } }, viewWith(), [
			"m.md",
		]);
		expect(sizeOf(sizes, "a.md")).toBe(DEFAULTS.minPx);
	});
});

/**
 * The Auto tier rule (ticket nid_k2pa8khm6ugozmhkd6nlbdrq6_e) expressed as SIZE,
 * which is the reason it exists: with content-fit sizing, a peripheral note with
 * even ONE heading used to be floored at the preview reveal rung, so the whole
 * vicinity rendered as near-identical big boxes. Withholding the outline from
 * ordinary neighbours withholds the floor with it. The IMAGE half of the ladder
 * is unaffected — the thumbnail suite below sizes a non-central image note.
 */
describe("NodeSizer under Auto (the outline is a central's affordance)", () => {
	const headingsOnlyNeighbour: FakeVaultSpec = {
		files: [{ path: "m.md" }, { path: "a.md", outline: headings(6) }],
		links: { "m.md": ["a.md"] },
	};

	it("WHEN an ordinary neighbour's only content is headings THEN it sizes to minPx (no preview region reserved)", () => {
		const sizes = sizeAll(headingsOnlyNeighbour, viewWith(), ["m.md"]);
		expect(sizeOf(sizes, "a.md")).toBe(DEFAULTS.minPx);
	});

	it("WHEN that same note is PINNED (a second root) THEN its outline is sized for again", () => {
		const peripheral = sizeAll(headingsOnlyNeighbour, viewWith(), ["m.md"]);
		const pinned = sizeAll(headingsOnlyNeighbour, viewWith(), ["m.md", "a.md"]);
		expect(sizeOf(pinned, "a.md")).toBeGreaterThan(sizeOf(peripheral, "a.md"));
	});

	it("WHEN the preference is an explicit Outline THEN an ordinary neighbour is sized for its outline anyway", () => {
		const sizes = sizeAll(headingsOnlyNeighbour, outlineShowingView(), ["m.md"]);
		expect(sizeOf(sizes, "a.md")).toBeGreaterThan(DEFAULTS.minPx);
	});
});

describe("NodeSizer thumbnail sizing (preview-kind driven — preference-independence superseded by design)", () => {
	const imageNote: FakeVaultSpec = {
		files: [{ path: "m.md" }, { path: "a.md" }, { path: "pic.png" }],
		links: { "m.md": ["a.md"], "a.md": ["pic.png"] },
	};

	it("WHEN a note's preview is its thumbnail THEN the node reaches the CSS reveal threshold", () => {
		const sizes = sizeAll(imageNote, viewWith(), ["m.md"]);
		expect(sizeOf(sizes, "a.md")).toBe(PREVIEW_VISIBLE_MIN_NODE_PX);
	});

	it("WHEN maxPx is below the reveal threshold THEN the explicit maximum still wins", () => {
		const sizes = sizeAll(imageNote, viewWith({ sizing: { minPx: 40, maxPx: 100 } }), ["m.md"]);
		expect(sizeOf(sizes, "a.md")).toBe(100);
	});

	it("WHEN a thumbnail node also wraps its title and carries a chip row THEN the slot is counted, not assumed", () => {
		// The three regions together exceed the reveal floor, so the floor no longer
		// covers for an uncounted slot: leaving the 56px out here sizes the node to
		// 122px, and the chip row is pushed out through the node's `overflow:hidden`.
		const sizes = sizeAll(
			{
				files: [
					{ path: "m.md" },
					// Long enough to wrap onto the 2 lines the thumbnail CSS clamps to.
					{ path: "a.md", frontmatterTitle: "A deliberately long note title that wraps" },
					{ path: "pic.png" },
				],
				links: { "m.md": ["a.md"], "a.md": ["pic.png"] },
			},
			viewWith(),
			["m.md"],
		);
		const expected =
			NODE_VERTICAL_CHROME_PX +
			THUMBNAIL_PREVIEW_TITLE_LINE_CLAMP * ESTIMATED_TITLE_LINE_PX +
			NODE_REGION_GAP_PX +
			ESTIMATED_THUMBNAIL_SLOT_PX +
			NODE_REGION_GAP_PX +
			ESTIMATED_ATTACHMENT_ROW_PX;
		expect(sizeOf(sizes, "a.md")).toBe(expected);
	});

	it("WHEN a thumbnail node's title is long THEN it is budgeted the 2 lines the CSS clamps it to", () => {
		// The 4-line clamp applies to every OTHER preview kind; budgeting 4 here
		// would reserve two lines the stylesheet never paints.
		const sizes = sizeAll(
			{
				files: [
					{ path: "m.md" },
					{ path: "a.md", frontmatterTitle: "A".repeat(300) },
					{ path: "pic.png" },
				],
				links: { "m.md": ["a.md"], "a.md": ["pic.png"] },
			},
			viewWith(),
			["m.md"],
		);
		expect(sizeOf(sizes, "a.md")).toBe(
			NODE_VERTICAL_CHROME_PX +
				THUMBNAIL_PREVIEW_TITLE_LINE_CLAMP * ESTIMATED_TITLE_LINE_PX +
				NODE_REGION_GAP_PX +
				ESTIMATED_THUMBNAIL_SLOT_PX +
				NODE_REGION_GAP_PX +
				ESTIMATED_ATTACHMENT_ROW_PX,
		);
	});

	it("WHEN the preference resolves the preview to the outline THEN no thumbnail space is reserved", () => {
		// The note offers BOTH; preference `outline` wins the slot, so the node
		// sizes to its outline, not to the thumbnail reveal. (The old rule —
		// reserve space whenever an image EXISTS — was preference-independent by
		// design; that rule is superseded: size follows displayed content.)
		const sizes = sizeAll(
			{
				files: [
					{ path: "m.md" },
					{ path: "a.md", outline: headings(5), imagePrecedesOutline: true },
					{ path: "pic.png" },
				],
				links: { "m.md": ["a.md"], "a.md": ["pic.png"] },
			},
			viewWith({ nodePreviewPreference: "outline" }),
			["m.md"],
		);
		const expected =
			NODE_VERTICAL_CHROME_PX +
			ESTIMATED_TITLE_LINE_PX +
			NODE_REGION_GAP_PX +
			5 * ESTIMATED_OUTLINE_ENTRY_PX +
			NODE_REGION_GAP_PX +
			ESTIMATED_ATTACHMENT_ROW_PX;
		expect(sizeOf(sizes, "a.md")).toBe(expected);
	});
});

describe("NodeSizer leading-video hero sizing (the video takes the media slot at a fixed 16:9 height)", () => {
	const VIDEO = { videoId: "dQw4w9WgXcQ", canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
	const videoNote: FakeVaultSpec = {
		files: [{ path: "m.md" }, { path: "a.md", leadingVideo: VIDEO }],
		links: { "m.md": ["a.md"] },
	};

	it("WHEN a note's preview is its leading video THEN the node reserves the 16:9 hero slot", () => {
		const sizes = sizeAll(videoNote, viewWith(), ["m.md"]);
		expect(sizeOf(sizes, "a.md")).toBe(
			NODE_VERTICAL_CHROME_PX + ESTIMATED_TITLE_LINE_PX + NODE_REGION_GAP_PX + ESTIMATED_VIDEO_HERO_SLOT_PX,
		);
	});

	it("WHEN external previews are OFF THEN the video reserves no space and the node falls to its title-only floor", () => {
		// OFF ⇒ the video is not the hero; with nothing else to show the node is
		// title-only and clamps to minPx, well below the ON node's hero height.
		const onSize = sizeOf(sizeAll(videoNote, viewWith({ externalPreviews: true }), ["m.md"]), "a.md");
		const offSize = sizeOf(sizeAll(videoNote, viewWith({ externalPreviews: false }), ["m.md"]), "a.md");
		expect(offSize).toBeLessThan(onSize);
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
