import { describe, expect, it } from "vitest";
import { forceRectCollide } from "./forceRectCollide";
import type { RectCollideBody } from "./forceRectCollide";

/**
 * Unit tests for the deterministic AABB collision force. Bodies are driven
 * directly (no simulation) so each behavior is observable in isolation: the
 * force only ever writes velocity impulses (`vx`/`vy`).
 */

interface TestBody extends RectCollideBody {
	readonly id: string;
}

function makeBody(overrides: Partial<TestBody> & Pick<TestBody, "id">): TestBody {
	return { halfWidth: 50, halfHeight: 50, x: 0, y: 0, vx: 0, vy: 0, ...overrides };
}

const NO_PADDING = 0;
const SINGLE_PASS = 1;

function runForce(bodies: TestBody[], paddingPx = NO_PADDING, iterations = SINGLE_PASS): void {
	const force = forceRectCollide<TestBody>(paddingPx, iterations);
	force.initialize?.(bodies, () => 0);
	force(1);
}

describe("forceRectCollide pairwise AABB separation", () => {
	it("WHEN two boxes overlap THEN each receives half the penetration along the minimum-penetration axis", () => {
		// GIVEN 100x100 boxes whose centres are 80px apart on x (20px x-penetration)
		// and 0px apart on y (100px y-penetration) => x is the minimum axis.
		const a = makeBody({ id: "a", x: 0 });
		const b = makeBody({ id: "b", x: 80 });
		runForce([a, b]);
		expect([a.vx, b.vx, a.vy, b.vy]).toEqual([-10, 10, 0, 0]);
	});

	it("WHEN the smaller penetration is vertical THEN the pair separates along y, not x", () => {
		// GIVEN centres offset 10px on x (90px x-penetration) and 90px on y
		// (10px y-penetration) => y is the minimum axis.
		const a = makeBody({ id: "a" });
		const b = makeBody({ id: "b", x: 10, y: 90 });
		runForce([a, b]);
		expect([a.vx, b.vx, a.vy, b.vy]).toEqual([0, 0, -5, 5]);
	});

	it("WHEN boxes are separated beyond the padding THEN velocities stay untouched", () => {
		const a = makeBody({ id: "a", x: 0 });
		const b = makeBody({ id: "b", x: 130 }); // 100px extents + 20px padding = 120 < 130.
		runForce([a, b], 20);
		expect([a.vx, b.vx, a.vy, b.vy]).toEqual([0, 0, 0, 0]);
	});

	it("WHEN boxes touch within the padding THEN the padding itself is enforced as separation", () => {
		// GIVEN edge-to-edge boxes (centres 100px apart): zero geometric overlap,
		// but 20px of padding penetration on x (the minimum axis).
		const a = makeBody({ id: "a", x: 0, y: 1 }); // 1px y-offset keeps y penetration > x's.
		const b = makeBody({ id: "b", x: 100 });
		runForce([a, b], 20);
		expect([a.vx, b.vx]).toEqual([-10, 10]);
	});

	it("WHEN centres coincide exactly THEN the tie-breaks are deterministic (positive y for equal squares)", () => {
		// GIVEN identical squares at the same centre: penetrationX === penetrationY
		// => y branch; dy === 0 => positive-direction tie-break. No randomness.
		const a = makeBody({ id: "a" });
		const b = makeBody({ id: "b" });
		runForce([a, b]);
		expect([a.vx, b.vx, a.vy, b.vy]).toEqual([0, 0, -50, 50]);
	});

	it("WHEN bodies are already moving THEN overlap is tested on anticipated positions (x+vx)", () => {
		// GIVEN currently-separated boxes (centres 120px apart) heading into each
		// other: anticipated gap 120 - 15 - 15 = 90 < 100 => 10px penetration.
		const a = makeBody({ id: "a", x: 0, vx: 15 });
		const b = makeBody({ id: "b", x: 120, vx: -15 });
		runForce([a, b]);
		expect([a.vx, b.vx]).toEqual([10, -10]); // 15 - 10/2 impulse each side.
	});

	it("WHEN run with multiple iterations THEN each pass relaxes the remaining anticipated overlap", () => {
		// GIVEN coincident squares: pass 1 splits the full 100px penetration
		// (vy -50/+50); pass 2 sees anticipated positions already separated by
		// exactly the required 100px => no further impulse. Result identical to a
		// single pass — proving passes act on anticipated, not stale, positions.
		const single = [makeBody({ id: "a" }), makeBody({ id: "b" })];
		const double = [makeBody({ id: "a" }), makeBody({ id: "b" })];
		runForce(single, NO_PADDING, 1);
		runForce(double, NO_PADDING, 2);
		expect(double.map((body) => [body.vx, body.vy])).toEqual(single.map((body) => [body.vx, body.vy]));
	});
});
