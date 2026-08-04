import { SETTINGS_SPEC } from "./SettingsSpec";
// Separate statement: the line above is a VALUE import, and `isolatedModules`
// needs the type to come across as a type.
import type { SizingSpec } from "./SettingsSpec";
import type {
	DepthSettings,
	ForceLayoutSettings,
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
 * Normalized value when a metric cannot discriminate (all raw values equal,
 * e.g. single-node graph or all-zero-byte notes): the neutral midpoint.
 */
export const NEUTRAL_NORMALIZED_VALUE = 0.5;

/**
 * Centrals (MAIN + pinned, even when disconnected from MAIN) bypass metric
 * composition and get the top score → max pixel size.
 */
export const CENTRAL_SIZE_SCORE = 1;

/**
 * Content-box height (px) at which `src/view/graph-view.css` reveals the node's
 * image thumbnail — its density budget for the fixed-height thumbnail slot on
 * top of two title lines and one attachment-chip row.
 *
 * NOT a node height: a CSS size container query measures the container's CONTENT
 * box, so this number must be grown by {@link NODE_VERTICAL_CHROME_PX} before it
 * can be compared to `sizePx`.
 */
const THUMBNAIL_REVEAL_CONTENT_BOX_PX = 104;

/**
 * How much taller a node's BORDER box is than the content box the container
 * query sees: `.vicinity-graph-node` is `box-sizing: border-box` with a 1px
 * border and `--size-4-2` (8px) of padding, top and bottom.
 *
 * (The `[data-tier]` centrals use a 2px border, so their chrome is 20 — not
 * modelled here. Centrals are sized at `maxPx`, so they clear the reveal on
 * their own only once `maxPx >= 124`; between 122 and 123 a central hides its
 * thumbnail while a non-central of the same height shows one. Deliberately left
 * unmodelled: the default `maxPx` is 160, and that 2px band is not worth a
 * per-tier floor.)
 */
export const NODE_VERTICAL_CHROME_PX = 2 * (1 + 8);

/**
 * Node height (px) at which a note's image thumbnail is actually displayed —
 * the CSS reveal threshold expressed as the border-box height React Flow gives
 * the node. Nodes below it show the title only, so a note that HAS an image but
 * scores low would never display it: {@link NodeSizer} floors image-bearing
 * nodes here.
 *
 * DUPLICATED KNOWLEDGE, deliberately guarded: the reveal itself is a CSS
 * container query and CSS cannot import a TS constant.
 * `src/view/thumbnailDensityThreshold.test.ts` parses the stylesheet — both the
 * threshold and the chrome — and fails if either half drifts.
 */
export const THUMBNAIL_VISIBLE_MIN_NODE_PX = THUMBNAIL_REVEAL_CONTENT_BOX_PX + NODE_VERTICAL_CHROME_PX;

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
 * THE per-node size-override clamp, shared by the persistence LOAD path and the
 * override WRITE path (store choke point) — never a bespoke guard that could
 * drift. These numbers become node geometry (React-Flow box → libavoid
 * obstacle), so like every sizing clamp it must be total: `NaN` carries no
 * intent and degrades to the hard minimum (the load path never reaches this —
 * non-finite fields are dropped there — this is the write-path backstop).
 */
export function clampNodeSizeOverridePx(size: NodeSizeOverridePx): NodeSizeOverridePx {
	const clamp = (value: number): number =>
		Number.isNaN(value)
			? NODE_OVERRIDE_HARD_MIN_PX
			: Math.min(NODE_OVERRIDE_HARD_MAX_PX, Math.max(NODE_OVERRIDE_HARD_MIN_PX, value));
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
 * (`metrics` carries defaults only — its weights are bounded by `metricWeight`.)
 */
export type SizingRangeField = Exclude<keyof SizingSpec, "metrics">;

export const SIZING_RANGES: Readonly<Record<SizingRangeField, SettingsRange>> = rangesOf({
	metricWeight: SETTINGS_SPEC.globalView.sizing.metricWeight,
	depthDecayK: SETTINGS_SPEC.globalView.sizing.depthDecayK,
	minPx: SETTINGS_SPEC.globalView.sizing.minPx,
	maxPx: SETTINGS_SPEC.globalView.sizing.maxPx,
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
 * be inverted without either leaving its bounds. `NodeSizer` reads the pair as
 * `minPx + score * (maxPx - minPx)`, so an inverted pair is a finite but BACKWARDS
 * ramp: the most relevant note draws smallest.
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
	const metrics = Object.fromEntries(
		Object.entries(settings.metrics).map(([metricId, metric]) => [
			metricId,
			{ ...metric, weight: clampSizingNumber("metricWeight", metric.weight) },
		]),
	) as SizingSettings["metrics"];
	const minPx = clampSizingNumber("minPx", settings.minPx);
	return {
		metrics,
		depthDecayK: clampSizingNumber("depthDecayK", settings.depthDecayK),
		minPx,
		// The CLAMPED minPx is the floor: raising to the typed one would drag maxPx
		// outside its own range, which is exactly what this function exists to prevent.
		maxPx: Math.max(minPx, clampSizingNumber("maxPx", settings.maxPx)),
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
			pinnedLinkDepthOut: depths.pinnedLinkDepthOut.default,
			pinnedEmbedDepthOut: depths.pinnedEmbedDepthOut.default,
			pinnedLinkDepthIn: depths.pinnedLinkDepthIn.default,
		};
	}

	static sizingSettings(): SizingSettings {
		const sizing = SETTINGS_SPEC.globalView.sizing;
		const metrics = Object.fromEntries(
			// Defensive per-metric copy: never hand out the spec's own leaf object,
			// so a future in-place mutation of a default can't corrupt SETTINGS_SPEC.
			Object.entries(sizing.metrics).map(([metricId, metric]) => [metricId, { ...metric.default }]),
		) as SizingSettings["metrics"];
		return {
			metrics,
			depthDecayK: sizing.depthDecayK.default,
			minPx: sizing.minPx.default,
			maxPx: sizing.maxPx.default,
		};
	}

	static nodeExclusionSettings(): NodeExclusionSettings {
		const exclusion = SETTINGS_SPEC.nodeExclusion;
		return { enabled: exclusion.enabled.default, patterns: [...exclusion.patterns.default] };
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
