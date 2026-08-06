import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX,
	CENTRAL_NODE_VERTICAL_CHROME_PX,
	ESTIMATED_THUMBNAIL_SLOT_PX,
	NODE_VERTICAL_CHROME_PX,
	PREVIEW_VISIBLE_MIN_NODE_PX,
	THUMBNAIL_PREVIEW_TITLE_LINE_CLAMP,
} from "../engine";

/**
 * The node's density ladder is knowledge held TWICE: the stylesheet's
 * `@container (min-height: …)` queries decide when the preview slot (thumbnail
 * OR outline — one slot) and the attachment-chip row are painted, and the engine
 * mirrors both rungs ({@link PREVIEW_VISIBLE_MIN_NODE_PX},
 * {@link ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX}) to floor the height of nodes that
 * carry those regions. CSS cannot import a TS constant, so this guard reads the
 * stylesheet and fails the moment the two drift — a drift that would be SILENT
 * otherwise (the node would just quietly stop showing its content while still
 * reserving the space for it).
 *
 * The numbers are NOT equal across the seam: a size container query measures the
 * container's CONTENT box, while the engine's `sizePx` becomes the node's BORDER
 * box. The guard therefore reconstructs the node's own chrome (border + padding)
 * from the same stylesheet, so neither half of `engine = css + chrome` can drift
 * alone.
 *
 * Lives in `src/view/` because it parses a view asset; the engine stays pure.
 */

const STYLESHEET = join(dirname(fileURLToPath(import.meta.url)), "graph-view.css");
// A top-level container query and its body: the body ends at the first `}` in
// column 0, since every rule inside the block is indented.
const CONTAINER_QUERY = /@container \(min-height:\s*(\d+)px\)\s*\{\n([\s\S]*?)\n\}/g;
const REVEALS_THUMBNAIL = /\.vicinity-graph-node__thumbnail\s*\{[^}]*display:\s*block/;
const REVEALS_OUTLINE = /\.vicinity-graph-outline\s*\{[^}]*display:\s*block/;
const REVEALS_ATTACHMENTS = /\.vicinity-graph-node__attachments\s*\{[^}]*display:\s*flex/;
// The node root's OWN rule block (not `:hover`, not the `[data-tier]` variants).
const NODE_ROOT_RULE = /\n\.vicinity-graph-node \{\n([\s\S]*?)\n\}/;
const NODE_BORDER_WIDTH = /\n\tborder:\s*(\d+)px\s/;
// `container-type` decides which axes the query can read: only `size` exposes
// HEIGHT. Downgrading it to `inline-size` would leave every number below in
// agreement while the min-height query silently never matches again.
// (Anchored to a line start so a `container-type` on some OTHER rule cannot pass.)
const DECLARES_SIZE_CONTAINER = /(?:^|\n)\tcontainer-type:\s*size;/;
// Padding is an Obsidian spacing token, e.g. `padding: var(--size-4-2)` = 2 * 4px.
const NODE_PADDING_SPACING_STEPS = /\n\tpadding:\s*var\(--size-4-(\d+)\)/;
/** Obsidian's spacing scale: `--size-4-N` is `N * 4px`. */
const OBSIDIAN_SPACING_STEP_PX = 4;
// The title budget the preview reveal threshold is sized against (see graph-view.css).
const THUMBNAIL_PREVIEW_TITLE_CLAMP =
	/\.vicinity-graph-node\[data-preview="thumbnail"\] \.vicinity-graph-node__title \{[^}]*-webkit-line-clamp:\s*(\d+)/;
// The centrals' own border: BOTH tiers carry the accent ring, and the engine
// models ONE central chrome, so a tier that drifted to a different width would
// leave one of them unmodelled.
// Captures from just after the `{`, so the leading newline `NODE_BORDER_WIDTH`
// anchors on is part of the body even when the border is the tier's ONLY rule.
const CENTRAL_TIER_RULE = (tier: string): RegExp =>
	new RegExp(`\\n\\.vicinity-graph-node\\[data-tier="${tier}"\\] \\{([\\s\\S]*?)\\n\\}`);
