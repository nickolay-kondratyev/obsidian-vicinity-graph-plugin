// @vitest-environment jsdom
import { ReactFlow } from "@xyflow/react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { NodeSizeOverridePx } from "../engine";
import { ControlsActionsContext } from "./ControlsActionsContext";
import type { FlowNodeData } from "./flowMapping";
import { GraphUiContext } from "./GraphUiContext";
import { NoteNode } from "./NoteNode";
import { RecordingControlsActions } from "./testFixtures/settingsPanelHarness";
import type { GraphUiPort, NodeMenuRequest } from "./viewPorts";

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

/** Records every node-menu request; every other UI service is inert. */
class RecordingGraphUi implements GraphUiPort {
	readonly nodeMenuRequests: NodeMenuRequest[] = [];
	resourcePath(): string | null {
		return null;
	}
	showAttachmentMenu(): void {}
	showNodeMenu(request: NodeMenuRequest): void {
		this.nodeMenuRequests.push(request);
	}
	renderIcon(): void {}
	renderMarkdown(): Promise<void> {
		return Promise.resolve();
	}
}

class RecordingResizeActions extends RecordingControlsActions {
	readonly resized: { path: string; sizePx: NodeSizeOverridePx }[] = [];
	readonly resetPaths: string[] = [];
	override resizeNode(path: string, sizePx: NodeSizeOverridePx): Promise<void> {
		this.resized.push({ path, sizePx });
		return Promise.resolve();
	}
	override resetNodeSize(path: string): Promise<void> {
		this.resetPaths.push(path);
		return Promise.resolve();
	}
}

const NODE_PATH = "a.md";

function nodeData(overrides: Partial<FlowNodeData> = {}): FlowNodeData {
	return {
		path: NODE_PATH,
		title: "a",
		tier: "regular",
		isPinned: false,
		sizePx: 100,
		sizeScore: 0.5,
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
		const node = container.querySelector<HTMLElement>(`.vicinity-graph-node[data-path="${NODE_PATH}"]`);
		if (node === null) {
			throw new Error("note node not mounted yet");
		}
		return node;
	});
}

afterEach(cleanup);

describe("NoteNode resize controls", () => {
	it("WHEN a note node renders THEN it mounts bottom/right/bottom-right resize controls (and no top/left ones)", async () => {
		const { result } = renderNoteNode(nodeData());
		const node = await mountedNode(result.container);
		const controls = Array.from(node.querySelectorAll(".react-flow__resize-control"));
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
});

describe("NoteNode context menu reset entry", () => {
	it("WHEN a node WITHOUT a size override is right-clicked THEN the menu has no 'Reset size' entry", async () => {
		const { ui, result } = renderNoteNode(nodeData());
		fireEvent.contextMenu(await mountedNode(result.container));
		expect(ui.nodeMenuRequests[0]?.entries.map((entry) => entry.title)).toEqual(["Pin to graph"]);
	});

	it("WHEN a node WITH a size override is right-clicked THEN the menu offers 'Reset size'", async () => {
		const { ui, result } = renderNoteNode(nodeData({ hasSizeOverride: true }));
		fireEvent.contextMenu(await mountedNode(result.container));
		expect(ui.nodeMenuRequests[0]?.entries.map((entry) => entry.title)).toEqual(["Pin to graph", "Reset size"]);
	});

	it("WHEN the 'Reset size' entry is activated THEN the node's path reaches resetNodeSize", async () => {
		const { ui, actions, result } = renderNoteNode(nodeData({ hasSizeOverride: true }));
		fireEvent.contextMenu(await mountedNode(result.container));
		ui.nodeMenuRequests[0]?.entries.find((entry) => entry.title === "Reset size")?.onClick();
		expect(actions.resetPaths).toEqual([NODE_PATH]);
	});
});
