/**
 * View-layer named constants. The engine keeps its own constants under an
 * import guard (`src/engine/constants.ts`); these are the view's and live here
 * so the pure view modules and the ItemView glue share one source.
 */

import { MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH } from "../engine";

// Depth-stepper bounds live in the engine's SETTINGS_SPEC (co-located with the
// depth defaults). Re-exported here so view modules keep importing them from the
// view constants barrel unchanged.
export { MAX_STEPPER_DEPTH, MIN_STEPPER_DEPTH };

/**
 * Relayout trigger for a node that SURVIVED a rebuild (same id, same structure):
 * relayout only if its `sizePx` grew by more than this fraction. `1.0` = +100%
 * (doubled). Below the threshold we keep the existing layout and just refresh
 * node data, avoiding jarring position jumps on small size changes.
 */
export const SIZE_RELAYOUT_THRESHOLD = 1.0;

/**
 * Debounce for vault-driven rebuilds (metadata "resolved"). Collapses the burst
 * of resolve events that follows an edit into a single rebuild.
 */
export const REBUILD_DEBOUNCE_MS = 500;

/**
 * Settle window for a TYPED settings field (numbers, text, textarea) before it
 * persists and rebuilds every open graph. Long enough to swallow a multi-digit
 * entry like `160` (three keystrokes = three full rebuilds without it), short
 * enough that the graph still reacts while the settings tab is open. Shorter than
 * {@link REBUILD_DEBOUNCE_MS} on purpose: this window starts at a deliberate
 * keystroke, not at a burst of vault events.
 */
export const SETTINGS_WRITE_DEBOUNCE_MS = 400;

/**
 * Approximate average glyph advance (px) of the node-title font
 * (`--font-ui-smaller`, ~12–13px in Obsidian's default theme). Used to size a
 * node's width to fit its title on one line. Snug (not generous) because the
 * title CSS clamps to 4 lines: when a title needs more than
 * {@link NODE_MAX_LABEL_WIDTH_PX} the width pins to that cap and the overflow
 * wraps onto the next lines — the wrap, not width overshoot, is the safety net
 * against ellipsis. An estimate, not a measurement: the view stays pure (no
 * DOM), consistent with the node's "no JS measuring" model.
 */
export const NODE_TITLE_CHAR_WIDTH_PX = 7;

/** Horizontal chrome around the title text: node padding (both sides) + border. */
export const NODE_LABEL_HORIZONTAL_PADDING_PX = 20;

/**
 * Upper bound on the label-driven node width. Beyond this a title stops widening
 * the node and instead wraps onto the next lines the title CSS allows
 * (`-webkit-line-clamp: 4`). Set a bit above the 160px engine max HEIGHT so a
 * long title gets some horizontal room before wrapping, while the node stays a
 * readable, not-too-wide box.
 */
export const NODE_MAX_LABEL_WIDTH_PX = 250;

/**
 * Snug width (px) a note node needs to render its title on ONE line. Char-count
 * heuristic — see {@link NODE_TITLE_CHAR_WIDTH_PX}. Callers cap this at
 * {@link NODE_MAX_LABEL_WIDTH_PX} (a longer title wraps to 4 lines instead).
 */
export function estimateNodeLabelWidthPx(title: string): number {
	return Math.ceil(title.length * NODE_TITLE_CHAR_WIDTH_PX) + NODE_LABEL_HORIZONTAL_PADDING_PX;
}

/**
 * Hard cap on outline entries mounted per node. Only ~3–6 are visible at once
 * (the node is ≤160px tall), so 40 is roughly seven screens of scrolling —
 * generous for reading, while bounding the DOM: a generated 500-heading note
 * must not mount 500 buttons in one node. Applied AFTER the depth filter, so
 * raising the depth never silently costs a note its shallow headings.
 */
export const OUTLINE_RENDER_LIMIT = 40;

/** Id of the synthetic elk root that contains every graph node. */
export const ELK_ROOT_ID = "root";

/**
 * The root's elk algorithm id — the marker {@link GraphLayoutRunner} keys the
 * d3-force refinement on. The tunable spacing/force VALUES live on
 * `ViewSettings.forceLayout` (engine defaults, ticket-04 sliders); this file
 * keeps only the non-tunable structure.
 */
export const ELK_FORCE_ALGORITHM = "force";

