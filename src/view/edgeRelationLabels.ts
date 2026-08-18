import type { EdgePathGeometry } from "./edgeGeometry";
import type { DirectedRelationLabel, RelationDirection } from "./flowMapping";
import { relationLabelText, relationOverflowBadgeText, relationOverflowTitle } from "./badgeText";

/**
 * Pure layout planner for the named-relationship labels a {@link VicinityEdge}
 * draws (ticket nid_1ycy9aszptp9fih76equxtcqa_e — GREAT UI for multi-name edges).
 * RF-free and geometry-only so the collision, truncation and direction rules are
 * node-testable; the edge component just maps the returned stacks to markup inside
 * React Flow's `EdgeLabelRenderer`.
 *
 * Two design decisions live here:
 *
 * 1. TRUNCATION. A pair with many names must not grow a tall stack that occludes
 *    the graph, so each direction shows at most {@link MAX_RELATION_LABELS_PER_STACK}
 *    names and folds the rest into a single `+N` overflow chip; the full list is
 *    always one click away in the edge flyout.
 * 2. DIRECTION on a collapsed bidirectional edge. When names travel BOTH ways on
 *    one drawn edge, a single midpoint stack cannot say which name goes which way.
 *    We instead split into two stacks and anchor each beside the arrowhead it points
 *    INTO — forward names by the target arrowhead, backward names by the source
 *    arrowhead — so the arrowhead itself disambiguates without adding glyph noise.
 *    Every one-directional edge keeps ONE midpoint stack (its lone arrowhead already
 *    tells the direction), preserving the count badge's hold on the midpoint.
 */

/** Max name chips shown in ONE direction's stack before the rest fold into a `+N` chip. */
export const MAX_RELATION_LABELS_PER_STACK = 3;

/**
 * How far a two-way edge's per-direction stacks slide off the midpoint toward
 * their arrowhead, as a fraction of the midpoint→arrowhead gap. Biases each stack
 * clearly toward its end (so it reads as "these names point THIS way") while
 * staying off the node the arrowhead lands on.
 */
export const DIRECTION_STACK_BIAS = 0.5;

/** The `+N` overflow chip that stands in for the names a stack could not show. */
export interface RelationLabelOverflow {
	readonly count: number;
	readonly badgeText: string;
	/** Tooltip naming the hidden relations and pointing at the flyout. */
	readonly title: string;
}

/**
 * One drawn relation chip: the display `text` (may carry the `[X]` qualifier) plus the
 * bare relation `name` that keys its colour ({@link import("./relationColor").relationChipColorClassName}).
 * The two differ whenever a qualifier is present, so a qualifier can never change a hue.
 */
export interface RelationLabelChip {
	readonly text: string;
	readonly name: string;
}

/** One rendered stack of relation-name chips, already truncated and positioned. */
export interface RelationLabelStack {
	readonly direction: RelationDirection;
	/** Anchor in absolute flow space (the chip column centres here, sitting above the line). */
	readonly x: number;
	readonly y: number;
	readonly names: readonly RelationLabelChip[];
	readonly overflow?: RelationLabelOverflow;
}

/**
 * Splits the edge's directed labels into the stacks to draw. Empty ⇒ nothing to
 * render. One direction ⇒ a single midpoint stack. Both directions ⇒ two stacks
 * anchored beside their own arrowheads (see the module doc).
 */
export function planRelationLabelStacks(
	relations: readonly DirectedRelationLabel[],
	geometry: EdgePathGeometry,
): readonly RelationLabelStack[] {
	const forward = namesOfDirection(relations, "forward");
	const backward = namesOfDirection(relations, "backward");
	if (forward.length === 0 && backward.length === 0) {
		return [];
	}
	const midpoint = { x: geometry.labelX, y: geometry.labelY };
	if (forward.length === 0 || backward.length === 0) {
		// One-directional: a single stack at the midpoint; the arrowhead conveys direction.
		const direction: RelationDirection = forward.length > 0 ? "forward" : "backward";
		const names = forward.length > 0 ? forward : backward;
		return [stackAt(direction, midpoint, names)];
	}
	// Two-way: each direction's names sit beside the arrowhead they point into.
	return [
		stackAt("forward", biasedToward(midpoint, { x: geometry.arrowX, y: geometry.arrowY }), forward),
		stackAt("backward", biasedToward(midpoint, { x: geometry.sourceArrowX, y: geometry.sourceArrowY }), backward),
	];
}

/** The chips for one direction's labels, in first-seen order (display text + colour-keying name). */
function namesOfDirection(relations: readonly DirectedRelationLabel[], direction: RelationDirection): RelationLabelChip[] {
	return relations
		.filter((relation) => relation.direction === direction)
		.map((relation) => ({ text: relationLabelText(relation.label), name: relation.label.name }));
}

interface Point {
	readonly x: number;
	readonly y: number;
}

/** Point a fraction {@link DIRECTION_STACK_BIAS} of the way from `from` toward `to`. */
function biasedToward(from: Point, to: Point): Point {
	return {
		x: from.x + (to.x - from.x) * DIRECTION_STACK_BIAS,
		y: from.y + (to.y - from.y) * DIRECTION_STACK_BIAS,
	};
}

/** Builds one stack: the first {@link MAX_RELATION_LABELS_PER_STACK} names, the rest as a `+N` chip. */
function stackAt(direction: RelationDirection, anchor: Point, names: readonly RelationLabelChip[]): RelationLabelStack {
	const base = { direction, x: anchor.x, y: anchor.y };
	if (names.length <= MAX_RELATION_LABELS_PER_STACK) {
		return { ...base, names };
	}
	const hidden = names.slice(MAX_RELATION_LABELS_PER_STACK);
	return {
		...base,
		names: names.slice(0, MAX_RELATION_LABELS_PER_STACK),
		overflow: {
			count: hidden.length,
			badgeText: relationOverflowBadgeText(hidden.length),
			title: relationOverflowTitle(hidden.map((chip) => chip.text)),
		},
	};
}
