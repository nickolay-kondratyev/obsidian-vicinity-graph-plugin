// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asVaultPath, directedLinkKey } from "../engine";
import type { EdgeRelationship } from "../engine";
import { ControlsActionsContext } from "./ControlsActionsContext";
import { EdgeRelationshipContext } from "./EdgeRelationshipContext";
import { EdgeRelationshipOverlayStore } from "./EdgeRelationshipOverlayStore";
import { DRAWER_KEYBOARD_STEP_PX, DRAWER_MIN_SIZE_PX, sessionDrawerSizes } from "./drawerResize";
import { RESIZE_HANDLE_LABEL } from "./DrawerResizeHandle";
import type { LinkPreviewGoTarget } from "./LinkPreviewContent";
import { LinkPreviewDrawer } from "./LinkPreviewDrawer";
import { LinkPreviewModels, NAME_RELATIONSHIP_ACTION } from "./linkPreviewModel";
import { RELATIONSHIPS_LIST_LABEL, relationshipNameFieldLabel } from "./RelationshipList";
import { RecordingControlsActions } from "./testFixtures/settingsPanelHarness";
import type { EdgePreviewModel } from "./linkPreviewModel";

/**
 * RENDERED behaviour of the in-graph link-preview drawer (ticket
 * `nid_5j9mygfywppaiakuim3utf6r2_e`): the title, the close
 * affordances (button, Escape) and the close-on-GO contract the modal used to
 * own. Content behaviour itself is covered by LinkPreviewContent's own suite.
 */

const SOURCE = asVaultPath("notes/alpha.md");
const TARGET = asVaultPath("notes/beta.md");

function edgeModel(bidirectional = false): EdgePreviewModel {
	return LinkPreviewModels.edge({
		sourceName: "alpha",
		targetName: "beta",
		bidirectional,
		pairs: [
			{
				sourcePath: SOURCE,
				targetPath: TARGET,
				occurrences: [
					{ offset: 30, context: { shortContext: "short@3", expandedContext: "expanded@3", line: 3 } },
				],
				hierarchy: false,
			},
		],
	});
}

/** The names the overlay holds, as the controller would publish them — `alpha → beta` named `relationship`. */
function namedRelationships(relationship: EdgeRelationship): EdgeRelationshipOverlayStore {
	const store = new EdgeRelationshipOverlayStore();
	store.showEdgeRelationships(new Map([[directedLinkKey(SOURCE, TARGET), relationship]]));
	return store;
}

function renderDrawer(
	model: EdgePreviewModel,
	relationships: EdgeRelationshipOverlayStore = new EdgeRelationshipOverlayStore(),
): {
	onClose: ReturnType<typeof vi.fn>;
	goTargets: LinkPreviewGoTarget[];
} {
	const onClose = vi.fn();
	const goTargets: LinkPreviewGoTarget[] = [];
	render(
		<ControlsActionsContext.Provider value={new RecordingControlsActions()}>
			<EdgeRelationshipContext.Provider value={relationships}>
				<LinkPreviewDrawer
					model={model}
					renderIcon={(el, iconId) => el.setAttribute("data-icon-id", iconId)}
					renderMarkdown={(el, markdown) => {
						el.textContent = markdown;
						return Promise.resolve();
					}}
					onOpenLink={() => undefined}
					onClose={onClose}
					onGo={(target) => goTargets.push(target)}
				/>
			</EdgeRelationshipContext.Provider>
		</ControlsActionsContext.Provider>,
	);
	return { onClose, goTargets };
}

afterEach(() => {
	cleanup();
	// The size memory is a module singleton on purpose (drawer size survives
	// reopen) — reset it so tests stay independent.
	sessionDrawerSizes.clear();
});

const CONTAINER_SIZE = { width: 1200, height: 800 };

/** jsdom has no layout — give the drawer's parent (the pane) real metrics. */
function stubPaneMetrics(): void {
	const drawer = screen.getByRole("dialog");
	const pane = drawer.parentElement;
	if (pane === null) {
		throw new Error("drawer must be mounted inside a pane element");
	}
	Object.defineProperty(pane, "clientHeight", { value: CONTAINER_SIZE.height, configurable: true });
	Object.defineProperty(pane, "clientWidth", { value: CONTAINER_SIZE.width, configurable: true });
	pane.getBoundingClientRect = () =>
		({
			top: 0,
			left: 0,
			right: CONTAINER_SIZE.width,
			bottom: CONTAINER_SIZE.height,
			width: CONTAINER_SIZE.width,
			height: CONTAINER_SIZE.height,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		}) as DOMRect;
}

function handleFor(axis: "height" | "width"): HTMLElement {
	const orientation = axis === "height" ? "horizontal" : "vertical";
	const handle = screen
		.getAllByRole("separator", { name: RESIZE_HANDLE_LABEL })
		.find((el) => el.getAttribute("aria-orientation") === orientation);
	if (handle === undefined) {
		throw new Error(`no resize handle for axis=[${axis}]`);
	}
	return handle;
}

function dragTo(handle: HTMLElement, pointer: { clientX: number; clientY: number }): void {
	fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 });
	fireEvent.pointerMove(handle, { pointerId: 1, ...pointer });
	fireEvent.pointerUp(handle, { pointerId: 1 });
}

