import { describe, expect, it } from "vitest";
import type { SizingSettings } from "../engine";
import { EngineDefaults, SIZING_RANGES } from "../engine";
import type { SizingNumberField } from "./settingsWritePlan";
import { SizingRowWrite } from "./sizingRowWrite";

const DEFAULTS = EngineDefaults.sizingSettings();

/** A settings tab whose store the test can move underneath a pending write. */
class FakeSizingStore {
	private sizing: SizingSettings = DEFAULTS;

	constructor(overrides: Partial<SizingSettings> = {}) {
		this.sizing = { ...DEFAULTS, ...overrides };
	}

	row(field: SizingNumberField): SizingRowWrite {
		return new SizingRowWrite(field, () => this.sizing);
	}

	/** Another surface (in-view sizing panel, a second view, a section reset) writing the same globals. */
	moveTo(overrides: Partial<SizingSettings>): void {
		this.sizing = { ...this.sizing, ...overrides };
	}
}

describe("SizingRowWrite cross-field verdict", () => {
	it("WHEN the typed maximum is below the stored minimum THEN the row says why it is not applied", () => {
		const store = new FakeSizingStore({ minPx: 200 });
		expect(store.row("maxPx").judge(40).message).toBe(
			"Not applied: maximum node size (40px) must be at least the minimum (200px).",
		);
	});

	it("WHEN the typed maximum is below the stored minimum THEN the value is rejected", () => {
		const store = new FakeSizingStore({ minPx: 200 });
		expect(store.row("maxPx").judge(40).rejected).toBe(true);
	});

	it("WHEN the STORED pair is inverted THEN the depth-decay row still accepts its own value", () => {
		// The cross-field rule is about min/max ONLY: refusing depth-decay-k for a
		// problem in two other rows would make an untouched field uneditable.
		const store = new FakeSizingStore({ minPx: 300, maxPx: 50 });
		expect(store.row("depthDecayK").judge(0.5).rejected).toBe(false);
	});

	it("WHEN the STORED pair is inverted THEN the depth-decay row shows no message", () => {
		const store = new FakeSizingStore({ minPx: 300, maxPx: 50 });
		expect(store.row("depthDecayK").judge(0.5).message).toBeUndefined();
	});

	it("WHEN the STORED pair is inverted THEN the depth-decay row still authorises its write", () => {
		const store = new FakeSizingStore({ minPx: 300, maxPx: 50 });
		expect(store.row("depthDecayK").interactionIfAccepted(0.5)).toEqual({
			kind: "global-sizing-number",
			field: "depthDecayK",
			value: 0.5,
		});
	});
});

describe("SizingRowWrite authorised write", () => {
	it("WHEN an accepted value drains THEN the authorised write names ONLY this row's field", () => {
		// The merge itself is `SettingsWritePipeline`'s job, against a read taken inside
		// its serialised slot — so what a row emits is a single field and a value.
		const store = new FakeSizingStore();
		expect(store.row("minPx").interactionIfAccepted(60)).toEqual({
			kind: "global-sizing-number",
			field: "minPx",
			value: 60,
		});
	});

	it("WHEN the globals turn the pending pair inverted THEN the flushed write is refused", () => {
		// Accepted at keystroke time (max was 400), rejected by the time it drains:
		// the verdict must be re-taken where the write actually happens.
		const store = new FakeSizingStore({ maxPx: 400 });
		const row = store.row("minPx");
		expect(row.judge(300).rejected).toBe(false);
		store.moveTo({ maxPx: 50 });
		expect(row.interactionIfAccepted(300)).toBeNull();
	});

	it("WHEN a rejected value drains THEN no write is authorised", () => {
		const store = new FakeSizingStore({ minPx: 200 });
		expect(store.row("maxPx").interactionIfAccepted(40)).toBeNull();
	});
});

describe("SizingRowWrite out-of-range warning", () => {
	const ABOVE_MAX_PX = SIZING_RANGES.maxPx.max + 100;

	it("WHEN the typed value exceeds the field's range THEN the row says what will be stored instead", () => {
		expect(new FakeSizingStore().row("maxPx").judge(ABOVE_MAX_PX).message).toBe(
			`Stored as ${SIZING_RANGES.maxPx.max} — the allowed range is ${SIZING_RANGES.maxPx.min}–${SIZING_RANGES.maxPx.max}.`,
		);
	});

	it("WHEN the typed value exceeds the field's range THEN it is still written (capped, not refused)", () => {
		expect(new FakeSizingStore().row("maxPx").judge(ABOVE_MAX_PX).rejected).toBe(false);
	});

	it("WHEN the typed value is inside the field's range THEN there is no message at all", () => {
		expect(new FakeSizingStore().row("maxPx").judge(SIZING_RANGES.maxPx.max).message).toBeUndefined();
	});
});
