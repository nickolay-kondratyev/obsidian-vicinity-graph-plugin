import type { DepthSettings, ForceLayoutSettings, NodePreviewPreference, SizeMetricId } from "../engine";
import {
	FORCE_LAYOUT_RANGES,
	MIN_NODE_CAP,
	SETTINGS_SPEC,
	SIZING_RANGES,
	clampOutlineMaxDepth,
	clampSizingNumber,
} from "../engine";
import { clampStepperDepth } from "./constants";
import type { SettingsRowState } from "./settingsRows";
import type { SettingsInteraction, SizingNumberField } from "./settingsWritePlan";
import { parseSizingInput } from "./sizingInput";

/**
 * THE VALUE HALF of the settings row contract: for each control kind, WHERE its
 * value lives in the globals, WHICH bounds it moves between, and WHAT
 * {@link SettingsInteraction} changes it. The copy half — label, description,
 * grouping, order, accessible naming — lives in `settingsRows.ts`.
 *
 * WHY it exists: both presenters (`VicinityGraphSettingTab`, `SettingsRowView`) used
 * to re-derive all three per control kind, so `state.globalView.sizing[field]`, the
 * range-table lookup, the clamp and the interaction literal were written twice — and
 * two step constants were literally declared in both files. None of that is
 * presentation. With it, each presenter arm is markup plus one accessor call.
 *
 * WHY A SIBLING MODULE and not `settingsRows.ts`: that module answers "what rows
 * exist and how are they worded"; this one answers "where does a row's value live and
 * what write moves it" — a different reason to change (SRP). It also keeps
 * `settingsRows.ts` pure DATA, which matters because `e2e/settingsBaseline.ts` imports
 * it in the node-side Playwright process: nothing in e2e needs an accessor, so the
 * engine range tables and clamps this module pulls in stay out of that import graph.
 *
 * View-layer and PURE, like `settingsRows.ts`: no `obsidian`, no `react`.
 */

/**
 * The bounds a numeric control renders.
 *
 * `max` is OPTIONAL because one shipped field genuinely has no upper bound: the node
 * cap is declared `min`-only in `SETTINGS_SPEC` (a `MinBoundedNumberSpec`), and
 * inventing a ceiling for it here would be a behavior change. A SLIDER row is
 * therefore only sound on a field that HAS a max — true of every slider-backed kind
 * declared today (outline depth, force layout), and not expressible in this type.
 */
export interface SettingsRowBounds {
	readonly min: number;
	readonly max?: number;
	readonly step: number;
}

/**
 * One control's value: read it out of the globals, and name the write that changes it.
 *
 * Both surfaces read through this, so neither can reach into a slice of `state`
 * directly and neither can spell an interaction literal of its own.
 */
export interface SettingsValueAccessor<T> {
	read(state: SettingsRowState): T;
	interaction(value: T): SettingsInteraction;
}

/**
 * A numeric control additionally owns its bounds and its clamp.
 *
 * {@link interaction} emits `settlesAt(value)`, so the value WRITTEN and the value a
 * surface shows optimistically are the same number by construction — the settings tab
 * used to clamp inside the interaction while the panel clamped only its display, which
 * is exactly the kind of split this module removes.
 */
export interface SettingsNumberAccessor extends SettingsValueAccessor<number> {
	readonly bounds: SettingsRowBounds;
	/** What the write path will actually STORE for a requested value; identity when nothing clamps it. */
	settlesAt(value: number): number;
}

/** A numeric control the user TYPES into — it must also say what counts as a typed value. */
export interface SettingsTypedNumberAccessor extends SettingsNumberAccessor {
	/** `undefined` ⇒ mid-edit or out of spec: nothing may be written yet. */
	accept(raw: string): number | undefined;
}

/**
 * The node cap is a whole number of nodes. Declared HERE and only here — the spec
 * gives `nodeCap` a `min` and no step, and both presenters used to carry their own
 * copy of this literal.
 */
const NODE_CAP_STEP = 1;

/** A field the write path stores verbatim. */
function unclamped(value: number): number {
	return value;
}

/** Projects a bounded spec leaf onto the bounds a control renders. */
function boundsOf(spec: { readonly min: number; readonly max: number; readonly step: number }): SettingsRowBounds {
	return { min: spec.min, max: spec.max, step: spec.step };
}

