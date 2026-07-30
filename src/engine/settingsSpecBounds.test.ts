import { describe, expect, it } from "vitest";
import {
	EngineDefaults,
	MAX_OUTLINE_DEPTH,
	MIN_OUTLINE_DEPTH,
	clampForceLayoutSettings,
	clampOutlineMaxDepth,
	clampSizingNumber,
} from "./constants";
import type { SizingRangeField } from "./constants";
import type { ForceLayoutSettings } from "./types";
import { EVERY_SETTINGS_SPEC_LEAF } from "./testFixtures/settingsSpecLeaves";
import type { SettingsSpecLeaf } from "./testFixtures/settingsSpecLeaves";

/**
 * BOUNDS, asserted by walking the spec: for every leaf that declares a min/max, the
 * thing that ENFORCES those bounds must actually do so — below-min comes back as the
 * min, above-max as the max, and a `NaN` (which `Math.min`/`Math.max` PROPAGATE) as the
 * field's declared default.
 *
 * The bounds themselves are never restated here; they are read off the leaf. What IS
 * declared is the mapping from a bounded field to its enforcer, and that mapping is
 * TOTAL: a newly bounded field that nothing clamps fails the first test below, naming
 * itself. That is the property the old literal baselines could not have — they pinned
 * the numbers and said nothing about whether anything honoured them.
 *
 * Bounds are asserted ONCE, at the clamp function, and deliberately not re-asserted on
 * the persistence path: `src/persistence/persistedShapes.test.ts` already pins which
 * families clamp on load, and `settingsSpecPersistence.test.ts` covers the per-field
 * fall-back-to-default rule for every leaf.
 */

/** Clamps one value of one field exactly as the shipping code clamps it. */
type BoundsEnforcer = (value: number) => number;

function sizingEnforcer(field: SizingRangeField): BoundsEnforcer {
	return (value) => clampSizingNumber(field, value);
}

/** One force-layout field through the whole-object clamp, siblings left at their defaults. */
function forceLayoutEnforcer(field: keyof ForceLayoutSettings): BoundsEnforcer {
	return (value) => clampForceLayoutSettings({ ...EngineDefaults.forceLayoutSettings(), [field]: value })[field];
}

/**
 * WHO enforces each bounded field's bounds, by leaf id. Engine clamps only — the two
 * fields whose enforcement lives elsewhere are listed in
 * {@link BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE} with the reason.
 */
const BOUNDS_ENFORCERS: Readonly<Record<string, BoundsEnforcer>> = {
	"globalView.outlineMaxDepth": clampOutlineMaxDepth,
	"globalView.sizing.metricWeight": sizingEnforcer("metricWeight"),
	"globalView.sizing.depthDecayK": sizingEnforcer("depthDecayK"),
	"globalView.sizing.minPx": sizingEnforcer("minPx"),
	"globalView.sizing.maxPx": sizingEnforcer("maxPx"),
	"globalView.forceLayout.centerPullStrength": forceLayoutEnforcer("centerPullStrength"),
	"globalView.forceLayout.repelStrength": forceLayoutEnforcer("repelStrength"),
	"globalView.forceLayout.linkStrengthFactor": forceLayoutEnforcer("linkStrengthFactor"),
	"globalView.forceLayout.linkGapPx": forceLayoutEnforcer("linkGapPx"),
	"globalView.forceLayout.collidePaddingPx": forceLayoutEnforcer("collidePaddingPx"),
	"globalView.forceLayout.elkNodeSpacingPx": forceLayoutEnforcer("elkNodeSpacingPx"),
	"globalView.forceLayout.edgeRoutingClearancePx": forceLayoutEnforcer("edgeRoutingClearancePx"),
};

/**
 * Bounded fields the engine deliberately does NOT clamp, and where their bound lives
 * instead. Listing them (rather than omitting them) is what keeps the mapping total:
 * a new bounded field must land in one table or the other, on purpose.
 */
const BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE: Readonly<Record<string, string>> = {
	"globalDepths.linkDepthOut":
		"clampStepperDepth (src/view/constants.ts) — an AFFORDANCE bound on the steppers; " +
		"the engine honors any depth (see SETTINGS_SPEC). Covered by src/view/clampStepperDepth.test.ts.",
	"globalDepths.embedDepthOut": "clampStepperDepth — see linkDepthOut.",
	"globalDepths.linkDepthIn": "clampStepperDepth — see linkDepthOut.",
	"globalView.nodeCap":
		"the node-cap number inputs reject anything below MIN_NODE_CAP (VicinityGraphSettingTab / " +
		"SettingsRowView). Deliberately NOT clamped on load: a stored 0 survives parsing by design " +
		"(pinned in persistedShapes.test.ts — falsy is a real value, not an absence). Whether a " +
		"hand-edited data.json below the declared min should clamp is nid_5meu9s38sbrv1703na77of4m7_e.",
};

