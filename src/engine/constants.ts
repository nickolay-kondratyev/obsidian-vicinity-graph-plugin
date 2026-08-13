import { SETTINGS_SPEC } from "./SettingsSpec";
// Separate statement: the line above is a VALUE import, and `isolatedModules`
// needs the type to come across as a type.
import type { SizingSpec } from "./SettingsSpec";
import type {
	DepthSettings,
	ForceLayoutSettings,
	FrontmatterLinkSettings,
	NodeExclusionSettings,
	NodeSizeOverridePx,
	SizingSettings,
	ViewSettings,
} from "./types";

// ---------------------------------------------------------------------------
// Thin adapters over SETTINGS_SPEC (the single source of truth for every
// settings default AND limit — see `SettingsSpec.ts`). The WHY rationale for
// each value lives on the spec; these are mechanical projections of it.
// Defaults have NO aliases here — read `SETTINGS_SPEC.<section>.<field>.default`
// or build a whole shape via `EngineDefaults`.
// ---------------------------------------------------------------------------

/**
 * THE node-cap clamp, shared by the persistence load path and the node-cap
 * accessor's settle rule (the number inputs themselves REFUSE out-of-spec
 * entries — this is the backstop behind them). Rounds: a cap is a whole
 * number of nodes. @see SETTINGS_SPEC — `globalView.nodeCap` for the WHY of
 * the 1..1000 range.
 */
export function clampNodeCap(value: number): number {
	const spec = SETTINGS_SPEC.globalView.nodeCap;
	return Math.round(clampIntoRange(value, spec, spec.default));
}

/** @see SETTINGS_SPEC — `globalView.outlineMaxDepth.{min,max}`. */
export const MIN_OUTLINE_DEPTH = SETTINGS_SPEC.globalView.outlineMaxDepth.min;
export const MAX_OUTLINE_DEPTH = SETTINGS_SPEC.globalView.outlineMaxDepth.max;

/**
 * THE outline-depth clamp, shared by the settings slider and the persistence
 * parser, so a hand-edited `data.json` cannot reach `0` (a silent off-switch the
 * feature deliberately does not have) or a level markdown does not define.
 * Rounds: heading levels are whole numbers.
 *
 * Goes through {@link clampIntoRange} rather than a bare `Math.min`/`Math.max` pair so
 * `NaN` resolves to the spec default exactly as it does for every other settings clamp —
 * those two PROPAGATE it, and this clamp used to hand a `NaN` depth straight to its
 * caller. Not reachable from today's slider-only callers; consistency, not a live bug fix
 * (`settingsSpecBounds.test.ts` asserts the rule for every bounded field at once).
 */
export function clampOutlineMaxDepth(value: number): number {
	const spec = SETTINGS_SPEC.globalView.outlineMaxDepth;
	return Math.round(clampIntoRange(value, spec, spec.default));
}

/**
 * Depth-stepper input bounds (CLARIFICATION Q2) — an AFFORDANCE limit on the
 * toolbar/settings steppers, not an engine limit. @see SETTINGS_SPEC —
 * `globalDepths.linkDepthOut.{min,max}` (both depth fields share these bounds).
 */
export const MIN_STEPPER_DEPTH = SETTINGS_SPEC.globalDepths.linkDepthOut.min;
export const MAX_STEPPER_DEPTH = SETTINGS_SPEC.globalDepths.linkDepthOut.max;

// ---------------------------------------------------------------------------
// Non-settings tuning constants (NOT user-facing defaults → not in the spec).
// ---------------------------------------------------------------------------