const CENTRAL_TIERS = ["main", "pinned-central"] as const;
// The corner chip's OWN rule block — the DEFAULT rung, where the full-size chip lives.
const NODE_CHIP_RULE = /\n\.vicinity-graph-node \.vicinity-graph-node-chip \{\n([\s\S]*?)\n\}/;
// Whole declared VALUE, not a px literal: the compact rung states px, the full-size
// rung reuses Obsidian's `--size-4-1` inset token, and both rungs must be measurable.
const NODE_CHIP_SIZE = /--vicinity-graph-node-chip-size:\s*([^;]+);/;
const NODE_CHIP_INSET = /--vicinity-graph-node-chip-inset:\s*([^;]+);/;
// The chip's reach is measured from its BORDER box, so the rungs below are only
// honest while the chip declares it (Obsidian's own reset is not this file's).
const NODE_CHIP_BORDER_BOX = /\n\tbox-sizing: border-box;/;
// The chip's centre-clearance ladder: `max-*` rungs on BOTH axes at once, each
// stepping the chip down (to the compact size, then to nothing) exactly where the
// chip above it would cover the node's centre point.
const NODE_CHIP_STEP_DOWN_QUERY =
	/@container \(max-height:\s*(\d+)px\) and \(max-width:\s*(\d+)px\)\s*\{\n\t\.vicinity-graph-node \.vicinity-graph-node-chip \{\n([\s\S]*?)\n\t\}\n\}/g;
