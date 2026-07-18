import { describe, expect, it } from "vitest";
import { EDGE_PAIR_CURVATURE_PX, edgePathFor } from "./edgeGeometry";

describe("edgePathFor without an opposite edge", () => {
	it("WHEN the edge has no opposite THEN it renders as a straight line", () => {
		expect(edgePathFor(0, 0, 100, 0, false).path).toBe("M 0,0 L 100,0");
	});

	it("WHEN the edge is straight THEN the label sits at the midpoint", () => {
		const geometry = edgePathFor(0, 0, 100, 40, false);
		expect({ x: geometry.labelX, y: geometry.labelY }).toEqual({ x: 50, y: 20 });
	});
});

describe("edgePathFor with an opposite edge (A↔B pair)", () => {
	it("WHEN the edge has an opposite THEN it bows via a quadratic control point right of travel", () => {
		// Travel east on screen → right of travel is down (+y).
		expect(edgePathFor(0, 0, 100, 0, true).path).toBe(`M 0,0 Q 50,${EDGE_PAIR_CURVATURE_PX} 100,0`);
	});

	it("WHEN the edge bows THEN the label sits on the curve at half the control offset", () => {
		const geometry = edgePathFor(0, 0, 100, 0, true);
		expect({ x: geometry.labelX, y: geometry.labelY }).toEqual({ x: 50, y: EDGE_PAIR_CURVATURE_PX / 2 });
	});

	it("WHEN both edges of a pair bow right of their OWN travel THEN they mirror to opposite sides", () => {
		const forward = edgePathFor(0, 0, 100, 0, true);
		const backward = edgePathFor(100, 0, 0, 0, true);
		expect(backward.labelY).toBe(-forward.labelY);
	});

	it("WHEN source and target coincide THEN the degenerate edge falls back to a straight line", () => {
		expect(edgePathFor(10, 10, 10, 10, true).path).toBe("M 10,10 L 10,10");
	});
});