/**
 * Where in the `minPx..maxPx` ramp a central's (MAIN + pinned, even when
 * disconnected from MAIN) size is FLOORED: `minPx + 0.35 * (maxPx - minPx)`.
 *
 * A modest prominence floor, NOT a bypass (node-sizing rethink Q2, decided
 * 2026-08-03): an empty central no longer renders at maxPx — centrality stays
 * visible via the floor plus border styling, while a content-rich central still
 * grows past it like any other node. Tuned to sit noticeably above the minPx a
 * bare title-only neighbor clamps to, and well under the midpoint, so a central
 * never dominates by role alone.
 *
 * 0.44 rather than the originally tuned 0.35: 0.44 was first reached to clear the
 * hover pin chip's old full-size rung (ticket `nid_tclb98q9hxhmcuonamvr4ig1f_e`) —
 * 0.35 floored an EMPTY central at 82px, missing that rung, so the node people pin
 * and unpin most got the compact chip. That rung is GONE (ticket
 * `nid_8i5936g90vrllosssaz7v3xbr_e`: the chip is full size by default, stepped down
 * only on a node small on BOTH axes, which a central never is), so the chip no
 * longer constrains this number. Owner-decided (ticket
 * `nid_s1474ljrdqneqhqt5zrkpwva2_e`) to KEEP 0.44 as the final shipped prominence:
 * at 40/180 an empty central reads at 102px — a touch more clearly the anchor than
 * 0.35's 89px — while still sitting well under the midpoint.
 *
 * A FRACTION of the user's ramp, deliberately, so it can never exceed `maxPx`.
 */
export const CENTRAL_PROMINENCE_FLOOR_SCORE = 0.44;

/**
 * Content-box height (px) at which `src/view/graph-view.css` reveals the node's
 * PREVIEW SLOT — the thumbnail and the outline share it (they are mutually
 * exclusive, see `nodePreviewKind`) and share this ONE container query, so this
 * is one threshold, not two.
 *
 * NOT a node height: a CSS size container query measures the container's CONTENT
 * box, so this number must be grown by the node's own chrome (see
 * {@link revealMinNodePx}) before it can be compared to `sizePx`.
 */
export const PREVIEW_SLOT_REVEAL_CONTENT_BOX_PX = 104;

/**
 * Content-box height (px) at which `src/view/graph-view.css` reveals the
 * attachment-chip row — the lower rung of the same density ladder. Same
 * content-box caveat as {@link PREVIEW_SLOT_REVEAL_CONTENT_BOX_PX}.
 */
export const ATTACHMENT_ROW_REVEAL_CONTENT_BOX_PX = 72;

/**
 * How much taller an ordinary node's BORDER box is than the content box the
 * container query sees: `.vicinity-graph-node` is `box-sizing: border-box` with
 * a 1px border and `--size-4-2` (8px) of padding, top and bottom.
 */
export const NODE_VERTICAL_CHROME_PX = 2 * (1 + 8);

/**
 * The same for a CENTRAL: `[data-tier="main"]` and `[data-tier="pinned-central"]`
 * draw a 2px accent border, so their content box is 2px SHORTER at the same
 * `sizePx`.
 *
 * Modelled — not rounded away — because content-fit sizing lands centrals
 * EXACTLY on a reveal floor routinely (a MAIN note with one to four headings
 * fits well under the rung, so the floor IS its size). Sized with the 18px
 * chrome, such a central gets a 102px content box, misses the 104px query by
 * 2px, and renders as a title over 40px of dead space — precisely the trap the
 * floor exists to prevent. (Under the old sizer centrals were pinned to `maxPx`,
 * which is why the band was safe to ignore then.)
 */
export const CENTRAL_NODE_VERTICAL_CHROME_PX = 2 * (2 + 8);

/** How much taller than the container-query content box THIS node's border box is. */
export function nodeVerticalChromePx(isCentral: boolean): number {
	return isCentral ? CENTRAL_NODE_VERTICAL_CHROME_PX : NODE_VERTICAL_CHROME_PX;
}

/**
 * Node height (px) at which `graph-view.css` actually PAINTS the region its
 * container query gates at `contentBoxRungPx` — the rung expressed as the
 * border-box height React Flow gives the node, which is the only form `sizePx`
 * can be compared against. THE one place `rung + chrome` is spelled out.
 *
 * `NodeSizer` floors every node that carries such a region here: sizing a node
 * to fit an outline (or a chip row) the stylesheet then refuses to paint would
 * buy nothing but dead space.
 *
 * DUPLICATED KNOWLEDGE, deliberately guarded: the reveal itself is a CSS
 * container query and CSS cannot import a TS constant.
 * `src/view/nodeDensityThresholds.test.ts` parses the stylesheet — both rungs
 * and both chromes — and fails if any half drifts.
 */
