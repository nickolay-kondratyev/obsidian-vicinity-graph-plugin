import { describe, expect, it } from "vitest";
import type { SizingSettings } from "../engine";
import { EngineDefaults, SIZING_RANGES } from "../engine";
import { NO_CROSS_FIELD_RULE, NumberRowCommitPolicy } from "./numberRowCommit";
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

/** A number the sizing range cannot hold — what the write path will cap on the way in. */
const ABOVE_MAX_PX = SIZING_RANGES.maxPx.max + 100;

describe("NumberRowCommitPolicy: a value the row accepts", () => {
	it("WHEN an in-range number is committed THEN it is the value to write", () => {
		expect(sizingPolicy("minPx").commit("60").value).toBe(60);
	});

	it("WHEN an in-range number is committed THEN there is nothing to say about it", () => {
		expect(sizingPolicy("minPx").commit("60").refusal).toBeUndefined();
	});

	it("WHEN an OUT-OF-RANGE number is committed THEN it is still written (the write path caps it)", () => {
		// Capping is not refusing: the panel reseeds the field from the store afterwards,
		// so the capped number is what the user is left looking at.
		expect(sizingPolicy("maxPx").commit(String(ABOVE_MAX_PX)).value).toBe(ABOVE_MAX_PX);
	});

	it("WHEN an out-of-range number is committed THEN the panel says nothing (the reseeded field states it)", () => {
		expect(sizingPolicy("maxPx").commit(String(ABOVE_MAX_PX)).refusal).toBeUndefined();
	});
});

describe("NumberRowCommitPolicy: a value the row refuses", () => {
	it("WHEN the committed maximum is below the stored minimum THEN nothing is written", () => {
		expect(sizingPolicy("maxPx", { minPx: 200 }).commit("40").value).toBeNull();
	});

	it("WHEN the committed maximum is below the stored minimum THEN the row says why", () => {
		expect(sizingPolicy("maxPx", { minPx: 200 }).commit("40").refusal).toBe(
			"Not applied: maximum node size (40px) must be at least the minimum (200px).",
		);
	});

	it("WHEN the committed minimum is above the stored maximum THEN nothing is written", () => {
		expect(sizingPolicy("minPx", { maxPx: 80 }).commit("200").value).toBeNull();
	});

	it("WHEN the STORED pair is already inverted THEN the depth-decay row still commits its own value", () => {
		// The cross-field rule is about the two bounds only; an untouched row must not
		// become uneditable because of a problem two rows away.
		expect(sizingPolicy("depthDecayK", { minPx: 300, maxPx: 50 }).commit("0.5").value).toBe(0.5);
	});
});

describe("NumberRowCommitPolicy: text that is not a value yet", () => {
	it("WHEN the field is committed BLANK THEN nothing is written", () => {
		// The behaviour the controlled field could not have: the box may be emptied on the
		// way to a new number, and emptying it stores nothing.
		expect(sizingPolicy("minPx").commit("").value).toBeNull();
	});

	it("WHEN the field is committed blank THEN nothing is said either (it is mid-edit, not wrong)", () => {
		expect(sizingPolicy("minPx").commit("").refusal).toBeUndefined();
	});

	it("WHEN the field is committed blank THEN the field is reseeded from the store", () => {
		// Nothing was written, so no store echo will ever repaint this row: without the
		// reseed the box stays EMPTY next to a setting that still holds a number.
		expect(sizingPolicy("minPx").commit("").reseedsFromStore).toBe(true);
	});

	it("WHEN the field holds text that is not a number THEN nothing is written", () => {
		expect(sizingPolicy("minPx").commit("abc").value).toBeNull();
	});

	it("WHEN the field holds text that is not a number THEN the field is reseeded from the store", () => {
		expect(sizingPolicy("minPx").commit("abc").reseedsFromStore).toBe(true);
	});
});

describe("NumberRowCommitPolicy: what the field is left showing", () => {
	it("WHEN a value is written THEN the field is reseeded from the store", () => {
		// Redundant in the ordinary case — the store echo remounts the row anyway — but it
		// is the ONE rule that also covers the case below, where nothing echoes.
		expect(sizingPolicy("minPx").commit("60").reseedsFromStore).toBe(true);
	});

	it("WHEN a written value is CAPPED back onto the stored one THEN the field is still reseeded", () => {
		// The corner the "store echo repaints it" reasoning misses: a field already sitting
		// at the range ceiling, typed past it. The write path caps back to the stored number,
		// so nothing about the row moves — without the reseed the box keeps an unstored
		// number with no message beside it.
		expect(sizingPolicy("maxPx", { maxPx: SIZING_RANGES.maxPx.max }).commit(String(ABOVE_MAX_PX)).reseedsFromStore).toBe(
			true,
		);
	});

	it("WHEN a value is REFUSED THEN the field is NOT reseeded (the typed text stands beside the reason)", () => {
		expect(sizingPolicy("maxPx", { minPx: 200 }).commit("40").reseedsFromStore).toBe(false);
	});
});

describe("NumberRowCommitPolicy: a row whose accessor is its whole policy", () => {
	it("WHEN the node cap is committed at a whole number in spec THEN it is the value to write", () => {
		expect(nodeCapPolicy().commit("120").value).toBe(120);
	});

	it("WHEN the node cap is committed BLANK THEN nothing is written", () => {
		expect(nodeCapPolicy().commit("").value).toBeNull();
	});

	it("WHEN the node cap is committed blank THEN the field is reseeded from the store", () => {
		expect(nodeCapPolicy().commit("").reseedsFromStore).toBe(true);
	});

	it("WHEN the node cap is committed below its declared minimum THEN nothing is written", () => {
		expect(nodeCapPolicy().commit("0").value).toBeNull();
	});
});
