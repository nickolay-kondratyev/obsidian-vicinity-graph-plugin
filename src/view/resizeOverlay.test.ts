// @vitest-environment jsdom
import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { applyResizeOverlay } from "./VicinityGraphFlow";

/**
 * The resize overlay is the ONE piece of node state VicinityGraphFlow holds after
 * ticket nid_1s77g4wx33uj8b380d1oph1d6_e replaced the standing local `nodes` mirror
 * (which could strand BELOW the published snapshot and never re-converge) with nodes
 * derived straight from the snapshot plus this narrow overlay. These lock the two
 * properties the fix rests on: BETWEEN gestures (null overlay) the derived nodes reach
 * React Flow untouched — so a re-measurement can never revert a node's box below the
 * store — and DURING a gesture only the dragged node moves.
 *
 * jsdom env only to import VicinityGraphFlow.tsx (it pulls in `@xyflow/react`, which
 * reaches for the DOM at module load); the assertions themselves are pure.
 */

function noteNode(id: string, widthPx: number, heightPx: number): Node {
	return {
		id,
		position: { x: 0, y: 0 },
		width: widthPx,
		height: heightPx,
		style: { width: widthPx, height: heightPx },
		type: "note",
		data: {},
	};
}

describe("applyResizeOverlay", () => {
	it("WHEN there is no active gesture THEN it returns the snapshot-derived nodes UNCHANGED", () => {
		const base = [noteNode("a.md", 40, 40), noteNode("b.md", 62, 40)];

		expect(applyResizeOverlay(base, null)).toBe(base);
	});

	it("WHEN a gesture is overlaid THEN the dragged node's RF width takes the live box", () => {
		const base = [noteNode("a.md", 40, 40)];

		const overlaid = applyResizeOverlay(base, { id: "a.md", width: 160, height: 40 });

		expect(overlaid[0]?.width).toBe(160);
	});

	it("WHEN a gesture is overlaid THEN the dragged node's inline style width takes the live box", () => {
		// The wrapper reads `node.width ?? node.style.width`, so both must move together
		// or the box would only half-follow the pointer.
		const base = [noteNode("a.md", 40, 40)];

		const overlaid = applyResizeOverlay(base, { id: "a.md", width: 160, height: 40 });

		expect(overlaid[0]?.style?.width).toBe(160);
	});

	it("WHEN a gesture is overlaid THEN a node it does NOT name keeps its identity", () => {
		// Untouched nodes must stay the SAME object so React Flow's adopt reuses them
		// (checkEquality) and re-measures nothing.
		const other = noteNode("b.md", 62, 40);
		const base = [noteNode("a.md", 40, 40), other];

		const overlaid = applyResizeOverlay(base, { id: "a.md", width: 160, height: 40 });

		expect(overlaid[1]).toBe(other);
	});
});