export function revealMinNodePx(contentBoxRungPx: number, isCentral: boolean): number {
	return contentBoxRungPx + nodeVerticalChromePx(isCentral);
}

/** The preview rung as an ordinary (non-central) node height — see {@link revealMinNodePx}. */
export const PREVIEW_VISIBLE_MIN_NODE_PX = revealMinNodePx(PREVIEW_SLOT_REVEAL_CONTENT_BOX_PX, false);

/** The chip-row rung as an ordinary (non-central) node height — see {@link revealMinNodePx}. */
export const ATTACHMENT_ROW_VISIBLE_MIN_NODE_PX = revealMinNodePx(ATTACHMENT_ROW_REVEAL_CONTENT_BOX_PX, false);

// ---------------------------------------------------------------------------
// Content-fit size estimate (NodeSizer) + label width estimate.
//
// ESTIMATES of the node CSS, not measurements: the engine stays pure (no DOM),
// so these mirror `src/view/graph-view.css` the way NODE_TITLE_CHAR_WIDTH_PX
// always has. They only steer the box the layout hands React Flow — the CSS
// itself flexes whatever content into whatever box it gets (the outline
// scrolls, the thumbnail shrinks), and minPx/maxPx clamp the result anyway,
// so a few px of drift is invisible.
// ---------------------------------------------------------------------------

/**
 * Approximate glyph advance (px) of the node-title font (`--font-ui-smaller`,
 * ~12–13px in Obsidian's default theme). Used to size a node's width to fit its
 * title on one line.
 *
 * A slight OVER-estimate of the mean advance, deliberately: at a bare mean the
 * box came out a hair too narrow for SHORT titles whose glyphs run wider than
 * the mean (e.g. `money`, whose `m` alone is ~0.8em), and `overflow-wrap:
 * anywhere` then broke the trailing letter onto a second line (`mone` / `y` —
 * ticket nid_vtizb5sqefquytcnfe1r73ybe_e). The overshoot only widens sub-cap
 * titles, which is exactly where the wrap must not happen; a title past
 * {@link NODE_MAX_LABEL_WIDTH_PX} still pins to that cap and wraps onto the next
 * lines by design (the wrap, not width, is the safety net against ellipsis there).
 */
export const NODE_TITLE_CHAR_WIDTH_PX = 8;

/** Horizontal chrome around the title text: node padding (both sides) + border. */
export const NODE_LABEL_HORIZONTAL_PADDING_PX = 20;

/**
 * Upper bound on the label-driven node width. Beyond this a title stops widening
 * the node and instead wraps onto the next lines the title CSS allows
 * (`-webkit-line-clamp`). Set a bit above the 160px default max HEIGHT so a
 * long title gets some horizontal room before wrapping, while the node stays a
 * readable, not-too-wide box.
 */
export const NODE_MAX_LABEL_WIDTH_PX = 250;

/** Max rendered title lines (`-webkit-line-clamp: 4` in graph-view.css). */
export const NODE_TITLE_LINE_CLAMP = 4;

/**
 * Max rendered title lines on a node whose preview is its THUMBNAIL: the reveal
 * block in `graph-view.css` re-clamps `[data-preview="thumbnail"]` titles to 2,
 * so the fixed-height slot is never pushed out by a long name. The height
 * estimate must budget the same 2 lines the CSS will actually paint.
 */
export const THUMBNAIL_PREVIEW_TITLE_LINE_CLAMP = 2;

/**
 * Snug width (px) a note node needs to render its title on ONE line. Char-count
 * heuristic — see {@link NODE_TITLE_CHAR_WIDTH_PX}. Callers cap this at
 * {@link NODE_MAX_LABEL_WIDTH_PX} (a longer title wraps instead).
 */
export function estimateNodeLabelWidthPx(title: string): number {
	return Math.ceil(title.length * NODE_TITLE_CHAR_WIDTH_PX) + NODE_LABEL_HORIZONTAL_PADDING_PX;
}

