// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { asVaultPath, directedLinkKey } from "../engine";
import type { EdgeRelationship } from "../engine";
import { ControlsActionsContext } from "./ControlsActionsContext";
import { EdgeRelationshipContext } from "./EdgeRelationshipContext";
import { EdgeRelationshipOverlayStore } from "./EdgeRelationshipOverlayStore";
import {
	CLEAR_RELATIONSHIP_ACTION,
	NAME_RELATIONSHIP_ACTION,
	RENAME_RELATIONSHIP_ACTION,
} from "./linkPreviewModel";
import type { RelationshipPairModel } from "./linkPreviewModel";
import { describeRelationshipNameRejection } from "./relationshipNameCommit";
import { RelationshipList, relationshipNameFieldLabel } from "./RelationshipList";
import { RecordingControlsActions } from "./testFixtures/settingsPanelHarness";

/**
 * RENDERED behaviour of the edge drawer's relationship list (ticket
 * `nid_a5m4kforr9scit68rhqmqh78o_e`): which actions a pair offers and what the
 * name field writes. Which actions a NAME allows is unit-tested in
 * `linkPreviewModel.test.ts` (`relationshipRowOf`); when a commit saves is
 * unit-tested in `relationshipNameCommit.test.ts`.
 */

const SOURCE = asVaultPath("notes/alpha.md");
const TARGET = asVaultPath("notes/beta.md");
const PAIR: RelationshipPairModel = {
	key: directedLinkKey(SOURCE, TARGET),
	sourcePath: SOURCE,
	targetPath: TARGET,
	sourceName: "alpha",
	targetName: "beta",
};

afterEach(() => {
	cleanup();
});

/** GIVEN the list for alpha → beta, named `relationship` (or unnamed). */
function renderList(relationship: EdgeRelationship | null = null): RecordingControlsActions {
	const actions = new RecordingControlsActions();
	const store = new EdgeRelationshipOverlayStore();
	if (relationship !== null) {
		store.showEdgeRelationships(new Map([[PAIR.key, relationship]]));
	}
	render(
		<ControlsActionsContext.Provider value={actions}>
			<EdgeRelationshipContext.Provider value={store}>
				<RelationshipList pairs={[PAIR]} />
			</EdgeRelationshipContext.Provider>
		</ControlsActionsContext.Provider>,
	);
	return actions;
}

function nameField(): HTMLInputElement {
	return screen.getByRole<HTMLInputElement>("textbox", { name: relationshipNameFieldLabel(PAIR) });
}

/** WHEN the user opens the name field and types `text` into it. */
function typeName(openAction: string, text: string): void {
	fireEvent.click(screen.getByRole("button", { name: openAction }));
	fireEvent.change(nameField(), { target: { value: text } });
}

describe("RelationshipList naming an unnamed pair", () => {
	it("WHEN 'Name this relationship' is clicked THEN the name field takes focus", () => {
		renderList();
		fireEvent.click(screen.getByRole("button", { name: NAME_RELATIONSHIP_ACTION }));
		expect(document.activeElement).toBe(nameField());
	});

	it("WHEN a name is typed and Enter pressed THEN it is saved for source → target", () => {
		const actions = renderList();
		typeName(NAME_RELATIONSHIP_ACTION, "supports");
		fireEvent.keyDown(nameField(), { key: "Enter" });
		expect(actions.relationshipWrites).toEqual([
			{ kind: "name", sourcePath: SOURCE, targetPath: TARGET, name: "supports" },
		]);
	});

	it("WHEN a name is typed and the field left THEN it is saved", () => {
		const actions = renderList();
		typeName(NAME_RELATIONSHIP_ACTION, "supports");
		fireEvent.blur(nameField());
		expect(actions.relationshipWrites).toHaveLength(1);
	});

	it("WHEN Enter saves and the closing field then blurs THEN the name is written once", () => {
		const actions = renderList();
		typeName(NAME_RELATIONSHIP_ACTION, "supports");
		const field = nameField();
		fireEvent.keyDown(field, { key: "Enter" });
		fireEvent.blur(field);
		expect(actions.relationshipWrites).toHaveLength(1);
	});

	it("WHEN a name is saved THEN the field closes", () => {
		renderList();
		typeName(NAME_RELATIONSHIP_ACTION, "supports");
		fireEvent.keyDown(nameField(), { key: "Enter" });
		expect(screen.queryByRole("textbox")).toBeNull();
	});

	it("WHEN Enter is pressed on an empty field THEN the refusal is shown in plain words", () => {
		renderList();
		typeName(NAME_RELATIONSHIP_ACTION, "  ");
		fireEvent.keyDown(nameField(), { key: "Enter" });
		expect(screen.getByRole("alert").textContent).toBe(describeRelationshipNameRejection("empty"));
	});

	it("WHEN Enter is pressed on an empty field THEN nothing is written", () => {
		const actions = renderList();
		typeName(NAME_RELATIONSHIP_ACTION, "");
		fireEvent.keyDown(nameField(), { key: "Enter" });
		expect(actions.relationshipWrites).toEqual([]);
	});

	it("WHEN Escape is pressed THEN the edit is dropped without writing", () => {
		const actions = renderList();
		typeName(NAME_RELATIONSHIP_ACTION, "supports");
		fireEvent.keyDown(nameField(), { key: "Escape" });
		expect({ writes: actions.relationshipWrites, field: screen.queryByRole("textbox") }).toEqual({
			writes: [],
			field: null,
		});
	});
});

describe("RelationshipList on a named pair", () => {
	it("WHEN a manual name is renamed THEN the field starts from the current name", () => {
		renderList({ name: "supports", origin: "manual" });
		fireEvent.click(screen.getByRole("button", { name: RENAME_RELATIONSHIP_ACTION }));
		expect(nameField().value).toBe("supports");
	});

	it("WHEN a manual name is cleared THEN the clear is sent for source → target", () => {
		const actions = renderList({ name: "supports", origin: "manual" });
		fireEvent.click(screen.getByRole("button", { name: CLEAR_RELATIONSHIP_ACTION }));
		expect(actions.relationshipWrites).toEqual([{ kind: "clear", sourcePath: SOURCE, targetPath: TARGET }]);
	});

	it("WHEN the `parent` default is renamed THEN the new name is saved as the user's", () => {
		const actions = renderList({ name: "parent", origin: "folder-hierarchy" });
		typeName(RENAME_RELATIONSHIP_ACTION, "contains");
		fireEvent.keyDown(nameField(), { key: "Enter" });
		expect(actions.relationshipWrites).toEqual([
			{ kind: "name", sourcePath: SOURCE, targetPath: TARGET, name: "contains" },
		]);
	});

	it("WHEN the name is declared in a note THEN the row offers no button", () => {
		renderList({ name: "improves", origin: "syntax" });
		expect(screen.queryAllByRole("button")).toEqual([]);
	});
});
