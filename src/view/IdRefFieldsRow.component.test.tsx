// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SettingsRow } from "./settingsRows";
import { SettingsRowNames, settingsRowsFor } from "./settingsRows";
import { SettingsRowView } from "./SettingsRowView";
import {
	RecordingControlsActions,
	renderWithActions,
	settingsRowStateFixture,
} from "./testFixtures/settingsPanelHarness";

/**
 * The free-text id-reference-fields row, as the PANEL renders it. This is the first
 * non-number declared row, so what needs pinning against a real DOM is that it commits
 * on BLUR (never per keystroke) and stores the typed string VERBATIM — the list parse
 * (`parseIdRefFields`) lives downstream, so the write must not pre-chew the value.
 */

const ID_REF_ROW: SettingsRow | undefined = settingsRowsFor("id-ref-fields")[0];
if (ID_REF_ROW === undefined) {
	throw new Error("the declared model no longer has an id-ref-fields row");
}
const ROW = ID_REF_ROW;

function input(): HTMLInputElement {
	return screen.getByRole("textbox", { name: SettingsRowNames.sole(ROW) }) as HTMLInputElement;
}

afterEach(cleanup);

describe("IdRefFieldsRow (rendered)", () => {
	it("WHEN the field is typed into but not blurred THEN nothing is written yet", () => {
		const actions = new RecordingControlsActions();
		renderWithActions(<SettingsRowView row={ROW} state={settingsRowStateFixture()} />, actions);
		fireEvent.change(input(), { target: { value: "deps" } });
		expect(actions.interactions).toEqual([]);
	});

	it("WHEN the field is committed on blur THEN the typed string is written verbatim", () => {
		const actions = new RecordingControlsActions();
		renderWithActions(<SettingsRowView row={ROW} state={settingsRowStateFixture()} />, actions);
		fireEvent.change(input(), { target: { value: "deps, links" } });
		fireEvent.blur(input());
		expect(actions.interactions).toEqual([{ kind: "global-id-ref-fields", idRefFields: "deps, links" }]);
	});
});
