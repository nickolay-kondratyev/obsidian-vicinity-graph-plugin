import { assert, describe, expect, it } from "vitest";
import {
	EDGE_ARROWHEAD_INSET_FRACTION,
	EDGE_ARROWHEAD_INSET_MAX_PX,
	EDGE_ARROWHEAD_INSET_MIN_PX,
	DETOUR_RATIO_DEGENERATE,
	EDGE_PAIR_CURVATURE_PX,
	ROUTED_CORNER_RADIUS_PX,
	clipRouteToEndpointRects,
	detourRatio,
	edgePathFor,
	facingSideAnchorsFor,
	polylineMidpoint,
	routedGeometryFor,
	routedPathFor,
} from "./edgeGeometry";
import type { ClipRect } from "./edgeGeometry";
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

	// KNOWN BUG (ticket nid_ea12b9v9fpfvg7n1ssmeyw58u_e) — the inset floor
	// (EDGE_ARROWHEAD_INSET_MIN_PX = 14) is never
	// clamped to the edge length, so an edge shorter than 14px places the tip
	// PAST the far endpoint (here x = 10 - 14 = -4, beyond the source). Short
	// edges are reachable: facing-side anchors of two adjacent boxes can sit a
	// few px apart. Flip `it.fails` to `it` when fixing.
	it.fails("WHEN the edge is shorter than the inset floor THEN the tip stays between the endpoints", () => {
		const { arrowX } = edgePathFor(0, 0, 10, 0, false);
		expect(arrowX).toBeGreaterThanOrEqual(0);
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
const rect = (x: number, y: number, width: number, height: number): ClipRect => ({
	x,
	y,
	widthPx: width,
	heightPx: height,
});

/** Local point-in-rect used ONLY to assert a clipped terminus is not buried inside a rect. */
function isStrictlyInside(point: RoutedPoint, r: ClipRect): boolean {
	return point.x > r.x && point.x < r.x + r.widthPx && point.y > r.y && point.y < r.y + r.heightPx;
}

describe("clipRouteToEndpointRects terminates routes on the endpoint boundaries", () => {
	// Target box [200..300]x[0..100], centre (250,50). Source box placed away from the
	// start so each test isolates the end it exercises.
	const targetRect = rect(200, 0, 100, 100);
	const farSourceRect = rect(-1000, 0, 100, 100);

	it("WHEN a 2-point route ends at the target centre THEN the terminus moves to the rect border", () => {
		const clipped = clipRouteToEndpointRects([pt(50, 50), pt(250, 50)], farSourceRect, targetRect);
		expect(clipped[clipped.length - 1]).toEqual({ x: 200, y: 50 });
	});

	it("WHEN several trailing points lie inside the target THEN they collapse to a single border crossing", () => {
		// Both (230,50) and (250,50) are strictly inside the target, so only the start
		// and the border crossing survive.
		const clipped = clipRouteToEndpointRects([pt(50, 50), pt(230, 50), pt(250, 50)], farSourceRect, targetRect);
		expect(clipped).toEqual([{ x: 50, y: 50 }, { x: 200, y: 50 }]);
	});

	it("WHEN the route starts inside the source rect THEN the start moves to the source border", () => {
		const sourceRect = rect(0, 0, 100, 100);
		const clipped = clipRouteToEndpointRects([pt(50, 50), pt(250, 50)], sourceRect, rect(1000, 0, 100, 100));
		expect(clipped[0]).toEqual({ x: 100, y: 50 });
	});

	it("WHEN the entry segment crosses at a corner THEN the terminus lands on that corner", () => {
		// (100,-100) -> (250,50) enters the box exactly at its top-left corner (200,0).
		const clipped = clipRouteToEndpointRects([pt(100, -100), pt(250, 50)], rect(0, 0, 50, 50), targetRect);
		expect(clipped[clipped.length - 1]).toEqual({ x: 200, y: 0 });
	});

	it("WHEN source and target rects contain the whole polyline THEN it falls back to the unclipped 2-point chord", () => {
		// Overlapping/nested rects: clipping would consume everything, so the original
		// first & last points are returned (non-empty, no NaN).
		const overlap = rect(0, 0, 100, 100);
		const clipped = clipRouteToEndpointRects([pt(10, 10), pt(20, 20), pt(30, 30)], overlap, overlap);
		expect(clipped).toEqual([{ x: 10, y: 10 }, { x: 30, y: 30 }]);
	});

	it("WHEN a clipped route feeds routedGeometryFor THEN the arrow tip lies outside the target interior", () => {
		const clipped = clipRouteToEndpointRects([pt(50, 50), pt(50, 250), pt(250, 250)], farSourceRect, rect(200, 200, 100, 100));
		const geometry = routedGeometryFor(clipped);
		expect(isStrictlyInside({ x: geometry.arrowX, y: geometry.arrowY }, rect(200, 200, 100, 100))).toBe(false);
	});
});

describe("facingSideAnchorsFor anchors a straight edge on the sides the boxes face", () => {
	// 100x100 boxes on a 200px grid so every border crossing is an exact integer.
	const box = rect(0, 0, 100, 100); // centre (50,50)

	it("WHEN the target sits to the RIGHT THEN the target anchor lands on its LEFT border", () => {
		expect(facingSideAnchorsFor(box, rect(200, 0, 100, 100))).toMatchObject({ targetX: 200, targetY: 50 });
	});

	it("WHEN the target sits to the LEFT THEN the target anchor lands on its RIGHT border", () => {
		expect(facingSideAnchorsFor(rect(200, 0, 100, 100), box)).toMatchObject({ targetX: 100, targetY: 50 });
	});

	it("WHEN the target sits ABOVE THEN the target anchor lands on its BOTTOM border", () => {
		expect(facingSideAnchorsFor(rect(0, 200, 100, 100), box)).toMatchObject({ targetX: 50, targetY: 100 });
	});

	it("WHEN the target sits BELOW THEN the target anchor lands on its TOP border", () => {
		expect(facingSideAnchorsFor(box, rect(0, 200, 100, 100))).toMatchObject({ targetX: 50, targetY: 200 });
	});

	it("WHEN the target sits DIAGONALLY THEN the anchor still lands on the border the centre line crosses", () => {
		// (50,50) -> (250,150) crosses the target's LEFT border (x=200) at y=125.
		expect(facingSideAnchorsFor(box, rect(200, 100, 100, 100))).toMatchObject({ targetX: 200, targetY: 125 });
	});

	it("WHEN the target sits DIAGONALLY THEN the SOURCE anchor mirrors onto the source's facing border", () => {
		// (250,150) -> (50,50) crosses the source's RIGHT border (x=100) at y=75.
		expect(facingSideAnchorsFor(box, rect(200, 100, 100, 100))).toMatchObject({ sourceX: 100, sourceY: 75 });
	});

	it("WHEN the rects are nested THEN it reports no facing side so the caller keeps its handle endpoints", () => {
		// A note inside its folder-group container: neither box faces the other.
		expect(facingSideAnchorsFor(rect(0, 0, 300, 300), rect(100, 100, 100, 100))).toBeNull();
	});

	it("WHEN the boxes overlap PARTIALLY THEN it reports no facing side rather than a BACKWARDS segment", () => {
		// Centres (50,50) and (110,50) — neither inside the other, yet the border
		// crossings come out ordered target(60) BEFORE source(100): drawing that
		// would aim the arrowhead at the wrong node.
		expect(facingSideAnchorsFor(box, rect(60, 0, 100, 100))).toBeNull();
	});

	it("WHEN the centre→centre chord DEGENERATES on overlapping boxes THEN there is no facing side either", () => {
		// Pins WHY the routed branch's degenerate chord fallback is NOT rewired through
		// these anchors: a 2-point centre→centre route degenerates only when a box swallows
		// the other's border crossing, which is exactly when no facing side exists. The two
		// conditions never co-occur, so wiring them together would be a guaranteed no-op.
		const source = box;
		const target = rect(60, 0, 100, 100);
		const chord = [
			{ x: 50, y: 50 },
			{ x: 110, y: 50 },
		];
		assert(
			clipRouteToEndpointRects(chord, source, target)[0]?.x === chord[0]?.x,
			"expected the clip to degenerate back to the raw centre→centre chord",
		);
		expect(facingSideAnchorsFor(source, target)).toBeNull();
	});

	it("WHEN the boxes merely TOUCH THEN it reports no facing side rather than a zero-length segment", () => {
		// Both anchors collapse onto the shared border point (100,50); a zero-length
		// segment has no direction, so edgePathFor's degenerate branch would aim the
		// arrowhead +x regardless of where the target really is.
		expect(facingSideAnchorsFor(box, rect(100, 0, 100, 100))).toBeNull();
	});

	it("WHEN the SOURCE rect is unavailable THEN it reports no facing side rather than guessing one", () => {
		expect(facingSideAnchorsFor(undefined, box)).toBeNull();
	});

	it("WHEN the TARGET rect is unavailable THEN it reports no facing side rather than guessing one", () => {
		expect(facingSideAnchorsFor(box, undefined)).toBeNull();
	});

	it("WHEN a rect has NON-FINITE geometry THEN it reports no facing side instead of NaN anchors", () => {
		// NaN anchors would render as `M NaN,50 …` — an SVG path that draws nothing,
		// i.e. the edge silently vanishes.
		expect(facingSideAnchorsFor(rect(Number.NaN, 0, 100, 100), rect(200, 0, 100, 100))).toBeNull();
	});

	it("WHEN a rect has ZERO size THEN it reports no facing side", () => {
		// A zero-size rect's centre is ON its border, not strictly inside it, which
		// would break segmentRectEntryPoint's precondition.
		expect(facingSideAnchorsFor(rect(0, 0, 0, 0), rect(200, 0, 100, 100))).toBeNull();
	});

	it("WHEN the anchors feed a paired edge THEN the bow is drawn between the BORDER points", () => {
		const anchors = facingSideAnchorsFor(box, rect(200, 0, 100, 100));
		// Fail HERE, on its own line, if the anchors are absent — a `?? 0` fallback
		// would silently redraw the bow from the origin and still match below.
		assert(anchors !== null, "expected facing-side anchors for two separated boxes");
		const geometry = edgePathFor(anchors.sourceX, anchors.sourceY, anchors.targetX, anchors.targetY, true);
		expect(geometry.path).toBe(`M 100,50 Q 150,${50 + EDGE_PAIR_CURVATURE_PX} 200,50`);
	});
});

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

	it("WHEN a route has three points THEN the path starts and ends exactly at the polyline endpoints (pure pass-through)", () => {
		// Proves only that this pure layer applies NO offset — it draws points in
		// the coordinates it receives. It does NOT (and cannot) verify the subflow
		// absolute-vs-parent-relative coordinate claim (ticket item 3); that rests
		// on the reasoning in routedGeometryFor's doc plus the e2e screenshot.
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

describe("routedGeometryFor tolerates duplicate consecutive waypoints (no NaN arrow transform)", () => {
	// A zero-length end segment (duplicate consecutive endpoint the router could emit)
	// must not divide the tangent by zero and NaN the arrowhead transform.
	it("WHEN the last two waypoints coincide THEN the target arrow follows the last DISTINCT segment and stays finite", () => {
		const geometry = routedGeometryFor([pt(0, 0), pt(0, 50), pt(60, 50), pt(60, 50)]);
		expect(Number.isFinite(geometry.arrowX) && Number.isFinite(geometry.arrowY)).toBe(true);
	});

	it("WHEN the last two waypoints coincide THEN the target arrow angle still follows the real last segment (+x)", () => {
		expect(routedGeometryFor([pt(0, 0), pt(0, 50), pt(60, 50), pt(60, 50)]).arrowAngleDeg).toBeCloseTo(0);
	});

	it("WHEN the first two waypoints coincide THEN the source arrow follows the first DISTINCT segment and stays finite", () => {
		const geometry = routedGeometryFor([pt(0, 0), pt(0, 0), pt(0, 50), pt(60, 50)]);
		expect(Number.isFinite(geometry.sourceArrowX) && Number.isFinite(geometry.sourceArrowY)).toBe(true);
	});

	it("WHEN the first two waypoints coincide THEN the source arrow angle still points back along the real first segment", () => {
		expect(routedGeometryFor([pt(0, 0), pt(0, 0), pt(0, 50), pt(60, 50)]).sourceArrowAngleDeg).toBeCloseTo(-90);
	});

	it("WHEN every waypoint coincides THEN both arrows anchor flat on the point (finite, zero angle)", () => {
		const geometry = routedGeometryFor([pt(5, 5), pt(5, 5), pt(5, 5)]);
		expect({ arrowX: geometry.arrowX, arrowY: geometry.arrowY, arrowAngleDeg: geometry.arrowAngleDeg }).toEqual({
			arrowX: 5,
			arrowY: 5,
			arrowAngleDeg: 0,
		});
	});
});

describe("detourRatio", () => {
	it("WHEN the route is a straight 2-point line THEN the ratio is 1 (arc length equals the chord)", () => {
		expect(detourRatio([pt(0, 0), pt(100, 0)])).toBe(1);
	});

	it("WHEN the route detours around an obstacle THEN the ratio exceeds 1", () => {
		// L-shaped detour: arc length 100 + 100 = 200 over a chord of hypot(100,100) ≈ 141.42.
		expect(detourRatio([pt(0, 0), pt(0, 100), pt(100, 100)])).toBeCloseTo(200 / Math.hypot(100, 100));
	});

	it("WHEN a straight-through waypoint lies on the chord THEN the ratio is still 1", () => {
		expect(detourRatio([pt(0, 0), pt(50, 0), pt(100, 0)])).toBe(1);
	});

	it("WHEN the endpoints coincide (zero chord) THEN the guard returns the degenerate ratio, not NaN", () => {
		expect(detourRatio([pt(10, 10), pt(30, 10), pt(10, 10)])).toBe(DETOUR_RATIO_DEGENERATE);
	});
});