// ANY top-level container query, whatever its prelude — the density ladder's
// `min-height` rungs included. The step-down regex above can only see rungs that
// already have the ladder's shape, so it is blind to the very regression this
// ticket removed (a `min-*` rung GROWING the chip); this one sees every rung.
const ANY_CONTAINER_QUERY = /@container ([^{]*)\{\n([\s\S]*?)\n\}/g;
const MENTIONS_NODE_CHIP = /\.vicinity-graph-node-chip/;
// Anchored to a line start, not a preceding newline: it is the rung's ONLY
// declaration, so there is nothing before it inside the captured body.
const WITHHOLDS_CHIP = /(?:^|\n)\t\tdisplay: none;/;
// The drag-resize grip band straddles the node's edge, so HALF of it reaches
// inside — over whatever the node's own corner holds (the gear at top-right; the pin's top-left carries no grip).
const RESIZE_BAND = /--vicinity-graph-resize-band-px:\s*(\d+)px;/;
// The thumbnail slot's fixed height, declared as a custom property on the node root.
// Anchored to a line start: it is the rule's FIRST declaration, so there is no
// preceding newline inside the captured body.
const THUMBNAIL_SLOT_HEIGHT = /(?:^|\n)\t--vicinity-graph-thumbnail-height:\s*(\d+)px/;

function stylesheet(): string {
	return readFileSync(STYLESHEET, "utf8");
}

/** Bodies of the container queries whose body matches `reveals`, keyed by min-height. */
function revealBlocks(reveals: RegExp): { readonly minHeightPx: number; readonly body: string }[] {
	return [...stylesheet().matchAll(CONTAINER_QUERY)]
		.filter(([, , body]) => body !== undefined && reveals.test(body))
		.map(([, minHeight, body]) => ({ minHeightPx: Number(minHeight), body: body ?? "" }));
}

/** The ONE query revealing a region — a second one would make "the" threshold a lie. */
function soleRevealBlock(reveals: RegExp): { readonly minHeightPx: number; readonly body: string } {
	const blocks = revealBlocks(reveals);
	const sole = blocks.length === 1 ? blocks[0] : undefined;
	if (sole === undefined) {
		throw new Error(`expected exactly ONE container query to reveal this region, found ${blocks.length}`);
	}
	return sole;
}

function soleRevealMinHeightPx(reveals: RegExp): number {
	return soleRevealBlock(reveals).minHeightPx;
}

function nodeRootDeclarations(): string {
	const match = NODE_ROOT_RULE.exec(stylesheet());
	if (match?.[1] === undefined) {
		throw new Error("graph-view.css no longer declares a `.vicinity-graph-node` rule block");
	}
	return match[1];
}

/** Vertical padding of the node root — shared by every tier (only the border varies). */
function parsedNodeVerticalPaddingPx(): number {
	const paddingSteps = NODE_PADDING_SPACING_STEPS.exec(nodeRootDeclarations())?.[1];
	if (paddingSteps === undefined) {
		throw new Error("`.vicinity-graph-node` no longer declares a --size-4-N padding");
	}
	return 2 * Number(paddingSteps) * OBSIDIAN_SPACING_STEP_PX;
}

/** Vertical border + padding of the node root, i.e. `borderBox - contentBox`. */
function parsedNodeVerticalChromePx(): number {
	const border = NODE_BORDER_WIDTH.exec(nodeRootDeclarations())?.[1];
	if (border === undefined) {
		throw new Error("`.vicinity-graph-node` no longer declares a plain px border");
	}
	return 2 * Number(border) + parsedNodeVerticalPaddingPx();
}

function nodeChipDeclarations(): string {
	const match = NODE_CHIP_RULE.exec(stylesheet());
	if (match?.[1] === undefined) {
		throw new Error("graph-view.css no longer declares a `.vicinity-graph-node .vicinity-graph-node-chip` rule block");
	}
	return match[1];
}

/** One `max-height`/`max-width` step-down rung of the corner chip's ladder. */
interface NodeChipRung {
	readonly maxHeightPx: number;
	readonly maxWidthPx: number;
	readonly body: string;
}

function nodeChipStepDownRungs(): NodeChipRung[] {
	return [...stylesheet().matchAll(NODE_CHIP_STEP_DOWN_QUERY)].map(([, maxHeight, maxWidth, body]) => ({
		maxHeightPx: Number(maxHeight),
		maxWidthPx: Number(maxWidth),
		body: body ?? "",
	}));
}

/** The ONE rung doing `does`, so "the" rung stays a fact rather than a first match. */
function soleNodeChipRung(does: RegExp, subject: string): NodeChipRung {
	const rungs = nodeChipStepDownRungs().filter((rung) => does.test(rung.body));
	const sole = rungs.length === 1 ? rungs[0] : undefined;
	if (sole === undefined) {
		throw new Error(`expected exactly ONE corner chip rung to ${subject}, found ${rungs.length}`);
	}
	return sole;
}

/** The rung that shrinks the chip; the other one withholds it outright. */
function compactNodeChipRung(): NodeChipRung {
	return soleNodeChipRung(NODE_CHIP_SIZE, "re-declare the chip's size");
}

function withholdNodeChipRung(): NodeChipRung {
	return soleNodeChipRung(WITHHOLDS_CHIP, "withhold the chip");
}

/** Preludes of EVERY container query that styles the corner chip, in source order. */
function nodeChipContainerQueryPreludes(): string[] {
	return [...stylesheet().matchAll(ANY_CONTAINER_QUERY)]
		.filter(([, , body]) => body !== undefined && MENTIONS_NODE_CHIP.test(body))
		.map(([, prelude]) => (prelude ?? "").trim());
}

/** How a step-down rung of the ladder states itself: both axes, both `max-*`. */
function twoAxisMaxPrelude(rung: NodeChipRung): string {
	return `(max-height: ${rung.maxHeightPx}px) and (max-width: ${rung.maxWidthPx}px)`;
}

/** A length the stylesheet writes either as a px literal or as an Obsidian spacing token. */
function parsedLengthPx(value: string, subject: string): number {
	const px = /^(\d+)px$/.exec(value.trim())?.[1];
	if (px !== undefined) {
		return Number(px);
	}
	const steps = /^var\(--size-4-(\d+)\)$/.exec(value.trim())?.[1];
	if (steps === undefined) {
		throw new Error(`${subject} is neither a px literal nor a --size-4-N token: [${value}]`);
	}
	return Number(steps) * OBSIDIAN_SPACING_STEP_PX;
}

/**
 * The largest CONTENT-box square on which a corner chip of this rung's
 * geometry still covers the node's CENTRE point — derived, never a literal.
 *
 * The chip reaches `inset + size` into the node's PADDING box; the centre sits at
 * half that box. So the centre is covered while `paddingBox / 2 <= inset + size`,
 * and `paddingBox = contentBox + padding`.
 *
 * ONE number for both axes: the node's `padding` is the shorthand, so its
 * horizontal and vertical totals are the same — which is why the stylesheet's
 * withholding query can state the same px on `max-height` and `max-width`.
 */
function chipCentreCoveredContentBoxPx(rungDeclarations: string, subject: string): number {
	const size = NODE_CHIP_SIZE.exec(rungDeclarations)?.[1];
	const inset = NODE_CHIP_INSET.exec(rungDeclarations)?.[1];
	if (size === undefined || inset === undefined) {
		throw new Error(`the ${subject} corner chip no longer declares both a size and an inset`);
	}
	const reachPx = parsedLengthPx(size, `${subject} chip size`) + parsedLengthPx(inset, `${subject} chip inset`);
	return 2 * reachPx - parsedNodeVerticalPaddingPx();
}

/** The chip's declared box size at one rung, in px. */
function declaredChipSizePx(rungDeclarations: string, subject: string): number {
	const size = NODE_CHIP_SIZE.exec(rungDeclarations)?.[1];
	if (size === undefined) {
		throw new Error(`the ${subject} corner chip no longer declares a size`);
	}
	return parsedLengthPx(size, `${subject} chip size`);
}

/**
 * How far the chip's OUTER edge sits from the node's border-box edge, measured
 * where the drag-resize grips live: `right`/`top` are offsets into the PADDING
 * box, so the node's border is part of the distance. The ORDINARY node's 1px
 * border is the tight case — a central's 2px ring only pushes the chip further in.
 */
function chipOuterEdgeInsetPx(rungDeclarations: string, subject: string): number {
	const inset = NODE_CHIP_INSET.exec(rungDeclarations)?.[1];
	const border = NODE_BORDER_WIDTH.exec(nodeRootDeclarations())?.[1];
	if (inset === undefined || border === undefined) {
		throw new Error(`cannot measure the ${subject} chip's offset from the node's border-box edge`);
	}
	return Number(border) + parsedLengthPx(inset, `${subject} chip inset`);
}

/** How far a drag-resize grip band reaches INSIDE the node — half the band straddles the edge. */
function resizeBandInwardReachPx(): number {
	const band = RESIZE_BAND.exec(stylesheet())?.[1];
	if (band === undefined) {
		throw new Error("graph-view.css no longer declares a --vicinity-graph-resize-band-px");
	}
	return Number(band) / 2;
}

/** The same for one central tier's overriding border. */
function parsedCentralVerticalChromePx(tier: string): number {
	const declarations = CENTRAL_TIER_RULE(tier).exec(stylesheet())?.[1];
	const border = declarations === undefined ? undefined : NODE_BORDER_WIDTH.exec(declarations)?.[1];
	if (border === undefined) {
		throw new Error(`\`.vicinity-graph-node[data-tier="${tier}"]\` no longer declares a plain px border`);
	}
	return 2 * Number(border) + parsedNodeVerticalPaddingPx();
}

describe("node density thresholds", () => {
	it("WHEN scanning graph-view.css THEN exactly one container query reveals the thumbnail", () => {
		expect(revealBlocks(REVEALS_THUMBNAIL)).toHaveLength(1);
	});

	it("WHEN the node root is styled THEN it is a SIZE container, so the reveal's min-height query can match", () => {
		expect(nodeRootDeclarations()).toMatch(DECLARES_SIZE_CONTAINER);
	});

	it("WHEN the node root is styled THEN its vertical chrome matches the engine's border-box correction", () => {
		expect(parsedNodeVerticalChromePx()).toBe(NODE_VERTICAL_CHROME_PX);
	});

	it("WHEN the engine floors a preview-bearing node THEN that height clears the reveal threshold plus the node's chrome", () => {
		expect(PREVIEW_VISIBLE_MIN_NODE_PX).toBe(soleRevealMinHeightPx(REVEALS_THUMBNAIL) + NODE_VERTICAL_CHROME_PX);
	});

	it("WHEN the outline shares the thumbnail's preview slot THEN it shares its reveal threshold too", () => {
		// The engine floors BOTH preview kinds at ONE number (`nodePreviewKind`
		// picks which region fills the slot), so a stylesheet that split the two
		// thresholds would leave one of them silently unfloored — a node sized for
		// an outline the CSS then refuses to paint.
		expect(soleRevealMinHeightPx(REVEALS_OUTLINE)).toBe(soleRevealMinHeightPx(REVEALS_THUMBNAIL));
	});

	it("WHEN the engine floors an attachment-bearing node THEN that height clears the chip row's reveal threshold", () => {
		expect(ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX).toBe(
			soleRevealMinHeightPx(REVEALS_ATTACHMENTS) + NODE_VERTICAL_CHROME_PX,
		);
	});

	it("WHEN the stylesheet reveals the thumbnail THEN it caps the title at the lines the engine budgets for it", () => {
		const clamp = THUMBNAIL_PREVIEW_TITLE_CLAMP.exec(revealBlocks(REVEALS_THUMBNAIL)[0]?.body ?? "")?.[1];
		expect(Number(clamp)).toBe(THUMBNAIL_PREVIEW_TITLE_LINE_CLAMP);
	});

	it("WHEN the thumbnail slot declares its fixed height THEN the engine's estimate of that region matches", () => {
		const slot = THUMBNAIL_SLOT_HEIGHT.exec(nodeRootDeclarations())?.[1];
		expect(Number(slot)).toBe(ESTIMATED_THUMBNAIL_SLOT_PX);
	});

	// The corner chip is NOT part of the ladder's reveal set (ticket
	// nid_tclb98q9hxhmcuonamvr4ig1f_e, owner-decided): it is hover-revealed at every
	// node height, because content-fit sizing made the small node the common case and
	// the right-click menu was the only pin affordance left there.
	it("WHEN the corner chip is styled THEN it is displayed at every node height, not gated on the density ladder", () => {
		expect(nodeChipDeclarations()).toMatch(/\n\tdisplay: inline-flex;/);
	});

	// …and it is FULL SIZE at every node size the geometry allows (ticket
	// nid_8i5936g90vrllosssaz7v3xbr_e): one chip size throughout, so the ladder may
	// only ever step DOWN from the default.
	//
	// This guard comes FIRST because every other pin-chip guard below reads the
	// ladder through `NODE_CHIP_STEP_DOWN_QUERY`, which matches only rungs that
	// ALREADY have the two-axis `max-*` shape. That makes them all blind to exactly
	// the regression this ticket removed: chip declarations added to a `min-height`
	// rung — the density ladder's own rungs sit a few lines up in the same file —
	// would grow the chip on HEIGHT alone again while every arithmetic guard below
	// stayed green, because none of them would ever see that rung.
	it("WHEN a container query styles the corner chip THEN it is one of the ladder's two-axis max-* step-downs, never a min-* rung", () => {
		expect([...nodeChipContainerQueryPreludes()].sort()).toEqual(
			[twoAxisMaxPrelude(compactNodeChipRung()), twoAxisMaxPrelude(withholdNodeChipRung())].sort(),
		);
	});

	// With the shape pinned above, "step DOWN" is then a claim about SIZE: a rung
	// re-declaring a BIGGER chip fails here (and would also breach the centre-
	// clearance arithmetic below, which is computed from the chip it steps down from).
	it("WHEN the stylesheet steps the corner chip down THEN it steps down from the DEFAULT rung's full-size chip", () => {
		expect(declaredChipSizePx(compactNodeChipRung().body, "compact")).toBeLessThan(
			declaredChipSizePx(nodeChipDeclarations(), "full-size"),
		);
	});

	// Why the ladder exists at all, and why its rungs are not judgement calls: a chip
	// reaches `inset + size` into the node's padding box from its corner, so
	// below a computable size it sits ON the node's centre point — where a click means
	// OPEN THE NOTE. `minPx` is a dial the user can take to 1px and a drag-resize
	// override may be 24px, so those bands are reachable; re-tuning a chip without
	// moving the rung under it would silently make the node unreachable-by-click.
	it("WHEN the chip is measured for centre clearance THEN it is sized from its BORDER box", () => {
		expect(nodeChipDeclarations()).toMatch(NODE_CHIP_BORDER_BOX);
	});

	// Each rung is computed from the chip ABOVE it — the one it steps down from.
	it.each(["maxHeightPx", "maxWidthPx"] as const)(
		"WHEN the stylesheet steps the corner chip down to compact THEN its %s rung is the content box at which the full-size chip covers the node's centre",
		(axis) => {
			expect(compactNodeChipRung()[axis]).toBe(chipCentreCoveredContentBoxPx(nodeChipDeclarations(), "full-size"));
		},
	);

	it.each(["maxHeightPx", "maxWidthPx"] as const)(
		"WHEN the stylesheet withholds the corner chip THEN its %s rung is the content box at which the compact chip covers the node's centre",
		(axis) => {
			expect(withholdNodeChipRung()[axis]).toBe(chipCentreCoveredContentBoxPx(compactNodeChipRung().body, "compact"));
		},
	);

	// The ladder must also DESCEND, which the two guards above do NOT imply: each is
	// computed from the chip it steps down FROM, so a rung that shrank the chip's SIZE
	// (satisfying the monotonicity guard) while GROWING its inset reaches further than
	// the chip above it — and then its own consistent arithmetic puts its band OUTSIDE
	// the band of the rung above. Both guards stay green while the withheld band
	// swallows the compact one: the compact chip would never render at all, and nodes
	// just above the step-down would lose a chip that never covered their centre.
	it.each(["maxHeightPx", "maxWidthPx"] as const)(
		"WHEN the corner chip's rungs are read THEN each %s band sits strictly inside the band of the rung above it",
		(axis) => {
			expect(withholdNodeChipRung()[axis]).toBeLessThan(compactNodeChipRung()[axis]);
		},
	);

	// The GEAR chip shares the node's top-right corner with the drag-resize
	// RIGHT-edge grip, which paints and hit-tests ABOVE the whole node (see the
	// z-index WHY in graph-view.css). The grip band therefore eats any part of the
	// chip it overlaps — silently, since neither element changes size or style. The
	// compact rung's inset was 1px too small for exactly this reason once. Both
	// chips share ONE inset (the base class), so guarding it on either corner
	// guards both; the pin's own corner (top-left) carries no grip at all.
	it.each([
		{ subject: "full-size", declarations: () => nodeChipDeclarations() },
		{ subject: "compact", declarations: () => compactNodeChipRung().body },
	])("WHEN the $subject corner chip is placed THEN the drag-resize grip band does not reach over it", ({ subject, declarations }) => {
		expect(chipOuterEdgeInsetPx(declarations(), subject)).toBeGreaterThanOrEqual(resizeBandInwardReachPx());
	});

	// A central's accent ring is 2px, so at the SAME sizePx its content box is 2px
	// shorter — and content-fit sizing lands centrals exactly ON a reveal floor
	// routinely, where 2px is the whole difference between painting the region and
	// reserving dead space for it. Hence the engine models this chrome separately.
	it.each(CENTRAL_TIERS)("WHEN a %s central is styled THEN its chrome matches the engine's central correction", (tier) => {
		expect(parsedCentralVerticalChromePx(tier)).toBe(CENTRAL_NODE_VERTICAL_CHROME_PX);
	});
});
