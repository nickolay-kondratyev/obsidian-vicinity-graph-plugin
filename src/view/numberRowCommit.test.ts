import { describe, expect, it } from "vitest";
import type { SizingSettings } from "../engine";
import { EngineDefaults, SIZING_RANGES } from "../engine";
import type { NumberRowCommit } from "./numberRowCommit";
import { NO_CROSS_FIELD_RULE, NumberFieldRefusal, NumberRowCommitPolicy } from "./numberRowCommit";
import { SettingsRowAccessors } from "./settingsRowAccessors";
import type { SizingNumberField } from "./settingsWritePlan";
import { SizingRowWrite } from "./sizingRowWrite";

/**
 * The controls panel's blur decision, over the two policies its typed rows actually
 * use: a sizing bound (cross-field rule) and the node cap (accessor rule only).
 *
 * Both are built from the SAME seams the panel builds them from — no fake accessor —
 * so a change to what a row accepts or refuses reaches this suite by itself.
 */

/** A sizing row's policy, against globals the test chooses. */
function sizingPolicy(field: SizingNumberField, stored: Partial<SizingSettings> = {}): NumberRowCommitPolicy {
	const sizing: SizingSettings = { ...EngineDefaults.sizingSettings(), ...stored };
	return new NumberRowCommitPolicy(SettingsRowAccessors.sizingNumber(field), new SizingRowWrite(field, () => sizing));
}

function nodeCapPolicy(): NumberRowCommitPolicy {
	return new NumberRowCommitPolicy(SettingsRowAccessors.nodeCap(), NO_CROSS_FIELD_RULE);
}

/** One metric's weight row. Every metric shares the same bounds, so any one of them stands for all. */
function weightPolicy(): NumberRowCommitPolicy {
	return new NumberRowCommitPolicy(SettingsRowAccessors.metricWeight("backlink-count"), NO_CROSS_FIELD_RULE);
}

/**
 * What the field under test was SEEDED with, wherever the test is not ABOUT the seed:
 * a number no suite below commits, so equality with it is never met by accident.
 */
const SEEDED_WITH = 77;

/**
 * THE refused commit, shared by the suites below: a maximum committed under the stored
 * minimum — the one cross-field rule a panel row can actually break. Shared so that the
 * test pinning its WORDING and the tests about CARRYING that wording are provably about
 * the same commit.
 */
function refusedMaxPxCommit(): NumberRowCommit {
	return sizingPolicy("maxPx", { minPx: 200 }).commit("40", SEEDED_WITH);
}

/** A number the sizing range cannot hold — what the write path will cap on the way in. */
const ABOVE_MAX_PX = SIZING_RANGES.maxPx.max + 100;

/** The same, for a metric weight. */
const ABOVE_MAX_WEIGHT = SIZING_RANGES.metricWeight.max + 50;

describe("NumberRowCommitPolicy: a value the row accepts", () => {
	it("WHEN an in-range number is committed THEN it is the value to write", () => {
		expect(sizingPolicy("minPx").commit("60", SEEDED_WITH).value).toBe(60);
	});

	it("WHEN an in-range number is committed THEN there is nothing to say about it", () => {
		expect(sizingPolicy("minPx").commit("60", SEEDED_WITH).refusal).toBeUndefined();
	});

	it("WHEN an OUT-OF-RANGE number is committed THEN it is still written (the write path caps it)", () => {
		// Capping is not refusing: the panel reseeds the field from the store afterwards,
		// so the capped number is what the user is left looking at.
		expect(sizingPolicy("maxPx").commit(String(ABOVE_MAX_PX), SEEDED_WITH).value).toBe(ABOVE_MAX_PX);
	});

	it("WHEN an out-of-range number is committed THEN the panel says nothing (the reseeded field states it)", () => {
		expect(sizingPolicy("maxPx").commit(String(ABOVE_MAX_PX), SEEDED_WITH).refusal).toBeUndefined();
	});
});

describe("NumberRowCommitPolicy: a value the row refuses", () => {
	it("WHEN the committed maximum is below the stored minimum THEN nothing is written", () => {
		expect(refusedMaxPxCommit().value).toBeNull();
	});

	// The ONE place this suite spells the refusal out. `describeSizingRejection` owns the
	// wording; this pins that the user is told which number was refused and what it must
	// clear, rather than a bare "invalid".
	it("WHEN the committed maximum is below the stored minimum THEN the row says why", () => {
		expect(refusedMaxPxCommit().refusal).toBe(
			"Not applied: maximum node size (40px) must be at least the minimum (200px).",
		);
	});

	it("WHEN the committed minimum is above the stored maximum THEN nothing is written", () => {
		expect(sizingPolicy("minPx", { maxPx: 80 }).commit("200", SEEDED_WITH).value).toBeNull();
	});

	it("WHEN the STORED pair is already inverted THEN the depth-decay row still commits its own value", () => {
		// The cross-field rule is about the two bounds only; an untouched row must not
		// become uneditable because of a problem two rows away.
		expect(sizingPolicy("depthDecayK", { minPx: 300, maxPx: 50 }).commit("0.5", SEEDED_WITH).value).toBe(0.5);
	});
});

