import { describe, expect, it } from "vitest";
import {
	EDGE_ARROWHEAD_INSET_FRACTION,
	EDGE_ARROWHEAD_INSET_MAX_PX,
	EDGE_ARROWHEAD_INSET_MIN_PX,
	EDGE_PAIR_CURVATURE_PX,
	ROUTED_CORNER_RADIUS_PX,
	edgePathFor,
	polylineMidpoint,
	routedGeometryFor,
	routedPathFor,
} from "./edgeGeometry";
import type { RoutedPoint } from "./edgeRouting";

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

describe("edgePathFor arrowhead placement (inset back from the target)", () => {
	// The arrowhead tip is inset back from the target so heads on edges converging
	// on one node fan apart instead of stacking at the shared boundary point.
	it("WHEN a short straight edge THEN the tip is inset by the MIN clamp, not the raw fraction", () => {
		// length 100 → 12% = 12px, below the 14px floor.
		const { arrowX, arrowY, arrowAngleDeg } = edgePathFor(0, 0, 100, 0, false);
		expect({ arrowX, arrowY, arrowAngleDeg }).toEqual({
			arrowX: 100 - EDGE_ARROWHEAD_INSET_MIN_PX,
			arrowY: 0,
			arrowAngleDeg: 0,
		});
	});

	it("WHEN a mid-length straight edge THEN the tip is inset by the fraction and the angle follows travel", () => {
		// length 120 → 12% = 14.4px (above the 14px floor, below the cap).
		const inset = 120 * EDGE_ARROWHEAD_INSET_FRACTION;
		const { arrowX, arrowY, arrowAngleDeg } = edgePathFor(0, 0, 0, 120, false);
		expect(arrowX).toBeCloseTo(0);
		expect(arrowY).toBeCloseTo(120 - inset);
		expect(arrowAngleDeg).toBeCloseTo(90);
	});

	it("WHEN a long straight edge THEN the inset is capped by the MAX clamp so the head stays near the node", () => {
		// length 500 → 12% = 60px, above the 48px cap.
		expect(edgePathFor(0, 0, 500, 0, false).arrowX).toBeCloseTo(500 - EDGE_ARROWHEAD_INSET_MAX_PX);
	});

	it("WHEN the edge bows THEN the tip is inset along the curve's END tangent, not the straight chord", () => {
		// Quadratic end tangent direction = P1 - control = (100,0) - (50,CURV) = (50,-CURV).
		const inset = EDGE_ARROWHEAD_INSET_MIN_PX; // length 100 → floor applies
		const dirLength = Math.hypot(50, EDGE_PAIR_CURVATURE_PX);
		const { arrowX, arrowY, arrowAngleDeg } = edgePathFor(0, 0, 100, 0, true);
		expect(arrowX).toBeCloseTo(100 - (inset * 50) / dirLength);
		expect(arrowY).toBeCloseTo(0 - (inset * -EDGE_PAIR_CURVATURE_PX) / dirLength);
		expect(arrowAngleDeg).toBeCloseTo((Math.atan2(-EDGE_PAIR_CURVATURE_PX, 50) * 180) / Math.PI);
	});

	it("WHEN source and target coincide THEN the arrow anchors at the target with a zero angle", () => {
		const { arrowX, arrowY, arrowAngleDeg } = edgePathFor(10, 10, 10, 10, false);
		expect({ arrowX, arrowY, arrowAngleDeg }).toEqual({ arrowX: 10, arrowY: 10, arrowAngleDeg: 0 });
	});
});

describe("edgePathFor source-side arrow anchor (drawn only for bidirectional edges)", () => {
	// The source anchor is the mirror of the target anchor: inset the same
	// distance back from the SOURCE along the outgoing tangent, pointing at the
	// source. It lets a collapsed bidirectional edge draw a second arrowhead.
	it("WHEN a straight edge THEN the source anchor angle points back at the source (opposite the target)", () => {
		const geometry = edgePathFor(0, 0, 0, 120, false);
		expect(geometry.sourceArrowAngleDeg).toBeCloseTo(-90);
		expect(geometry.arrowAngleDeg).toBeCloseTo(90);
	});

	it("WHEN a straight edge THEN the source anchor is inset the same distance as the target anchor", () => {
		const geometry = edgePathFor(0, 0, 0, 120, false);
		const targetInset = Math.hypot(geometry.arrowX - 0, geometry.arrowY - 120);
		const sourceInset = Math.hypot(geometry.sourceArrowX - 0, geometry.sourceArrowY - 0);
		expect(sourceInset).toBeCloseTo(targetInset);
	});

	it("WHEN source and target coincide THEN the source anchor sits on the source with a zero angle", () => {
		const { sourceArrowX, sourceArrowY, sourceArrowAngleDeg } = edgePathFor(10, 10, 10, 10, false);
		expect({ sourceArrowX, sourceArrowY, sourceArrowAngleDeg }).toEqual({
			sourceArrowX: 10,
			sourceArrowY: 10,
			sourceArrowAngleDeg: 0,
		});
	});
});

