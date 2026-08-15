import { describe, expect, it } from "vitest";
import {
	EngineDefaults,
	FORCE_LAYOUT_RANGES,
	MAX_STEPPER_DEPTH,
	MIN_STEPPER_DEPTH,
	SIZING_RANGES,
} from "./constants";
import { SETTINGS_SPEC } from "./SettingsSpec";
import { SettingsDefaults } from "./SettingsDefaults";
import {
	BOUNDS_ONLY_SPEC_LEAF_IDS,
	EVERY_SETTINGS_SPEC_LEAF,
	SETTINGS_FIELD_LEAVES,
	defaultSettingsRoot,
	readLeaf,
} from "./testFixtures/settingsSpecLeaves";

/**
 * SETTINGS_SPEC is the SINGLE source of truth for every settings default and limit.
 * This file asserts the spec's STRUCTURAL invariants and proves the adapters
 * (`EngineDefaults`, `FORCE_LAYOUT_RANGES`, `SIZING_RANGES`, the `MIN_*`/`MAX_*`
 * bound aliases) are mechanical projections of it.
 *
 * It ITERATES `EVERY_SETTINGS_SPEC_LEAF` rather than restating the shipped values.
 * WHY-NOT the two hand-built `toEqual` baselines this replaced: they duplicated every
 * default and every bound, so an intentional retune had to be re-typed in two places
 * and went stale twice for real (`collidePaddingPx`, `elkNodeSpacingPx`) — while STILL
 * saying nothing about whether a field was wired into anything.
 *
 * The few defaults that carry product meaning (and so SHOULD fail loudly when they
 * move) are pinned as literals in exactly one place: `settingsProductDefaults.test.ts`.
 */
/**
 * Leaves whose default is deliberately OUTSIDE their finite bounds because it is a
 * non-finite value the control reaches through a stop past the finite range.
 *
 * `globalView.folderGroupingDepth` (ticket `nid_rndi5sulwrsx1aq0x4xqcskrb_e`): its slider
 * runs 0..max and then one ∞ stop; the default is ∞ (unlimited nesting), which is a REAL
 * reachable selection, not a number inside `[min, max]`. Listed rather than tolerated so a
 * SECOND such leaf must be added here on purpose, and so the invariant still bites every
 * other bounded field.
 */
const DEFAULT_OUTSIDE_FINITE_BOUNDS_LEAF_IDS: readonly string[] = ["globalView.folderGroupingDepth"];

