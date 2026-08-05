import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX,
	CENTRAL_NODE_VERTICAL_CHROME_PX,
	ESTIMATED_THUMBNAIL_SLOT_PX,
	NODE_VERTICAL_CHROME_PX,
	PIN_CHIP_FULL_SIZE_CONTENT_BOX_PX,
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
// The pin chip's OWN rule block, and the chip-size property the ladder re-declares.
const PIN_BUTTON_RULE = /\n\.vicinity-graph-node \.vicinity-graph-pin-button \{\n([\s\S]*?)\n\}/;
const PIN_CHIP_SIZE = /--vicinity-graph-pin-chip-size:\s*(\d+)px/;
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
function soleRevealMinHeightPx(reveals: RegExp): number {
	const blocks = revealBlocks(reveals);
	const sole = blocks.length === 1 ? blocks[0] : undefined;
	if (sole === undefined) {
		throw new Error(`expected exactly ONE container query to reveal this region, found ${blocks.length}`);
	}
	return sole.minHeightPx;
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

	// The pin chip is NOT part of the ladder's reveal set (ticket
	// nid_tclb98q9hxhmcuonamvr4ig1f_e, owner-decided): it is hover-revealed at every
	// node height, because content-fit sizing made the small node the common case and
	// the right-click menu was the only pin affordance left there. The rung merely
	// GROWS it — and `CENTRAL_PROMINENCE_FLOOR_SCORE` is tuned against that rung, so a
	// stylesheet that moved it would silently leave centrals on the compact chip.
	it("WHEN the pin chip is styled THEN it is displayed at every node height, not gated on the density ladder", () => {
		const declarations = PIN_BUTTON_RULE.exec(stylesheet())?.[1];
		expect(declarations).toMatch(/\n\tdisplay: inline-flex;/);
	});

	it("WHEN the stylesheet grows the pin chip to full size THEN it does so at the rung the engine tunes the central floor against", () => {
		expect(soleRevealMinHeightPx(PIN_CHIP_SIZE)).toBe(PIN_CHIP_FULL_SIZE_CONTENT_BOX_PX);
	});

	// A central's accent ring is 2px, so at the SAME sizePx its content box is 2px
	// shorter — and content-fit sizing lands centrals exactly ON a reveal floor
	// routinely, where 2px is the whole difference between painting the region and
	// reserving dead space for it. Hence the engine models this chrome separately.
	it.each(CENTRAL_TIERS)("WHEN a %s central is styled THEN its chrome matches the engine's central correction", (tier) => {
		expect(parsedCentralVerticalChromePx(tier)).toBe(CENTRAL_NODE_VERTICAL_CHROME_PX);
	});
});
