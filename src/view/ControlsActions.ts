import { Notice } from "obsidian";
import type { App, TFile } from "obsidian";
import type { PersistableIdentity } from "../persistence/DocPersistEligibility";
import type { PersistenceServices } from "../persistence/PersistenceServices";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import type { GraphViewController } from "./GraphViewController";
import type { SettingsCommand } from "./settingsWritePlan";
import type { ControlsActionsPort } from "./viewPorts";

/**
 * Obsidian executor for the controls surface (step-06 #6/#8). Thin glue: it
 * switches a pure {@link SettingsCommand} (or a pin/unpin) onto the matching
 * {@link PersistenceServices}/{@link PluginDataStore} call, resolves the target
 * `TFile` from a path, surfaces a `Notice` when the doc can't be persisted, then
 * asks the controller to rebuild. This is one of the few view files allowed to
 * import `obsidian`; the decision of WHICH write to make lives in the pure
 * `planSettingsWrite`, keeping this a switch with no business logic.
 *
 * Depth writes ALL target the MAIN file (own depths → `setDocDepthField`; a
 * pinned central's depth → MAIN's `centralDepths` → `setCentralDepthField`), so
 * the executor reads the current MAIN via `controller.currentMainPath()` rather
 * than threading a path through React. A null/unresolvable MAIN is a silent
 * no-op (nothing to write against).
 */

const NOT_PERSISTABLE_NOTICE = "This note can't carry graph settings (no stable id).";
const NOT_PINNABLE_NOTICE = "This note can't be pinned (no stable id).";

export class ControlsActions implements ControlsActionsPort {
	constructor(
		private readonly controller: GraphViewController,
		private readonly persistenceServices: PersistenceServices,
		private readonly pluginDataStore: PluginDataStore,
		private readonly app: App,
	) {}

	async applySettings(command: SettingsCommand): Promise<void> {
		await this.executeSettings(command);
		this.controller.handleSettingsChanged();
	}

	async pinNode(path: string): Promise<void> {
		const file = this.app.vault.getFileByPath(path);
		if (file === null) {
			return;
		}
		this.noticeIfNotPersistable(await this.persistenceServices.pinDoc(file), NOT_PINNABLE_NOTICE);
		this.controller.handleSettingsChanged();
	}

	async unpinNode(docid: string): Promise<void> {
		await this.persistenceServices.unpinDoc(docid);
		this.controller.handleSettingsChanged();
	}

	private async executeSettings(command: SettingsCommand): Promise<void> {
		switch (command.kind) {
			case "doc-depth-field": {
				const mainFile = this.mainFile();
				if (mainFile === null) {
					return;
				}
				this.noticeIfNotPersistable(
					await this.persistenceServices.setDocDepthField(mainFile, command.field, command.value),
					NOT_PERSISTABLE_NOTICE,
				);
				return;
			}
			case "central-depth-field": {
				const mainFile = this.mainFile();
				if (mainFile === null) {
					return;
				}
				this.noticeIfNotPersistable(
					await this.persistenceServices.setCentralDepthField(
						mainFile,
						command.centralDocid,
						command.field,
						command.value,
					),
					NOT_PERSISTABLE_NOTICE,
				);
				return;
			}
			case "global-depths":
				await this.pluginDataStore.saveGlobalDepths(command.depths);
				return;
			case "global-view":
				await this.pluginDataStore.saveGlobalView(command.view);
				return;
		}
	}

	private mainFile(): TFile | null {
		const mainPath = this.controller.currentMainPath();
		return mainPath === null ? null : this.app.vault.getFileByPath(mainPath);
	}

	private noticeIfNotPersistable(identity: PersistableIdentity, message: string): void {
		if (identity.kind === "not-persistable") {
			new Notice(message);
		}
	}
}
