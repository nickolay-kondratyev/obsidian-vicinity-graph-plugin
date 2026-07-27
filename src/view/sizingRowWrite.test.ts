import { describe, expect, it } from "vitest";
import type { SizingSettings } from "../engine";
import { EngineDefaults, SIZING_RANGES } from "../engine";
import { SizingRowWrite } from "./sizingRowWrite";
import type { SizingNumberField } from "./sizingRowWrite";

const DEFAULTS = EngineDefaults.sizingSettings();

/** A settings tab whose store the test can move underneath a pending write. */
class FakeSizingStore {
	private sizing: SizingSettings = DEFAULTS;
	readonly persisted: SizingSettings[] = [];

	constructor(overrides: Partial<SizingSettings> = {}) {
		this.sizing = { ...DEFAULTS, ...overrides };
	}

	row(field: SizingNumberField): SizingRowWrite {
		return new SizingRowWrite(
			field,
			() => this.sizing,
			async (sizing) => {
				this.persisted.push(sizing);
				this.sizing = sizing;
			},
		);
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

	it("WHEN the STORED pair is inverted THEN the depth-decay row still persists", async () => {
		const store = new FakeSizingStore({ minPx: 300, maxPx: 50 });
		await store.row("depthDecayK").persistIfAccepted(0.5);
		expect(store.persisted).toHaveLength(1);
	});
});

describe("SizingRowWrite persistence", () => {
	it("WHEN an accepted value is written THEN only its own field moves", async () => {
		const store = new FakeSizingStore();
		await store.row("minPx").persistIfAccepted(60);
		expect(store.persisted).toEqual([{ ...DEFAULTS, minPx: 60 }]);
	});

	it("WHEN the globals moved after the keystroke THEN the flushed write composes with them", async () => {
		const store = new FakeSizingStore();
		const row = store.row("minPx");
		row.judge(60);
		store.moveTo({ depthDecayK: 0.9 });
		await row.persistIfAccepted(60);
		expect(store.persisted).toEqual([{ ...DEFAULTS, depthDecayK: 0.9, minPx: 60 }]);
	});

	it("WHEN the globals turn the pending pair inverted THEN the flushed write persists NOTHING", async () => {
		// Accepted at keystroke time (max was 400), rejected by the time it drains:
		// the verdict must be re-taken where the write actually happens.
		const store = new FakeSizingStore({ maxPx: 400 });
		const row = store.row("minPx");
		expect(row.judge(300).rejected).toBe(false);
		store.moveTo({ maxPx: 50 });
		await row.persistIfAccepted(300);
		expect(store.persisted).toEqual([]);
	});

	it("WHEN a rejected value is written THEN nothing is persisted", async () => {
		const store = new FakeSizingStore({ minPx: 200 });
		await store.row("maxPx").persistIfAccepted(40);
		expect(store.persisted).toEqual([]);
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