/**
 * WHAT: the separation the root elk `force` SEED asks for between root-level boxes.
 * The seed is only a starting arrangement — the d3 refinement that runs after it
 * (`d3ForceRefinement.ts`) sets the final root gaps from `forceLayout.collidePaddingPx`
 * ("Node spacing"). The seed still MATTERS though: the arrangement d3 starts from
 * decides which boxes end up stranded (see below), so this is not a free parameter.
 *
 * WHY IT IS PINNED, and pinned at 40: 40 is the value the "Group member spacing"
 * knob used to hand BOTH elk passes, so freezing it here is what keeps the root pass
 * byte-identical while this ticket tightens only the GROUP INTERIOR (CLARIFICATION
 * D4). WHAT BREAKS IF IT MOVES: taking it down to 20 with the interiors blew the
 * `d3ForceStranding.test.ts` boundary-gap budget — 113px against 100px, measured, and
 * measured back to green with the seed pinned. Any change here must re-run that suite.
 *
 * WHY IT IS NOT THE USER KNOB (DECIDED — do not re-couple them): the slider is labelled
 * "Group member spacing" and now means exactly that — one knob, one meaning (SRP). The
 * two spacings were a single knob by accident, not by design. TRADE-OFF, accepted with
 * eyes open: a user who had SAVED a non-default value (say 90) was previously feeding it
 * to this seed as well, and after the split their saved value no longer reaches it — for
 * them the root arrangement changes, with nothing in the UI to explain it. Accepted
 * because the seed is refined away by d3 and the label never promised root-level reach.
 *
 * 40 is inherited, not derived. Giving the root seed a justification of its own is
 * tracked in `nid_zvoay26y4y9h1e2p2b1y9glfk_e`. Value-locked by `elkMapping.test.ts`.
 */
const ELK_ROOT_SEED_NODE_SPACING_PX = 40;

/**
 * Root layout options. elk's `force` algorithm is only the SEED: it computes
 * folder-container dimensions and a rough untangled arrangement, then the
 * d3-force refinement (`d3ForceRefinement.ts`) packs the root-level boxes
 * tightly. `force` does not support `INCLUDE_CHILDREN`, so the root runs elk's
 * default `SEPARATE_CHILDREN` hierarchy handling: folder containers pack their
 * members first (see {@link elkGroupMemberOptions}), then the root arranges
 * the resulting fixed-size boxes.
 */
export function elkForceRootOptions(): Readonly<Record<string, string>> {
	return {
		"elk.algorithm": ELK_FORCE_ALGORITHM,
		"elk.spacing.nodeNode": String(ELK_ROOT_SEED_NODE_SPACING_PX),
	};
}

/**
 * Rect-collide (`forceRectCollide.ts`) relaxation passes per tick. 1 leaves
 * residual overlaps on dense hubs; 2 resolves them (same rationale as d3's own
 * advice to raise `forceCollide` iterations when overlap-freedom matters more
 * than speed). The ticket-03 prototype found 3 passes gained nothing.
 * Deliberately INTERNAL (no slider): overlap-resolution quality/perf, not
 * layout taste.
 */
export const D3_FORCE_COLLIDE_ITERATIONS = 2;

/**
 * Shape elk aims the packed group box at (width / height): 3:4 PORTRAIT, mildly
 * taller than wide. Without it rectpacking defaults to landscape (1.3).
 *
 * WHY portrait and not square/landscape: the graph usually lives in a tall narrow
 * pane, and — measured — landscape containers regress the ticket-03 stranding
 * budget (`d3ForceStranding.test.ts`): the root d3 pass treats the box as one
 * rigid rectangle whose link resting distance comes from its SMALLER half-extent,
 * so a wide box lets its own width push linked neighbours past that distance.
 * WHY not more extreme (<= 0.6): boxes drift back towards strips, which is the
 * shape this whole pass exists to avoid.
 *
 * 0.75 sits at the flat part of both curves — measured across 120 fixtures
 * (member counts 2-20 x four intra-group link shapes), box area lands ~6% below
 * the previous `layered` pass while |log(w/h)| drops from 0.72 to 0.26.
 * elk treats this as a soft goal of its width APPROXIMATION step (compaction
 * afterwards may overshoot), so individual boxes still vary around it.
 */
const GROUP_PACKING_ASPECT_RATIO = 0.75;

