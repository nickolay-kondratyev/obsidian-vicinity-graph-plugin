import { Notice } from "obsidian";
import type { VaultFilePort, VaultPort } from "../adapters/obsidianPorts";
import type { PersistableIdentity } from "../persistence/DocPersistEligibility";
import type { PersistenceServices } from "../persistence/PersistenceServices";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import type { SettingsCommand } from "./settingsWritePlan";
import { settingsWriteScope } from "./settingsWriteScope";
import type { ControlsActionsPort, OwningViewPort, ViewsRefreshPort } from "./viewPorts";

/**
 * Obsidian executor for the controls surface (step-06 #6/#8). Thin glue: it
 * switches a pure {@link SettingsCommand} (or a pin/unpin) onto the matching
 * {@link PersistenceServices}/{@link PluginDataStore} call, resolves the target
 * `TFile` from a path, surfaces a `Notice` when the doc can't be persisted, then
 * asks the controller to rebuild. This is one of the few view files allowed to
 * import `obsidian`; the decision of WHICH write to make lives in the pure
 * `planSettingsWrite`, keeping this a switch with no business logic.
 *
 * WHICH views rebuild afterwards is likewise a pure decision
 * ({@link settingsWriteScope}): a global write reaches every open view through
 * {@link ViewsRefreshPort}, a per-doc write only the view that made it.
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
		private readonly owningView: OwningViewPort,
		private readonly persistenceServices: PersistenceServices,
		private readonly pluginDataStore: PluginDataStore,
		private readonly vault: VaultPort,
		private readonly viewsRefresh: ViewsRefreshPort,
	) {}

	async applySettings(command: SettingsCommand): Promise<void> {
		await this.executeSettings(command);
		if (settingsWriteScope(command) === "global") {
			this.refreshEveryView();
			return;
		}
		this.owningView.handleSettingsChanged();
	}

	async pinNode(path: string): Promise<void> {
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			return;
		}
		this.noticeIfNotPersistable(await this.persistenceServices.pinDoc(file), NOT_PINNABLE_NOTICE);
		this.refreshEveryView();
	}

	async unpinNode(docid: string): Promise<void> {
		await this.persistenceServices.unpinDoc(docid);
		this.refreshEveryView();
	}

	/**
	 * The fan-out for writes to state EVERY open view renders from (globals and
	 * the pinned set, both in data.json). The originating view needs no separate
	 * `handleSettingsChanged()`: it is itself an open view, so the fan-out already
	 * rebuilds it — calling both would duplicate the build and flash its canvas.
	 */
	private refreshEveryView(): void {
		this.viewsRefresh.refreshAllViews();
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
			case "node-exclusion":
				await this.pluginDataStore.saveNodeExclusion(command.nodeExclusion);
				return;
		}
	}

	private mainFile(): VaultFilePort | null {
		const mainPath = this.owningView.currentMainPath();
		return mainPath === null ? null : this.vault.getFileByPath(mainPath);
	}

	private noticeIfNotPersistable(identity: PersistableIdentity, message: string): void {
		if (identity.kind === "not-persistable") {
			new Notice(message);
		}
	}
}