export class SettingsRowAccessors {
	/** One global depth budget. Clamped by the SAME clamp every depth stepper applies. */
	static depth(field: keyof DepthSettings): SettingsNumberAccessor {
		return {
			bounds: boundsOf(SETTINGS_SPEC.globalDepths[field]),
			read: (state) => state.globalDepths[field],
			settlesAt: clampStepperDepth,
			interaction: (value) => ({ kind: "global-depth", field, value: clampStepperDepth(value) }),
		};
	}

	/** One sizing number (min/max px, depth decay k). Clamped exactly as `planSettingsWrite` clamps it. */
	static sizingNumber(field: SizingNumberField): SettingsTypedNumberAccessor {
		const settlesAt = (value: number): number => clampSizingNumber(field, value);
		return {
			bounds: SIZING_RANGES[field],
			read: (state) => state.globalView.sizing[field],
			settlesAt,
			accept: parseSizingInput,
			interaction: (value) => ({ kind: "global-sizing-number", field, value: settlesAt(value) }),
		};
	}

	/** Whether one size metric contributes at all. */
	static metricEnabled(metric: SizeMetricId): SettingsValueAccessor<boolean> {
		return {
			read: (state) => state.globalView.sizing.metrics[metric].enabled,
			interaction: (enabled) => ({ kind: "global-sizing-metric-enabled", metric, enabled }),
		};
	}

	/** One size metric's contribution weight — bounded by the shared `metricWeight` range. */
	static metricWeight(metric: SizeMetricId): SettingsTypedNumberAccessor {
		const settlesAt = (value: number): number => clampSizingNumber("metricWeight", value);
		return {
			bounds: SIZING_RANGES.metricWeight,
			read: (state) => state.globalView.sizing.metrics[metric].weight,
			settlesAt,
			accept: parseSizingInput,
			interaction: (weight) => ({ kind: "global-sizing-metric-weight", metric, weight: settlesAt(weight) }),
		};
	}

	/** Deepest heading level a node's outline renders. */
	static outlineDepth(): SettingsNumberAccessor {
		return {
			bounds: boundsOf(SETTINGS_SPEC.globalView.outlineMaxDepth),
			read: (state) => state.globalView.outlineMaxDepth,
			settlesAt: clampOutlineMaxDepth,
			interaction: (value) => ({ kind: "global-outline-depth", value: clampOutlineMaxDepth(value) }),
		};
	}

	/** One force-layout tuning value. Bounds come from the table the persistence parser clamps with. */
	static forceLayout(field: keyof ForceLayoutSettings): SettingsNumberAccessor {
		return {
			bounds: FORCE_LAYOUT_RANGES[field],
			read: (state) => state.globalView.forceLayout[field],
			settlesAt: unclamped,
			interaction: (value) => ({ kind: "global-force-layout-field", field, value }),
		};
	}

	/**
	 * Maximum number of non-central nodes rendered.
	 *
	 * NOT {@link parseSizingInput}: a cap is a whole number of nodes and the write path
	 * does not clamp it, so a half-typed or out-of-range entry must not be written at all.
	 */
	static nodeCap(): SettingsTypedNumberAccessor {
		return {
			bounds: { min: MIN_NODE_CAP, step: NODE_CAP_STEP },
			read: (state) => state.globalView.nodeCap,
			settlesAt: unclamped,
			accept: (raw) => {
				const value = Number(raw);
				return Number.isInteger(value) && value >= MIN_NODE_CAP ? value : undefined;
			},
			interaction: (value) => ({ kind: "global-cap", value }),
		};
	}

	/** Which preview a node's preview slot shows. */
	static nodePreview(): SettingsValueAccessor<NodePreviewPreference> {
		return {
			read: (state) => state.globalView.nodePreviewPreference,
			interaction: (value) => ({ kind: "global-node-preview", value }),
		};
	}

	/** Whether node exclusion applies at all (the pattern list is untouched). */
	static exclusionEnabled(): SettingsValueAccessor<boolean> {
		return {
			read: (state) => state.nodeExclusion.enabled,
			interaction: (enabled) => ({ kind: "global-exclusion-enabled", enabled }),
		};
	}

	/** The exclusion pattern list (the enable flag is untouched). */
	static exclusionPatterns(): SettingsValueAccessor<readonly string[]> {
		return {
			read: (state) => state.nodeExclusion.patterns,
			interaction: (patterns) => ({ kind: "global-exclusion-patterns", patterns }),
		};
	}
}