/**
 * Layout of the INSIDE of a folder-group container. The force root runs
 * `SEPARATE_CHILDREN`, laying out every container independently: members are
 * packed here, then the container is placed as a fixed-size box by the root
 * force/d3 pass. `nodeSpacingPx` is the "Group member spacing" knob
 * (`ViewSettings.forceLayout.elkNodeSpacingPx`).
 *
 * WHY `rectpacking` and not `layered`: layered optimizes edge FLOW, not density,
 * and its edge routing is discarded anyway (edges are re-routed by
 * `edgeRouting.ts`). Worse, a folder whose members all link one hub member — the
 * commonest shape in a note vault — puts every member in a single layer, i.e. one
 * very wide row with a mostly empty box around it. `rectpacking` packs
 * heterogeneous rectangles by area instead, which is what a group box needs.
 *
 * Measured against `layered` across 120 fixtures (member counts 2-20 x four
 * intra-group link shapes): hub/star groups 45-55% LESS box area, mean area ~6%
 * better, and the durable win is shape regularity — mean |log(w/h)| 0.72 -> 0.26,
 * which also feeds the root d3 pass since it treats each container as one rigid
 * rectangle. `layered` beat it on edge-free and chain groups at the 40px member
 * spacing of the day; at the shipped 20px it no longer does (the table in
 * `groupPacking.test.ts` has the per-shape numbers).
 *
 * WHY these options and not others: every rectpacking sub-option in elkjs 0.12
 * was swept against real fixtures at 40px AND 20px spacing (width approximation
 * strategy + goal, compaction iterations, row-height re-evaluation, trybox,
 * whitespace elimination, expandNodes, contentAlignment). None beat this set
 * except by collapsing groups into single-column strips. A hand-written skyline
 * packer over the same rectangles was also measured: within ~5% of elk, i.e. the
 * PLACEMENT has no headroom left, which is why the member GAP is where the group
 * interior got its space back.
 *
 * WHY-NOT keep any edge awareness inside a group: rectpacking ignores intra-group
 * edges, so members no longer read top-to-bottom along their links. Accepted —
 * those edges render as routed curves, never as clean layered orthogonals.
 *
 * `orderBySize` packs the largest members first; without it rectpacking keeps
 * input order and leaves measurably more ragged white space.
 */
export function elkGroupMemberOptions(nodeSpacingPx: number): Readonly<Record<string, string>> {
	return {
		"elk.algorithm": "rectpacking",
		"elk.aspectRatio": String(GROUP_PACKING_ASPECT_RATIO),
		"elk.rectpacking.orderBySize": "true",
		"elk.spacing.nodeNode": String(nodeSpacingPx),
	};
}

/**
 * Inset of a folder group's MEMBER squares from the container's left/bottom/right
 * border. Stated numerically (and not only inside the elk string below) because it
 * is the measured CEILING of the edge-routing clearance: members are emitted as
 * their own routing obstacles, so a clearance wider than this inset makes a
 * member's clearance region poke OUTSIDE the group border and seal the group's own
 * boundary pins from the outside (edge-routing__06 `SWEEP__PUBLIC.md` §4 — the
 * cliff moves when this inset moves). Asserted in `edgeRouting.test.ts`.
 */
export const GROUP_SIDE_PADDING_PX = 16;

/**
 * Room reserved above the members for the group's folder-name label, so member
 * nodes never render underneath it.
 */
const GROUP_TOP_PADDING_PX = 36;

/** [elk `ElkPadding` syntax]: values must be written as float literals (`16.0`, not `16`). */
function elkPaddingValue(px: number): string {
	const ELK_PADDING_DECIMALS = 1;
	return px.toFixed(ELK_PADDING_DECIMALS);
}

/** Inner padding of folder-group containers, in elk's `ElkPadding` syntax. */
export const ELK_GROUP_PADDING =
	`[top=${elkPaddingValue(GROUP_TOP_PADDING_PX)},left=${elkPaddingValue(GROUP_SIDE_PADDING_PX)}` +
	`,bottom=${elkPaddingValue(GROUP_SIDE_PADDING_PX)},right=${elkPaddingValue(GROUP_SIDE_PADDING_PX)}]`;

/**
 * React Flow zoom floor. RF's default (0.5) clamps `fitView` on dense graphs in
 * a narrow sidebar pane — the whole vicinity then CANNOT be brought into view
 * (and, with viewport culling, boundary nodes flicker in and out of the DOM).
 * A low floor lets fitView always show the full graph; users can zoom back in.
 */
export const GRAPH_MIN_ZOOM = 0.1;

/**
 * Clamp a (possibly fractional / out-of-range) stepper input into
 * `[MIN_STEPPER_DEPTH, MAX_STEPPER_DEPTH]`, rounding to the nearest integer.
 * Used by every depth stepper and the settings-tab depth inputs.
 */
export function clampStepperDepth(value: number): number {
	return Math.min(MAX_STEPPER_DEPTH, Math.max(MIN_STEPPER_DEPTH, Math.round(value)));
}
