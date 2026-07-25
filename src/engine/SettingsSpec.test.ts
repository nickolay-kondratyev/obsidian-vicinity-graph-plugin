import { describe, expect, it } from "vitest";
import {
	DEFAULT_EDGE_VISIBILITY,
	DEFAULT_INCOMING_DEPTH,
	DEFAULT_MAX_NODE_PX,
	DEFAULT_MIN_NODE_PX,
	DEFAULT_NODE_CAP,
	DEFAULT_OUTGOING_DEPTH,
	EngineDefaults,
	FORCE_LAYOUT_RANGES,
	MAX_OUTLINE_DEPTH,
	MAX_STEPPER_DEPTH,
	MIN_NODE_CAP,
	MIN_OUTLINE_DEPTH,
	MIN_STEPPER_DEPTH,
	clampOutlineMaxDepth,
} from "./constants";
import { SETTINGS_SPEC } from "./SettingsSpec";
import type { DepthSpec, NodeExclusionSpec, ViewSpec } from "./SettingsSpec";
import { SettingsDefaults } from "./SettingsDefaults";

/**
 * Refactor guard: SETTINGS_SPEC is the SINGLE source of truth for every settings
 * default and limit. These tests pin the exact shipped baseline (so a future
 * edit that drifts a value fails loudly) AND prove the adapters (`EngineDefaults`,
 * `FORCE_LAYOUT_RANGES`, the view bounds) are mechanical projections of the spec.
 */

/**
 * Exhaustiveness guard for the "exact shipped baseline" tests below: a baseline
 * literal annotated `satisfies EverySpecField<SomeSpec>` MUST carry one entry per
 * field of that spec section. WHY: these baselines used to be hand-listed, so a
 * newly added spec field (this happened with `outlineMaxDepth`) was simply never
 * baselined and nothing went red. Now it is a `npm run check` error instead.
 */
type EverySpecField<TSpec> = Record<keyof TSpec, unknown>;

/** Baseline entry for a spec field that is default-only (no min/max/step to pin). */
const NO_SPEC_LIMITS = "no limits in the spec";