/** One rendered title line (`--font-ui-smaller` × `line-height: 1.25`, rounded up). */
export const ESTIMATED_TITLE_LINE_PX = 17;

/** One rendered outline entry (`--font-smallest` × 1.5 + the entry's own padding). */
export const ESTIMATED_OUTLINE_ENTRY_PX = 18;

/** The attachment-chip row (chip padding + icon), present when a note has attachments. */
export const ESTIMATED_ATTACHMENT_ROW_PX = 22;

/**
 * The image thumbnail's slot (`--vicinity-graph-thumbnail-height`, also its
 * `min-height`, so it is a FLOOR the flexbox cannot shrink past). Counted like
 * any other region: a thumbnail node that also carries a chip row and a wrapped
 * title needs room for all three, or the chip row is pushed out through the
 * node's `overflow: hidden`.
 */
export const ESTIMATED_THUMBNAIL_SLOT_PX = 56;

/** Flex gap between the node's content regions (`--size-4-1`). */
export const NODE_REGION_GAP_PX = 4;

/**
 * Hard sanity bounds for a per-node size override ({@link import("./types").NodeSizeOverridePx}).
 * Q3 (decided 2026-08-03): an override may exceed the global `maxPx` dial or
 * undercut `minPx` — so these are deliberately WIDER than `NODE_SIZE_PX_BOUNDS`
 * (1..400) and exist only to keep the number usable as geometry:
 * - min 24: below that a node is no longer a grabbable/clickable box.
 * - max 1200: 3× the dial ceiling — past that one node fills the pane and the
 *   value is a typo/hand-edit, not a resize intent.
 */
export const NODE_OVERRIDE_HARD_MIN_PX = 24;
export const NODE_OVERRIDE_HARD_MAX_PX = 1200;

/**
 * THE per-node size-override box rule, shared by the persistence LOAD path and
 * the override WRITE path (store choke point) — never a bespoke guard that
 * could drift. These numbers become node geometry (React-Flow box → libavoid
 * obstacle), so a dimension that is NOT FINITE yields NO box (`undefined`)
 * rather than some invented number.
 *
 * WHY-NOT degrade a non-finite dimension to a bound, the way
 * {@link clampSizingNumber} degrades `NaN` to the field's spec DEFAULT: an
 * override has no default to fall back to — ABSENCE is what "no override"
 * means — so inventing 24px would persist a dot the user never asked for and
 * make a bug indistinguishable from a deliberate tiny node. Refusing matches
 * what the load path already does with an unusable `sizePx` (drops the field),
 * so the two paths cannot disagree about which boxes exist.
 *
 * WHY `±Infinity` is refused HERE but accepted by a settings dial (where it
 * means "as large/small as possible"): this value is not typed, it is MEASURED
 * off a drag-resize — an unmeasurable box states nothing about intent.
 */
export function clampNodeSizeOverridePx(size: NodeSizeOverridePx): NodeSizeOverridePx | undefined {
	if (!Number.isFinite(size.widthPx) || !Number.isFinite(size.heightPx)) {
		return undefined;
	}
	const clamp = (value: number): number =>
		Math.min(NODE_OVERRIDE_HARD_MAX_PX, Math.max(NODE_OVERRIDE_HARD_MIN_PX, value));
	return { widthPx: clamp(size.widthPx), heightPx: clamp(size.heightPx) };
}

// ---------------------------------------------------------------------------
// Settings input ranges — derived from SETTINGS_SPEC's per-field bounds.
// Single source of truth for the tuning-input limits: the settings surfaces
// take their bounds here and the same tables clamp on the way in, so
// out-of-range values are unreachable end-to-end. The WHY per field lives on
// `SETTINGS_SPEC.globalView.{forceLayout,sizing}`.
// ---------------------------------------------------------------------------

/** Inclusive slider/stepper bounds + step for one numeric settings field. */
export interface SettingsRange {
	readonly min: number;
	readonly max: number;
	readonly step: number;
}

/** Projects the `{min,max,step}` of a spec section's bounded fields into a range table. */
function rangesOf<TField extends string>(
	specSection: Readonly<Record<TField, SettingsRange>>,
): Readonly<Record<TField, SettingsRange>> {
	return Object.fromEntries(
		Object.entries<SettingsRange>(specSection).map(([field, spec]) => [
			field,
			{ min: spec.min, max: spec.max, step: spec.step },
		]),
	) as Readonly<Record<TField, SettingsRange>>;
}

