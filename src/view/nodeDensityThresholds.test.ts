import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX, NODE_VERTICAL_CHROME_PX, PREVIEW_VISIBLE_MIN_NODE_PX } from "../engine";

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
const CLAMPS_TITLE_TO_TWO_LINES =
	/\.vicinity-graph-node\[data-preview="thumbnail"\] \.vicinity-graph-node__title \{[^}]*-webkit-line-clamp:\s*2/;

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

/** Vertical border + padding of the node root, i.e. `borderBox - contentBox`. */
function parsedNodeVerticalChromePx(): number {
	const declarations = nodeRootDeclarations();
	const border = NODE_BORDER_WIDTH.exec(declarations)?.[1];
	const paddingSteps = NODE_PADDING_SPACING_STEPS.exec(declarations)?.[1];
	if (border === undefined || paddingSteps === undefined) {
		throw new Error("`.vicinity-graph-node` no longer declares a plain px border and a --size-4-N padding");
	}
	return 2 * (Number(border) + Number(paddingSteps) * OBSIDIAN_SPACING_STEP_PX);
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

	it("WHEN the stylesheet reveals the thumbnail THEN it also caps the title at the 2 lines the threshold budgets", () => {
		expect(revealBlocks(REVEALS_THUMBNAIL)[0]?.body ?? "").toMatch(CLAMPS_TITLE_TO_TWO_LINES);
	});
});
