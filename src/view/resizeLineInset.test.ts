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
 * The radius itself is NOT duplicated knowledge: `--vicinity-graph-node-radius`
 * on `.vicinity-graph-flow` is the one declaration, and both the node root and
 * these lines read it through the cascade — so the two can never drift apart and
 * nothing here needs to assert that they still match. What this scan holds is
 * the CHOICE the fix encodes, which CSS states nowhere:
 *
 * - both ends of BOTH painted lines are pulled back (a line inset at one end
 *   only still overshoots the other corner);
 * - the pull-back stays on the PAINT and off the grab band — the band is the
 *   control box React Flow hit-tests (see the band's WHY in graph-view.css and
 *   the hit-check in e2e/nodeResize.e2e.ts), so insetting it would trade a
 *   cosmetic fix for a smaller drag target at the very corners.
 */

const STYLESHEET = join(dirname(fileURLToPath(import.meta.url)), "graph-view.css");
const NODE_RADIUS_VAR = "var(--vicinity-graph-node-radius)";
/** The two ends of each painted line — the pair the corner arcs bite into. */
const LINE_ENDS = { right: ["top", "bottom"], bottom: ["left", "right"] } as const;
type Side = keyof typeof LINE_ENDS;
const SIDES = Object.keys(LINE_ENDS) as readonly Side[];
/** One edge's PAINT rule — the pseudo-element, not the grab band it sits in. */
const PAINTED_LINE_RULE = (side: Side): RegExp =>
	new RegExp(`\\n\\.vicinity-graph-flow \\.react-flow__resize-control\\.line\\.${side}::after \\{\\n([\\s\\S]*?)\\n\\}`);
/** The same edge's grab-band rule — the control box React Flow hit-tests. */
const GRAB_BAND_RULE = (side: Side): RegExp =>
	new RegExp(`\\n\\.vicinity-graph-flow \\.react-flow__resize-control\\.line\\.${side} \\{\\n([\\s\\S]*?)\\n\\}`);

function stylesheet(): string {
	return readFileSync(STYLESHEET, "utf8");
}

/**
 * Throws rather than returning undefined: a scan that stops finding its subject
 * must FAIL, not quietly pass by never looking at anything.
 */
function declarations(rule: RegExp, subject: string): string {
	const body = rule.exec(stylesheet())?.[1];
	if (body === undefined) {
		throw new Error(`graph-view.css no longer declares the ${subject} rule block`);
	}
	return body;
}

/**
 * `(?:^|\n)`: the first declaration of a captured body has no newline before it,
 * so anchoring on `\n` alone would miss whichever end is listed first — and pass
 * by never looking.
 */
function declares(body: string, property: string, value: string): boolean {
	return new RegExp(`(?:^|\\n)\\t${property}:\\s*${value.replace(/[()\-]/g, "\\$&")};`).test(body);
}

describe("drag-resize line inset", () => {
	it.each(SIDES)(
		"WHEN the %s edge's line is painted THEN both ends stop where the node's corner rounding starts",
		(side) => {
			const painted = declarations(PAINTED_LINE_RULE(side), `${side} resize line's paint`);
			const insetEnds = LINE_ENDS[side].filter((end) => declares(painted, end, NODE_RADIUS_VAR));
			expect(insetEnds).toEqual([...LINE_ENDS[side]]);
		},
	);

	it.each(SIDES)(
		"WHEN the %s edge's grab band is sized THEN the inset stays off it, so the drag target keeps the full edge",
		(side) => {
			expect(declarations(GRAB_BAND_RULE(side), `${side} resize grab band`)).not.toContain(NODE_RADIUS_VAR);
		},
	);
});