describe("SETTINGS_SPEC (single source of truth for defaults + limits)", () => {
	it("WHEN the spec is read THEN its default values equal the exact shipped baseline", () => {
		const view = SETTINGS_SPEC.globalView;
		const viewDefaults = {
			nodeCap: view.nodeCap.default,
			outlineMaxDepth: view.outlineMaxDepth.default,
			nodePreviewPreference: view.nodePreviewPreference.default,
			groupByFolder: view.groupByFolder.default,
			edgeVisibility: view.edgeVisibility.default,
			sizing: {
				metrics: Object.fromEntries(
					Object.entries(view.sizing.metrics).map(([id, m]) => [id, m.default]),
				),
				depthDecayK: view.sizing.depthDecayK.default,
				minPx: view.sizing.minPx.default,
				maxPx: view.sizing.maxPx.default,
			},
			forceLayout: Object.fromEntries(
				Object.entries(view.forceLayout).map(([field, s]) => [field, s.default]),
			),
		} satisfies EverySpecField<ViewSpec>;
		expect({
			globalDepths: {
				outgoingDepth: SETTINGS_SPEC.globalDepths.outgoingDepth.default,
				incomingDepth: SETTINGS_SPEC.globalDepths.incomingDepth.default,
			} satisfies EverySpecField<DepthSpec>,
			...viewDefaults,
			nodeExclusion: {
				enabled: SETTINGS_SPEC.nodeExclusion.enabled.default,
				patterns: SETTINGS_SPEC.nodeExclusion.patterns.default,
			} satisfies EverySpecField<NodeExclusionSpec>,
		}).toEqual({
			globalDepths: { outgoingDepth: 1, incomingDepth: 1 },
			nodeCap: 100,
			outlineMaxDepth: 2,
			nodePreviewPreference: "auto",
			groupByFolder: true,
			edgeVisibility: "walked-from-center",
			sizing: {
				metrics: {
					"own-file-size": { enabled: true, weight: 1 },
					"total-linker-size": { enabled: false, weight: 1 },
					"backlink-count": { enabled: false, weight: 1 },
					"outlink-count": { enabled: false, weight: 1 },
					"depth-decay": { enabled: false, weight: 1 },
				},
				depthDecayK: 1,
				minPx: 40,
				maxPx: 160,
			},
			forceLayout: {
				centerPullStrength: 0.05,
				repelStrength: 300,
				linkStrengthFactor: 1,
				linkGapPx: 40,
				collidePaddingPx: 50,
				elkNodeSpacingPx: 40,
				edgeRoutingClearancePx: 11,
			},
			nodeExclusion: { enabled: false, patterns: [] },
		});
	});

	it("WHEN the spec is read THEN its limits equal the exact shipped baseline", () => {
		const view = SETTINGS_SPEC.globalView;
		const viewLimits = {
			nodeCap: { min: view.nodeCap.min },
			outlineMaxDepth: {
				min: view.outlineMaxDepth.min,
				max: view.outlineMaxDepth.max,
				step: view.outlineMaxDepth.step,
			},
			nodePreviewPreference: NO_SPEC_LIMITS,
			groupByFolder: NO_SPEC_LIMITS,
			edgeVisibility: NO_SPEC_LIMITS,
			sizing: NO_SPEC_LIMITS,
			forceLayout: Object.fromEntries(
				Object.entries(view.forceLayout).map(([field, s]) => [
					field,
					{ min: s.min, max: s.max, step: s.step },
				]),
			),
		} satisfies EverySpecField<ViewSpec>;
		expect({
			depthStepper: {
				min: SETTINGS_SPEC.globalDepths.outgoingDepth.min,
				max: SETTINGS_SPEC.globalDepths.outgoingDepth.max,
			},
			...viewLimits,
		}).toEqual({
			depthStepper: { min: 0, max: 5 },
			nodeCap: { min: 1 },
			outlineMaxDepth: { min: 1, max: 6, step: 1 },
			nodePreviewPreference: NO_SPEC_LIMITS,
			groupByFolder: NO_SPEC_LIMITS,
			edgeVisibility: NO_SPEC_LIMITS,
			sizing: NO_SPEC_LIMITS,
			forceLayout: {
				centerPullStrength: { min: 0, max: 0.15, step: 0.01 },
				repelStrength: { min: 50, max: 1000, step: 10 },
				linkStrengthFactor: { min: 0.25, max: 4, step: 0.05 },
				linkGapPx: { min: 10, max: 250, step: 5 },
				collidePaddingPx: { min: 0, max: 100, step: 5 },
				elkNodeSpacingPx: { min: 10, max: 120, step: 5 },
				edgeRoutingClearancePx: { min: 6, max: 14, step: 1 },
			},
		});
	});
});

