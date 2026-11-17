// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GROUPING_MODE_OPTION_META } from "./groupingModeMeta";
import type { SettingsRow } from "./settingsRows";
import { SettingsRowNames, settingsRowsFor } from "./settingsRows";
import { SettingsRowView } from "./SettingsRowView";
import { RecordingControlsActions, renderWithActions, settingsRowStateFixture } from "./testFixtures/settingsPanelHarness";

/** The panel's grouping-mode row (the settings TAB is covered by the parity source scan). */

const DECLARED_ROW: SettingsRow | undefined = settingsRowsFor("grouping-mode")[0];
if (DECLARED_ROW === undefined) {
	throw new Error("the declared model no longer has a grouping-mode row");
}
const ROW = DECLARED_ROW;

function renderRow(): RecordingControlsActions {
	const actions = new RecordingControlsActions();
	renderWithActions(<SettingsRowView row={ROW} state={settingsRowStateFixture()} />, actions);
	return actions;
}

afterEach(cleanup);

describe("GroupingModeRow (rendered)", () => {
	it("WHEN the row renders THEN its pill is a radiogroup named by the declared label", () => {
		renderRow();
		expect(screen.queryByRole("radiogroup", { name: SettingsRowNames.sole(ROW) })).not.toBeNull();
	});

	it("WHEN Tags is chosen THEN exactly one global-grouping-mode interaction names tags", () => {
		const actions = renderRow();
		fireEvent.click(screen.getByRole("radio", { name: GROUPING_MODE_OPTION_META.tags.label }));
		expect(actions.interactions).toEqual([{ kind: "global-grouping-mode", value: "tags" }]);
	});
});
