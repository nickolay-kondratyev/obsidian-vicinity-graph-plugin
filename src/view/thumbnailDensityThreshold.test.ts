import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NODE_VERTICAL_CHROME_PX, THUMBNAIL_VISIBLE_MIN_NODE_PX } from "../engine";

/**
 * The thumbnail's visibility threshold is knowledge held TWICE: the stylesheet's
 * `@container (min-height: …)` decides when the thumbnail is painted, and
 * {@link THUMBNAIL_VISIBLE_MIN_NODE_PX} makes the engine size image-bearing nodes
 * tall enough to reach it. CSS cannot import a TS constant, so this guard reads
 * the stylesheet and fails the moment the two drift — a drift that would be
 * SILENT otherwise (the node would just quietly stop showing its image).
 *
 * The two numbers are NOT equal: a size container query measures the container's
 * CONTENT box, while the engine's `sizePx` becomes the node's BORDER box. The
 * guard therefore reconstructs the node's own chrome (border + padding) from the
 * same stylesheet, so neither half of `engine = css + chrome` can drift alone.
 *
 * Lives in `src/view/` because it parses a view asset; the engine stays pure.
 */

const STYLESHEET = join(dirname(fileURLToPath(import.meta.url)), "graph-view.css");
// A top-level container query and its body: the body ends at the first `}` in
// column 0, since every rule inside the block is indented.
const CONTAINER_QUERY = /@container \(min-height:\s*(\d+)px\)\s*\{\n([\s\S]*?)\n\}/g;
const REVEALS_THUMBNAIL = /\.vicinity-graph-node__thumbnail\s*\{[^}]*display:\s*block/;
// The node root's OWN rule block (not `:hover`, not the `[data-tier]` variants).
const NODE_ROOT_RULE = /\n\.vicinity-graph-node \{\n([\s\S]*?)\n\}/;
const NODE_BORDER_WIDTH = /\n\tborder:\s*(\d+)px\s/;
// Padding is an Obsidian spacing token, e.g. `padding: var(--size-4-2)` = 2 * 4px.
const NODE_PADDING_SPACING_STEPS = /\n\tpadding:\s*var\(--size-4-(\d+)\)/;
/** Obsidian's spacing scale: `--size-4-N` is `N * 4px`. */
const OBSIDIAN_SPACING_STEP_PX = 4;
// The title budget the reveal threshold is sized against (see graph-view.css).
const CLAMPS_TITLE_TO_TWO_LINES =
	/\.vicinity-graph-node\[data-preview="thumbnail"\] \.vicinity-graph-node__title \{[^}]*-webkit-line-clamp:\s*2/;

function stylesheet(): string {
	return readFileSync(STYLESHEET, "utf8");
}

/** Bodies of the container queries that switch the thumbnail on, keyed by min-height. */
function thumbnailRevealBlocks(): { readonly minHeightPx: number; readonly body: string }[] {
	return [...stylesheet().matchAll(CONTAINER_QUERY)]
		.filter(([, , body]) => body !== undefined && REVEALS_THUMBNAIL.test(body))
		.map(([, minHeight, body]) => ({ minHeightPx: Number(minHeight), body: body ?? "" }));
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

describe("thumbnail density threshold", () => {
	it("WHEN scanning graph-view.css THEN exactly one container query reveals the thumbnail", () => {
		expect(thumbnailRevealBlocks()).toHaveLength(1);
	});

	it("WHEN the node root is styled THEN its vertical chrome matches the engine's border-box correction", () => {
		expect(parsedNodeVerticalChromePx()).toBe(NODE_VERTICAL_CHROME_PX);
	});

	it("WHEN the engine floors an image node THEN that height clears the reveal threshold plus the node's chrome", () => {
		expect(THUMBNAIL_VISIBLE_MIN_NODE_PX).toBe((thumbnailRevealBlocks()[0]?.minHeightPx ?? 0) + NODE_VERTICAL_CHROME_PX);
	});

	it("WHEN the stylesheet reveals the thumbnail THEN it also caps the title at the 2 lines the threshold budgets", () => {
		expect(thumbnailRevealBlocks()[0]?.body ?? "").toMatch(CLAMPS_TITLE_TO_TWO_LINES);
	});
});
