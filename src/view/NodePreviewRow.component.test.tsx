// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NODE_PREVIEW_PREFERENCES } from "../engine";
import { NODE_PREVIEW_OPTION_META } from "./nodePreviewPreferenceMeta";
import type { SettingsRow } from "./settingsRows";
import { settingsRowsFor } from "./settingsRows";
import { SettingsRowView } from "./SettingsRowView";
import { RecordingControlsActions, renderWithActions, settingsRowStateFixture } from "./testFixtures/settingsPanelHarness";

/**
 * The RENDERED panel-side pill (the settings TAB cannot render under `npm test` —
 * `obsidian` is types-only, so `settingsRowParity.test.ts` covers it by source
 * scan). Here we pin that the new `title-only` option actually reaches the DOM as
 * a selectable radio and that picking it emits the ONE interaction the write
 * pipeline expects — the acceptance criterion's "both settings surfaces show the
 * new option" for the surface a jsdom test can reach.
 */

const PREVIEW_ROW: SettingsRow | undefined = settingsRowsFor("node-preview")[0];
if (PREVIEW_ROW === undefined) {
	throw new Error("the declared model no longer has a node-preview row");
}
const ROW = PREVIEW_ROW;

function renderPreviewRow(): RecordingControlsActions {
	const actions = new RecordingControlsActions();
	renderWithActions(<SettingsRowView row={ROW} state={settingsRowStateFixture()} />, actions);
	return actions;
}

afterEach(cleanup);

describe("NodePreviewRow (rendered): the Title only option", () => {
	it("WHEN the pill renders THEN every preference — Title only included — is a radio named by its shared copy", () => {
		renderPreviewRow();
		const rendered = NODE_PREVIEW_PREFERENCES.map(
			(preference) => screen.queryByRole("radio", { name: NODE_PREVIEW_OPTION_META[preference].label }) !== null,
		);
		expect(rendered.every(Boolean)).toBe(true);
	});

	it("WHEN Title only is chosen THEN exactly one global-node-preview interaction names that value", () => {
		const actions = renderPreviewRow();
		fireEvent.click(screen.getByRole("radio", { name: NODE_PREVIEW_OPTION_META["title-only"].label }));
		expect(actions.interactions).toEqual([{ kind: "global-node-preview", value: "title-only" }]);
	});
});
