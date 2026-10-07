import { describe, expect, it } from "vitest";
import { FakeDocIdPort } from "../adapters/FakeDocIdPort";
import type { VaultFilePort, VaultPort } from "../adapters/obsidianPorts";
import { EngineDefaults } from "../engine";
import { FakePluginDataPort } from "../persistence/FakePluginDataPort";
import { FakeVaultFsPort } from "../persistence/FakeVaultFsPort";
import { PathDocIdMap } from "../persistence/PathDocIdMap";
import { PerDocStore } from "../persistence/PerDocStore";
import { PersistenceServices } from "../persistence/PersistenceServices";
import { PluginDataStore } from "../persistence/PluginDataStore";
import { RejectingPluginDataPort } from "../persistence/RejectingPluginDataPort";
import { RejectingVaultFsPort } from "../persistence/RejectingVaultFsPort";
import type { PluginDataPort } from "../persistence/storagePorts";
import { VaultFileStore } from "../persistence/VaultFileStore";
import { ControlsActions } from "./ControlsActions";
import { FakeUserNotices } from "./FakeUserNotices";
import { FakeViewsRefresh } from "./FakeViewsRefresh";
import { SettingsWriteFailureNotice } from "./settingsWriteFailureNotice";
import { SettingsWritePipeline } from "./settingsWritePipeline";
import type { ActiveMainProvider, ChildNoteCreatorPort } from "./viewPorts";

/**
 * Refresh fan-out tests for the controls executor: EVERY write it makes lands in
 * data.json (settings are global, so is the pinned set), which every open graph
 * view renders from — so it must rebuild ALL of them, while a write it REFUSED to
 * make (nothing moved, in memory or on disk) must rebuild nothing at all.
 * Collaborators are the real persistence classes and the real
 * `SettingsWritePipeline` over their in-memory fakes — no obsidian runtime.
 *
 * Settings-write BEHAVIOUR (serialisation, merge base, fan-out) is pinned in
 * `settingsWritePipeline.test.ts`; this file only proves the executor delegates
 * there and owns the PIN path.
 */

/** The copy a user sees when a pin is refused; pinned here because it is user-visible. */
const NOT_PINNABLE_MESSAGE = "This note can't be pinned (no stable id).";
/** The local pin's own refusal copy — same cause, worded for the "for this note" scope. */
const NOT_LOCALLY_PINNABLE_MESSAGE = "This note can't be pinned for the current note (no stable id).";
/** Its drag-resize twin — same refusal cause, its own wording. */
const NOT_RESIZABLE_MESSAGE = "This note's size can't be saved (no stable id).";

const ORIGINATING_VIEW_ID = "view-originating";
const OTHER_VIEW_ID = "view-other";
const MAIN_PATH = "main.md";
const MAIN_DOCID = "docid_main_e";
/** The local-pin TARGET a neighbor is pinned under MAIN — resolves and carries an id. */
const TARGET_PATH = "target.md";
const TARGET_DOCID = "docid_target_e";
/** Resolves to a real file, but id-lib can mint no docid for it → `not-persistable`. */
const ID_LESS_PATH = "id-less.md";

function fileAt(path: string): VaultFilePort {
	return { path, extension: path.split(".").pop() ?? "", stat: { mtime: 0, size: 0 }, parent: { path: "/" } };
}

/** Serves the MAIN, the target and the id-less file; anything else is unresolved, as an empty vault would be. */
const RESOLVABLE_PATHS: readonly string[] = [MAIN_PATH, TARGET_PATH, ID_LESS_PATH];
const VAULT: VaultPort = {
	getFileByPath: (path) => (RESOLVABLE_PATHS.includes(path) ? fileAt(path) : null),
	getFiles: () => RESOLVABLE_PATHS.map(fileAt),
	cachedRead: () => Promise.resolve(""),
};

