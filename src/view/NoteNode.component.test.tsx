// @vitest-environment jsdom
import { ReactFlow } from "@xyflow/react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { NodeContentOverride, NodeSizeOverridePx } from "../engine";
import { ControlsActionsContext } from "./ControlsActionsContext";
import type { FlowNodeData } from "./flowMapping";
import { GraphUiContext } from "./GraphUiContext";
import { NoteNode } from "./NoteNode";
import { planNodeContentMenu } from "./nodePreviewChoice";
import { RecordingControlsActions } from "./testFixtures/settingsPanelHarness";
import type { GraphUiPort, NodeMenuEntry, NodeMenuRequest } from "./viewPorts";

/**
 * Rendered proof of the drag-to-resize surface (ticket
 * nid_qjsj5mth2phdqctbm0vfx9elw_e): the REAL `<ReactFlow>` mounts a real
 * `NoteNode`, so what is asserted is what React Flow ships — the resize
 * controls exist, and the context menu offers "Reset size" exactly when a
 * size override exists. The commit MATH is pure (`nodeResize.test.ts`); the
 * real drag gesture is e2e (`e2e/nodeResize.e2e.ts`).
 *
 * jsdom needs the same ResizeObserver stub as
 * `reactFlowKeyBindings.component.test.tsx` (RF's Wrapper observes its pane).
 */

