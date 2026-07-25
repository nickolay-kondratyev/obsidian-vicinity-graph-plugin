import { describe, expect, it, vi } from "vitest";
import { FakeDocIdPort } from "../adapters/FakeDocIdPort";
import type { VaultFilePort, VaultPort } from "../adapters/obsidianPorts";
import { EngineDefaults } from "../engine";
import { DocDataStore } from "../persistence/DocDataStore";
import { FakeFileStorage } from "../persistence/FakeFileStorage";
import { FakePluginDataPort } from "../persistence/FakePluginDataPort";
import { PathDocIdMap } from "../persistence/PathDocIdMap";
import { PersistenceServices } from "../persistence/PersistenceServices";
import { PluginDataStore } from "../persistence/PluginDataStore";
import { ControlsActions } from "./ControlsActions";
import { FakeViewsRefresh } from "./FakeViewsRefresh";
import type { OwningViewPort } from "./viewPorts";

// `ControlsActions` imports `Notice` from the type-only `obsidian` package (no
// runtime entry point), so the module needs a stand-in to be importable at all.
// Nothing here asserts on notices — the non-persistable paths are not exercised.
vi.mock("obsidian", () => ({ Notice: class {} }));

/**
 * Refresh fan-out tests for the controls executor: a GLOBAL write lands in
 * data.json, which every open graph view renders from, so it must rebuild ALL of
 * them; a PER-DOC write only concerns the doc that is MAIN in the writing view.
 * Collaborators are the real persistence classes over their in-memory fakes plus
 * a structural fake for the owning view's controller — no obsidian runtime.
 */

const ORIGINATING_VIEW_ID = "view-originating";
const OTHER_VIEW_ID = "view-other";
const MAIN_PATH = "main.md";
const MAIN_DOCID = "docid_main_e";

/** Records rebuilds of the ONE view that owns the controls panel. */
class FakeOwningView implements OwningViewPort {
	rebuildCount = 0;

	constructor(private readonly mainPath: string | null) {}

	currentMainPath(): string | null {
		return this.mainPath;
	}

	handleSettingsChanged(): void {
		this.rebuildCount += 1;
	}
}

function fileAt(path: string): VaultFilePort {
	return { path, extension: path.split(".").pop() ?? "", stat: { mtime: 0, size: 0 }, parent: { path: "/" } };
}

/** Serves exactly the MAIN file; anything else is unresolved, as an empty vault would be. */
const VAULT: VaultPort = {
	getFileByPath: (path) => (path === MAIN_PATH ? fileAt(MAIN_PATH) : null),
	getFiles: () => [fileAt(MAIN_PATH)],
	cachedRead: () => Promise.resolve(""),
};

async function actionsUnderTest() {
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();
	const persistenceServices = new PersistenceServices(
		new FakeDocIdPort({ [MAIN_PATH]: MAIN_DOCID }),
		pluginDataStore,
		new DocDataStore(new FakeFileStorage(), "doc-data"),
		new PathDocIdMap(),
	);
	const owningView = new FakeOwningView(MAIN_PATH);
	const viewsRefresh = new FakeViewsRefresh([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	const actions = new ControlsActions(owningView, persistenceServices, pluginDataStore, VAULT, viewsRefresh);
	return { actions, owningView, viewsRefresh, pluginDataStore };
}

describe("ControlsActions.applySettings", () => {
	it("WHEN a global-scope write is applied THEN EVERY open view is refreshed", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.applySettings({ kind: "global-view", view: EngineDefaults.viewSettings() });
		expect(viewsRefresh.refreshedViewIds).toEqual([ORIGINATING_VIEW_ID, OTHER_VIEW_ID]);
	});

	it("WHEN a global-scope write is applied THEN the originating view is not rebuilt a second time on its own", async () => {
		// The fan-out already covers the originating view (it IS an open view);
		// an extra controller rebuild would be duplicate work and a visible flash.
		const { actions, owningView } = await actionsUnderTest();
		await actions.applySettings({ kind: "global-view", view: EngineDefaults.viewSettings() });
		expect(owningView.rebuildCount).toBe(0);
	});

	it("WHEN a global-scope write is applied THEN the new globals are persisted before the fan-out", async () => {
		const { actions, pluginDataStore } = await actionsUnderTest();
		const view = { ...EngineDefaults.viewSettings(), nodeCap: 42 };
		await actions.applySettings({ kind: "global-view", view });
		expect(pluginDataStore.globalView().nodeCap).toBe(42);
	});

	it("WHEN a per-doc write is applied THEN only the originating view rebuilds", async () => {
		const { actions, owningView } = await actionsUnderTest();
		await actions.applySettings({ kind: "doc-depth-field", field: "outgoingDepth", value: 3 });
		expect(owningView.rebuildCount).toBe(1);
	});

	it("WHEN a per-doc write is applied THEN the other open views are left alone", async () => {
		const { actions, viewsRefresh } = await actionsUnderTest();
		await actions.applySettings({ kind: "doc-depth-field", field: "outgoingDepth", value: 3 });
		expect(viewsRefresh.refreshedViewIds).toEqual([]);
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
});
