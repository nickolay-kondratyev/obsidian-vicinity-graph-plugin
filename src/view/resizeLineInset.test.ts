import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The drag-resize edge grips paint an accent line ALONG the node's right and
 * bottom edges — edges the node itself draws ROUNDED. A line that runs the full
 * length of its edge therefore overshoots into (and past) the corner arc, which
 * reads as chrome that missed the box it belongs to (ticket
 * `nid_rcs31edfd3uadudhlxo1gdjue_e`).
 *
 * The fix is knowledge held TWICE: the node root's `border-radius` decides where
 * the arc starts, and the line's inset decides where the line stops. CSS cannot
 * assert that they agree, so this scan does — a node radius re-tuned on its own
 * would SILENTLY put the overshoot back.
 *
 * The inset is on the PAINT (the `::after`) only, never on the control box: the
 * box is the grab band the right/bottom drag depends on (see the band's WHY in
 * graph-view.css and the hit-check in e2e/nodeResize.e2e.ts), and shortening it
 * would trade a cosmetic fix for a smaller drag target at the very corners.
 */

const STYLESHEET = join(dirname(fileURLToPath(import.meta.url)), "graph-view.css");
const NODE_ROOT_RULE = /\n\.vicinity-graph-node \{\n([\s\S]*?)\n\}/;
const NODE_BORDER_RADIUS = /\n\tborder-radius:\s*([^;]+);/;
const RESIZE_LINE_RULE = /\n\.vicinity-graph-flow \.react-flow__resize-control\.line \{\n([\s\S]*?)\n\}/;
const RESIZE_LINE_INSET_DECLARATION = /--vicinity-graph-resize-line-inset:\s*([^;]+);/;
const RESIZE_LINE_INSET_VAR = "var(--vicinity-graph-resize-line-inset)";
/** One edge's PAINT rule — the pseudo-element, not the grab band it sits in. */
const PAINTED_LINE_RULE = (side: "right" | "bottom"): RegExp =>
	new RegExp(`\\n\\.vicinity-graph-flow \\.react-flow__resize-control\\.line\\.${side}::after \\{\\n([\\s\\S]*?)\\n\\}`);
/** The same edge's grab-band rule — the control box React Flow hit-tests. */
const GRAB_BAND_RULE = (side: "right" | "bottom"): RegExp =>
	new RegExp(`\\n\\.vicinity-graph-flow \\.react-flow__resize-control\\.line\\.${side} \\{\\n([\\s\\S]*?)\\n\\}`);
/** The two ends of each painted line — the pair the corner arcs bite into. */
const LINE_ENDS = { right: ["top", "bottom"], bottom: ["left", "right"] } as const;

function stylesheet(): string {
	return readFileSync(STYLESHEET, "utf8");
}

function declarations(rule: RegExp, subject: string): string {
	const body = rule.exec(stylesheet())?.[1];
	if (body === undefined) {
		throw new Error(`graph-view.css no longer declares the ${subject} rule block`);
	}
	return body;
}

describe("drag-resize line inset", () => {
	it("WHEN the resize line declares its inset THEN it is the node root's own corner radius", () => {
		const radius = NODE_BORDER_RADIUS.exec(declarations(NODE_ROOT_RULE, "`.vicinity-graph-node`"))?.[1];
		const inset = RESIZE_LINE_INSET_DECLARATION.exec(declarations(RESIZE_LINE_RULE, "resize line"))?.[1];
		expect(inset).toBe(radius);
	});

	it.each(["right", "bottom"] as const)(
		"WHEN the %s edge's line is painted THEN both ends stop where the node's corner rounding starts",
		(side) => {
			const painted = declarations(PAINTED_LINE_RULE(side), `${side} resize line's paint`);
			// `(?:^|\n)`: the first declaration of the captured body has no newline
			// before it, so anchoring on `\n` alone would miss whichever end is listed
			// first — and pass by never looking.
			const insetEnds = LINE_ENDS[side].filter((end) =>
				new RegExp(`(?:^|\\n)\\t${end}:\\s*${RESIZE_LINE_INSET_VAR.replace(/[()]/g, "\\$&")};`).test(painted),
			);
			expect(insetEnds).toEqual([...LINE_ENDS[side]]);
		},
	);

	it.each(["right", "bottom"] as const)(
		"WHEN the %s edge's grab band is sized THEN the inset stays off it, so the drag target keeps the full edge",
		(side) => {
			expect(declarations(GRAB_BAND_RULE(side), `${side} resize grab band`)).not.toContain(
				RESIZE_LINE_INSET_VAR,
			);
		},
	);
});
