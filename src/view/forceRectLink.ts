import type { Force } from "d3-force";
import type { RectCollideBody } from "./forceRectCollide";

/** A link between two already-resolved simulation bodies. */
export interface RectLink<Body extends RectCollideBody> {
	readonly source: Body;
	readonly target: Body;
}

/**
 * Deterministic DIRECTION-AWARE link (spring) force for box-shaped bodies.
 *
 * Replaces d3's `forceLink` for the root refinement. d3 resolves each link's
 * resting distance ONCE, before the first tick, so a box can only contribute a
 * single scalar no matter which way its partner ends up sitting. Feeding it the
 * smaller half-extent stranded neighbours of a LANDSCAPE box: the spring rested
 * at the box's half-HEIGHT while a horizontally-linked partner still had to
 * clear its much larger half-WIDTH, so the rect collide pushed the partner out
 * along the long axis and the spring never pulled it back (worst boundary gap
 * 113px against a 100px budget on the landscape stranding fixture).
 *
 * Here the resting distance is recomputed EVERY tick as the two boxes' extents
 * projected onto the current centre-to-centre direction plus `linkGapPx`, i.e.
 * exactly "the rectangles touch with a `linkGapPx` gap" whatever the approach
 * angle. The rect collide still owns the actual separation.
 *
 * Spring mechanics otherwise mirror d3's forceLink so the tuning sliders keep
 * their meaning: default strength `1 / min(degree(source), degree(target))`
 * scaled by `strengthFactor`, and the impulse is split by
 * `bias = degree(source) / (degree(source) + degree(target))` so the
 * better-connected endpoint moves less. Coincident centres tie-break to the
 * positive x direction (no randomness) — layouts stay bit-identical across runs.
 */
export function forceRectLink<Body extends RectCollideBody>(
	links: readonly RectLink<Body>[],
	linkGapPx: number,
	strengthFactor: number,
): Force<Body, undefined> {
	const degreeByBody = new Map<RectCollideBody, number>();
	for (const link of links) {
		for (const endpoint of [link.source, link.target]) {
			degreeByBody.set(endpoint, (degreeByBody.get(endpoint) ?? 0) + 1);
		}
	}
	const degreeOf = (body: Body): number => degreeByBody.get(body) ?? 1;
	const springs = links.map((link) => ({
		...link,
		strength: strengthFactor / Math.min(degreeOf(link.source), degreeOf(link.target)),
		bias: degreeOf(link.source) / (degreeOf(link.source) + degreeOf(link.target)),
	}));
	const force = (alpha: number): void => {
		for (const spring of springs) {
			applySpring(spring, alpha, linkGapPx);
		}
	};
	// d3 calls this with the simulation's nodes; links already reference the body
	// objects directly, so there is nothing to resolve.
	force.initialize = (): void => {};
	return force;
}

interface Spring<Body extends RectCollideBody> extends RectLink<Body> {
	readonly strength: number;
	readonly bias: number;
}

function applySpring<Body extends RectCollideBody>(spring: Spring<Body>, alpha: number, linkGapPx: number): void {
	const { source, target } = spring;
	// Anticipated positions (`x+vx`), as d3's own forceLink does.
	const rawX = (target.x ?? 0) + (target.vx ?? 0) - ((source.x ?? 0) + (source.vx ?? 0));
	const dy = (target.y ?? 0) + (target.vy ?? 0) - ((source.y ?? 0) + (source.vy ?? 0));
	const dx = rawX === 0 && dy === 0 ? 1 : rawX; // Coincident centres tie-break to +x.
	const distance = Math.hypot(dx, dy);
	const restingDistance = rectExtentAlong(source, dx, dy) + rectExtentAlong(target, dx, dy) + linkGapPx;
	const pull = ((distance - restingDistance) / distance) * alpha * spring.strength;
	const impulseX = dx * pull;
	const impulseY = dy * pull;
	target.vx = (target.vx ?? 0) - impulseX * spring.bias;
	target.vy = (target.vy ?? 0) - impulseY * spring.bias;
	source.vx = (source.vx ?? 0) + impulseX * (1 - spring.bias);
	source.vy = (source.vy ?? 0) + impulseY * (1 - spring.bias);
}

/**
 * Distance from a box's centre to its rectangle boundary along direction
 * `(dx, dy)` — how far a partner on that bearing must sit to just touch it.
 * Direction magnitude is irrelevant; only its bearing matters.
 */
export function rectExtentAlong(
	box: { readonly halfWidth: number; readonly halfHeight: number },
	dx: number,
	dy: number,
): number {
	const distance = Math.hypot(dx, dy);
	if (distance === 0) {
		return Math.min(box.halfWidth, box.halfHeight);
	}
	// Scale the unit direction until it hits a side; the nearer side wins.
	const toVerticalSide = dx === 0 ? Number.POSITIVE_INFINITY : box.halfWidth / Math.abs(dx / distance);
	const toHorizontalSide = dy === 0 ? Number.POSITIVE_INFINITY : box.halfHeight / Math.abs(dy / distance);
	return Math.min(toVerticalSide, toHorizontalSide);
}
