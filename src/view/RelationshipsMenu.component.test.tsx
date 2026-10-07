// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EngineDefaults } from "../engine";
import type { RelationshipSettings } from "../engine";
import { aiNamingStatusLine } from "./aiNamingStatusLine";
import type { AiNamingStatus } from "./AiRelationshipQueue";
import { GraphUiContext } from "./GraphUiContext";
import { RelationshipsMenu } from "./RelationshipsMenu";
import type { SettingsRow, SettingsRowControl } from "./settingsRows";
import { SettingsRowNames, settingsRowsFor, settingsRowsPresentedBy } from "./settingsRows";
import { FakeSecretPicker } from "./testFixtures/fakeSecretPicker";
import {
	RecordingControlsActions,
	controlsModelFixture,
	settingsRowStateFixture,
	withActions,
} from "./testFixtures/settingsPanelHarness";
import type { AiNamingMenuPort, GraphUiPort } from "./viewPorts";

/**
 * The top-right Relationships menu, rendered (task 4/4 `nid_80xc6z8umlpo1x6u4p1v7eb22_e`):
 * every row the Relationships section declares, the session status line, and Retry.
 * Structural over the declared model, like `GraphToolbar.component.test.tsx`: no row
 * label and no status copy is typed here.
 */

const IDLE: AiNamingStatus = {
	preparing: 0,
	inFlight: 0,
	runRequested: 0,
	runAnswered: 0,
	named: 0,
	declined: 0,
	failed: 0,
	inputTokens: 0,
	outputTokens: 0,
	lastFailure: null,
	stopped: false,
};

const STOPPED: AiNamingStatus = { ...IDLE, failed: 1, lastFailure: "no-key", stopped: true };

/** A status the test publishes by hand, and a count of Retry clicks. */
class ScriptedAiNaming implements AiNamingMenuPort {
	retries = 0;
	private current: AiNamingStatus;
	private readonly listeners = new Set<() => void>();

	constructor(initial: AiNamingStatus) {
		this.current = initial;
	}

	readonly status = (): AiNamingStatus => this.current;

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	retry(): void {
		this.retries += 1;
	}

	publish(next: AiNamingStatus): void {
		this.current = next;
		this.listeners.forEach((listener) => listener());
	}
}

/** Only the methods a settings row reaches; anything else fails loudly. */
function graphUi(picker: FakeSecretPicker): GraphUiPort {
	const unreachable = (name: string): never => {
		throw new Error(`the Relationships menu must not call GraphUiPort.${name}`);
	};
	return {
		resourcePath: () => unreachable("resourcePath"),
		showAttachmentMenu: () => unreachable("showAttachmentMenu"),
		showNodeMenu: () => unreachable("showNodeMenu"),
		renderIcon: () => unreachable("renderIcon"),
		renderMarkdown: () => unreachable("renderMarkdown"),
		mountSecretPicker: picker.mount,
	};
}

interface Rendered {
	readonly actions: RecordingControlsActions;
	readonly aiNaming: ScriptedAiNaming;
	readonly picker: FakeSecretPicker;
	readonly container: HTMLElement;
}

function renderMenu(status: AiNamingStatus = IDLE, relationships: Partial<RelationshipSettings> = {}): Rendered {
	const actions = new RecordingControlsActions();
	const aiNaming = new ScriptedAiNaming(status);
	const picker = new FakeSecretPicker();
	const state = settingsRowStateFixture({
		relationships: { ...EngineDefaults.relationshipSettings(), ...relationships },
	});
	const { container } = render(
		<GraphUiContext.Provider value={graphUi(picker)}>
			{withActions(<RelationshipsMenu controls={controlsModelFixture(state)} aiNaming={aiNaming} />, actions)}
		</GraphUiContext.Provider>,
	);
	return { actions, aiNaming, picker, container };
}

function declaredRow(kind: SettingsRowControl["kind"]): SettingsRow {
	const row = settingsRowsFor(kind)[0];
	if (row === undefined) {
		throw new Error(`the declared model no longer has a ${kind} row`);
	}
	return row;
}

function controlOf(kind: SettingsRowControl["kind"]): HTMLInputElement | HTMLSelectElement {
	return screen.getByLabelText<HTMLInputElement | HTMLSelectElement>(SettingsRowNames.sole(declaredRow(kind)));
}

function statusLineText(container: HTMLElement): string | null {
	return container.querySelector('[role="status"]')?.textContent ?? null;
}

afterEach(cleanup);

