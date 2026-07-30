import type { VaultPort } from "../adapters/obsidianPorts";
import type { ViewSettings } from "../engine";
import type { PersistableIdentity } from "../persistence/DocPersistEligibility";
import type { PersistenceServices } from "../persistence/PersistenceServices";
import type { SettingsResetScope } from "./settingsResetPlan";
import type { SettingsWritePipeline } from "./settingsWritePipeline";
import type { SettingsInteraction } from "./settingsWritePlan";
import type { ControlsActionsPort, UserNoticePort, ViewsRefreshPort } from "./viewPorts";

/**
 * Obsidian executor for the controls surface (step-06 #6/#8). Thin glue with ONE
 * job of its own: PINS. Every settings edit is handed straight to the shared
 * {@link SettingsWritePipeline} — the same object the settings tab writes through —
 * so the panel and the tab cannot drift on serialisation, merge base or fan-out.
 *
 * Pins run on the pipeline's chain too: they are `data.json` writes like any other,
 * so two fast pin/unpin clicks must land in CLICK order, and the panel's settings
 * edits must not interleave with them mid-write.
 *
 * NOTHING rebuilds when the write did not land ({@link WriteOutcome}): no rendered
 * state changed, so a rebuild could only redisplay what is on screen.
 */

const NOT_PINNABLE_NOTICE = "This note can't be pinned (no stable id).";

/**
 * Whether a requested write actually reached storage. A refused doc (no stable
 * id) leaves every byte and every view unchanged, so this is what gates the
 * rebuild — otherwise a rejected pin would cost one graph build plus layout in
 * EVERY open view, next to a "can't be pinned" notice.
 */
type WriteOutcome = "persisted" | "not-persisted";

export class ControlsActions implements ControlsActionsPort {
	constructor(
		private readonly persistenceServices: PersistenceServices,
		private readonly vault: VaultPort,
		private readonly viewsRefresh: ViewsRefreshPort,
		private readonly settingsWrites: SettingsWritePipeline,
		/** The view layer's ONE user-message surface, shared with the write pipeline. */
		private readonly notices: UserNoticePort,
	) {}

	applySettings(interaction: SettingsInteraction): Promise<void> {
		return this.settingsWrites.apply(interaction);
	}

	/**
	 * Through the pipeline, which already owns the store and already reads it fresh for
	 * every write — so the value a control is JUDGED against and the value it is MERGED
	 * over come from the one place, and this class gains no store of its own to drift.
	 */
	storedGlobalView(): ViewSettings {
		return this.settingsWrites.storedGlobalView();
	}

	/**
	 * The panel's own "Restore defaults" buttons. Routed through the pipeline (which
	 * calls `planSettingsReset`) rather than building a defaults object here — a
	 * second opinion on what a default is, which is exactly what
	 * `engineDefaultsSingleSource.test.ts` guards against.
	 */
	restoreDefaults(scope: SettingsResetScope): Promise<void> {
		return this.settingsWrites.restoreDefaults(scope);
	}

	pinNode(path: string): Promise<void> {
		return this.settingsWrites.runSerialised(async () => {
			const file = this.vault.getFileByPath(path);
			if (file === null) {
				return;
			}
			const pinned = await this.persistenceServices.pinDoc(file);
			if (this.persistOutcome(pinned, NOT_PINNABLE_NOTICE) === "not-persisted") {
				return;
			}
			this.refreshEveryView();
		});
	}

	/** Unpinning always lands: `unpinDoc` removes the pin unconditionally and reports no verdict. */
	unpinNode(docid: string): Promise<void> {
		return this.settingsWrites.runSerialised(async () => {
			await this.persistenceServices.unpinDoc(docid);
			this.refreshEveryView();
		});
	}

	/**
	 * The fan-out for writes to state EVERY open view renders from (here: the pinned
	 * set — settings writes fan out inside the pipeline). The originating view needs
	 * no separate rebuild call: it is itself an open view, so the fan-out already
	 * rebuilds it — doing both would duplicate the build and flash its canvas.
	 */
	private refreshEveryView(): void {
		this.viewsRefresh.refreshAllViews();
	}

	/** Turns a persistence verdict into a rebuild decision, telling the user when the write was refused. */
	private persistOutcome(identity: PersistableIdentity, message: string): WriteOutcome {
		if (identity.kind === "not-persistable") {
			this.notices.show(message);
			return "not-persisted";
		}
		return "persisted";
	}
}
