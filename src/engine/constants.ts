import { SETTINGS_SPEC } from "./SettingsSpec";
import type {
	DepthSettings,
	EdgeVisibilityMode,
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

/** @see SETTINGS_SPEC — `globalView.edgeVisibility.default`. */
export const DEFAULT_EDGE_VISIBILITY: EdgeVisibilityMode = SETTINGS_SPEC.globalView.edgeVisibility.default;

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

// ---------------------------------------------------------------------------
// Force-layout slider ranges — derived from SETTINGS_SPEC's per-field bounds.
// Single source of truth for the tuning-slider limits: the settings-tab sliders
// take their bounds here and the persistence parser clamps with the same table,
// so out-of-range values are unreachable end-to-end. The WHY per field lives on
// `SETTINGS_SPEC.globalView.forceLayout`.
// ---------------------------------------------------------------------------

/** Inclusive slider bounds + step for one force-layout field. */
export interface ForceLayoutRange {
	readonly min: number;
	readonly max: number;
	readonly step: number;
}

export const FORCE_LAYOUT_RANGES: Readonly<Record<keyof ForceLayoutSettings, ForceLayoutRange>> =
	Object.fromEntries(
		Object.entries(SETTINGS_SPEC.globalView.forceLayout).map(([field, spec]) => [
			field,
			{ min: spec.min, max: spec.max, step: spec.step },
		]),
	) as Readonly<Record<keyof ForceLayoutSettings, ForceLayoutRange>>;

/** Clamps every field into its {@link FORCE_LAYOUT_RANGES} bounds (steps are a UI affordance, not enforced). */
export function clampForceLayoutSettings(settings: ForceLayoutSettings): ForceLayoutSettings {
	const clamp = (field: keyof ForceLayoutSettings): number => {
		const range = FORCE_LAYOUT_RANGES[field];
		return Math.min(range.max, Math.max(range.min, settings[field]));
	};
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
			groupByFolder: view.groupByFolder.default,
			edgeVisibility: view.edgeVisibility.default,
			sizing: EngineDefaults.sizingSettings(),
			forceLayout: EngineDefaults.forceLayoutSettings(),
		};
	}
}