/** A settable stand-in for the graph's active MAIN (defaults to the resolvable MAIN_PATH). */
class FakeActiveMain implements ActiveMainProvider {
	constructor(private mainPath: string | null = MAIN_PATH) {}
	activeMainPath(): string | null {
		return this.mainPath;
	}
	setMain(mainPath: string | null): void {
		this.mainPath = mainPath;
	}
}

async function actionsUnderTest(
	dataPort: PluginDataPort = new FakePluginDataPort(),
	// The per-file store's disk is a separate seam from `data.json`: local pins and
	// node overrides now live there, so a suite pinning THEIR failure policy fails the
	// vault write, not `saveData`.
	perFileFs: FakeVaultFsPort = new FakeVaultFsPort(),
) {
	const pluginDataStore = new PluginDataStore(dataPort);
	await pluginDataStore.init();
	const docIdPort = new FakeDocIdPort({ [MAIN_PATH]: MAIN_DOCID, [TARGET_PATH]: TARGET_DOCID });
	docIdPort.markUnidentifiable(ID_LESS_PATH);
	const perDocStore = new PerDocStore(
		new VaultFileStore(".plugin_data/vicinity_graph", perFileFs, () => 0),
	);
	const persistenceServices = new PersistenceServices(docIdPort, pluginDataStore, perDocStore, new PathDocIdMap());
	const viewsRefresh = new FakeViewsRefresh([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	const notices = new FakeUserNotices();
	const settingsWrites = new SettingsWritePipeline(pluginDataStore, viewsRefresh, notices);
	const activeMain = new FakeActiveMain();
	const childNoteCreator = new RecordingChildNoteCreator();
	const actions = new ControlsActions(
		persistenceServices,
		VAULT,
		settingsWrites,
		notices,
		activeMain,
		childNoteCreator,
	);
	return { actions, viewsRefresh, pluginDataStore, perDocStore, notices, activeMain, childNoteCreator };
}

/** Records the main paths handed to the create-child-note action (the vault-content write seam). */
class RecordingChildNoteCreator implements ChildNoteCreatorPort {
	readonly createdFor: string[] = [];
	createChildNote(mainPath: string): Promise<void> {
		this.createdFor.push(mainPath);
		return Promise.resolve();
	}
}

describe("ControlsActions.applySettings", () => {
	it("WHEN a settings write is applied THEN EVERY open view is refreshed", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.applySettings({ kind: "global-cap", value: 42 });
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});

	it("WHEN a settings write is applied THEN each view is refreshed exactly once (the fan-out covers the originating view)", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.applySettings({ kind: "global-cap", value: 42 });
		expect(viewsRefresh.refreshedViewIds).toHaveLength(2);
	});

	it("WHEN a settings write is applied THEN the new globals are persisted before the fan-out", async () => {
		const { actions, pluginDataStore } = await actionsUnderTest();
		await actions.applySettings({ kind: "global-cap", value: 42 });
		expect(pluginDataStore.globalView().nodeCap).toBe(42);
	});

	it("WHEN a panel restore-defaults is requested THEN the scope's defaults reach the store", async () => {
		// The panel's force-layout "Restore defaults" button: the scope name goes to
		// the pipeline, so the panel is not a second opinion on what a default is.
		const { actions, pluginDataStore } = await actionsUnderTest();
		await actions.applySettings({ kind: "global-force-layout-field", field: "linkGapPx", value: 60 });
		await actions.restoreDefaults("force-layout");
		expect(pluginDataStore.globalView().forceLayout).toEqual(EngineDefaults.forceLayoutSettings());
	});
});

describe("ControlsActions.storedGlobalView", () => {
	it("WHEN a write has landed since the panel rendered THEN the stored globals report the NEW value", async () => {
		// The panel's cross-field judge (max px vs min px) reads through here rather than
		// from the snapshot it rendered from: that snapshot only refreshes after the whole
		// rebuild, so raising Max and then Min would otherwise be refused against the
		// maximum the user has already replaced.
		const { actions } = await actionsUnderTest();
		await actions.applySettings({ kind: "global-sizing-number", field: "maxPx", value: 300 });
		expect(actions.storedGlobalView().sizing.maxPx).toBe(300);
	});
});