/**
 * Clamps one value into `range`. `±Infinity` needs no special case — it carries
 * an intent ("as large/small as possible") that `Math.min`/`Math.max` already
 * resolve to the finite bound. `NaN` carries none and DOES: those two propagate
 * it rather than filtering it, so without this branch a bare min/max clamp
 * would let `NaN` straight through to the field's consumer.
 */
function clampIntoRange(value: number, range: SettingsRange, fallback: number): number {
	if (Number.isNaN(value)) {
		return fallback; // The field's spec default — the only meaning left.
	}
	return Math.min(range.max, Math.max(range.min, value));
}

export const FORCE_LAYOUT_RANGES: Readonly<Record<keyof ForceLayoutSettings, SettingsRange>> = rangesOf(
	SETTINGS_SPEC.globalView.forceLayout,
);

/** Clamps every field into its {@link FORCE_LAYOUT_RANGES} bounds (steps are a UI affordance, not enforced). */
export function clampForceLayoutSettings(settings: ForceLayoutSettings): ForceLayoutSettings {
	const spec = SETTINGS_SPEC.globalView.forceLayout;
	const clamp = (field: keyof ForceLayoutSettings): number =>
		clampIntoRange(settings[field], FORCE_LAYOUT_RANGES[field], spec[field].default);
	return {
		centerPullStrength: clamp("centerPullStrength"),
		repelStrength: clamp("repelStrength"),
		linkStrengthFactor: clamp("linkStrengthFactor"),
		linkGapPx: clamp("linkGapPx"),
		collidePaddingPx: clamp("collidePaddingPx"),
		elkNodeSpacingPx: clamp("elkNodeSpacingPx"),
		edgeRoutingClearancePx: clamp("edgeRoutingClearancePx"),
	};
}

/**
 * The bounded sizing fields — DERIVED from the spec, so a new bounded sizing
 * field fails to compile in {@link SIZING_RANGES} below until it is given a
 * range, instead of silently getting no range and no clamp.
 */
export type SizingRangeField = keyof SizingSpec;

export const SIZING_RANGES: Readonly<Record<SizingRangeField, SettingsRange>> = rangesOf({
	minPx: SETTINGS_SPEC.globalView.sizing.minPx,
	maxPx: SETTINGS_SPEC.globalView.sizing.maxPx,
	minImageHeightPx: SETTINGS_SPEC.globalView.sizing.minImageHeightPx,
});

/**
 * Clamps ONE sizing number exactly as {@link clampSizingSettings} clamps it. Exists
 * so a surface holding a single field (a panel row) can say what the write path will
 * STORE for a typed value without inventing a second clamp that could drift from it.
 */
export function clampSizingNumber(field: SizingRangeField, value: number): number {
	return clampIntoRange(value, SIZING_RANGES[field], SETTINGS_SPEC.globalView.sizing[field].default);
}

/**
 * Clamps every sizing number into its {@link SIZING_RANGES} bounds — applied on
 * the persistence-LOAD path, on every settings-WRITE path, and once more by the
 * sizer itself.
 *
 * Stricter than {@link clampForceLayoutSettings} (load-only) on purpose: these
 * numbers become node GEOMETRY (`sizePx` → React-Flow width/height → a libavoid
 * obstacle, and a non-finite rectangle ABORTS the router's wasm module for the
 * rest of the session), and a typed `-1` / `1e999` in a number input reaches the
 * live session without ever round-tripping through disk.
 *
 * Also enforces the ONE cross-field sizing rule — `maxPx >= minPx` — by RAISING
 * `maxPx`, because `minPx` and `maxPx` are clamped into the SAME range and so can
 * be inverted without either leaving its bounds. `NodeSizer` clamps the content
 * fit into `[minPx, maxPx]` and floors centrals at a point of that ramp, so an
 * inverted pair would size nodes backwards.
 *
 * WHY raise rather than swap or reset: raising never shrinks a node the user asked
 * to be big, and it keeps the Min/Max labels agreeing with the number typed under
 * them (a swap silently moves a value to the other row; a reset discards a
 * deliberately typed one). It is only ever reached from a hand-edited `data.json`
 * — both settings surfaces REFUSE an inverted pair with a message
 * (`describeSizingRejection`) before it gets here — so a slightly lossy rule is
 * fine: it never has to be explained to anyone.
 */
