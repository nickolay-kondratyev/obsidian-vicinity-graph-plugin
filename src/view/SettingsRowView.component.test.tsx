// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { SettingsRowAccessors } from "./settingsRowAccessors";
import type { SettingsRow, SettingsRowState } from "./settingsRows";
import { SettingsRowNames, settingsRowsFor } from "./settingsRows";
import { SettingsRowView } from "./SettingsRowView";
import { describeSizingRejection } from "./settingsValidation";
import {
	RecordingControlsActions,
	renderWithActions,
	settingsRowStateFixture,
	withActions,
} from "./testFixtures/settingsPanelHarness";

/**
 * The MARKUP half of a typed row's refusal protocol — the wiring
 * `numberRowCommit.test.ts` (the pure rule) cannot see: that a refused commit
 * renders the refusal as a `role="alert"` the input's `aria-describedby` points at,
 * that a refused commit writes NOTHING, and that the message retires when the stored
 * value moves under the field (Restore defaults, another surface). Plus the reseed
 * rule (`NumberRowCommit.reseedsFromStore`) as rendered: every commit the panel does
 * NOT refuse puts the settled value back in the box.
 *
 * Exercised on the ONE row kind with a cross-field rule (`sizing-number`, maxPx),
 * judged against `storedGlobalView()` — the fresh store read, not the rendered
 * snapshot.
 */

const MAX_PX_ROW: SettingsRow | undefined = settingsRowsFor("sizing-number").find(
	(row) => row.control.kind === "sizing-number" && row.control.field === "maxPx",
);
if (MAX_PX_ROW === undefined) {
	throw new Error("the declared model no longer has a maxPx sizing-number row");
}
const ROW = MAX_PX_ROW;

function maxPxInput(): HTMLInputElement {
	return screen.getByRole("spinbutton", { name: SettingsRowNames.sole(ROW) }) as HTMLInputElement;
}

function commitTyped(raw: string): void {
	const input = maxPxInput();
	fireEvent.change(input, { target: { value: raw } });
	fireEvent.blur(input);
}

/** Renders the maxPx row over shipped defaults; the actions' view is that same store. */
function renderMaxPxRow(): { actions: RecordingControlsActions; state: SettingsRowState; rerenderAt: (maxPx: number) => void } {
	const actions = new RecordingControlsActions();
	const state = settingsRowStateFixture();
	const view = renderWithActions(<SettingsRowView row={ROW} state={state} />, actions);
	const rerenderAt = (maxPx: number): void => {
		const globalView = { ...state.globalView, sizing: { ...state.globalView.sizing, maxPx } };
		actions.view = globalView;
		view.rerender(withActions(<SettingsRowView row={ROW} state={{ ...state, globalView }} />, actions));
	};
	return { actions, state, rerenderAt };
}

/** A maxPx value the cross-field rule refuses, and the exact copy the rule gives for it. */
function refusedValue(state: SettingsRowState): { typed: number; reason: string } {
	const typed = state.globalView.sizing.minPx - 1;
	const reason = describeSizingRejection({ ...state.globalView.sizing, maxPx: typed });
	if (reason === undefined) {
		throw new Error("fixture error: the typed value was expected to be refused");
	}
	return { typed, reason };
}

afterEach(cleanup);

describe("SettingsRowView (rendered): a refused typed commit", () => {
	it("WHEN a commit is refused THEN the row renders the refusal copy as an alert", () => {
		const { state } = renderMaxPxRow();
		const { typed, reason } = refusedValue(state);
		commitTyped(String(typed));
		expect(screen.getByRole("alert").textContent).toBe(reason);
	});

	it("WHEN a commit is refused THEN the input is marked invalid and described by that alert", () => {
		const { state } = renderMaxPxRow();
		commitTyped(String(refusedValue(state).typed));
		const input = maxPxInput();
		expect({
			invalid: input.getAttribute("aria-invalid"),
			describedBy: input.getAttribute("aria-describedby"),
		}).toEqual({ invalid: "true", describedBy: screen.getByRole("alert").id });
	});

	it("WHEN a commit is refused THEN nothing is written and the typed text stands beside the reason", () => {
		const { actions, state } = renderMaxPxRow();
		const { typed } = refusedValue(state);
		commitTyped(String(typed));
		expect({ interactions: actions.interactions, shownText: maxPxInput().value }).toEqual({
			interactions: [],
			shownText: String(typed),
		});
	});

	it("WHEN the stored value then moves under the field THEN the refusal disappears with the reseed", () => {
		const { state, rerenderAt } = renderMaxPxRow();
		commitTyped(String(refusedValue(state).typed));
		// Restore defaults / another surface: the store answers with a different number.
		rerenderAt(state.globalView.sizing.maxPx + 10);
		expect(screen.queryByRole("alert")).toBeNull();
	});
});

describe("SettingsRowView (rendered): a commit the panel does not refuse reseeds from the store", () => {
	it("WHEN the typed value is capped by the write path THEN the write carries the settled number and its store echo reseeds the box", () => {
		const accessor = SettingsRowAccessors.sizingNumber("maxPx");
		const { actions, state, rerenderAt } = renderMaxPxRow();
		// Far past the declared ceiling: accepted (a real number), clamped on the way in.
		const typed = accessor.bounds.max + state.globalView.sizing.maxPx;
		const settled = accessor.settlesAt(typed);
		commitTyped(String(typed));
		// The rebuilt snapshot echoes what the write path stored — the settled number,
		// which is what releases the optimistic override (it never waits for the typed
		// text to be echoed, because that echo will never come).
		rerenderAt(settled);
		expect({ written: actions.interactions, shownText: maxPxInput().value }).toEqual({
			written: [{ kind: "global-sizing-number", field: "maxPx", value: settled }],
			shownText: String(settled),
		});
	});

	it("WHEN the field is left blank THEN nothing is written and the stored value returns to the box", () => {
		const { actions } = renderMaxPxRow();
		commitTyped("");
		expect({ interactions: actions.interactions, shownText: maxPxInput().value }).toEqual({
			interactions: [],
			shownText: String(EngineDefaults.viewSettings().sizing.maxPx),
		});
	});
});
