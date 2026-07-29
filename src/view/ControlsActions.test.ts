import { describe, expect, it, vi } from "vitest";
import { FakeDocIdPort } from "../adapters/FakeDocIdPort";
import type { VaultFilePort, VaultPort } from "../adapters/obsidianPorts";
import { EngineDefaults } from "../engine";
import { FakePluginDataPort } from "../persistence/FakePluginDataPort";
import { PathDocIdMap } from "../persistence/PathDocIdMap";
import { PersistenceServices } from "../persistence/PersistenceServices";
import { PluginDataStore } from "../persistence/PluginDataStore";
import { ControlsActions } from "./ControlsActions";
import { FakeViewsRefresh } from "./FakeViewsRefresh";

// `ControlsActions` imports `Notice` from the type-only `obsidian` package (no
// runtime entry point), so the module needs a stand-in to be importable at all.
// The non-persistable tests below exercise the notice path; none assert on it.
vi.mock("obsidian", () => ({ Notice: class {} }));

/**
 * Refresh fan-out tests for the controls executor: EVERY write it makes lands in
 * data.json (settings are global, so is the pinned set), which every open graph
 * view renders from — so it must rebuild ALL of them, and a write that never
 * landed must rebuild nothing at all. Collaborators are the real persistence
 * classes over their in-memory fakes — no obsidian runtime.
 */

const ORIGINATING_VIEW_ID = "view-originating";
const OTHER_VIEW_ID = "view-other";
const MAIN_PATH = "main.md";
const MAIN_DOCID = "docid_main_e";
/** Resolves to a real file, but id-lib can mint no docid for it → `not-persistable`. */
const ID_LESS_PATH = "id-less.md";

function fileAt(path: string): VaultFilePort {
	return { path, extension: path.split(".").pop() ?? "", stat: { mtime: 0, size: 0 }, parent: { path: "/" } };
}

/** Serves the MAIN and the id-less file; anything else is unresolved, as an empty vault would be. */
const RESOLVABLE_PATHS: readonly string[] = [MAIN_PATH, ID_LESS_PATH];
const VAULT: VaultPort = {
	getFileByPath: (path) => (RESOLVABLE_PATHS.includes(path) ? fileAt(path) : null),
	getFiles: () => RESOLVABLE_PATHS.map(fileAt),
	cachedRead: () => Promise.resolve(""),
};

async function actionsUnderTest() {
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();
	const docIdPort = new FakeDocIdPort({ [MAIN_PATH]: MAIN_DOCID });
	docIdPort.markUnidentifiable(ID_LESS_PATH);
	const persistenceServices = new PersistenceServices(docIdPort, pluginDataStore, new PathDocIdMap());
	const viewsRefresh = new FakeViewsRefresh([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	const actions = new ControlsActions(persistenceServices, pluginDataStore, VAULT, viewsRefresh);
	return { actions, viewsRefresh, pluginDataStore };
}

describe("ControlsActions.applySettings", () => {
	it("WHEN a settings write is applied THEN EVERY open view is refreshed", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.applySettings({ kind: "global-view", view: EngineDefaults.viewSettings() });
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});

	it("WHEN a settings write is applied THEN each view is refreshed exactly once (the fan-out covers the originating view)", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.applySettings({ kind: "global-view", view: EngineDefaults.viewSettings() });
		expect(viewsRefresh.refreshedViewIds).toHaveLength(2);
	});

	it("WHEN a settings write is applied THEN the new globals are persisted before the fan-out", async () => {
		const { actions, pluginDataStore } = await actionsUnderTest();
		const view = { ...EngineDefaults.viewSettings(), nodeCap: 42 };
		await actions.applySettings({ kind: "global-view", view });
		expect(pluginDataStore.globalView().nodeCap).toBe(42);
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
		// The user gets a Notice instead; no pin landed, so N rebuilds would be pure waste.
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.pinNode(ID_LESS_PATH);
		expect(viewsRefresh.refreshedViewIds).toEqual([]);
	});
});
