import { describe, expect, it } from "vitest";
import { PendingEdits } from "./optimisticValue";

/**
 * The reconciliation rule behind the panel's optimistic controls. It lives in a
 * pure class because the repo has no React component-test infrastructure — the
 * hook over it (`useOptimisticValue`) is a five-line wrapper with no rule of its
 * own, so this is where the behaviour is pinned.
 *
 * Concretely: a control must answer the user IMMEDIATELY, and then hand authority
 * back to the store — without flickering through the intermediate values its own
 * earlier writes echo back mid-burst.
 */

const STORED = 40;

describe("PendingEdits with nothing requested", () => {
	it("WHEN nothing has been requested THEN the stored value is shown", () => {
		expect(PendingEdits.none<number>().valueOver(STORED)).toBe(STORED);
	});

	it("WHEN nothing has been requested THEN a new stored value needs no reconciliation", () => {
		const pending = PendingEdits.none<number>();
		expect(pending.reconciled(99)).toBe(pending);
	});
});

describe("PendingEdits optimism", () => {
	it("WHEN a value is requested THEN it is shown before the store has moved", () => {
		expect(PendingEdits.none<number>().requesting(60).valueOver(STORED)).toBe(60);
	});

	it("WHEN a second value is requested THEN the LATEST request is shown", () => {
		expect(PendingEdits.none<number>().requesting(60).requesting(80).valueOver(STORED)).toBe(80);
	});
});

describe("PendingEdits reconciliation", () => {
	it("WHEN the store echoes the LATEST request THEN the override is released", () => {
		const pending = PendingEdits.none<number>().requesting(60);
		expect(pending.reconciled(60).valueOver(60)).toBe(60);
	});

	it("WHEN the store echoes the latest request THEN a later store change is shown immediately", () => {
		// Released means released: nothing may keep shadowing the store afterwards.
		const pending = PendingEdits.none<number>().requesting(60).reconciled(60);
		expect(pending.valueOver(70)).toBe(70);
	});

	it("WHEN the store echoes an EARLIER request mid-burst THEN the latest request is still shown", () => {
		// This is the anti-flicker rule: two fast clicks (60 then 80) make the first
		// write echo 60 back while the user is already looking at 80.
		const pending = PendingEdits.none<number>().requesting(60).requesting(80);
		expect(pending.reconciled(60).valueOver(60)).toBe(80);
	});

	it("WHEN the store reports a value that was never requested THEN it wins immediately", () => {
		// Someone else wrote it (the settings tab, a reset) — or the write path clamped
		// what was typed. Either way the store is right and the control was wrong.
		const pending = PendingEdits.none<number>().requesting(9999);
		expect(pending.reconciled(400).valueOver(400)).toBe(400);
	});

	it("WHEN a requested write is abandoned THEN the stored value is shown again", () => {
		// A failed `data.json` write never echoes, so without this the control would
		// keep displaying a value that was never persisted.
		const pending = PendingEdits.none<number>().requesting(60);
		expect(pending.abandoned().valueOver(STORED)).toBe(STORED);
	});
});