export function clampSizingSettings(settings: SizingSettings): SizingSettings {
	const minPx = clampSizingNumber("minPx", settings.minPx);
	return {
		minPx,
		// The CLAMPED minPx is the floor: raising to the typed one would drag maxPx
		// outside its own range, which is exactly what this function exists to prevent.
		maxPx: Math.max(minPx, clampSizingNumber("maxPx", settings.maxPx)),
		// An INDEPENDENT floor (no cross-field rule with the pair): it is applied ONLY
		// to image nodes and `NodeSizer` caps it at `maxPx` there, so it needs no
		// inversion repair here — just the same range clamp every sizing number gets.
		minImageHeightPx: clampSizingNumber("minImageHeightPx", settings.minImageHeightPx),
	};
}

/**
 * Stateless factory for default settings shapes (used by tests and step-03
 * seeding). Every value is projected from {@link SETTINGS_SPEC} `.default` — a
 * thin adapter, NOT a second source of truth.
 */
export class EngineDefaults {
	static depthSettings(): DepthSettings {
		const depths = SETTINGS_SPEC.globalDepths;
		return {
			linkDepthOut: depths.linkDepthOut.default,
			embedDepthOut: depths.embedDepthOut.default,
			linkDepthIn: depths.linkDepthIn.default,
			descendantDepth: depths.descendantDepth.default,
			ancestorDepth: depths.ancestorDepth.default,
			pinnedLinkDepthOut: depths.pinnedLinkDepthOut.default,
			pinnedEmbedDepthOut: depths.pinnedEmbedDepthOut.default,
			pinnedLinkDepthIn: depths.pinnedLinkDepthIn.default,
			pinnedDescendantDepth: depths.pinnedDescendantDepth.default,
			pinnedAncestorDepth: depths.pinnedAncestorDepth.default,
		};
	}

	static sizingSettings(): SizingSettings {
		const sizing = SETTINGS_SPEC.globalView.sizing;
		return {
			minPx: sizing.minPx.default,
			maxPx: sizing.maxPx.default,
			minImageHeightPx: sizing.minImageHeightPx.default,
		};
	}

	static nodeExclusionSettings(): NodeExclusionSettings {
		const exclusion = SETTINGS_SPEC.nodeExclusion;
		return { enabled: exclusion.enabled.default, patterns: [...exclusion.patterns.default] };
	}

	static frontmatterLinkSettings(): FrontmatterLinkSettings {
		return { idRefFields: SETTINGS_SPEC.frontmatterLinks.idRefFields.default };
	}

	static forceLayoutSettings(): ForceLayoutSettings {
		const forceLayout = SETTINGS_SPEC.globalView.forceLayout;
		return {
			centerPullStrength: forceLayout.centerPullStrength.default,
			repelStrength: forceLayout.repelStrength.default,
			linkStrengthFactor: forceLayout.linkStrengthFactor.default,
			linkGapPx: forceLayout.linkGapPx.default,
			collidePaddingPx: forceLayout.collidePaddingPx.default,
			elkNodeSpacingPx: forceLayout.elkNodeSpacingPx.default,
			edgeRoutingClearancePx: forceLayout.edgeRoutingClearancePx.default,
		};
	}

	static viewSettings(): ViewSettings {
		const view = SETTINGS_SPEC.globalView;
		return {
			nodeCap: view.nodeCap.default,
			outlineMaxDepth: view.outlineMaxDepth.default,
			nodePreviewPreference: view.nodePreviewPreference.default,
			showCrossLinks: view.showCrossLinks.default,
			sizing: EngineDefaults.sizingSettings(),
			forceLayout: EngineDefaults.forceLayoutSettings(),
		};
	}
}
