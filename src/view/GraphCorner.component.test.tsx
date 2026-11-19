// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { asFolderPath, EngineDefaults } from "../engine";
import { GraphCorner } from "./GraphCorner";
import { GROUPING_MODE_OPTION_META } from "./groupingModeMeta";
import { GROUPING_MODE_ROW_LABEL } from "./settingsRows";
import { NO_ORPHAN_TRUNCATION } from "./truncationBadges";
import type { OrphanTruncation } from "./truncationBadges";
import {
	RecordingControlsActions,
	controlsModelFixture,
	renderWithActions,
	settingsRowStateFixture,
} from "./testFixtures/settingsPanelHarness";

/**
 * The graph's top-right Folders | Tags toggle (rendered panel side). It must write
 * the SAME interaction the settings row writes — through the one `ControlsActionsPort`
 * into the shared pipeline — and coexist with the "+N hidden" overlay.
 */

const HIDDEN_TWO: OrphanTruncation = { totalHiddenCount: 2, breakdown: [{ folder: asFolderPath("gone"), hiddenCount: 2 }] };

function renderCorner(groupingMode: "folders" | "tags", orphanTruncation = NO_ORPHAN_TRUNCATION): RecordingControlsActions {
	const actions = new RecordingControlsActions();
	const state = settingsRowStateFixture({ globalView: { ...EngineDefaults.viewSettings(), groupingMode } });
	renderWithActions(<GraphCorner controls={controlsModelFixture(state)} orphanTruncation={orphanTruncation} />, actions);
	return actions;
}

const toggle = () => screen.getByRole("radiogroup", { name: GROUPING_MODE_ROW_LABEL });

afterEach(cleanup);

describe("GraphCorner grouping toggle", () => {
	it("WHEN the stored mode is folders THEN the Folders segment is checked", () => {
		renderCorner("folders");
		expect(within(toggle()).getByRole<HTMLInputElement>("radio", { name: GROUPING_MODE_OPTION_META.folders.label }).checked).toBe(true);
	});

	it("WHEN Tags is chosen THEN exactly one global-grouping-mode interaction names tags", () => {
		const actions = renderCorner("folders");
		fireEvent.click(within(toggle()).getByRole("radio", { name: GROUPING_MODE_OPTION_META.tags.label }));
		expect(actions.interactions).toEqual([{ kind: "global-grouping-mode", value: "tags" }]);
	});

	it("WHEN Folders is chosen from tag mode THEN exactly one global-grouping-mode interaction names folders", () => {
		const actions = renderCorner("tags");
		fireEvent.click(within(toggle()).getByRole("radio", { name: GROUPING_MODE_OPTION_META.folders.label }));
		expect(actions.interactions).toEqual([{ kind: "global-grouping-mode", value: "folders" }]);
	});

	it("WHEN a segment is hovered THEN its tooltip says what it does", () => {
		renderCorner("folders");
		const tagsSegment = within(toggle()).getByRole("radio", { name: GROUPING_MODE_OPTION_META.tags.label });
		expect(tagsSegment.closest("label")?.title).toBe(GROUPING_MODE_OPTION_META.tags.description);
	});
});

describe("GraphCorner hidden overlay", () => {
	it("WHEN nothing is hidden THEN no overlay renders beside the toggle", () => {
		renderCorner("folders");
		expect(screen.queryByText(/hidden/)).toBeNull();
	});

	it("WHEN notes are hidden THEN the overlay renders beside the toggle", () => {
		renderCorner("folders", HIDDEN_TWO);
		expect(screen.getByText("+2 hidden")).not.toBeNull();
	});
});