describe("SETTINGS_SPEC structure (every leaf, no hand-enumerated values)", () => {
	it("WHEN the spec is walked THEN every declared section contributes leaves (the walk is not vacuous)", () => {
		const sectionsWithoutLeaves = Object.keys(SETTINGS_SPEC).filter(
			(section) => !EVERY_SETTINGS_SPEC_LEAF.some((leaf) => leaf.path[0] === section),
		);
		expect(sectionsWithoutLeaves).toEqual([]);
	});

	it("WHEN the spec is walked THEN every leaf carries a defined default", () => {
		expect(EVERY_SETTINGS_SPEC_LEAF.filter((leaf) => leaf.default === undefined)).toEqual([]);
	});

	it("WHEN a leaf declares bounds THEN its own default sits inside them", () => {
		const outside = EVERY_SETTINGS_SPEC_LEAF.filter((leaf) => {
			const { bounds } = leaf;
			if (bounds === undefined || typeof leaf.default !== "number") {
				return false;
			}
			if (DEFAULT_OUTSIDE_FINITE_BOUNDS_LEAF_IDS.includes(leaf.id)) {
				// The declared exception: this leaf's default is a non-finite value that
				// the control reaches through a stop BEYOND the finite bounds (see below).
				return false;
			}
			return leaf.default < bounds.min || (bounds.max !== undefined && leaf.default > bounds.max);
		}).map((leaf) => leaf.id);
		expect(outside).toEqual([]);
	});

	it("WHEN a leaf declares both bounds THEN the range is non-degenerate (a collapsed range makes every clamp trivially pass)", () => {
		const collapsed = EVERY_SETTINGS_SPEC_LEAF.filter(
			(leaf) => leaf.bounds?.max !== undefined && leaf.bounds.max <= leaf.bounds.min,
		).map((leaf) => leaf.id);
		expect(collapsed).toEqual([]);
	});

	it("WHEN a leaf declares a step THEN it is positive and no wider than the range itself", () => {
		const unusable = EVERY_SETTINGS_SPEC_LEAF.filter((leaf) => {
			const { bounds } = leaf;
			if (bounds?.step === undefined || bounds.max === undefined) {
				return false;
			}
			return bounds.step <= 0 || bounds.step > bounds.max - bounds.min;
		}).map((leaf) => leaf.id);
		expect(unusable).toEqual([]);
	});

	it("WHEN a leaf is declared bounds-only THEN it really is a leaf of the spec (the exception list cannot rot)", () => {
		const stale = BOUNDS_ONLY_SPEC_LEAF_IDS.filter(
			(id) => !EVERY_SETTINGS_SPEC_LEAF.some((leaf) => leaf.id === id),
		);
		expect(stale).toEqual([]);
	});

	it("WHEN a leaf is declared bounds-only THEN no settings field carries it (else it belongs in the field list)", () => {
		const root = defaultSettingsRoot();
		const reachable = EVERY_SETTINGS_SPEC_LEAF.filter(
			(leaf) => BOUNDS_ONLY_SPEC_LEAF_IDS.includes(leaf.id) && readLeaf(root, leaf) !== undefined,
		).map((leaf) => leaf.id);
		expect(reachable).toEqual([]);
	});
});

describe("adapters derive from SETTINGS_SPEC", () => {
	it("WHEN EngineDefaults builds the settings root THEN every spec leaf's default is what the root carries", () => {
		// This replaces the old hand-typed defaults baseline: it covers EVERY leaf,
		// including one added tomorrow, and fails naming a field `EngineDefaults`
		// forgot to project (the value comes back `undefined`).
		const root = defaultSettingsRoot();
		const drifted = SETTINGS_FIELD_LEAVES.filter(
			(leaf) => JSON.stringify(readLeaf(root, leaf)) !== JSON.stringify(leaf.default),
		).map((leaf) => ({ id: leaf.id, declared: leaf.default, built: readLeaf(root, leaf) }));
		expect(drifted).toEqual([]);
	});

	it("WHEN sizingSettings is built twice THEN each call returns deep-equal but fresh objects", () => {
		const first = EngineDefaults.sizingSettings();
		const second = EngineDefaults.sizingSettings();
		expect(first).toEqual(second);
		expect(first).not.toBe(second);
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

	it("WHEN SIZING_RANGES is read THEN each field mirrors the spec's min/max/step", () => {
		const drifted = Object.entries(SIZING_RANGES).filter(([field, range]) => {
			const spec = SETTINGS_SPEC.globalView.sizing[field as keyof typeof SIZING_RANGES];
			return JSON.stringify(range) !== JSON.stringify({ min: spec.min, max: spec.max, step: spec.step });
		});
		expect(drifted).toEqual([]);
	});

	it("WHEN the view bound constants are read THEN they alias the spec limits", () => {
		expect({ MIN_STEPPER_DEPTH, MAX_STEPPER_DEPTH }).toEqual({
			MIN_STEPPER_DEPTH: SETTINGS_SPEC.globalDepths.linkDepthOut.min,
			MAX_STEPPER_DEPTH: SETTINGS_SPEC.globalDepths.linkDepthOut.max,
		});
	});
});

describe("SettingsDefaults discoverability shim", () => {
	it("WHEN SettingsDefaults.SPEC is read THEN it points at the real SETTINGS_SPEC", () => {
		expect(SettingsDefaults.SPEC).toBe(SETTINGS_SPEC);
	});
});