class ResizeObserverStub {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

/** Records every node-menu request and icon render; every other UI service is inert. */
class RecordingGraphUi implements GraphUiPort {
	readonly nodeMenuRequests: NodeMenuRequest[] = [];
	readonly renderedIcons: { el: HTMLElement; iconId: string }[] = [];
	resourcePath(): string | null {
		return null;
	}
	showAttachmentMenu(): void {}
	showNodeMenu(request: NodeMenuRequest): void {
		this.nodeMenuRequests.push(request);
	}
	renderIcon(el: HTMLElement, iconId: string): void {
		this.renderedIcons.push({ el, iconId });
	}
	renderMarkdown(): Promise<void> {
		return Promise.resolve();
	}
}

class RecordingResizeActions extends RecordingControlsActions {
	readonly resized: { path: string; sizePx: NodeSizeOverridePx }[] = [];
	readonly resetPaths: string[] = [];
	readonly contentSet: { path: string; content: NodeContentOverride }[] = [];
	readonly contentCleared: string[] = [];
	readonly localPinnedPaths: string[] = [];
	readonly localUnpinnedDocids: string[] = [];
	override localPinNode(path: string): Promise<void> {
		this.localPinnedPaths.push(path);
		return Promise.resolve();
	}
	override localUnpinNode(docid: string): Promise<void> {
		this.localUnpinnedDocids.push(docid);
		return Promise.resolve();
	}
	override resizeNode(path: string, sizePx: NodeSizeOverridePx): Promise<void> {
		this.resized.push({ path, sizePx });
		return Promise.resolve();
	}
	override resetNodeSize(path: string): Promise<void> {
		this.resetPaths.push(path);
		return Promise.resolve();
	}
	override setNodeContentOverride(path: string, content: NodeContentOverride): Promise<void> {
		this.contentSet.push({ path, content });
		return Promise.resolve();
	}
	override clearNodeContentOverride(path: string): Promise<void> {
		this.contentCleared.push(path);
		return Promise.resolve();
	}
}

const NODE_PATH = "a.md";

function nodeData(overrides: Partial<FlowNodeData> = {}): FlowNodeData {
	return {
		path: NODE_PATH,
		title: "a",
		tier: "regular",
		isGloballyPinned: false,
		isLocallyPinned: false,
		hasSizeOverride: false,
		folder: "",
		outline: [],
		preview: "none",
		imageCount: 0,
		attachmentGroups: [],
		...overrides,
	};
}

function renderNoteNode(data: FlowNodeData) {
	const ui = new RecordingGraphUi();
	const actions = new RecordingResizeActions();
	const result = render(
		<GraphUiContext.Provider value={ui}>
			<ControlsActionsContext.Provider value={actions}>
				<div style={{ width: 800, height: 600 }}>
					<ReactFlow
						nodes={[{ id: NODE_PATH, type: "note", position: { x: 0, y: 0 }, width: 100, height: 100, data }]}
						edges={[]}
						nodeTypes={{ note: NoteNode }}
					/>
				</div>
			</ControlsActionsContext.Provider>
		</GraphUiContext.Provider>,
	);
	return { ui, actions, result };
}

/** The mounted node root, once React Flow has rendered it. */
async function mountedNode(container: HTMLElement): Promise<HTMLElement> {
	return waitFor(() => {
		const node = container.querySelector<HTMLElement>(`.vicinity-graph-node[data-vicinity-path="${NODE_PATH}"]`);
		if (node === null) {
			throw new Error("note node not mounted yet");
		}
		return node;
	});
}

/** React Flow's node wrapper — the element NoteNode's whole output lives under. */
async function mountedWrapper(container: HTMLElement): Promise<HTMLElement> {
	const node = await mountedNode(container);
	const wrapper = node.closest<HTMLElement>(".react-flow__node");
	if (wrapper === null) {
		throw new Error("note node is not inside a React Flow node wrapper");
	}
	return wrapper;
}

afterEach(cleanup);

describe("NoteNode resize controls", () => {
	it("WHEN a note node renders THEN it mounts bottom/right/bottom-right resize controls (and no top/left ones)", async () => {
		const { result } = renderNoteNode(nodeData());
		const wrapper = await mountedWrapper(result.container);
		const controls = Array.from(wrapper.querySelectorAll(".react-flow__resize-control"));
		const classesOf = (el: Element) =>
			Array.from(el.classList)
				.filter((c) => ["top", "left", "right", "bottom", "line", "handle"].includes(c))
				.sort();
		expect(controls.map(classesOf)).toEqual([
			["line", "right"],
			["bottom", "line"],
			["bottom", "handle", "right"],
		]);
	});

	it("WHEN a note node renders THEN NO resize control sits inside the node's clipping box", async () => {
		// `.vicinity-graph-node` is `overflow: hidden` (it clips its own title and
		// thumbnail) and React Flow centres every grip ON the node's edge, so a grip
		// nested there is cut down to the sliver falling inside the padding box —
		// the edge lines all but vanish. jsdom does no layout, so the RULE that
		// prevents it is what is asserted: grips are siblings of the node box.
		const { result } = renderNoteNode(nodeData());
		const node = await mountedNode(result.container);
		expect(node.querySelectorAll(".react-flow__resize-control")).toHaveLength(0);
	});
});

describe("NoteNode path attribute", () => {
	it("WHEN a note node renders THEN its vault path rides data-vicinity-path, NEVER data-path", async () => {
		// `data-path` is the attribute Obsidian's file explorer keys files by, and
		// other plugins query it DOCUMENT-WIDE: Folder Notes runs
		// `activeDocument.querySelectorAll("[data-path='…']")` and tags every match
		// `is-folder-note`, which its `.hide-folder-note .is-folder-note
		// { display: none }` rule then hides — eating this node's whole body after a
		// folder-note rename (ticket nid_ofacqul281sr71qrdacqy8jv3_e). The
		// plugin-scoped attribute name is the fix, so its absence is the behavior.
		const { result } = renderNoteNode(nodeData());
		const node = await mountedNode(result.container);
		expect(node.getAttribute("data-path")).toBeNull();
	});
});

describe("NoteNode context menu reset entry", () => {
	it("WHEN a node WITHOUT a size override is right-clicked THEN the menu has no 'Reset size' entry", async () => {
		const { ui, result } = renderNoteNode(nodeData());
		fireEvent.contextMenu(await mountedNode(result.container));
		expect(ui.nodeMenuRequests[0]?.entries.map((entry) => entry.title)).toEqual([
			"Pin to graph",
			"Pin for this note",
		]);
	});

	it("WHEN a node WITH a size override is right-clicked THEN the menu offers 'Reset size'", async () => {
		const { ui, result } = renderNoteNode(nodeData({ hasSizeOverride: true }));
		fireEvent.contextMenu(await mountedNode(result.container));
		expect(ui.nodeMenuRequests[0]?.entries.map((entry) => entry.title)).toEqual([
			"Pin to graph",
			"Pin for this note",
			"Reset size",
		]);
	});

	it("WHEN the 'Reset size' entry is activated THEN the node's path reaches resetNodeSize", async () => {
		const { ui, actions, result } = renderNoteNode(nodeData({ hasSizeOverride: true }));
		fireEvent.contextMenu(await mountedNode(result.container));
		ui.nodeMenuRequests[0]?.entries.find((entry) => entry.title === "Reset size")?.onClick();
		expect(actions.resetPaths).toEqual([NODE_PATH]);
	});

	it("WHEN 'Reset size' is offered THEN it carries an educational sub-line (the adapter renders it under the label)", async () => {
		const { ui, result } = renderNoteNode(nodeData({ hasSizeOverride: true }));
		fireEvent.contextMenu(await mountedNode(result.container));
		const reset = ui.nodeMenuRequests[0]?.entries.find((entry) => entry.title === "Reset size");
		expect(reset?.description).not.toBe(undefined);
	});
});

/** The gear (top-right) button, once React Flow has mounted the node. */
async function mountedGear(container: HTMLElement): Promise<HTMLElement> {
	const node = await mountedNode(container);
	const gear = node.querySelector<HTMLElement>("button.vicinity-graph-gear-button");
	if (gear === null) {
		throw new Error("gear button not mounted");
	}
	return gear;
}

/** The entries of the menu the gear opened (the recorder captures the request). */
function gearMenuEntries(ui: RecordingGraphUi): readonly NodeMenuEntry[] {
	const request = ui.nodeMenuRequests[0];
	if (request === undefined) {
		throw new Error("gear opened no menu");
	}
	return request.entries;
}

describe("NoteNode gear content menu", () => {
	it("WHEN a note node renders THEN it mounts a hover gear button distinct from the pin", async () => {
		const { result } = renderNoteNode(nodeData());
		const node = await mountedNode(result.container);
		expect(node.querySelectorAll("button.vicinity-graph-gear-button")).toHaveLength(1);
		// The pin moved to its own corner; both chips coexist.
		expect(node.querySelectorAll("button.vicinity-graph-pin-button")).toHaveLength(1);
	});

	it("WHEN the gear is clicked THEN it opens a menu offering every content choice", async () => {
		const { ui, result } = renderNoteNode(nodeData());
		fireEvent.click(await mountedGear(result.container));
		const titles = gearMenuEntries(ui)
			.filter((entry) => entry.checked !== undefined)
			.map((entry) => entry.title);
		expect(titles).toEqual(planNodeContentMenu("inherit").map((item) => item.label));
	});

	it("WHEN a node has NO content override THEN the gear menu checks Inherit", async () => {
		const { ui, result } = renderNoteNode(nodeData());
		fireEvent.click(await mountedGear(result.container));
		const checked = gearMenuEntries(ui).filter((entry) => entry.checked === true);
		expect(checked.map((entry) => entry.title)).toEqual([planNodeContentMenu("inherit")[0]?.label]);
	});

	it("WHEN a node overrides content THEN the gear menu checks that override, not Inherit", async () => {
		const { ui, result } = renderNoteNode(nodeData({ contentOverride: "image" }));
		fireEvent.click(await mountedGear(result.container));
		const checked = gearMenuEntries(ui)
			.filter((entry) => entry.checked === true)
			.map((entry) => entry.title);
		expect(checked).toEqual([planNodeContentMenu("image").find((item) => item.choice === "image")?.label]);
	});

	it("WHEN an override choice is activated THEN it reaches setNodeContentOverride with that value", async () => {
		const { ui, actions, result } = renderNoteNode(nodeData());
		fireEvent.click(await mountedGear(result.container));
		const outlineLabel = planNodeContentMenu("inherit").find((item) => item.choice === "outline")?.label;
		gearMenuEntries(ui)
			.find((entry) => entry.title === outlineLabel)
			?.onClick();
		expect(actions.contentSet).toEqual([{ path: NODE_PATH, content: "outline" }]);
	});

	it("WHEN Inherit is activated THEN it reaches clearNodeContentOverride (never a stored value)", async () => {
		const { ui, actions, result } = renderNoteNode(nodeData({ contentOverride: "image" }));
		fireEvent.click(await mountedGear(result.container));
		const inheritLabel = planNodeContentMenu("inherit")[0]?.label;
		gearMenuEntries(ui)
			.find((entry) => entry.title === inheritLabel)
			?.onClick();
		expect(actions.contentCleared).toEqual([NODE_PATH]);
		expect(actions.contentSet).toEqual([]);
	});

	it("WHEN a node has NO size override THEN the gear menu omits 'Reset size'", async () => {
		const { ui, result } = renderNoteNode(nodeData());
		fireEvent.click(await mountedGear(result.container));
		expect(gearMenuEntries(ui).some((entry) => entry.title === "Reset size")).toBe(false);
	});

	it("WHEN a node HAS a size override THEN the gear menu hosts 'Reset size' and it reaches resetNodeSize", async () => {
		const { ui, actions, result } = renderNoteNode(nodeData({ hasSizeOverride: true }));
		fireEvent.click(await mountedGear(result.container));
		gearMenuEntries(ui)
			.find((entry) => entry.title === "Reset size")
			?.onClick();
		expect(actions.resetPaths).toEqual([NODE_PATH]);
	});

	it("WHEN the gear hosts 'Reset size' THEN it carries an educational sub-line", async () => {
		const { ui, result } = renderNoteNode(nodeData({ hasSizeOverride: true }));
		fireEvent.click(await mountedGear(result.container));
		const reset = gearMenuEntries(ui).find((entry) => entry.title === "Reset size");
		expect(reset?.description).not.toBe(undefined);
	});
});

/** The local-pin chip (distinct class from the global pin), once the node has mounted. */
function localPinButton(node: HTMLElement): HTMLElement | null {
	return node.querySelector<HTMLElement>("button.vicinity-graph-local-pin-button");
}

describe("NoteNode local pin control", () => {
	it("WHEN a regular node renders THEN it mounts BOTH the global and the local pin chip", async () => {
		const { result } = renderNoteNode(nodeData());
		const node = await mountedNode(result.container);
		expect({
			global: node.querySelectorAll("button.vicinity-graph-pin-button").length,
			local: node.querySelectorAll("button.vicinity-graph-local-pin-button").length,
		}).toEqual({ global: 1, local: 1 });
	});

	it("WHEN the MAIN node renders THEN it withholds the local pin chip (a note cannot be locally pinned under itself)", async () => {
		const { result } = renderNoteNode(nodeData({ tier: "main" }));
		const node = await mountedNode(result.container);
		expect(localPinButton(node)).toBeNull();
	});

	it("WHEN a node is NOT locally pinned THEN its local chip offers to pin for this note", async () => {
		const { result } = renderNoteNode(nodeData());
		const node = await mountedNode(result.container);
		expect(localPinButton(node)?.getAttribute("aria-label")).toBe("Pin for this note");
	});

	it("WHEN a node IS locally pinned THEN its local chip KEEPS the constant toggle name (aria-pressed carries the state)", async () => {
		const { result } = renderNoteNode(nodeData({ isLocallyPinned: true, docid: "docid_a_e" }));
		const node = await mountedNode(result.container);
		expect(localPinButton(node)?.getAttribute("aria-label")).toBe("Pin for this note");
	});

	it("WHEN a node IS locally pinned THEN its local chip TOOLTIP still flips to the unpin action (the hover hint predicts the click)", async () => {
		const { result } = renderNoteNode(nodeData({ isLocallyPinned: true, docid: "docid_a_e" }));
		const node = await mountedNode(result.container);
		expect(localPinButton(node)?.getAttribute("title")).toBe("Unpin for this note");
	});

	it("WHEN the local chip on an unpinned node is clicked THEN the node's PATH reaches localPinNode", async () => {
		const { actions, result } = renderNoteNode(nodeData());
		const node = await mountedNode(result.container);
		fireEvent.click(localPinButton(node)!);
		expect(actions.localPinnedPaths).toEqual([NODE_PATH]);
	});

	it("WHEN the local chip on a locally-pinned node is clicked THEN the node's DOCID reaches localUnpinNode", async () => {
		const { actions, result } = renderNoteNode(nodeData({ isLocallyPinned: true, docid: "docid_a_e" }));
		const node = await mountedNode(result.container);
		fireEvent.click(localPinButton(node)!);
		expect(actions.localUnpinnedDocids).toEqual(["docid_a_e"]);
	});

	it("WHEN a node is BOTH globally and locally pinned THEN both chips KEEP their constant toggle names (state is in aria-pressed)", async () => {
		const { result } = renderNoteNode(
			nodeData({ isGloballyPinned: true, isLocallyPinned: true, tier: "pinned-central", docid: "docid_a_e" }),
		);
		const node = await mountedNode(result.container);
		expect({
			global: node.querySelector("button.vicinity-graph-pin-button")?.getAttribute("aria-label"),
			local: localPinButton(node)?.getAttribute("aria-label"),
		}).toEqual({ global: "Pin to graph", local: "Pin for this note" });
	});

	it("WHEN a node is BOTH globally and locally pinned THEN both chip TOOLTIPS flip to their unpin actions (both hover hints)", async () => {
		const { result } = renderNoteNode(
			nodeData({ isGloballyPinned: true, isLocallyPinned: true, tier: "pinned-central", docid: "docid_a_e" }),
		);
		const node = await mountedNode(result.container);
		expect({
			global: node.querySelector("button.vicinity-graph-pin-button")?.getAttribute("title"),
			local: localPinButton(node)?.getAttribute("title"),
		}).toEqual({ global: "Unpin from graph", local: "Unpin for this note" });
	});

	it("WHEN a regular node is right-clicked THEN the menu carries the local pin entry after the global one", async () => {
		const { ui, result } = renderNoteNode(nodeData());
		fireEvent.contextMenu(await mountedNode(result.container));
		expect(ui.nodeMenuRequests[0]?.entries.map((entry) => entry.title)).toEqual([
			"Pin to graph",
			"Pin for this note",
		]);
	});

	it("WHEN the MAIN node is right-clicked THEN the menu omits the local pin entry", async () => {
		const { ui, result } = renderNoteNode(nodeData({ tier: "main" }));
		fireEvent.contextMenu(await mountedNode(result.container));
		expect(ui.nodeMenuRequests[0]?.entries.map((entry) => entry.title)).toEqual(["Pin to graph"]);
	});

	it("WHEN the local pin menu entry is activated THEN it reaches localPinNode with the node's path", async () => {
		const { ui, actions, result } = renderNoteNode(nodeData());
		fireEvent.contextMenu(await mountedNode(result.container));
		ui.nodeMenuRequests[0]?.entries.find((entry) => entry.title === "Pin for this note")?.onClick();
		expect(actions.localPinnedPaths).toEqual([NODE_PATH]);
	});
});

/** The last icon the ui rendered INSIDE the given chip (re-renders replace content, so last wins). */
function chipIconId(ui: RecordingGraphUi, chip: HTMLElement | null): string | undefined {
	if (chip === null) {
		return undefined;
	}
	const inChip = ui.renderedIcons.filter((rendered) => chip.contains(rendered.el));
	return inChip[inChip.length - 1]?.iconId;
}

/**
 * The pressed-in pin chips (ticket nid_s88z29iparzxrtxhh6ooqfvrz_e): the chip is a
 * TOGGLE — a constant glyph whose pinned state is the pressed treatment
 * (`aria-pressed`, styled in graph-view.css), not an icon swap. The `*-off` action
 * glyphs live only in the context menu, where entries are actions.
 */
describe("NoteNode pin chip pressed state", () => {
	it("WHEN a node is not pinned in any way THEN both chips read unpressed", async () => {
		const { result } = renderNoteNode(nodeData());
		const node = await mountedNode(result.container);
		expect({
			global: node.querySelector("button.vicinity-graph-pin-button")?.getAttribute("aria-pressed"),
			local: localPinButton(node)?.getAttribute("aria-pressed"),
		}).toEqual({ global: "false", local: "false" });
	});

	it("WHEN a node is globally pinned THEN ONLY the global chip reads pressed", async () => {
		const { result } = renderNoteNode(
			nodeData({ isGloballyPinned: true, tier: "pinned-central", docid: "docid_a_e" }),
		);
		const node = await mountedNode(result.container);
		expect({
			global: node.querySelector("button.vicinity-graph-pin-button")?.getAttribute("aria-pressed"),
			local: localPinButton(node)?.getAttribute("aria-pressed"),
		}).toEqual({ global: "true", local: "false" });
	});

	it("WHEN a node is BOTH globally and locally pinned THEN both chips read pressed", async () => {
		const { result } = renderNoteNode(
			nodeData({ isGloballyPinned: true, isLocallyPinned: true, tier: "pinned-central", docid: "docid_a_e" }),
		);
		const node = await mountedNode(result.container);
		expect({
			global: node.querySelector("button.vicinity-graph-pin-button")?.getAttribute("aria-pressed"),
			local: localPinButton(node)?.getAttribute("aria-pressed"),
		}).toEqual({ global: "true", local: "true" });
	});

	it("WHEN a node is pinned THEN its chip STILL renders the constant glyph, not the *-off action icon", async () => {
		const { ui, result } = renderNoteNode(
			nodeData({ isGloballyPinned: true, isLocallyPinned: true, tier: "pinned-central", docid: "docid_a_e" }),
		);
		const node = await mountedNode(result.container);
		expect({
			global: chipIconId(ui, node.querySelector<HTMLElement>("button.vicinity-graph-pin-button")),
			local: chipIconId(ui, localPinButton(node)),
		}).toEqual({ global: "pin", local: "map-pin" });
	});

	it("WHEN a pinned node is right-clicked THEN the MENU still carries the *-off action icons (menus are actions)", async () => {
		const { ui, result } = renderNoteNode(
			nodeData({ isGloballyPinned: true, isLocallyPinned: true, tier: "pinned-central", docid: "docid_a_e" }),
		);
		fireEvent.contextMenu(await mountedNode(result.container));
		expect(ui.nodeMenuRequests[0]?.entries.map((entry) => entry.iconId)).toEqual([
			"pin-off",
			"map-pin-off",
		]);
	});
});
