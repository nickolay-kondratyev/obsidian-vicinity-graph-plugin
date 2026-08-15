// @vitest-environment jsdom
import { ReactFlow } from "@xyflow/react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FolderGroupNode } from "./FolderGroupNode";
import type { FlowGroupData } from "./flowMapping";
import { GraphUiContext } from "./GraphUiContext";
import { NoteOpenContext } from "./NoteOpenContext";
import type { GraphUiPort, NodeMenuRequest, NoteOpenPort, OpenNoteOptions } from "./viewPorts";

/**
 * Rendered proof of the clickable folder-group label (ticket
 * `nid_2pobjyfp5zgspx283bfukaugn_e`): the REAL `<ReactFlow>` mounts a real
 * `FolderGroupNode`, so what is asserted is what ships — the navigation
 * affordance exists exactly when candidates do, a single candidate opens
 * through the `NoteOpenPort` (ctrl/cmd = new tab), and 2+ candidates open the
 * native menu seam instead. The candidate LIST is pure
 * (`FolderNotes.test.ts`); the real click-through is e2e
 * (`e2e/folderGroupLabelNav.e2e.ts`).
 *
 * jsdom needs the same ResizeObserver stub as the sibling component tests
 * (RF's Wrapper observes its pane).
 */

class ResizeObserverStub {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

/** Records opens; the label under test is the only caller. */
class RecordingNoteOpen implements NoteOpenPort {
	readonly opened: { path: string; options: OpenNoteOptions }[] = [];
	openNote(path: string, options: OpenNoteOptions): void {
		this.opened.push({ path, options });
	}
}

/** Records node-menu requests; every other UI service is inert. */
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

const GROUP_FOLDER = "notes";
const GROUP_ID = `folder-group:${GROUP_FOLDER}`;

function groupData(overrides: Partial<FlowGroupData> = {}): FlowGroupData {
	return {
		folder: GROUP_FOLDER,
		folderName: GROUP_FOLDER,
		hiddenCount: 0,
		fullPathLabel: false,
		folderNoteCandidates: [],
		...overrides,
	};
}

function renderGroupNode(data: FlowGroupData) {
	const ui = new RecordingGraphUi();
	const noteOpen = new RecordingNoteOpen();
	const result = render(
		<GraphUiContext.Provider value={ui}>
			<NoteOpenContext.Provider value={noteOpen}>
				<div style={{ width: 800, height: 600 }}>
					<ReactFlow
						nodes={[{ id: GROUP_ID, type: "folder-group", position: { x: 0, y: 0 }, width: 200, height: 150, data }]}
						edges={[]}
						nodeTypes={{ "folder-group": FolderGroupNode }}
					/>
				</div>
			</NoteOpenContext.Provider>
		</GraphUiContext.Provider>,
	);
	return { ui, noteOpen, result };
}

/** The mounted group's label span, once React Flow has rendered the node. */
async function mountedLabel(container: HTMLElement): Promise<HTMLElement> {
	return waitFor(() => {
		const label = container.querySelector<HTMLElement>(
			`.vicinity-graph-group[data-folder="${GROUP_FOLDER}"] .vicinity-graph-group__label`,
		);
		if (label === null) {
			throw new Error("folder-group label not mounted yet");
		}
		return label;
	});
}

afterEach(cleanup);

describe("FolderGroupNode label affordance", () => {
	it("WHEN the folder has candidates THEN the label carries the navigable modifier class", async () => {
		const { result } = renderGroupNode(groupData({ folderNoteCandidates: ["notes.md"] }));
		const label = await mountedLabel(result.container);
		expect(label.classList.contains("vicinity-graph-group__label--navigable")).toBe(true);
	});

	it("WHEN the folder has NO candidates THEN the label stays inert (no navigable class)", async () => {
		const { result } = renderGroupNode(groupData());
		const label = await mountedLabel(result.container);
		expect(label.classList.contains("vicinity-graph-group__label--navigable")).toBe(false);
	});

	it("WHEN a candidate-less label is clicked THEN nothing opens and no menu shows", async () => {
		const { ui, noteOpen, result } = renderGroupNode(groupData());
		const label = await mountedLabel(result.container);
		fireEvent.click(label);
		expect({ opened: noteOpen.opened, menus: ui.nodeMenuRequests }).toEqual({ opened: [], menus: [] });
	});
});

describe("FolderGroupNode single-candidate click", () => {
	it("WHEN the label is plain-clicked THEN the one candidate opens in the CURRENT tab", async () => {
		const { noteOpen, result } = renderGroupNode(groupData({ folderNoteCandidates: ["notes.md"] }));
		fireEvent.click(await mountedLabel(result.container));
		expect(noteOpen.opened).toEqual([{ path: "notes.md", options: { newTab: false } }]);
	});

	it("WHEN the label is ctrl-clicked THEN the one candidate opens in a NEW tab", async () => {
		const { noteOpen, result } = renderGroupNode(groupData({ folderNoteCandidates: ["notes.md"] }));
		fireEvent.click(await mountedLabel(result.container), { ctrlKey: true });
		expect(noteOpen.opened).toEqual([{ path: "notes.md", options: { newTab: true } }]);
	});

	it("WHEN one candidate exists THEN a click opens it directly, never via the menu", async () => {
		const { ui, result } = renderGroupNode(groupData({ folderNoteCandidates: ["notes.md"] }));
		fireEvent.click(await mountedLabel(result.container));
		expect(ui.nodeMenuRequests).toEqual([]);
	});
});

describe("FolderGroupNode multi-candidate click", () => {
	const CANDIDATES = ["notes/notes.md", "notes/notes.canvas", "notes.md"];

	it("WHEN 2+ candidates exist THEN a click opens the native menu listing them in precedence order", async () => {
		const { ui, result } = renderGroupNode(groupData({ folderNoteCandidates: CANDIDATES }));
		fireEvent.click(await mountedLabel(result.container));
		expect(ui.nodeMenuRequests.map((request) => request.entries.map((entry) => entry.title))).toEqual([CANDIDATES]);
	});

	it("WHEN 2+ candidates exist THEN a click opens nothing until a menu entry is chosen", async () => {
		const { noteOpen, result } = renderGroupNode(groupData({ folderNoteCandidates: CANDIDATES }));
		fireEvent.click(await mountedLabel(result.container));
		expect(noteOpen.opened).toEqual([]);
	});

	it("WHEN a menu entry is chosen THEN that candidate opens in the current tab", async () => {
		const { ui, noteOpen, result } = renderGroupNode(groupData({ folderNoteCandidates: CANDIDATES }));
		fireEvent.click(await mountedLabel(result.container));
		ui.nodeMenuRequests[0]?.entries[1]?.onClick();
		expect(noteOpen.opened).toEqual([{ path: "notes/notes.canvas", options: { newTab: false } }]);
	});
});