describe("LinkPreviewDrawer", () => {
	it("WHEN an edge model renders THEN the drawer title is 'source → target'", () => {
		renderDrawer(edgeModel());
		expect(screen.getByRole("dialog", { name: "alpha → beta" })).toBeTruthy();
	});

	it("WHEN a bidirectional edge model renders THEN the drawer title joins the endpoints with '↔'", () => {
		renderDrawer(edgeModel(true));
		expect(screen.getByRole("dialog", { name: "alpha ↔ beta" })).toBeTruthy();
	});

	it("WHEN the edge is named THEN the drawer shows 'source —name→ target'", () => {
		renderDrawer(edgeModel(), namedRelationships({ name: "improves", origin: "syntax" }));
		expect(screen.getByRole("list", { name: RELATIONSHIPS_LIST_LABEL }).textContent).toContain("alpha —improves→ beta");
	});

	it("WHEN the edge is named THEN the drawer shows where the name came from", () => {
		renderDrawer(edgeModel(), namedRelationships({ name: "parent", origin: "folder-hierarchy" }));
		expect(screen.getByRole("list", { name: RELATIONSHIPS_LIST_LABEL }).textContent).toContain("folder hierarchy");
	});

	it("WHEN the edge is unnamed THEN the drawer offers to name it", () => {
		renderDrawer(edgeModel());
		expect(screen.getByRole("button", { name: NAME_RELATIONSHIP_ACTION })).toBeTruthy();
	});

	it("WHEN a name is published while the drawer is open THEN its line updates in place", () => {
		const relationships = new EdgeRelationshipOverlayStore();
		renderDrawer(edgeModel(), relationships);
		act(() => {
			relationships.showEdgeRelationships(
				new Map([[directedLinkKey(SOURCE, TARGET), { name: "supports", origin: "manual" } as const]]),
			);
		});
		expect(screen.getByRole("list", { name: RELATIONSHIPS_LIST_LABEL }).textContent).toContain("alpha —supports→ beta");
	});

	it("WHEN Escape is pressed in the name field THEN the drawer stays open", () => {
		const { onClose } = renderDrawer(edgeModel());
		fireEvent.click(screen.getByRole("button", { name: NAME_RELATIONSHIP_ACTION }));
		fireEvent.keyDown(screen.getByRole("textbox", { name: relationshipNameFieldLabel(edgeModel().relationshipPairs[0]!) }), {
			key: "Escape",
		});
		expect(onClose).not.toHaveBeenCalled();
	});

	it("WHEN the close button is clicked THEN onClose fires", () => {
		const { onClose } = renderDrawer(edgeModel());
		fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("WHEN Escape is pressed THEN onClose fires", () => {
		const { onClose } = renderDrawer(edgeModel());
		fireEvent.keyDown(window, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("WHEN a GO button is clicked THEN the target is reported AND the drawer closes", () => {
		const { onClose, goTargets } = renderDrawer(edgeModel());
		fireEvent.click(screen.getByRole("button", { name: /^Go to line 4/ }));
		expect(goTargets).toEqual([{ path: SOURCE, line: 3 }]);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("WHEN the top handle is dragged THEN the drawer height follows the pointer's distance to the pane bottom", () => {
		renderDrawer(edgeModel());
		stubPaneMetrics();
		dragTo(handleFor("height"), { clientX: 0, clientY: CONTAINER_SIZE.height - 300 });
		const drawer = screen.getByRole("dialog");
		expect(drawer.style.getPropertyValue("--vicinity-drawer-height")).toBe("300px");
		expect(drawer.classList.contains("vicinity-graph-link-preview-drawer--height-resized")).toBe(true);
	});

	it("WHEN the left handle is dragged THEN the drawer width follows the pointer's distance to the pane right edge", () => {
		renderDrawer(edgeModel());
		stubPaneMetrics();
		dragTo(handleFor("width"), { clientX: CONTAINER_SIZE.width - 500, clientY: 0 });
		expect(screen.getByRole("dialog").style.getPropertyValue("--vicinity-drawer-width")).toBe("500px");
	});

	it("WHEN a drag asks for less than the minimum height THEN the drawer clamps to the minimum", () => {
		renderDrawer(edgeModel());
		stubPaneMetrics();
		dragTo(handleFor("height"), { clientX: 0, clientY: CONTAINER_SIZE.height - 10 });
		expect(screen.getByRole("dialog").style.getPropertyValue("--vicinity-drawer-height")).toBe(
			`${DRAWER_MIN_SIZE_PX.height}px`,
		);
	});

	it("WHEN the pointer moves without a preceding pointer down THEN the drawer does not resize", () => {
		renderDrawer(edgeModel());
		stubPaneMetrics();
		fireEvent.pointerMove(handleFor("height"), { pointerId: 1, clientX: 0, clientY: 100 });
		expect(screen.getByRole("dialog").style.getPropertyValue("--vicinity-drawer-height")).toBe("");
	});

	it("WHEN ArrowUp is pressed on the focused top handle THEN the drawer grows by the keyboard step", () => {
		renderDrawer(edgeModel());
		stubPaneMetrics();
		dragTo(handleFor("height"), { clientX: 0, clientY: CONTAINER_SIZE.height - 300 });
		fireEvent.keyDown(handleFor("height"), { key: "ArrowUp" });
		expect(screen.getByRole("dialog").style.getPropertyValue("--vicinity-drawer-height")).toBe(
			`${300 + DRAWER_KEYBOARD_STEP_PX}px`,
		);
	});

	it("WHEN the drawer is reopened THEN it keeps the size from the previous drag (session memory)", () => {
		renderDrawer(edgeModel());
		stubPaneMetrics();
		dragTo(handleFor("height"), { clientX: 0, clientY: CONTAINER_SIZE.height - 300 });
		cleanup();
		renderDrawer(edgeModel());
		expect(screen.getByRole("dialog").style.getPropertyValue("--vicinity-drawer-height")).toBe("300px");
	});
});