describe("NumberRowCommitPolicy: text that is not a value yet", () => {
	it("WHEN the field is committed BLANK THEN nothing is written", () => {
		// The behaviour the controlled field could not have: the box may be emptied on the
		// way to a new number, and emptying it stores nothing.
		expect(sizingPolicy("minPx").commit("", SEEDED_WITH).value).toBeNull();
	});

	it("WHEN the field is committed blank THEN nothing is said either (it is mid-edit, not wrong)", () => {
		expect(sizingPolicy("minPx").commit("", SEEDED_WITH).refusal).toBeUndefined();
	});

	it("WHEN the field is committed blank THEN the field is reseeded from the store", () => {
		// Nothing was written, so no store echo will ever repaint this row: without the
		// reseed the box stays EMPTY next to a setting that still holds a number.
		expect(sizingPolicy("minPx").commit("", SEEDED_WITH).reseedsFromStore).toBe(true);
	});

	it("WHEN the field holds text that is not a number THEN nothing is written", () => {
		expect(sizingPolicy("minPx").commit("abc", SEEDED_WITH).value).toBeNull();
	});

	it("WHEN the field holds text that is not a number THEN the field is reseeded from the store", () => {
		expect(sizingPolicy("minPx").commit("abc", SEEDED_WITH).reseedsFromStore).toBe(true);
	});
});

describe("NumberRowCommitPolicy: what the field is left showing", () => {
	it("WHEN a value is written THEN the field is reseeded from the store", () => {
		// Redundant in the ordinary case — the store echo remounts the row anyway — but it
		// is the ONE rule that also covers the case below, where nothing echoes.
		expect(sizingPolicy("minPx").commit("60", SEEDED_WITH).reseedsFromStore).toBe(true);
	});

	it("WHEN a written value is CAPPED back onto the stored one THEN the field is still reseeded", () => {
		// The corner the "store echo repaints it" reasoning misses: a field already sitting
		// at the range ceiling, typed past it. The write path caps back to the stored number,
		// so nothing about the row moves — without the reseed the box keeps an unstored
		// number with no message beside it.
		expect(sizingPolicy("maxPx", { maxPx: SIZING_RANGES.maxPx.max }).commit(String(ABOVE_MAX_PX), SEEDED_WITH).reseedsFromStore).toBe(
			true,
		);
	});

	it("WHEN a value is REFUSED THEN the field is NOT reseeded (the typed text stands beside the reason)", () => {
		expect(sizingPolicy("maxPx", { minPx: 200 }).commit("40", SEEDED_WITH).reseedsFromStore).toBe(false);
	});
});

describe("NumberRowCommitPolicy: a commit that changed nothing", () => {
	// The ticketed waste (nid_bbe962ojwwkhzn3uq27zw5w6l_e): focusing a field and leaving
	// it used to persist the seeded value back over itself — a full write plus a
	// traversal/layout rebuild for no change. "Left untouched" and "edited back to the
	// original" are indistinguishable here on purpose: both commit text that parses to
	// the seeded number, and neither deserves a write.

	it("WHEN the committed text parses to the seeded value THEN nothing is written", () => {
		expect(sizingPolicy("minPx").commit(String(SEEDED_WITH), SEEDED_WITH).value).toBeNull();
	});

	it("WHEN the committed text merely SPELLS the seeded value differently THEN nothing is written", () => {
		// `077` is the seeded number, not an edit — writing it would rebuild the graph
		// for a value the store already holds.
		expect(sizingPolicy("minPx").commit(`0${SEEDED_WITH}`, SEEDED_WITH).value).toBeNull();
	});

	it("WHEN nothing is written because nothing changed THEN there is nothing to say either", () => {
		expect(sizingPolicy("minPx").commit(String(SEEDED_WITH), SEEDED_WITH).refusal).toBeUndefined();
	});

	it("WHEN nothing is written because nothing changed THEN the field is still reseeded from the store", () => {
		// The reseed is what normalises the box back to the stored spelling (`077` → `77`);
		// skipping the WRITE must not skip that.
		expect(sizingPolicy("minPx").commit(`0${SEEDED_WITH}`, SEEDED_WITH).reseedsFromStore).toBe(true);
	});

	it("WHEN the unchanged value would fail the cross-field rule THEN it is still a silent no-op, not a refusal", () => {
		// Reachable only through a stored pair the clamp backstop should have raised —
		// but even then, leaving an untouched field must not scold the user for it.
		expect(sizingPolicy("maxPx", { minPx: 200 }).commit("77", 77).refusal).toBeUndefined();
	});

	it("WHEN the node cap is committed unchanged THEN nothing is written (the rule is not sizing-specific)", () => {
		expect(nodeCapPolicy().commit(String(SEEDED_WITH), SEEDED_WITH).value).toBeNull();
	});
});