const BOUNDED_LEAVES: readonly SettingsSpecLeaf[] = EVERY_SETTINGS_SPEC_LEAF.filter(
	(leaf) => leaf.bounds !== undefined,
);

/** Well past any declared bound, in the given direction. */
const FAR_OUTSIDE_ANY_RANGE = 1e6;

describe("settings bounds coverage (every bounded spec leaf has an enforcer)", () => {
	it("WHEN the spec declares a bounded field THEN exactly one table claims to enforce it", () => {
		const unclassified = BOUNDED_LEAVES.filter(
			(leaf) =>
				(BOUNDS_ENFORCERS[leaf.id] === undefined) ===
				(BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE[leaf.id] === undefined),
		).map((leaf) => leaf.id);
		expect(unclassified).toEqual([]);
	});

	it("WHEN a table names a field THEN the spec still declares it bounded (no stale entries)", () => {
		const declared = new Set(BOUNDED_LEAVES.map((leaf) => leaf.id));
		const stale = [...Object.keys(BOUNDS_ENFORCERS), ...Object.keys(BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE)].filter(
			(id) => !declared.has(id),
		);
		expect(stale).toEqual([]);
	});

	it("WHEN the bounded-leaf walk runs THEN it found fields to check (the guard is not vacuous)", () => {
		expect(BOUNDED_LEAVES.length).toBeGreaterThan(Object.keys(BOUNDS_ENFORCED_OUTSIDE_THE_ENGINE).length);
	});
});

describe("settings bounds enforcement (derived from each leaf's own declaration)", () => {
	const enforced = BOUNDED_LEAVES.filter((leaf) => BOUNDS_ENFORCERS[leaf.id] !== undefined);

	function enforcerFor(leaf: SettingsSpecLeaf): BoundsEnforcer {
		const enforcer = BOUNDS_ENFORCERS[leaf.id];
		if (enforcer === undefined) {
			throw new Error(`no bounds enforcer declared for spec leaf id=[${leaf.id}]`);
		}
		return enforcer;
	}

	it("WHEN a value below a field's declared min is clamped THEN the min comes back", () => {
		const wrong = enforced
			.map((leaf) => ({ leaf, got: enforcerFor(leaf)(-FAR_OUTSIDE_ANY_RANGE) }))
			.filter(({ leaf, got }) => got !== leaf.bounds?.min)
			.map(({ leaf, got }) => `${leaf.id}: expected min=[${leaf.bounds?.min}] got=[${got}]`);
		expect(wrong).toEqual([]);
	});

	it("WHEN a value above a field's declared max is clamped THEN the max comes back", () => {
		const wrong = enforced
			.filter((leaf) => leaf.bounds?.max !== undefined)
			.map((leaf) => ({ leaf, got: enforcerFor(leaf)(FAR_OUTSIDE_ANY_RANGE) }))
			.filter(({ leaf, got }) => got !== leaf.bounds?.max)
			.map(({ leaf, got }) => `${leaf.id}: expected max=[${leaf.bounds?.max}] got=[${got}]`);
		expect(wrong).toEqual([]);
	});

	// `Math.min`/`Math.max` PROPAGATE NaN, so every clamp needs an explicit NaN branch;
	// without one a garbage input reaches the field's consumer intact.
	it("WHEN a field is NaN THEN its declared default comes back", () => {
		const wrong = enforced
			.map((leaf) => ({ leaf, got: enforcerFor(leaf)(Number.NaN) }))
			.filter(({ leaf, got }) => got !== leaf.default)
			.map(({ leaf, got }) => `${leaf.id}: expected default=[${String(leaf.default)}] got=[${got}]`);
		expect(wrong).toEqual([]);
	});
});

/**
 * Outline depth (CLARIFICATION Q1 + Q5) rounds as well as clamping — heading levels are
 * whole numbers, and no generic bounds walk can state that. Its 1..6 range and its
 * default of 2 are pinned in `settingsProductDefaults.test.ts`.
 */
describe("outline depth clamp specifics", () => {
	it("WHEN a fractional value is clamped THEN it rounds to a whole heading level", () => {
		expect(clampOutlineMaxDepth(2.4)).toBe(2);
	});

	it("WHEN zero is clamped THEN the min comes back (depth is never a silent off-switch)", () => {
		expect(clampOutlineMaxDepth(0)).toBe(MIN_OUTLINE_DEPTH);
	});

	it("WHEN a deeper level than markdown defines is clamped THEN the max comes back", () => {
		expect(clampOutlineMaxDepth(MAX_OUTLINE_DEPTH + 1)).toBe(MAX_OUTLINE_DEPTH);
	});
});
