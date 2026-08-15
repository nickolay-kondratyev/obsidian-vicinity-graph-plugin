// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IdRefFieldChips } from "./idRefFieldChips";
import type { SettingsRow, SettingsRowState } from "./settingsRows";
import { SettingsRowNames, settingsRowsFor } from "./settingsRows";
import { SettingsRowView } from "./SettingsRowView";
import {
	RecordingControlsActions,
	renderWithActions,
	settingsRowStateFixture,
} from "./testFixtures/settingsPanelHarness";

/**
 * The id-reference-fields CHIP row, as the PANEL renders it (ticket
 * `nid_gpgudw7pfdy02wcqbs73si21x_e`): the stored comma-separated string renders as
 * one chip per field, the entry field adds ONE field per commit (Enter or blur,
 * never per keystroke), each chip's remove button drops exactly its field, and a
 * no-op entry (empty/duplicate) writes nothing.
 */

const ID_REF_ROW: SettingsRow | undefined = settingsRowsFor("id-ref-fields")[0];
if (ID_REF_ROW === undefined) {
	throw new Error("the declared model no longer has an id-ref-fields row");
}
const ROW = ID_REF_ROW;

function stateWithFields(idRefFields: string): SettingsRowState {
	return settingsRowStateFixture({ frontmatterLinks: { idRefFields } });
}

function entryField(): HTMLInputElement {
	return screen.getByRole("textbox", { name: SettingsRowNames.sole(ROW) }) as HTMLInputElement;
}

afterEach(cleanup);

describe("IdRefFieldsRow (rendered)", () => {
	it("WHEN fields are stored THEN each renders as a chip with its own remove button", () => {
		renderWithActions(<SettingsRowView row={ROW} state={stateWithFields("deps, links")} />, new RecordingControlsActions());
		const removeNames = screen
			.getAllByRole("button")
			.map((button) => button.getAttribute("aria-label"));
		expect(removeNames).toEqual([IdRefFieldChips.removeName("deps"), IdRefFieldChips.removeName("links")]);
	});

	it("WHEN the entry field is typed into but not committed THEN nothing is written yet", () => {
		const actions = new RecordingControlsActions();
		renderWithActions(<SettingsRowView row={ROW} state={stateWithFields("")} />, actions);
		fireEvent.change(entryField(), { target: { value: "deps" } });
		expect(actions.interactions).toEqual([]);
	});

	it("WHEN an entry is committed with Enter THEN the field is appended to the stored list", () => {
		const actions = new RecordingControlsActions();
		renderWithActions(<SettingsRowView row={ROW} state={stateWithFields("deps")} />, actions);
		fireEvent.change(entryField(), { target: { value: "links" } });
		fireEvent.keyDown(entryField(), { key: "Enter" });
		expect(actions.interactions).toEqual([{ kind: "global-id-ref-fields", idRefFields: "deps, links" }]);
	});

	it("WHEN an entry is committed with Enter THEN the committed field appears as a chip", () => {
		renderWithActions(<SettingsRowView row={ROW} state={stateWithFields("")} />, new RecordingControlsActions());
		fireEvent.change(entryField(), { target: { value: "deps" } });
		fireEvent.keyDown(entryField(), { key: "Enter" });
		expect(screen.getByRole("button", { name: IdRefFieldChips.removeName("deps") })).toBeTruthy();
	});

	it("WHEN an entry is committed THEN the entry field is cleared for the next one", () => {
		renderWithActions(<SettingsRowView row={ROW} state={stateWithFields("")} />, new RecordingControlsActions());
		fireEvent.change(entryField(), { target: { value: "deps" } });
		fireEvent.keyDown(entryField(), { key: "Enter" });
		expect(entryField().value).toBe("");
	});

	it("WHEN the entry field is left with text THEN the blur commits it (a typed name is not lost)", () => {
		const actions = new RecordingControlsActions();
		renderWithActions(<SettingsRowView row={ROW} state={stateWithFields("")} />, actions);
		fireEvent.change(entryField(), { target: { value: "deps" } });
		fireEvent.blur(entryField());
		expect(actions.interactions).toEqual([{ kind: "global-id-ref-fields", idRefFields: "deps" }]);
	});

	it("WHEN a duplicate entry is committed THEN nothing is written", () => {
		const actions = new RecordingControlsActions();
		renderWithActions(<SettingsRowView row={ROW} state={stateWithFields("deps")} />, actions);
		fireEvent.change(entryField(), { target: { value: "deps" } });
		fireEvent.keyDown(entryField(), { key: "Enter" });
		expect(actions.interactions).toEqual([]);
	});

	it("WHEN a chip's remove button is clicked THEN exactly its field leaves the stored list", () => {
		const actions = new RecordingControlsActions();
		renderWithActions(<SettingsRowView row={ROW} state={stateWithFields("deps, links")} />, actions);
		fireEvent.click(screen.getByRole("button", { name: IdRefFieldChips.removeName("deps") }));
		expect(actions.interactions).toEqual([{ kind: "global-id-ref-fields", idRefFields: "links" }]);
	});

	it("WHEN a chip is removed THEN it disappears from the rendered list", () => {
		renderWithActions(
			<SettingsRowView row={ROW} state={stateWithFields("deps, links")} />,
			new RecordingControlsActions(),
		);
		fireEvent.click(screen.getByRole("button", { name: IdRefFieldChips.removeName("deps") }));
		expect(screen.queryByRole("button", { name: IdRefFieldChips.removeName("deps") })).toBeNull();
	});
});