describe("NumberRowCommitPolicy: a row whose accessor is its whole policy", () => {
	it("WHEN the node cap is committed at a whole number in spec THEN it is the value to write", () => {
		expect(nodeCapPolicy().commit("120", SEEDED_WITH).value).toBe(120);
	});

	it("WHEN the node cap is committed BLANK THEN nothing is written", () => {
		expect(nodeCapPolicy().commit("", SEEDED_WITH).value).toBeNull();
	});

	it("WHEN the node cap is committed blank THEN the field is reseeded from the store", () => {
		expect(nodeCapPolicy().commit("", SEEDED_WITH).reseedsFromStore).toBe(true);
	});

	it("WHEN the node cap is committed below its declared minimum THEN nothing is written", () => {
		expect(nodeCapPolicy().commit("0", SEEDED_WITH).value).toBeNull();
	});

	it("WHEN the node cap is committed above its declared maximum THEN nothing is written", () => {
		// The typo/paste hole the 1000 ceiling closes: a pasted huge cap is refused
		// at the field, and clampNodeCap backstops any path that skips the field.
		const aboveMax = SettingsRowAccessors.nodeCap().bounds.max + 1;
		expect(nodeCapPolicy().commit(String(aboveMax), SEEDED_WITH).value).toBeNull();
	});
});

describe("NumberRowCommitPolicy: a size metric's weight", () => {
	// The weight sits beside its metric's toggle rather than in a `NumberRow`, so its
	// wiring to this policy is what `typedNumberFields.test.ts` scans for. These
	// assertions are the behaviour that wiring buys.

	it("WHEN a weight in range is committed THEN it is the value to write", () => {
		expect(weightPolicy().commit("2.5", SEEDED_WITH).value).toBe(2.5);
	});

	it("WHEN a weight ABOVE the range is committed THEN it is still written (the write path caps it)", () => {
		// The snap this row used to do mid-word: typing `150` into a 0..100 weight clamped
		// the box after the third key. Nothing is refused — the field is reseeded instead.
		expect(weightPolicy().commit(String(ABOVE_MAX_WEIGHT), SEEDED_WITH).value).toBe(ABOVE_MAX_WEIGHT);
	});

	it("WHEN a weight above the range is committed THEN the row says nothing (the reseeded field states it)", () => {
		expect(weightPolicy().commit(String(ABOVE_MAX_WEIGHT), SEEDED_WITH).refusal).toBeUndefined();
	});

	it("WHEN the weight is committed BLANK THEN nothing is written", () => {
		expect(weightPolicy().commit("", SEEDED_WITH).value).toBeNull();
	});

	it("WHEN the weight is committed blank THEN the field is reseeded from the store", () => {
		expect(weightPolicy().commit("", SEEDED_WITH).reseedsFromStore).toBe(true);
	});
});

describe("NumberFieldRefusal: how long a refusal stays under the field", () => {
	/** What the store held for the refused row at the moment it was judged. */
	const STORED_MAX_PX = 100;

	/** A refusal a panel row really earns: a maximum committed below the stored minimum. */
	function refusedMaxPx(): NumberFieldRefusal | undefined {
		return NumberFieldRefusal.fromCommit(refusedMaxPxCommit(), STORED_MAX_PX);
	}

	it("WHEN the store still holds the value the refusal was judged against THEN the reason is shown", () => {
		// Compared against the COMMIT's own reason, not a copy of the sentence: this test is
		// about the reason surviving, and the wording is pinned once, above, against this
		// same commit — so a rule that stopped refusing fails there, loudly, not here.
		expect(refusedMaxPx()?.messageWhileStoredIs(STORED_MAX_PX)).toBe(refusedMaxPxCommit().refusal);
	});

	it("WHEN the store MOVES under the refused field THEN the reason is gone", () => {
		// The field is uncontrolled and reseeds from the store on any move (Restore
		// defaults, the settings tab, a second graph view), so the number under the
		// message is no longer the number the message is about — and leaving it would
		// also mark a perfectly valid field `aria-invalid`.
		expect(refusedMaxPx()?.messageWhileStoredIs(160)).toBeUndefined();
	});

	it("WHEN a commit refused nothing THEN there is no refusal to carry", () => {
		expect(NumberFieldRefusal.fromCommit(sizingPolicy("minPx").commit("60", SEEDED_WITH), STORED_MAX_PX)).toBeUndefined();
	});
});