describe("ControlsActions pinning", () => {
	it("WHEN a node is pinned THEN EVERY open view is refreshed (the pinned set is global state)", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.pinNode(MAIN_PATH);
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});

	it("WHEN a pinned central is unpinned THEN EVERY open view is refreshed", async () => {
		const { actions, viewsRefresh, pluginDataStore } = await actionsUnderTest();
		await pluginDataStore.addPin(MAIN_DOCID, 1);
		await actions.unpinNode(MAIN_DOCID);
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});

	it("WHEN the pinned path resolves to no file THEN nothing is refreshed", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.pinNode("gone.md");
		expect(viewsRefresh.refreshedViewIds).toEqual([]);
	});

	it("WHEN a pin is refused as not-persistable THEN nothing is refreshed", async () => {
		// The user gets a notice instead; no pin landed, so N rebuilds would be pure waste.
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.pinNode(ID_LESS_PATH);
		expect(viewsRefresh.refreshedViewIds).toEqual([]);
	});

	it("WHEN a pin is refused as not-persistable THEN the user is told why", async () => {
		// The ONLY signal the click did nothing: the node simply stays unpinned.
		const { actions, notices } = await actionsUnderTest();
		await actions.pinNode(ID_LESS_PATH);
		expect(notices.messages).toEqual([NOT_PINNABLE_MESSAGE]);
	});

	it("WHEN a pin lands THEN the user is told nothing", async () => {
		const { actions, notices } = await actionsUnderTest();
		await actions.pinNode(MAIN_PATH);
		expect(notices.messages).toEqual([]);
	});
});

