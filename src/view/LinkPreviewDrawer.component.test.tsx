// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asVaultPath } from "../engine";
import { DRAWER_KEYBOARD_STEP_PX, DRAWER_MIN_SIZE_PX, sessionDrawerSizes } from "./drawerResize";
import { RESIZE_HANDLE_LABEL } from "./DrawerResizeHandle";
import type { LinkPreviewGoTarget } from "./LinkPreviewContent";
import { LinkPreviewDrawer } from "./LinkPreviewDrawer";
import { LinkPreviewModels } from "./linkPreviewModel";
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
			},
		],
	});
}

function renderDrawer(model: EdgePreviewModel): {
	onClose: ReturnType<typeof vi.fn>;
	goTargets: LinkPreviewGoTarget[];
} {
	const onClose = vi.fn();
	const goTargets: LinkPreviewGoTarget[] = [];
	render(
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
		/>,
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
