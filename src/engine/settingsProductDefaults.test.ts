import { describe, expect, it } from "vitest";
import { SETTINGS_SPEC } from "./SettingsSpec";
import { EVERY_SETTINGS_SPEC_LEAF } from "./testFixtures/settingsSpecLeaves";

/**
 * THE ONE PLACE WHERE SETTINGS DEFAULTS ARE PINNED AS LITERALS.
 *
 * Every other settings test in this repo iterates {@link SETTINGS_SPEC} and asserts
 * STRUCTURE (a field parses, round-trips, resets, honours its own bounds), precisely so
 * that retuning a value is a one-line edit instead of a hunt through mirrored baselines.
 * The cost of that is real and unavoidable: a structural suite stays green when a default
 * MOVES, including when it moves by accident. This file buys the tripwire back.
 *
 * IT COVERS EVERY LEAF, DELIBERATELY. The first cut of this file pinned only a small
 * "product-meaningful" subset, on the theory that a tuning constant whose rationale is
 * measured and documented on the spec is already protected by the layout-quality suites
 * that run AT the shipped defaults. Review MEASURED that theory and it was only partly
 * true: mutating `repelStrength`, `collidePaddingPx`, `elkNodeSpacingPx` or `linkGapPx`
 * does redden the geometry suites, but `centerPullStrength` 0.05 → 0.15,
 * `linkStrengthFactor` 1 → 4 and `edgeRoutingClearancePx` 11 → 14 left the ENTIRE suite
 * green. Three shipped defaults with zero tripwire, under a comment claiming otherwise.
 *
 * So the admission rule is now the only one that cannot rot: EVERY spec leaf's default is
 * pinned here, and the guard below fails if a leaf is missing, extra, or changed. The
 * "which defaults happen to be observable by some other suite today" split was a judgement
 * that had to be re-measured on every layout change to stay honest — and it was not.
 * One line per field is cheaper than that.
 *
 * WHY this is not the staleness the ticket removed: the baselines that went stale were
 * DUPLICATES (a defaults baseline and a limits baseline in `SettingsSpec.test.ts`, plus a
 * seven-field one in `forceLayoutSettings.test.ts`), so a retune meant hunting mirrors and
 * the failures said nothing about intent. There is exactly ONE table now, it is keyed by
 * the walk's own leaf ids, and its whole job is to be edited in the same commit as a
 * deliberate retune.
 *
 * WHEN THIS FAILS: do not "fix" the test. Either the change was intended — then update the
 * literal in the same commit as the spec, and say so in the release note — or it was not,
 * and the spec is what needs reverting.
 */

/**
 * Every spec leaf's SHIPPED default, by leaf id (the dotted path the walk reports).
 *
 * Each value's WHY lives on {@link SETTINGS_SPEC} beside the declaration, not here — this
 * table is a tripwire, not a second explanation. Comments here say only what a reader of
 * the number alone could not guess about its PRODUCT meaning.
 */
const SHIPPED_SETTINGS_DEFAULTS: Readonly<Record<string, unknown>> = {
	// Both depths mirror Obsidian's own local graph: 1 hop each way.
	"globalDepths.outgoingDepth": 1,
	"globalDepths.incomingDepth": 1,

	"globalView.nodeCap": 100, // The shipped performance ceiling.
	"globalView.outlineMaxDepth": 2, // Sections + subsections — what fits a 160px node.
	"globalView.nodePreviewPreference": "auto", // The documented document-position rule.

	// `own-file-size` is the ONLY metric shipped ON; the other four are opt-in. Every
	// metric ships at the equal weight `globalView.sizing.metricWeight` declares.
	"globalView.sizing.metrics.own-file-size": { enabled: true, weight: 1 },
	"globalView.sizing.metrics.total-linker-size": { enabled: false, weight: 1 },
	"globalView.sizing.metrics.backlink-count": { enabled: false, weight: 1 },
	"globalView.sizing.metrics.outlink-count": { enabled: false, weight: 1 },
	"globalView.sizing.metrics.depth-decay": { enabled: false, weight: 1 },
	"globalView.sizing.metricWeight": 1, // Equal weight until a per-metric slider ships.
	"globalView.sizing.depthDecayK": 1,
	"globalView.sizing.minPx": 40, // Nodes span 40..160px on first run.
	"globalView.sizing.maxPx": 160,

	// The force-layout tuning set = the DEFAULT RENDERED LAYOUT. Four of these are also
	// observable in the geometry suites; three (centerPullStrength, linkStrengthFactor,
	// edgeRoutingClearancePx) are observable NOWHERE else — see the file header.
	"globalView.forceLayout.centerPullStrength": 0.05,
	"globalView.forceLayout.repelStrength": 300,
	"globalView.forceLayout.linkStrengthFactor": 1, // Reproduces d3's built-in 1/min(degree).
	"globalView.forceLayout.linkGapPx": 40,
	"globalView.forceLayout.collidePaddingPx": 50,
	"globalView.forceLayout.elkNodeSpacingPx": 20,
	"globalView.forceLayout.edgeRoutingClearancePx": 11, // Measured (edge-routing__06 sweep).

	// Exclusion is additive and opt-in: OFF, with nothing to match.
	"nodeExclusion.enabled": false,
	"nodeExclusion.patterns": [],
};

describe("shipped settings defaults (the hand-pinned literal baseline)", () => {
	it("WHEN every spec leaf's default is read THEN it is exactly the value pinned here", () => {
		// ONE toEqual over both records, so the diff names every offender at once — and so a
		// leaf ADDED to the spec (extra key) or REMOVED from it (missing key) fails too.
		const declared = Object.fromEntries(EVERY_SETTINGS_SPEC_LEAF.map((leaf) => [leaf.id, leaf.default]));
		expect(declared).toEqual(SHIPPED_SETTINGS_DEFAULTS);
	});
});

/**
 * RANGES are otherwise structural on purpose: `settingsSpecBounds.test.ts` proves every
 * bounded leaf's declared range is ENFORCED and that its default is reachable inside it,
 * which is the property that matters and the one the deleted limits baseline never had.
 *
 * The two ranges pinned below are the exceptions, each for a stated reason. No other range
 * has a literal tripwire, and widening one is therefore NOT something `npm test` notices —
 * said plainly here rather than implied by silence.
 */
describe("settings ranges pinned as literals (the two exceptions)", () => {
	it("WHEN the outline depth range is read THEN it is 1..6 (markdown's own heading levels, never 0)", () => {
		// Product-meaningful: 6 is markdown's own ceiling and 1 (never 0) is what keeps
		// depth from becoming a second, silent off-switch for previews.
		const spec = SETTINGS_SPEC.globalView.outlineMaxDepth;
		expect({ min: spec.min, max: spec.max }).toEqual({ min: 1, max: 6 });
	});

	it("WHEN the link-force range is read THEN it is 0.25..4 (the twice-stale headroom ceiling)", () => {
		// `max 4` is the literal that went stale in BOTH resolved baseline tickets, and the
		// spec calls it maintainer-chosen headroom rather than a measured limit — i.e. the
		// one range number nothing else in the suite constrains from above. `min 0.25` is
		// load-bearing for the anti-collapse invariant in `forceLayoutSettings.test.ts`.
		const spec = SETTINGS_SPEC.globalView.forceLayout.linkStrengthFactor;
		expect({ min: spec.min, max: spec.max }).toEqual({ min: 0.25, max: 4 });
	});
});
