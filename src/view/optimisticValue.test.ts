import { describe, expect, it } from "vitest";
import { clampStepperDepth } from "./constants";
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
		expect(PendingEdits.none<number>().requesting(60, STORED).valueOver(STORED)).toBe(60);
	});

	it("WHEN a second value is requested THEN the LATEST request is shown", () => {
		const pending = PendingEdits.none<number>().requesting(60, STORED).requesting(80, STORED);
		expect(pending.valueOver(STORED)).toBe(80);
	});
});

describe("PendingEdits reconciliation", () => {
	it("WHEN the store has NOT moved yet THEN the requested value is still shown", () => {
		// THE case that happens on every single edit: the write is serialised behind a
		// whole traversal + layout round-trip, so the very next render still carries the
		// PRE-EDIT stored value. Releasing the override here loses the user's click
		// before it is ever painted — which is the bug this class exists to prevent.
		const pending = PendingEdits.none<number>().requesting(3, 2);
		expect(pending.reconciled(2).valueOver(2)).toBe(3);
	});

	it("WHEN the store echoes the LATEST request THEN the override is released", () => {
		const pending = PendingEdits.none<number>().requesting(60, STORED);
		expect(pending.reconciled(60).valueOver(60)).toBe(60);
	});

	it("WHEN the store echoes the latest request THEN a later store change is shown immediately", () => {
		// Released means released: nothing may keep shadowing the store afterwards.
		const pending = PendingEdits.none<number>().requesting(60, STORED).reconciled(60);
		expect(pending.valueOver(70)).toBe(70);
	});

	it("WHEN the store echoes an EARLIER request mid-burst THEN the latest request is still shown", () => {
		// This is the anti-flicker rule: two fast clicks (60 then 80) make the first
		// write echo 60 back while the user is already looking at 80.
		const pending = PendingEdits.none<number>().requesting(60, STORED).requesting(80, STORED);
		expect(pending.reconciled(60).valueOver(60)).toBe(80);
	});

	it("WHEN the store moves to a value nobody requested THEN it wins immediately", () => {
		// Someone else wrote it (the settings tab, a reset) — or the write path clamped
		// what was typed. Either way the store is right and the control was wrong. This
		// is the anti-lie half of the rule: it must survive the fix for the case above.
		const pending = PendingEdits.none<number>().requesting(9999, STORED);
		expect(pending.reconciled(400).valueOver(400)).toBe(400);
	});

	it("WHEN a requested write is abandoned THEN the stored value is shown again", () => {
		// A failed `data.json` write never echoes, so without this the control would
		// keep displaying a value that was never persisted.
		const pending = PendingEdits.none<number>().requesting(60, STORED);
		expect(pending.abandoned().valueOver(STORED)).toBe(STORED);
	});
});

/**
 * The original defect (`ticket-controls-optimistic-input-latency.md`) as the user
 * meets it: rapid `+` clicks on a depth stepper looked DROPPED, because each click
 * computes its target from what the stepper currently SHOWS while the store is
 * still several hundred ms behind.
 *
 * {@link stepperRender} is `DepthStepper`'s own per-render derivation, expressed
 * against the same pure pieces the component uses (`PendingEdits` +
 * `clampStepperDepth`). It reproduces the component's LOOP, not the component: that
 * the real `DepthStepper` feeds `shown` (not the raw `value` prop) back into the
 * next click is verified only by reading it and by e2e — there is no React
 * component-test harness in this repo.
 */
function stepperRender(
	pending: PendingEdits<number>,
	stored: number,
): { readonly shown: number; clickPlus(): PendingEdits<number> } {
	const reconciled = pending.reconciled(stored);
	const shown = reconciled.valueOver(stored);
	return { shown, clickPlus: () => reconciled.requesting(clampStepperDepth(shown + 1), stored) };
}

describe("PendingEdits driving a depth stepper", () => {
	it("WHEN the stepper is clicked twice before the store answers THEN neither click is dropped", () => {
		const stored = 2;
		const afterFirst = stepperRender(PendingEdits.none<number>(), stored).clickPlus();
		const afterSecond = stepperRender(afterFirst, stored).clickPlus();
		expect(stepperRender(afterSecond, stored).shown).toBe(4);
	});

	it("WHEN the first click's write lands mid-burst THEN the stepper does not snap back to it", () => {
		const stored = 2;
		const afterFirst = stepperRender(PendingEdits.none<number>(), stored).clickPlus();
		const afterSecond = stepperRender(afterFirst, stored).clickPlus();
		// The store has caught up to click ONE (3) while the user is looking at 4.
		expect(stepperRender(afterSecond, 3).shown).toBe(4);
	});

	it("WHEN the store settles on the last requested value THEN the stepper follows the store again", () => {
		const stored = 2;
		const afterFirst = stepperRender(PendingEdits.none<number>(), stored).clickPlus();
		const afterSecond = stepperRender(afterFirst, stored).clickPlus();
		const released = afterSecond.reconciled(4);
		// A later change from the OTHER surface must show through immediately.
		expect(stepperRender(released, 9).shown).toBe(9);
	});
});
