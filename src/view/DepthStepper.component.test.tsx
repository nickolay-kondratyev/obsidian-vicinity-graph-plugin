// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import { SettingsRowAccessors } from "./settingsRowAccessors";
import { SettingsRowNames, settingsRowsFor } from "./settingsRows";
import { SettingsRowView } from "./SettingsRowView";
import {
	RecordingControlsActions,
	renderWithActions,
	settingsRowStateFixture,
	withActions,
} from "./testFixtures/settingsPanelHarness";

/**
 * THE COMPONENT LOOP the pure suites cannot pin (`optimisticValue.test.ts` simulates
 * it): a rendered depth stepper, clicked in a burst BEFORE any rebuilt snapshot
 * arrives. The optimistic-controls layer once shipped non-functional on exactly this
 * path — nine passing unit tests on `PendingEdits` never rendered the component — so
 * this file exercises the real wiring: `SettingsRowView`'s depth arm, the accessor it
 * mounts, `useOptimisticValue`, and the interactions that reach the actions port.
 *
 * Rendered through `SettingsRowView` rather than `DepthStepper` directly, so what is
 * pinned includes the presenter handing the stepper the right accessor/interaction
 * pair — one of the gaps the harness ticket (`nid_7qot0m6nuxxmd5z0yb9jylsd6_e`) names.
 */

const FIRST_DEPTH_ROW = settingsRowsFor("depth")[0];
if (FIRST_DEPTH_ROW === undefined || FIRST_DEPTH_ROW.control.kind !== "depth") {
	throw new Error("the declared model no longer has a depth row for this suite to render");
}
// Re-bound after the guard: module-level narrowing does not reach into closures.
const DEPTH_ROW = FIRST_DEPTH_ROW;
const FIELD = FIRST_DEPTH_ROW.control.field;
const { bounds } = SettingsRowAccessors.depth(FIELD);

const INCREASE = SettingsRowNames.action("Increase", DEPTH_ROW);
const DECREASE = SettingsRowNames.action("Decrease", DEPTH_ROW);

/** Mounts the row with the store holding `stored` for {@link FIELD}. */
function renderStepperAt(stored: number): RecordingControlsActions {
	const actions = new RecordingControlsActions();
	const state = settingsRowStateFixture({
		globalDepths: { ...EngineDefaults.depthSettings(), [FIELD]: stored },
	});
	renderWithActions(<SettingsRowView row={DEPTH_ROW} state={state} />, actions);
	return actions;
}

afterEach(cleanup);

describe("DepthStepper (rendered): a click burst before the store catches up", () => {
	it("GIVEN the declared track THEN it is wide enough for a three-click burst (fixture guard)", () => {
		expect(bounds.max - bounds.min).toBeGreaterThanOrEqual(3 * bounds.step);
	});

	it("WHEN + is clicked three times THEN no click is dropped: each write steps from the SHOWN value", () => {
		const actions = renderStepperAt(bounds.min);
		const plus = screen.getByRole("button", { name: INCREASE });
		fireEvent.click(plus);
		fireEvent.click(plus);
		fireEvent.click(plus);
		// The raw `value` prop never moved (no rebuild happened), so stepping from it
		// would emit min+step three times — the shipped bug this file exists to pin.
		expect(actions.interactions).toEqual([
			{ kind: "global-depth", field: FIELD, value: bounds.min + bounds.step },
			{ kind: "global-depth", field: FIELD, value: bounds.min + 2 * bounds.step },
			{ kind: "global-depth", field: FIELD, value: bounds.min + 3 * bounds.step },
		]);
	});

	it("WHEN + is clicked three times THEN the readout shows the third step while the store still holds the start", () => {
		renderStepperAt(bounds.min);
		const plus = screen.getByRole("button", { name: INCREASE });
		fireEvent.click(plus);
		fireEvent.click(plus);
		fireEvent.click(plus);
		expect(screen.getByText(String(bounds.min + 3 * bounds.step))).toBeTruthy();
	});

	it("WHEN a click carries the SHOWN value onto the declared max THEN + disables without waiting for the store", () => {
		renderStepperAt(bounds.max - bounds.step);
		const plus = screen.getByRole("button", { name: INCREASE });
		fireEvent.click(plus);
		expect((plus as HTMLButtonElement).disabled).toBe(true);
	});

	it("WHEN the store holds the declared minimum THEN the − button renders disabled", () => {
		renderStepperAt(bounds.min);
		const minus = screen.getByRole("button", { name: DECREASE });
		expect((minus as HTMLButtonElement).disabled).toBe(true);
	});

	it("WHEN a rebuilt snapshot lands on a DIFFERENT value THEN the store wins over the stale override", () => {
		const actions = new RecordingControlsActions();
		const stateAt = (stored: number) =>
			settingsRowStateFixture({ globalDepths: { ...EngineDefaults.depthSettings(), [FIELD]: stored } });
		const view = renderWithActions(<SettingsRowView row={DEPTH_ROW} state={stateAt(bounds.min)} />, actions);
		fireEvent.click(screen.getByRole("button", { name: INCREASE }));
		// Another surface moved the field: the arriving snapshot disagrees with the
		// override, so the override must yield — rendered, not just `PendingEdits`-deep.
		const storeAnswer = bounds.min + 2 * bounds.step;
		view.rerender(withActions(<SettingsRowView row={DEPTH_ROW} state={stateAt(storeAnswer)} />, actions));
		expect(screen.getByText(String(storeAnswer))).toBeTruthy();
	});
});
