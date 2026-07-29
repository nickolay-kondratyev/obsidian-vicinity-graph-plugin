import { describe, expect, it } from "vitest";
import { forceRectLink, rectExtentAlong } from "./forceRectLink";
import type { RectCollideBody } from "./forceRectCollide";

/**
 * Unit tests for the direction-aware link spring. Bodies are driven directly
 * (no simulation) so each behavior is observable in isolation: the force only
 * ever writes velocity impulses (`vx`/`vy`).
 */

interface TestBody extends RectCollideBody {
	readonly id: string;
}

const LANDSCAPE_HALF_WIDTH = 200;
const LANDSCAPE_HALF_HEIGHT = 20;
const NO_GAP = 0;
const FULL_STRENGTH = 1;
const FULL_ALPHA = 1;

function makeBody(overrides: Partial<TestBody> & Pick<TestBody, "id">): TestBody {
	return { halfWidth: 50, halfHeight: 50, x: 0, y: 0, vx: 0, vy: 0, ...overrides };
}

function runForce(source: TestBody, target: TestBody, linkGapPx = NO_GAP): void {
	forceRectLink<TestBody>([{ source, target }], linkGapPx, FULL_STRENGTH)(FULL_ALPHA);
}

describe("rectExtentAlong (centre-to-boundary distance on a bearing)", () => {
	const landscape = { halfWidth: LANDSCAPE_HALF_WIDTH, halfHeight: LANDSCAPE_HALF_HEIGHT };

	it("WHEN the bearing is horizontal THEN the extent is the half-WIDTH", () => {
		expect(rectExtentAlong(landscape, 1, 0)).toBe(LANDSCAPE_HALF_WIDTH);
	});

	it("WHEN the bearing is vertical THEN the extent is the half-HEIGHT", () => {
		expect(rectExtentAlong(landscape, 0, -1)).toBe(LANDSCAPE_HALF_HEIGHT);
	});

	it("WHEN the bearing is diagonal THEN the extent reaches the nearer side, not the corner", () => {
		// 45°: the horizontal side is hit at 20px along y => hypotenuse 20*sqrt(2).
		expect(rectExtentAlong(landscape, 1, 1)).toBeCloseTo(LANDSCAPE_HALF_HEIGHT * Math.SQRT2, 10);
	});
});

describe("forceRectLink direction-aware resting distance", () => {
	it("WHEN a partner sits horizontally at exactly the projected extents THEN no impulse is applied", () => {
		// GIVEN a landscape box and a partner touching its RIGHT side: the
		// direction-blind min half-extent (20px) would have pulled them together.
		const source = makeBody({ id: "wide", halfWidth: LANDSCAPE_HALF_WIDTH, halfHeight: LANDSCAPE_HALF_HEIGHT });
		const target = makeBody({ id: "leaf", x: LANDSCAPE_HALF_WIDTH + 50 });
		runForce(source, target);
		expect([source.vx, target.vx]).toEqual([0, 0]);
	});

	it("WHEN a horizontally-linked partner sits beyond the projected extents THEN it is pulled IN", () => {
		const source = makeBody({ id: "wide", halfWidth: LANDSCAPE_HALF_WIDTH, halfHeight: LANDSCAPE_HALF_HEIGHT });
		const target = makeBody({ id: "leaf", x: LANDSCAPE_HALF_WIDTH + 50 + 100 });
		runForce(source, target);
		expect(target.vx).toBeLessThan(0);
	});

	it("WHEN the same partner sits vertically THEN the resting distance follows the half-HEIGHT instead", () => {
		// GIVEN the partner directly ABOVE at the horizontal resting distance:
		// vertically that is far too far, so it must be pulled DOWN toward the box.
		const source = makeBody({ id: "wide", halfWidth: LANDSCAPE_HALF_WIDTH, halfHeight: LANDSCAPE_HALF_HEIGHT });
		const target = makeBody({ id: "leaf", y: -(LANDSCAPE_HALF_WIDTH + 50) });
		runForce(source, target);
		expect(target.vy).toBeGreaterThan(0);
	});

	it("WHEN a link gap is configured THEN partners rest that much further apart", () => {
		const LINK_GAP_PX = 30;
		const source = makeBody({ id: "wide", halfWidth: LANDSCAPE_HALF_WIDTH, halfHeight: LANDSCAPE_HALF_HEIGHT });
		const target = makeBody({ id: "leaf", x: LANDSCAPE_HALF_WIDTH + 50 + LINK_GAP_PX });
		runForce(source, target, LINK_GAP_PX);
		expect([source.vx, target.vx]).toEqual([0, 0]);
	});

	it("WHEN two equally-linked bodies are apart THEN they are pulled together symmetrically", () => {
		const source = makeBody({ id: "a", x: -200 });
		const target = makeBody({ id: "b", x: 200 });
		runForce(source, target);
		expect(source.vx).toBe(-(target.vx as number));
	});
});