describe("ControlsActions local pinning", () => {
	it("WHEN a neighbor is locally pinned THEN the pin is stored under the active MAIN", async () => {
		const { actions, perDocStore } = await actionsUnderTest();
		await actions.localPinNode(TARGET_PATH);
		expect(perDocStore.localPins(MAIN_DOCID).map((pin) => pin.docid)).toEqual([TARGET_DOCID]);
	});

	it("WHEN a neighbor is locally pinned THEN EVERY open view is refreshed (the local-pin map is global state)", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.localPinNode(TARGET_PATH);
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});

	it("WHEN the local-pin TARGET resolves to no file THEN nothing is refreshed", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.localPinNode("gone.md");
		expect(viewsRefresh.refreshedViewIds).toEqual([]);
	});

	it("WHEN no MAIN is active THEN a local pin lands nothing and refreshes nothing", async () => {
		const { actions, viewsRefresh, activeMain } = await actionsUnderTest();
		activeMain.setMain(null);
		await actions.localPinNode(TARGET_PATH);
		expect(viewsRefresh.refreshedViewIds).toEqual([]);
	});

	it("WHEN the TARGET is not persistable THEN the local pin is refused, nothing refreshes, and the user is told why", async () => {
		const { actions, viewsRefresh, notices } = await actionsUnderTest();
		await actions.localPinNode(ID_LESS_PATH);
		expect({ refreshed: viewsRefresh.refreshedViewIds, messages: notices.messages }).toEqual({
			refreshed: [],
			messages: [NOT_LOCALLY_PINNABLE_MESSAGE],
		});
	});

	it("WHEN the active MAIN is not persistable THEN the local pin is refused and the user is told why", async () => {
		// The un-clicked MAIN needs an id too (the map is keyed by it); a main that can
		// get none blocks the pin exactly like an id-less target, and never has its
		// frontmatter touched.
		const { actions, viewsRefresh, notices, activeMain } = await actionsUnderTest();
		activeMain.setMain(ID_LESS_PATH);
		await actions.localPinNode(TARGET_PATH);
		expect({ refreshed: viewsRefresh.refreshedViewIds, messages: notices.messages }).toEqual({
			refreshed: [],
			messages: [NOT_LOCALLY_PINNABLE_MESSAGE],
		});
	});

	it("WHEN a local pin lands THEN the user is told nothing", async () => {
		const { actions, notices } = await actionsUnderTest();
		await actions.localPinNode(TARGET_PATH);
		expect(notices.messages).toEqual([]);
	});

	it("WHEN a locally pinned target is unpinned THEN the pin is gone and EVERY open view is refreshed", async () => {
		const { actions, viewsRefresh, perDocStore } = await actionsUnderTest();
		await perDocStore.addLocalPin(MAIN_DOCID, TARGET_DOCID, 1);
		await actions.localUnpinNode(TARGET_DOCID);
		expect({
			pins: perDocStore.localPins(MAIN_DOCID),
			refreshed: viewsRefresh.refreshedViewIds,
		}).toEqual({ pins: [], refreshed: [ORIGINATING_VIEW_ID, OTHER_VIEW_ID] });
	});

	it("WHEN no MAIN is active THEN a local unpin refreshes nothing", async () => {
		const { actions, viewsRefresh, activeMain } = await actionsUnderTest();
		activeMain.setMain(null);
		await actions.localUnpinNode(TARGET_DOCID);
		expect(viewsRefresh.refreshedViewIds).toEqual([]);
	});

	it("WHEN the MAIN changes after the click but before the write slot runs THEN the pin lands under the CLICK-time main", async () => {
		// The guarded slot queues on the shared serial chain, so it can run well after
		// the click; the pin must scope to the main the user was LOOKING at, not
		// whichever note the graph has re-centred on since.
		const { actions, perDocStore, activeMain } = await actionsUnderTest();
		const pinLanded = actions.localPinNode(TARGET_PATH);
		activeMain.setMain(null);
		await pinLanded;
		expect(perDocStore.localPins(MAIN_DOCID).map((pin) => pin.docid)).toEqual([TARGET_DOCID]);
	});

	it("WHEN the MAIN changes after the click but before the write slot runs THEN the unpin removes from the CLICK-time main", async () => {
		const { actions, perDocStore, activeMain } = await actionsUnderTest();
		await perDocStore.addLocalPin(MAIN_DOCID, TARGET_DOCID, 1);
		const unpinLanded = actions.localUnpinNode(TARGET_DOCID);
		activeMain.setMain(null);
		await unpinLanded;
		expect(perDocStore.localPins(MAIN_DOCID)).toEqual([]);
	});

	it("WHEN a local pin's persist rejects THEN the user is told once and every view is refreshed anyway", async () => {
		// Same rule as a failed global pin: the store moved before the disk write, so the
		// SCREEN is the stale copy — repaint it and let the notice be the news. Local pins
		// live in the per-file store now, so it is the VAULT write that fails here.
		const { actions, viewsRefresh, notices } = await actionsUnderTest(
			new FakePluginDataPort(),
			new RejectingVaultFsPort(),
		);
		await actions.localPinNode(TARGET_PATH);
		expect({ messages: notices.messages, refreshed: viewsRefresh.refreshedViewIds }).toEqual({
			messages: [SettingsWriteFailureNotice.forNonSettingsWrite("pinned-set")],
			refreshed: [ORIGINATING_VIEW_ID, OTHER_VIEW_ID],
		});
	});
});

