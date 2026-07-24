import type { Force, SimulationNodeDatum } from "d3-force";

/**
 * A simulation body the rectangle-collision force can separate: an axis-aligned
 * box described by its centre (`x`/`y`, d3-managed) and half-extents.
 */
export interface RectCollideBody extends SimulationNodeDatum {
	readonly halfWidth: number;
	readonly halfHeight: number;
}

/**
 * Deterministic rectangular (AABB) collision force for d3-force.
 *
 * Replaces d3's circular `forceCollide` for box-shaped bodies: a circle must
 * circumscribe the box (radius = half the diagonal), so a tall 192x392 folder
 * container held every neighbour >= ~238px from its centre — the ticket-03
 * "Enchiridion" stranding. Colliding the RECTANGLES lets a neighbour approach a
 * tall box from the side and stop at its half-width instead of its diagonal
 * (prototype: worst boundary gap 207px -> 33px on the vault-mirror fixture).
 *
 * Mechanics, per relaxation pass over every pair in FIXED index order:
 * - Overlap is tested on ANTICIPATED positions (`x+vx`), the same trick d3's
 *   forceCollide uses so this pass sees where bodies are heading this tick.
 * - Half-extents are inflated by `paddingPx` so separated boxes keep a visible
 *   gap.
 * - The pair separates along the MINIMUM-penetration axis only, half the
 *   penetration to each body (velocity impulse, symmetric).
 * - Exactly-coincident centres tie-break to the positive direction — no
 *   randomness anywhere, so layouts are bit-identical across runs.
 *
 * WHY O(n^2) per pass: this runs only on the ROOT's direct children (containers
 * + ungrouped notes, at most a few hundred) for ~300 static ticks, well under
 * 10ms total — a quadtree would be YAGNI complexity.
 */
export function forceRectCollide<Body extends RectCollideBody>(
	paddingPx: number,
	iterations: number,
): Force<Body, undefined> {
	let bodies: Body[] = [];
	const force = (): void => {
		for (let pass = 0; pass < iterations; pass++) {
			for (let i = 0; i < bodies.length; i++) {
				for (let j = i + 1; j < bodies.length; j++) {
					separatePair(bodies[i] as Body, bodies[j] as Body, paddingPx);
				}
			}
		}
	};
	force.initialize = (nodes: Body[]): void => {
		bodies = nodes;
	};
	return force;
}

function separatePair(a: RectCollideBody, b: RectCollideBody, paddingPx: number): void {
	// d3 initializes x/y/vx/vy on every node before forces run; `?? 0` keeps the
	// force total (and unit-testable) without non-null assertions.
	const dx = (b.x ?? 0) + (b.vx ?? 0) - ((a.x ?? 0) + (a.vx ?? 0));
	const dy = (b.y ?? 0) + (b.vy ?? 0) - ((a.y ?? 0) + (a.vy ?? 0));
	const penetrationX = a.halfWidth + b.halfWidth + paddingPx - Math.abs(dx);
	const penetrationY = a.halfHeight + b.halfHeight + paddingPx - Math.abs(dy);
	if (penetrationX <= 0 || penetrationY <= 0) {
		return; // Separated (padding included) on at least one axis.
	}
	if (penetrationX < penetrationY) {
		const sign = dx > 0 ? 1 : dx < 0 ? -1 : 1; // dx === 0 tie-breaks positive.
		a.vx = (a.vx ?? 0) - (penetrationX / 2) * sign;
		b.vx = (b.vx ?? 0) + (penetrationX / 2) * sign;
	} else {
		const sign = dy > 0 ? 1 : dy < 0 ? -1 : 1; // dy === 0 tie-breaks positive.
		a.vy = (a.vy ?? 0) - (penetrationY / 2) * sign;
		b.vy = (b.vy ?? 0) + (penetrationY / 2) * sign;
	}
}