const pt = (x: number, y: number): RoutedPoint => ({ x, y });

describe("routedPathFor rounded polyline path", () => {
	it("WHEN the polyline has only two points THEN it is a plain straight line (identical to the OFF case)", () => {
		// Degenerate route == today's straight edge, so a cleanly-routed edge renders unchanged.
		expect(routedPathFor([pt(0, 0), pt(100, 0)])).toBe("M 0,0 L 100,0");
	});

	it("WHEN a route turns a right angle THEN the interior corner is rounded by ROUTED_CORNER_RADIUS_PX", () => {
		// Both adjacent segments are long (100px), so the full radius applies: the
		// arc starts R back along the incoming segment and ends R along the outgoing.
		const shrink = ROUTED_CORNER_RADIUS_PX;
		expect(routedPathFor([pt(0, 0), pt(100, 0), pt(100, 100)])).toBe(
			`M 0,0 L ${100 - shrink},0 Q 100,0 100,${shrink} L 100,100`,
		);
	});

	it("WHEN a corner's segment is shorter than twice the radius THEN the shrink is clamped to half that segment", () => {
		// Incoming segment is only 10px, so the corner shrink clamps to 5 (half of it),
		// never inverting the short segment.
		const shrink = Math.min(ROUTED_CORNER_RADIUS_PX, 10 / 2, 100 / 2);
		expect(routedPathFor([pt(0, 0), pt(10, 0), pt(10, 100)])).toBe(
			`M 0,0 L ${10 - shrink},0 Q 10,0 10,${shrink} L 10,100`,
		);
	});

	it("WHEN a route has three points THEN the path starts and ends exactly at the polyline endpoints (no coordinate transform)", () => {
		// Coordinate-space guard (ticket item 3): routed points are drawn in the
		// coordinates they arrive in — the geometry layer applies no offset.
		const path = routedPathFor([pt(3, 7), pt(40, 7), pt(40, 55)]);
		expect(path.startsWith("M 3,7")).toBe(true);
		expect(path.endsWith("L 40,55")).toBe(true);
	});
});

describe("polylineMidpoint (arc-length half-way point)", () => {
	it("WHEN a two-segment route THEN the midpoint is walked to half the TOTAL length, not the straight midpoint", () => {
		// Total length 200 (100 + 100); half is 100 => exactly the shared corner (100,0).
		expect(polylineMidpoint([pt(0, 0), pt(100, 0), pt(100, 100)])).toEqual({ x: 100, y: 0 });
	});

	it("WHEN a two-point route THEN the midpoint is the segment midpoint", () => {
		expect(polylineMidpoint([pt(0, 0), pt(0, 40)])).toEqual({ x: 0, y: 20 });
	});
});

describe("routedGeometryFor arrowheads follow the segment tangents", () => {
	// L-shaped route: first segment travels +y (down), last segment travels +x (right).
	const lShaped = [pt(0, 0), pt(0, 50), pt(60, 50)];

	it("WHEN a routed polyline THEN the target arrowhead angle follows the LAST segment tangent", () => {
		// Last segment (0,50)->(60,50) travels +x => 0deg (not the chord's diagonal).
		expect(routedGeometryFor(lShaped).arrowAngleDeg).toBeCloseTo(0);
	});

	it("WHEN a routed polyline THEN the source arrowhead angle points back along the FIRST segment", () => {
		// First segment travels +y, so the source arrow (pointing back at the source) faces -y => -90deg.
		expect(routedGeometryFor(lShaped).sourceArrowAngleDeg).toBeCloseTo(-90);
	});

	it("WHEN a routed polyline THEN the target tip is inset back along the last segment by the clamped inset", () => {
		// Last segment length 60 -> 12% = 7.2px, below the MIN floor, so inset = MIN.
		const inset = EDGE_ARROWHEAD_INSET_MIN_PX;
		const geometry = routedGeometryFor(lShaped);
		expect(geometry.arrowX).toBeCloseTo(60 - inset);
		expect(geometry.arrowY).toBeCloseTo(50);
	});

	it("WHEN the badge is placed THEN it anchors at the polyline arc-length midpoint", () => {
		const midpoint = polylineMidpoint(lShaped);
		const geometry = routedGeometryFor(lShaped);
		expect({ x: geometry.labelX, y: geometry.labelY }).toEqual(midpoint);
	});

	it("WHEN a route is just two points THEN routedGeometryFor equals the straight edgePathFor (OFF parity)", () => {
		expect(routedGeometryFor([pt(0, 0), pt(100, 0)])).toEqual(edgePathFor(0, 0, 100, 0, false));
	});
});
