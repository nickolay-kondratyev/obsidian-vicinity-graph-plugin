import { forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import type { ElkNode } from "elkjs";
import type { ForceLayoutSettings } from "../engine";
import { D3_FORCE_COLLIDE_ITERATIONS } from "./constants";
import { forceRectCollide } from "./forceRectCollide";
import type { RectCollideBody } from "./forceRectCollide";
import { forceRectLink } from "./forceRectLink";
import type { RectLink } from "./forceRectLink";

/**
 * d3-force refinement of a `force`-mode root (the reactflow.dev force-layout
 * approach, run statically to convergence instead of animated). Input is the
 * elk-laid-out root: elk already sized the folder containers and produced a
 * rough seed arrangement; this pass re-arranges ONLY the root's direct children
 * (containers + ungrouped leaves) so linked boxes sit close and unlinked boxes
 * merely stop overlapping — the tight hub packing elk's own force pass cannot
 * deliver. Children's internal layouts are untouched.
 *
 * Deterministic: seeds come from elk (deterministic) and the simulation's
 * random source is a fixed-seed LCG, so the same graph always lays out
 * identically (matches the elk runner's contract and keeps tests stable).
 *
 * Separation is RECTANGULAR ({@link forceRectCollide}), not d3's circular
 * `forceCollide`: a circle must circumscribe the box, so a tall folder-group
 * container (e.g. 192x392 ⇒ radius ~238px) stranded every external neighbour
 * off its diagonal — ticket 03. Colliding the boxes themselves cut the
 * worst root-edge boundary gap 207px → 33px on the reproduction fixture.
 *
 * The link spring is likewise rectangular and DIRECTION-AWARE
 * ({@link forceRectLink}) rather than d3's `forceLink`, whose resting distance is
 * fixed before the first tick: any single scalar is wrong for one of a landscape
 * box's two axes (113px → 73px gap on the landscape stranding fixture).
 */

/** A root child as a simulation body. d3 mutates `x`/`y` (centre coordinates). */
interface ForceBody extends RectCollideBody {
	readonly id: string;
}

export function refineForceRootLayout(root: ElkNode, forceLayout: ForceLayoutSettings): ElkNode {
	const children = root.children ?? [];
	if (children.length < 2) {
		return root; // Nothing to arrange.
	}
	const bodies = children.map((child): ForceBody => {
		const width = child.width ?? 0;
		const height = child.height ?? 0;
		return {
			id: child.id,
			halfWidth: width / 2,
			halfHeight: height / 2,
			x: (child.x ?? 0) + width / 2,
			y: (child.y ?? 0) + height / 2,
		};
	});
	recentre(bodies);
	const bodyById = new Map(bodies.map((body) => [body.id, body]));
	const links = (root.edges ?? []).flatMap((edge): RectLink<ForceBody>[] => {
		const source = bodyById.get(edge.sources[0] as string);
		const target = bodyById.get(edge.targets[0] as string);
		// Root edges whose endpoint is nested inside a container are projected onto
		// the container by the mapping layer, so both ends resolve in practice.
		return source === undefined || target === undefined ? [] : [{ source, target }];
	});
	const simulation = forceSimulation(bodies)
		.randomSource(seededRandom())
		// Resting distance = the two boxes' extents PROJECTED onto the current link
		// direction + gap: the spring only pulls partners into touching range and
		// the rect collide owns the actual separation. Circumscribed-radius resting
		// distances were the ticket-03 stranding mechanism; direction-blind MIN
		// half-extents then stranded neighbours of landscape containers.
		.force("link", forceRectLink<ForceBody>(links, forceLayout.linkGapPx, forceLayout.linkStrengthFactor))
		// repelStrength is stored as a positive magnitude (intuitive slider value);
		// d3's forceManyBody repels on NEGATIVE strength, hence the negation here.
		.force("charge", forceManyBody<ForceBody>().strength(-forceLayout.repelStrength))
		.force("collide", forceRectCollide<ForceBody>(forceLayout.collidePaddingPx, D3_FORCE_COLLIDE_ITERATIONS))
		.force("x", forceX<ForceBody>(0).strength(forceLayout.centerPullStrength))
		.force("y", forceY<ForceBody>(0).strength(forceLayout.centerPullStrength))
		.stop();
	// Run to convergence synchronously (the d3 "static layout" recipe): the tick
	// count is exactly how many decays alpha needs to fall below alphaMin.
	simulation.tick(Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())));
	return {
		...root,
		children: children.map((child) => {
			const body = bodyById.get(child.id);
			if (body === undefined || body.x === undefined || body.y === undefined) {
				return child;
			}
			// d3 centres → elk top-left coordinates.
			return { ...child, x: body.x - body.halfWidth, y: body.y - body.halfHeight };
		}),
	};
}

/** Shift seed centres so their centroid is the origin — the point the centring forces pull toward. */
function recentre(bodies: ForceBody[]): void {
	const meanX = bodies.reduce((sum, body) => sum + (body.x ?? 0), 0) / bodies.length;
	const meanY = bodies.reduce((sum, body) => sum + (body.y ?? 0), 0) / bodies.length;
	for (const body of bodies) {
		body.x = (body.x ?? 0) - meanX;
		body.y = (body.y ?? 0) - meanY;
	}
}

/**
 * Fixed-seed LCG (Numerical Recipes constants: state*1664525+1013904223 mod
 * 2^32) replacing `Math.random` inside the simulation, which only consults it
 * to jiggle exactly-coincident bodies apart.
 */
function seededRandom(): () => number {
	const MODULUS = 2 ** 32;
	let state = 1;
	return () => {
		state = (state * 1664525 + 1013904223) % MODULUS;
		return state / MODULUS;
	};
}