describe("adapters derive from SETTINGS_SPEC", () => {
	it("WHEN EngineDefaults.viewSettings is built THEN it projects the spec defaults", () => {
		expect(EngineDefaults.viewSettings()).toEqual({
			nodeCap: SETTINGS_SPEC.globalView.nodeCap.default,
			outlineMaxDepth: SETTINGS_SPEC.globalView.outlineMaxDepth.default,
			nodePreviewPreference: SETTINGS_SPEC.globalView.nodePreviewPreference.default,
			groupByFolder: SETTINGS_SPEC.globalView.groupByFolder.default,
			edgeVisibility: SETTINGS_SPEC.globalView.edgeVisibility.default,
			sizing: EngineDefaults.sizingSettings(),
			forceLayout: EngineDefaults.forceLayoutSettings(),
		});
	});

	it("WHEN EngineDefaults.depthSettings is built THEN it projects the spec depth defaults", () => {
		expect(EngineDefaults.depthSettings()).toEqual({ outgoingDepth: 1, incomingDepth: 1 });
	});

	it("WHEN EngineDefaults.nodeExclusionSettings is built THEN it projects the spec exclusion defaults", () => {
		expect(EngineDefaults.nodeExclusionSettings()).toEqual({ enabled: false, patterns: [] });
	});

	it("WHEN sizingSettings is built twice THEN each call returns deep-equal but fresh metric objects", () => {
		const first = EngineDefaults.sizingSettings();
		const second = EngineDefaults.sizingSettings();
		expect(first.metrics["own-file-size"]).toEqual(second.metrics["own-file-size"]);
		expect(first.metrics["own-file-size"]).not.toBe(second.metrics["own-file-size"]);
	});

	it("WHEN FORCE_LAYOUT_RANGES is read THEN each field mirrors the spec's min/max/step", () => {
		for (const [field, spec] of Object.entries(SETTINGS_SPEC.globalView.forceLayout)) {
			expect(FORCE_LAYOUT_RANGES[field as keyof typeof FORCE_LAYOUT_RANGES]).toEqual({
				min: spec.min,
				max: spec.max,
				step: spec.step,
			});
		}
	});

	it("WHEN the DEFAULT_* named constants are read THEN they alias the spec defaults", () => {
		expect({
			DEFAULT_NODE_CAP,
			DEFAULT_OUTGOING_DEPTH,
			DEFAULT_INCOMING_DEPTH,
			DEFAULT_MIN_NODE_PX,
			DEFAULT_MAX_NODE_PX,
			DEFAULT_EDGE_VISIBILITY,
		}).toEqual({
			DEFAULT_NODE_CAP: 100,
			DEFAULT_OUTGOING_DEPTH: 1,
			DEFAULT_INCOMING_DEPTH: 1,
			DEFAULT_MIN_NODE_PX: 40,
			DEFAULT_MAX_NODE_PX: 160,
			DEFAULT_EDGE_VISIBILITY: "walked-from-center",
		});
	});

	it("WHEN the view bound constants are read THEN they alias the spec limits", () => {
		expect({ MIN_NODE_CAP, MIN_STEPPER_DEPTH, MAX_STEPPER_DEPTH }).toEqual({
			MIN_NODE_CAP: 1,
			MIN_STEPPER_DEPTH: 0,
			MAX_STEPPER_DEPTH: 5,
		});
	});
});

describe("SettingsDefaults discoverability shim", () => {
	it("WHEN SettingsDefaults.SPEC is read THEN it points at the real SETTINGS_SPEC", () => {
		expect(SettingsDefaults.SPEC).toBe(SETTINGS_SPEC);
	});
});

describe("outline depth spec (CLARIFICATION Q1 + Q5)", () => {
	it("WHEN the spec is read THEN the outline depth default is the shipped baseline of 2", () => {
		expect(SETTINGS_SPEC.globalView.outlineMaxDepth.default).toBe(2);
	});

	it("WHEN the spec is read THEN the outline depth limits are the shipped baseline 1..6", () => {
		const spec = SETTINGS_SPEC.globalView.outlineMaxDepth;
		expect({ min: spec.min, max: spec.max, step: spec.step }).toEqual({ min: 1, max: 6, step: 1 });
	});

	it("WHEN a value below the spec min is clamped THEN the min comes back (never a silent off-switch)", () => {
		expect(clampOutlineMaxDepth(0)).toBe(MIN_OUTLINE_DEPTH);
	});

	it("WHEN a value above the spec max is clamped THEN the max comes back", () => {
		expect(clampOutlineMaxDepth(99)).toBe(MAX_OUTLINE_DEPTH);
	});

	it("WHEN a fractional value is clamped THEN it rounds to a whole heading level", () => {
		expect(clampOutlineMaxDepth(2.4)).toBe(2);
	});
});
