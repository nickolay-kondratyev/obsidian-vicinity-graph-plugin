import type { VaultPort } from "../adapters/obsidianPorts";
import type { NodeSizeOverridePx, ViewSettings } from "../engine";
import type { PersistableIdentity } from "../persistence/DocPersistEligibility";
import type { PersistenceServices } from "../persistence/PersistenceServices";
import type { SettingsResetScope } from "./settingsResetPlan";
import type { NonSettingsWriteSubject } from "./settingsWriteFailureNotice";
import type { GuardedWriteOutcome, SettingsWritePipeline } from "./settingsWritePipeline";
import type { SettingsInteraction } from "./settingsWritePlan";
import type { ControlsActionsPort, UserNoticePort } from "./viewPorts";

/**
 * Obsidian executor for the controls surface (step-06 #6/#8). Thin glue with ONE
 * job of its own: PINS. Every settings edit is handed straight to the shared
 * {@link SettingsWritePipeline} — the same object the settings tab writes through —
 * so the panel and the tab cannot drift on serialisation, merge base or fan-out.
 *
 * Pins run on the pipeline's chain too, through its GUARDED seam: they are `data.json`
 * writes like any other, so two fast pin/unpin clicks must land in CLICK order, the
 * panel's settings edits must not interleave with them mid-write, and a pin that never
 * reaches disk is reported by the same one policy a failed settings edit is. There is
 * deliberately no `try` and no fan-out call here — see `SettingsWritePipeline.runGuarded`.
 *
 * Each pin body reports a {@link GuardedWriteOutcome}, which is the pipeline's rebuild
 * gate, and the two cases it distinguishes are NOT the same case:
 * - REFUSED (no file at the path, or no stable id) → `store-unchanged`: nothing moved,
 *   so a rebuild could only redisplay what is on screen. A refused RESIZE is the one
 *   exception (`store-unchanged-screen-ahead`): its gesture already moved the screen.
 * - REJECTED save → the body never returns; the pipeline treats a throw as
 *   `store-changed` and repaints, because `PluginDataStore.persist()` had already moved
 *   the pin in memory. The user gets the notice AND a screen that matches the session's
 *   state. WHY-NOT roll that in-memory pin back instead — an open owner decision,
 *   ticket `nid_biwdtykvazsk3ejcqqli8o9j7_e`; until it is taken, showing what the store
 *   holds beats a screen that flips at the next unrelated rebuild.
 */

const NOT_PINNABLE_NOTICE = "This note can't be pinned (no stable id).";
/** Same refusal cause as {@link NOT_PINNABLE_NOTICE} (the shared eligibility seam), worded for the resize gesture. */
const NOT_RESIZABLE_NOTICE = "This note's size can't be saved (no stable id).";

/**
 * What a failed pinned-set / size-override save is ANNOUNCED as. Only the subject
 * lives here — the sentence is `settingsWriteFailureNotice.ts`'s, and the WHEN is
 * the pipeline's, so this class states no failure policy of its own.
 */
const PIN_WRITE_SUBJECT: NonSettingsWriteSubject = "pinned-set";
const NODE_SIZE_WRITE_SUBJECT: NonSettingsWriteSubject = "node-size-override";

export class ControlsActions implements ControlsActionsPort {
	constructor(
		private readonly persistenceServices: PersistenceServices,
		private readonly vault: VaultPort,
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
		return this.settingsWrites.runGuarded(PIN_WRITE_SUBJECT, async () => {
			const file = this.vault.getFileByPath(path);
			if (file === null) {
				return "store-unchanged";
			}
			// A refused pin leaves the node exactly as drawn (unpinned) — nothing to take back.
			return this.persistOutcome(await this.persistenceServices.pinDoc(file), {
				message: NOT_PINNABLE_NOTICE,
				refusedOutcome: "store-unchanged",
			});
		});
	}

	/** Unpinning always lands: `unpinDoc` removes the pin unconditionally and reports no verdict. */
	unpinNode(docid: string): Promise<void> {
		return this.settingsWrites.runGuarded(PIN_WRITE_SUBJECT, async () => {
			await this.persistenceServices.unpinDoc(docid);
			return "store-changed";
		});
	}

	/**
	 * Commit of a released drag-resize: the doc's size override, exactly the pin
	 * shape — a write intent on ONE doc (docid ensured lazily, the same
	 * eligibility seam can refuse it) naming ONE field, guarded and fanned out by
	 * the pipeline. The value was already clamped by the resize handles
	 * (`NODE_RESIZE_BOUNDS`); the store clamps again at its choke point.
	 *
	 * UNLIKE a pin, every refusal here still repaints (`store-unchanged-screen-ahead`):
	 * the release already left the dragged box in React Flow's local node state, so a
	 * refusal with no rebuild would leave the graph showing a size nothing stored — the
	 * notice would say "can't be saved" next to a node that looks saved.
	 */
	resizeNode(path: string, sizePx: NodeSizeOverridePx): Promise<void> {
		return this.settingsWrites.runGuarded(NODE_SIZE_WRITE_SUBJECT, async () => {
			const file = this.vault.getFileByPath(path);
			if (file === null) {
				return "store-unchanged-screen-ahead";
			}
			return this.persistOutcome(
				await this.persistenceServices.saveNodeOverrideField(file, { field: "sizePx", value: sizePx }),
				{ message: NOT_RESIZABLE_NOTICE, refusedOutcome: "store-unchanged-screen-ahead" },
			);
		});
	}

	/**
	 * "Back to computed size": clearing never mints an id and never refuses
	 * (`clearNodeOverrideField` — an id-less doc owns no override), so like
	 * {@link unpinNode} it always lands and always repaints.
	 */
	resetNodeSize(path: string): Promise<void> {
		return this.settingsWrites.runGuarded(NODE_SIZE_WRITE_SUBJECT, async () => {
			const file = this.vault.getFileByPath(path);
			if (file === null) {
				return "store-unchanged";
			}
			await this.persistenceServices.clearNodeOverrideField(file, "sizePx");
			return "store-changed";
		});
	}

	/**
	 * Turns a persistence verdict into a rebuild decision, telling the user when the
	 * write was refused. `refusedOutcome` belongs to the CALLER because only the caller
	 * knows whether its gesture already moved the screen — see {@link GuardedWriteOutcome}.
	 */
	private persistOutcome(
		identity: PersistableIdentity,
		refusal: { readonly message: string; readonly refusedOutcome: GuardedWriteOutcome },
	): GuardedWriteOutcome {
		if (identity.kind === "not-persistable") {
			this.notices.show(refusal.message);
			return refusal.refusedOutcome;
		}
		return "store-changed";
	}
}