describe("ControlsActions node size override (drag-to-resize commit)", () => {
	const SIZE = { widthPx: 320, heightPx: 180 };

	it("WHEN a resize commits THEN the override is persisted under the doc's id", async () => {
		const { actions, perDocStore } = await actionsUnderTest();
		await actions.resizeNode(MAIN_PATH, SIZE);
		expect(perDocStore.nodeOverrides()[MAIN_DOCID]).toEqual({ sizePx: SIZE });
	});

	it("WHEN a resize commits THEN EVERY open view is refreshed (the ONE rebuild on release)", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.resizeNode(MAIN_PATH, SIZE);
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});

	it("WHEN a resize is refused as not-persistable THEN the user is told why", async () => {
		const { actions, notices } = await actionsUnderTest();
		await actions.resizeNode(ID_LESS_PATH, SIZE);
		expect(notices.messages).toEqual([NOT_RESIZABLE_MESSAGE]);
	});

	it("WHEN a resize is refused as not-persistable THEN every view is STILL refreshed (the dragged box must be taken back)", async () => {
		// UNLIKE a refused pin, the release already left the dragged box in React Flow's
		// local node state. Skipping the rebuild would leave the graph showing a size
		// nothing stored, under a notice saying it could not be saved.
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.resizeNode(ID_LESS_PATH, SIZE);
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});

	it("WHEN the resized path resolves to no file THEN every view is STILL refreshed", async () => {
		// Same reason: nothing was stored, but the node on screen is already the dragged size.
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.resizeNode("gone.md", SIZE);
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});

	it("WHEN a reset clears a stored override THEN the override is gone and every view is refreshed", async () => {
		const { actions, viewsRefresh, perDocStore } = await actionsUnderTest();
		await actions.resizeNode(MAIN_PATH, SIZE);
		await actions.resetNodeSize(MAIN_PATH);
		expect({
			override: perDocStore.nodeOverrides()[MAIN_DOCID],
			refreshCount: viewsRefresh.refreshedViewIds.length,
		}).toEqual({ override: undefined, refreshCount: 4 });
	});

	it("WHEN a resize's persist rejects THEN the user is told once and every view is refreshed anyway", async () => {
		// Same rule as a failed pin: the store moved before the disk write, so the
		// SCREEN is the stale copy — repaint it and let the notice be the news. Overrides
		// live in the per-file store now, so it is the VAULT write that fails here.
		const { actions, viewsRefresh, notices } = await actionsUnderTest(
			new FakePluginDataPort(),
			new RejectingVaultFsPort(),
		);
		await actions.resizeNode(MAIN_PATH, SIZE);
		expect({ messages: notices.messages, refreshed: viewsRefresh.refreshedViewIds }).toEqual({
			messages: [SettingsWriteFailureNotice.forNonSettingsWrite("node-size-override")],
			refreshed: [ORIGINATING_VIEW_ID, OTHER_VIEW_ID],
		});
	});
});

describe("ControlsActions node content override (hover gear)", () => {
	const NOT_CONTENT_OVERRIDABLE_MESSAGE = "This note's content choice can't be saved (no stable id).";

	it("WHEN a content choice is set THEN the override is persisted under the doc's id", async () => {
		const { actions, perDocStore } = await actionsUnderTest();
		await actions.setNodeContentOverride(MAIN_PATH, "outline");
		expect(perDocStore.nodeOverrides()[MAIN_DOCID]).toEqual({ content: "outline" });
	});

	it("WHEN a content choice is set THEN EVERY open view is refreshed (a data-only rebuild)", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.setNodeContentOverride(MAIN_PATH, "image");
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});

	it("WHEN a content set is refused as not-persistable THEN the user is told why", async () => {
		const { actions, notices } = await actionsUnderTest();
		await actions.setNodeContentOverride(ID_LESS_PATH, "outline");
		expect(notices.messages).toEqual([NOT_CONTENT_OVERRIDABLE_MESSAGE]);
	});

	it("WHEN a content set is refused as not-persistable THEN NO view is refreshed (the menu closed, screen unchanged)", async () => {
		// UNLIKE a resize, nothing on screen moved optimistically — so a refusal, like a
		// refused pin, has nothing to repaint.
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.setNodeContentOverride(ID_LESS_PATH, "outline");
		expect(viewsRefresh.refreshedViewIds).toEqual([]);
	});

	it("WHEN Inherit clears a stored override THEN the override is gone and every view is refreshed", async () => {
		const { actions, viewsRefresh, perDocStore } = await actionsUnderTest();
		await actions.setNodeContentOverride(MAIN_PATH, "image");
		await actions.clearNodeContentOverride(MAIN_PATH);
		expect({
			override: perDocStore.nodeOverrides()[MAIN_DOCID],
			refreshCount: viewsRefresh.refreshedViewIds.length,
		}).toEqual({ override: undefined, refreshCount: 4 });
	});

	it("WHEN a content set's persist rejects THEN the user is told once and every view is refreshed anyway", async () => {
		// Overrides live in the per-file store now, so it is the VAULT write that fails here.
		const { actions, viewsRefresh, notices } = await actionsUnderTest(
			new FakePluginDataPort(),
			new RejectingVaultFsPort(),
		);
		await actions.setNodeContentOverride(MAIN_PATH, "outline");
		expect({ messages: notices.messages, refreshed: viewsRefresh.refreshedViewIds }).toEqual({
			messages: [SettingsWriteFailureNotice.forNonSettingsWrite("node-content-override")],
			refreshed: [ORIGINATING_VIEW_ID, OTHER_VIEW_ID],
		});
	});
});