describe("RelationshipsMenu (rendered): the declared rows", () => {
	it("WHEN the menu renders THEN every row it presents appears under its declared accessible name, in declared order", () => {
		const { container } = renderMenu();
		const declared = settingsRowsPresentedBy("relationships-menu").map((row) => SettingsRowNames.sole(row));
		const rendered = Array.from(container.querySelectorAll("[aria-label]"))
			.map((el) => el.getAttribute("aria-label"))
			.filter((name): name is string => name !== null && declared.includes(name));
		expect(rendered).toEqual(declared);
	});

	it("WHEN the menu renders THEN it presents at least one row (the guard above is not vacuous)", () => {
		expect(settingsRowsPresentedBy("relationships-menu").length).toBeGreaterThan(0);
	});

	it("WHEN AI naming is switched on THEN one auto-naming write is emitted", () => {
		const { actions } = renderMenu(IDLE, { autoNaming: false });
		fireEvent.click(controlOf("ai-auto-naming"));
		expect(actions.interactions).toEqual([{ kind: "global-ai-auto-naming", autoNaming: true }]);
	});

	it("WHEN a key secret is picked THEN one key-secret write carries its name", () => {
		const { actions } = renderMenu();
		fireEvent.change(controlOf("ai-api-key"), { target: { value: "openai" } });
		expect(actions.interactions).toEqual([{ kind: "global-ai-key-secret", apiKeySecretName: "openai" }]);
	});

	it("WHEN the stored key secret is shown THEN the picker is mounted with it", () => {
		const { picker } = renderMenu(IDLE, { apiKeySecretName: "work-openai" });
		expect(picker.mounts.map((mount) => mount.secretName)).toContain("work-openai");
	});

	it("WHEN a model is typed THEN nothing is written before the field is left", () => {
		const { actions } = renderMenu();
		fireEvent.change(controlOf("ai-model"), { target: { value: "gpt-other" } });
		expect(actions.interactions).toEqual([]);
	});

	it("WHEN a typed model is committed with surrounding spaces THEN the settled model is written", () => {
		const { actions } = renderMenu();
		const field = controlOf("ai-model");
		fireEvent.change(field, { target: { value: "  gpt-other  " } });
		fireEvent.blur(field);
		expect(actions.interactions).toEqual([{ kind: "global-ai-model", model: "gpt-other" }]);
	});

	it("WHEN a reasoning effort is chosen THEN one effort write is emitted", () => {
		const { actions } = renderMenu();
		fireEvent.change(controlOf("ai-reasoning-effort"), { target: { value: "high" } });
		expect(actions.interactions).toEqual([{ kind: "global-ai-reasoning-effort", reasoningEffort: "high" }]);
	});

	it.each(["xhigh", "max"] as const)("WHEN the live-verified effort %s is chosen THEN one effort write for it is emitted", (effort) => {
		const { actions } = renderMenu();
		fireEvent.change(controlOf("ai-reasoning-effort"), { target: { value: effort } });
		expect(actions.interactions).toEqual([{ kind: "global-ai-reasoning-effort", reasoningEffort: effort }]);
	});
});

describe("RelationshipsMenu (rendered): status and Retry", () => {
	it("WHEN the menu renders THEN the status line reads the session status", () => {
		const { container } = renderMenu(IDLE, { autoNaming: true });
		expect(statusLineText(container)).toBe(aiNamingStatusLine(IDLE, true).text);
	});

	it("WHEN the session status changes THEN the status line follows it", () => {
		const { container, aiNaming } = renderMenu(IDLE, { autoNaming: true });
		const named: AiNamingStatus = { ...IDLE, named: 2, inputTokens: 40, outputTokens: 4 };
		act(() => aiNaming.publish(named));
		expect(statusLineText(container)).toBe(aiNamingStatusLine(named, true).text);
	});

	it("WHEN auto mode is not stopped THEN no Retry is offered", () => {
		const { container } = renderMenu(IDLE, { autoNaming: true });
		expect(container.querySelector(".vicinity-graph-relationships-menu__retry")).toBeNull();
	});

	it("WHEN auto mode is stopped THEN Retry asks the gate to retry", () => {
		const { container, aiNaming } = renderMenu(STOPPED, { autoNaming: true });
		const retry = container.querySelector(".vicinity-graph-relationships-menu__retry");
		if (retry === null) {
			throw new Error("a stopped auto mode offers no Retry");
		}
		fireEvent.click(retry);
		expect(aiNaming.retries).toBe(1);
	});
});
