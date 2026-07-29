import { Notice } from "obsidian";
import type { VaultPort } from "../adapters/obsidianPorts";
import type { PersistableIdentity } from "../persistence/DocPersistEligibility";
import type { PersistenceServices } from "../persistence/PersistenceServices";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import type { SettingsCommand } from "./settingsWritePlan";
import type { ControlsActionsPort, ViewsRefreshPort } from "./viewPorts";

/**
 * Obsidian executor for the controls surface (step-06 #6/#8). Thin glue: it
 * switches a pure {@link SettingsCommand} (or a pin/unpin) onto the matching
 * {@link PersistenceServices}/{@link PluginDataStore} call, resolves the target
 * file from a path via {@link VaultPort}, surfaces a `Notice` when the doc can't
 * be pinned, then triggers a rebuild. This is one of the few view files allowed
 * to import `obsidian`; the decision of WHICH write to make lives in the pure
 * `planSettingsWrite`, keeping this a switch with no business logic.
 *
 * EVERY write here lands in `data.json` — settings are global and so is the
 * pinned set — so every write that lands fans out to EVERY open view through
 * {@link ViewsRefreshPort}. NOTHING rebuilds when the write did not land
 * ({@link WriteOutcome}): no rendered state changed, so a rebuild could only
 * redisplay what is on screen.
 */

const NOT_PINNABLE_NOTICE = "This note can't be pinned (no stable id).";

/**
 * Whether a requested write actually reached storage. A refused doc (no stable
 * id) leaves every byte and every view unchanged, so this is what gates the
 * rebuild — otherwise a rejected pin would cost one graph build plus layout in
 * EVERY open view, next to a "can't be pinned" Notice.
 */
type WriteOutcome = "persisted" | "not-persisted";

export class ControlsActions implements ControlsActionsPort {
	constructor(
		private readonly persistenceServices: PersistenceServices,
		private readonly pluginDataStore: PluginDataStore,
		private readonly vault: VaultPort,
		private readonly viewsRefresh: ViewsRefreshPort,
	) {}

	async applySettings(command: SettingsCommand): Promise<void> {
		await this.executeSettings(command);
		this.refreshEveryView();
	}

	async pinNode(path: string): Promise<void> {
		const file = this.vault.getFileByPath(path);
		if (file === null) {
			return;
		}
		if (this.persistOutcome(await this.persistenceServices.pinDoc(file), NOT_PINNABLE_NOTICE) === "not-persisted") {
			return;
		}
		this.refreshEveryView();
	}

	/** Unpinning always lands: `unpinDoc` removes the pin unconditionally and reports no verdict. */
	async unpinNode(docid: string): Promise<void> {
		await this.persistenceServices.unpinDoc(docid);
		this.refreshEveryView();
	}

	/**
	 * The fan-out for writes to state EVERY open view renders from (globals and
	 * the pinned set, both in data.json). The originating view needs no separate
	 * rebuild call: it is itself an open view, so the fan-out already rebuilds it —
	 * doing both would duplicate the build and flash its canvas.
	 */
	private refreshEveryView(): void {
		this.viewsRefresh.refreshAllViews();
	}

	/** Globals carry no doc identity, so nothing can refuse them. */
	private async executeSettings(command: SettingsCommand): Promise<void> {
		switch (command.kind) {
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

	/** Turns a persistence verdict into a rebuild decision, telling the user when the write was refused. */
	private persistOutcome(identity: PersistableIdentity, message: string): WriteOutcome {
		if (identity.kind === "not-persistable") {
			new Notice(message);
			return "not-persisted";
		}
		return "persisted";
	}
}