/**
 * The pinned set is a `data.json` write like any setting, so it owes the user the
 * SAME failure policy — and needs it more: `PluginDataStore.persist()` moves the pin
 * in memory before the disk write, so the node keeps rendering as pinned until a
 * restart quietly drops it. The policy itself lives in the pipeline
 * (`settingsWritePipeline.test.ts`); these pin the pin path onto it.
 */
describe("ControlsActions pinning when data.json cannot be written", () => {
	it("WHEN a pin's persist rejects THEN the user is told exactly once", async () => {
		const { actions, notices } = await actionsUnderTest(new RejectingPluginDataPort());
		await actions.pinNode(MAIN_PATH);
		expect(notices.messages).toEqual([SettingsWriteFailureNotice.forNonSettingsWrite("pinned-set")]);
	});

	it("WHEN a pin's persist rejects THEN the (fire-and-forget) caller's promise resolves", async () => {
		// `NoteNode` `void`s this promise, so a rejection here is an unhandled rejection.
		const { actions } = await actionsUnderTest(new RejectingPluginDataPort());
		await expect(actions.pinNode(MAIN_PATH)).resolves.toBeUndefined();
	});

	it("WHEN an unpin's persist rejects THEN the user is told exactly once", async () => {
		const { actions, notices } = await actionsUnderTest(new RejectingPluginDataPort());
		await actions.unpinNode(MAIN_DOCID);
		expect(notices.messages).toEqual([SettingsWriteFailureNotice.forNonSettingsWrite("pinned-set")]);
	});

	it("WHEN a pin's persist rejects THEN EVERY open view is refreshed anyway (the pin IS in memory)", async () => {
		// NOT the refused-pin case above: `PluginDataStore.persist()` moves the pin in memory
		// BEFORE the disk write, so a rejection leaves the SCREEN stale, not the store. Same
		// rule as a failed settings write — repaint from what the store holds, and let the
		// notice be the news.
		const { actions, viewsRefresh } = await actionsUnderTest(new RejectingPluginDataPort());
		await actions.pinNode(MAIN_PATH);
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});
});

describe("ControlsActions.createChildNote", () => {
	it("WHEN createChildNote is called THEN it delegates the MAIN path to the child-note creator", async () => {
		const { actions, childNoteCreator } = await actionsUnderTest();
		await actions.createChildNote("Jon/Jon.md");
		expect(childNoteCreator.createdFor).toEqual(["Jon/Jon.md"]);
	});

	it("WHEN createChildNote is called THEN it makes NO settings/pin fan-out (a vault-content write is off the guarded chain)", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.createChildNote("Jon/Jon.md");
		expect(viewsRefresh.refreshedViewIds).toEqual([]);
	});
});
