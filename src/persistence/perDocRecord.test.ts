import { describe, expect, it } from "vitest";
import { NODE_OVERRIDE_HARD_MAX_PX, NODE_OVERRIDE_HARD_MIN_PX } from "../engine";
import { isEmptyPerDocRecord, parsePerDocRecord } from "./perDocRecord";

describe("parsePerDocRecord — override section", () => {
	it("WHEN a non-object payload is parsed THEN an empty record results", () => {
		expect(parsePerDocRecord("scrambled")).toEqual({});
	});

	it("WHEN a valid override round-trips through JSON THEN it parses back unchanged", () => {
		const record = { override: { sizePx: { widthPx: 320, heightPx: 180 }, content: "outline" } };
		expect(parsePerDocRecord(JSON.parse(JSON.stringify(record)))).toEqual(record);
	});

	it("WHEN the override's sizePx is missing a dimension THEN only that field falls away", () => {
		const raw = { override: { sizePx: { widthPx: 300 }, content: "image" } };
		expect(parsePerDocRecord(raw)).toEqual({ override: { content: "image" } });
	});

	it("WHEN a sizePx dimension is non-finite THEN the whole sizePx falls away (never NaN geometry)", () => {
		const raw = { override: { sizePx: { widthPx: 1e999, heightPx: 200 }, content: "outline" } };
		expect(parsePerDocRecord(raw)).toEqual({ override: { content: "outline" } });
	});

	it("WHEN the override carries an unrecognized content THEN only that field falls away", () => {
		const raw = { override: { sizePx: { widthPx: 300, heightPx: 200 }, content: "collage" } };
		expect(parsePerDocRecord(raw)).toEqual({ override: { sizePx: { widthPx: 300, heightPx: 200 } } });
	});

	it("WHEN the override ends up with neither field THEN the override section is dropped", () => {
		expect(parsePerDocRecord({ override: {} })).toEqual({});
	});

	it("WHEN a hand-edited sizePx exceeds the hard sanity bounds THEN it loads clamped into them", () => {
		const raw = { override: { sizePx: { widthPx: 999999, heightPx: 1 } } };
		expect(parsePerDocRecord(raw)).toEqual({
			override: { sizePx: { widthPx: NODE_OVERRIDE_HARD_MAX_PX, heightPx: NODE_OVERRIDE_HARD_MIN_PX } },
		});
	});
});

describe("parsePerDocRecord — localPins section", () => {
	it("WHEN a valid localPins list round-trips through JSON THEN it parses back unchanged", () => {
		const record = { localPins: [{ docid: "docid_x_e", pinTimestamp: 5 }] };
		expect(parsePerDocRecord(JSON.parse(JSON.stringify(record)))).toEqual(record);
	});

	it("WHEN a target entry is malformed THEN only that entry is dropped (per-target defensive parse)", () => {
		const raw = { localPins: [{ docid: "docid_ok_e", pinTimestamp: 5 }, { docid: 42 }, "garbage"] };
		expect(parsePerDocRecord(raw)).toEqual({ localPins: [{ docid: "docid_ok_e", pinTimestamp: 5 }] });
	});

	it("WHEN the localPins list survives with NO usable entry THEN the section is dropped whole (no empty list)", () => {
		expect(parsePerDocRecord({ localPins: ["garbage"] })).toEqual({});
	});

	it("WHEN localPins is not an array THEN the section is dropped", () => {
		expect(parsePerDocRecord({ localPins: { docid: "x" } })).toEqual({});
	});
});

describe("parsePerDocRecord — localControls section (reserved, opaque)", () => {
	it("WHEN localControls is an object THEN it is preserved verbatim (additive for the dependent ticket)", () => {
		const raw = { localControls: { future: { depth: 3 } } };
		expect(parsePerDocRecord(raw)).toEqual({ localControls: { future: { depth: 3 } } });
	});

	it("WHEN localControls is not an object THEN it is dropped", () => {
		expect(parsePerDocRecord({ localControls: "nope" })).toEqual({});
	});
});

describe("isEmptyPerDocRecord", () => {
	it("WHEN every section is absent THEN the record is empty", () => {
		expect(isEmptyPerDocRecord({})).toBe(true);
	});

	it("WHEN localControls is present but empty THEN the record is still empty", () => {
		expect(isEmptyPerDocRecord({ localControls: {} })).toBe(true);
	});

	it("WHEN an override is present THEN the record is not empty", () => {
		expect(isEmptyPerDocRecord({ override: { content: "image" } })).toBe(false);
	});

	it("WHEN a localPins entry is present THEN the record is not empty", () => {
		expect(isEmptyPerDocRecord({ localPins: [{ docid: "docid_x_e", pinTimestamp: 1 }] })).toBe(false);
	});
});
