import { describe, expect, it } from "vitest";
import { FakeDocIdPort } from "../adapters/FakeDocIdPort";
import type { VaultFilePort, VaultPort } from "../adapters/obsidianPorts";
import type { AiNamedRelationship, RelationshipName } from "../engine";
import { FakePluginDataPort } from "../persistence/FakePluginDataPort";
import { FakeVaultFsPort } from "../persistence/FakeVaultFsPort";
import { PathDocIdMap } from "../persistence/PathDocIdMap";
import { PerDocStore } from "../persistence/PerDocStore";
import { PersistenceServices } from "../persistence/PersistenceServices";
import { PluginDataStore } from "../persistence/PluginDataStore";
import { RejectingVaultFsPort } from "../persistence/RejectingVaultFsPort";
import { RelationshipStore } from "../persistence/RelationshipStore";
import { VaultFileStore } from "../persistence/VaultFileStore";
import { AiRelationshipWriter } from "./AiRelationshipWriter";
import { FakeUserNotices } from "./FakeUserNotices";
import { FakeViewsRefresh } from "./FakeViewsRefresh";
import { SettingsWriteFailureNotice } from "./settingsWriteFailureNotice";
import { SettingsWritePipeline } from "./settingsWritePipeline";

/**
 * The AI name write (moved off the per-view `ControlsActions` when the queue became
 * plugin-lived, task 4/4). Real persistence classes and the real pipeline over their
 * in-memory fakes — no obsidian runtime.
 */

const OPEN_VIEW_IDS = ["view-a", "view-b"];
const SOURCE_PATH = "main.md";
const SOURCE_DOCID = "docid_main_e";
const TARGET_PATH = "target.md";
const TARGET_DOCID = "docid_target_e";
/** Resolves to a real file, but no docid can be minted for it → `not-persistable`. */
const ID_LESS_PATH = "id-less.md";

const AI_EXTENDS: AiNamedRelationship = {
	name: "extends" as RelationshipName,
	model: "gpt-6-luna",
	effort: "medium",
	usage: { inputTokens: 100, outputTokens: 5 },
};

function fileAt(path: string): VaultFilePort {
	return { path, extension: path.split(".").pop() ?? "", stat: { mtime: 0, size: 0 }, parent: { path: "/" } };
}

const RESOLVABLE_PATHS: readonly string[] = [SOURCE_PATH, TARGET_PATH, ID_LESS_PATH];
const VAULT: VaultPort = {
	getFileByPath: (path) => (RESOLVABLE_PATHS.includes(path) ? fileAt(path) : null),
	getFiles: () => RESOLVABLE_PATHS.map(fileAt),
	cachedRead: () => Promise.resolve(""),
};

async function writerUnderTest(perFileFs: FakeVaultFsPort = new FakeVaultFsPort()) {
	const pluginDataStore = new PluginDataStore(new FakePluginDataPort());
	await pluginDataStore.init();
	const docIdPort = new FakeDocIdPort({ [SOURCE_PATH]: SOURCE_DOCID, [TARGET_PATH]: TARGET_DOCID });
	docIdPort.markUnidentifiable(ID_LESS_PATH);
	const fileStore = new VaultFileStore(".plugin_data/vicinity_graph", perFileFs, () => 0);
	const relationshipStore = new RelationshipStore(fileStore, () => 0);
	const persistenceServices = new PersistenceServices(
		docIdPort,
		pluginDataStore,
		new PerDocStore(fileStore),
		relationshipStore,
		new PathDocIdMap(),
	);
	const viewsRefresh = new FakeViewsRefresh(OPEN_VIEW_IDS);
	const notices = new FakeUserNotices();
	const settingsWrites = new SettingsWritePipeline(pluginDataStore, viewsRefresh, notices);
	return {
		writer: new AiRelationshipWriter(persistenceServices, VAULT, settingsWrites),
		persistenceServices,
		relationshipStore,
		viewsRefresh,
		notices,
	};
}

describe("AiRelationshipWriter (auto mode's one write)", () => {
	it("WHEN an AI name is saved THEN it is stored as an ai name under source → target", async () => {
		const { writer, relationshipStore } = await writerUnderTest();
		await writer.saveAiRelationship(SOURCE_PATH, TARGET_PATH, AI_EXTENDS);
		expect(relationshipStore.relationshipFor(SOURCE_DOCID, TARGET_DOCID)).toMatchObject({ name: "extends", origin: "ai" });
	});

	it("WHEN an AI name is saved THEN every open view is refreshed (labels repaint)", async () => {
		const { writer, viewsRefresh } = await writerUnderTest();
		await writer.saveAiRelationship(SOURCE_PATH, TARGET_PATH, AI_EXTENDS);
		expect(viewsRefresh.refreshedViewIds).toEqual(OPEN_VIEW_IDS);
	});

	it("WHEN a note of the pair has no stable id THEN nothing is shown and no view is refreshed", async () => {
		const { writer, notices, viewsRefresh } = await writerUnderTest();
		await writer.saveAiRelationship(SOURCE_PATH, ID_LESS_PATH, AI_EXTENDS);
		expect({ messages: notices.messages, refreshed: viewsRefresh.refreshedViewIds }).toEqual({ messages: [], refreshed: [] });
	});

	it("WHEN the pair was named manually meanwhile THEN the manual name stays", async () => {
		const { writer, persistenceServices, relationshipStore } = await writerUnderTest();
		const source = VAULT.getFileByPath(SOURCE_PATH);
		const target = VAULT.getFileByPath(TARGET_PATH);
		if (source === null || target === null) {
			throw new Error("fixture vault lost its files");
		}
		await persistenceServices.nameRelationship(source, target, "supports" as RelationshipName);
		await writer.saveAiRelationship(SOURCE_PATH, TARGET_PATH, AI_EXTENDS);
		expect(relationshipStore.relationshipFor(SOURCE_DOCID, TARGET_DOCID)?.name).toBe("supports");
	});

	it("WHEN the AI name cannot be written to the vault THEN the ONE failure notice is shown", async () => {
		const { writer, notices } = await writerUnderTest(new RejectingVaultFsPort());
		await writer.saveAiRelationship(SOURCE_PATH, TARGET_PATH, AI_EXTENDS);
		expect(notices.messages).toEqual([SettingsWriteFailureNotice.forNonSettingsWrite("relationship-name")]);
	});
});
