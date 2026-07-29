import { SETTINGS_SPEC } from "./SettingsSpec";
import type {
	DepthSettings,
	ForceLayoutSettings,
	NodeExclusionSettings,
	SizingSettings,
	ViewSettings,
} from "./types";

// ---------------------------------------------------------------------------
// Thin adapters over SETTINGS_SPEC (the single source of truth for every
// settings default AND limit — see `SettingsSpec.ts`). The WHY rationale for
// each value lives on the spec; these are mechanical projections of it.
// ---------------------------------------------------------------------------

/** @see SETTINGS_SPEC — `globalView.nodeCap.default`. */
export const DEFAULT_NODE_CAP = SETTINGS_SPEC.globalView.nodeCap.default;

/** @see SETTINGS_SPEC — `globalDepths.{outgoing,incoming}Depth.default`. */
export const DEFAULT_OUTGOING_DEPTH = SETTINGS_SPEC.globalDepths.outgoingDepth.default;
export const DEFAULT_INCOMING_DEPTH = SETTINGS_SPEC.globalDepths.incomingDepth.default;

/** @see SETTINGS_SPEC — `globalView.sizing.{minPx,maxPx}.default`. */
export const DEFAULT_MIN_NODE_PX = SETTINGS_SPEC.globalView.sizing.minPx.default;
export const DEFAULT_MAX_NODE_PX = SETTINGS_SPEC.globalView.sizing.maxPx.default;

/** @see SETTINGS_SPEC — `globalView.sizing.depthDecayK.default`. */
export const DEFAULT_DEPTH_DECAY_K = SETTINGS_SPEC.globalView.sizing.depthDecayK.default;

/** Lower bound of the node-cap input. @see SETTINGS_SPEC — `globalView.nodeCap.min`. */
export const MIN_NODE_CAP = SETTINGS_SPEC.globalView.nodeCap.min;

/** @see SETTINGS_SPEC — `globalView.outlineMaxDepth.{min,max}`. */
export const MIN_OUTLINE_DEPTH = SETTINGS_SPEC.globalView.outlineMaxDepth.min;
export const MAX_OUTLINE_DEPTH = SETTINGS_SPEC.globalView.outlineMaxDepth.max;

/**
 * THE outline-depth clamp, shared by the settings slider and the persistence
 * parser, so a hand-edited `data.json` cannot reach `0` (a silent off-switch the
 * feature deliberately does not have) or a level markdown does not define.
 * Rounds: heading levels are whole numbers.
 */
export function clampOutlineMaxDepth(value: number): number {
	return Math.min(MAX_OUTLINE_DEPTH, Math.max(MIN_OUTLINE_DEPTH, Math.round(value)));
}

/**
 * Depth-stepper input bounds (CLARIFICATION Q2) — an AFFORDANCE limit on the
 * toolbar/settings steppers, not an engine limit. @see SETTINGS_SPEC —
 * `globalDepths.outgoingDepth.{min,max}` (both depth fields share these bounds).
 */
export const MIN_STEPPER_DEPTH = SETTINGS_SPEC.globalDepths.outgoingDepth.min;
export const MAX_STEPPER_DEPTH = SETTINGS_SPEC.globalDepths.outgoingDepth.max;

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

/** The bounded sizing fields (`metrics` carries defaults only — its weights are bounded by `metricWeight`). */
type SizingRangeField = "metricWeight" | "depthDecayK" | "minPx" | "maxPx";

export const SIZING_RANGES: Readonly<Record<SizingRangeField, SettingsRange>> = rangesOf({
	metricWeight: SETTINGS_SPEC.globalView.sizing.metricWeight,
	depthDecayK: SETTINGS_SPEC.globalView.sizing.depthDecayK,
	minPx: SETTINGS_SPEC.globalView.sizing.minPx,
	maxPx: SETTINGS_SPEC.globalView.sizing.maxPx,
});

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
 */
export function clampSizingSettings(settings: SizingSettings): SizingSettings {
	const spec = SETTINGS_SPEC.globalView.sizing;
	const clamp = (field: SizingRangeField, value: number): number =>
		clampIntoRange(value, SIZING_RANGES[field], spec[field].default);
	const metrics = Object.fromEntries(
		Object.entries(settings.metrics).map(([metricId, metric]) => [
			metricId,
			{ ...metric, weight: clamp("metricWeight", metric.weight) },
		]),
	) as SizingSettings["metrics"];
	return {
		metrics,
		depthDecayK: clamp("depthDecayK", settings.depthDecayK),
		minPx: clamp("minPx", settings.minPx),
		maxPx: clamp("maxPx", settings.maxPx),
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
			outgoingDepth: depths.outgoingDepth.default,
			incomingDepth: depths.incomingDepth.default,
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
			sizing: EngineDefaults.sizingSettings(),
			forceLayout: EngineDefaults.forceLayoutSettings(),
		};
	}
}
