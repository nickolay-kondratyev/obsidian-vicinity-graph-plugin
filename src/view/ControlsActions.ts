import type { VaultFilePort, VaultPort } from "../adapters/obsidianPorts";
import type { NodeContentOverride, NodeSizeOverridePx, ViewSettings } from "../engine";
import type { PersistableIdentity } from "../persistence/DocPersistEligibility";
import type { PersistenceServices } from "../persistence/PersistenceServices";
import type { SettingsResetScope } from "./settingsResetPlan";
import type { NonSettingsWriteSubject } from "./settingsWriteFailureNotice";
import type { GuardedWriteOutcome, SettingsWritePipeline } from "./settingsWritePipeline";
import type { SettingsInteraction } from "./settingsWritePlan";
import type { ActiveMainProvider, ControlsActionsPort, UserNoticePort } from "./viewPorts";

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
/**
 * Same refusal cause as {@link NOT_PINNABLE_NOTICE}, worded for a LOCAL pin: it needs a
 * stable id for BOTH the target AND the current main, so the sentence names neither
 * doc specifically (either one lacking an id blocks the pin) — the remedy is the same.
 */
const NOT_LOCALLY_PINNABLE_NOTICE = "This note can't be pinned for the current note (no stable id).";
/** Same refusal cause as {@link NOT_PINNABLE_NOTICE} (the shared eligibility seam), worded for the resize gesture. */
const NOT_RESIZABLE_NOTICE = "This note's size can't be saved (no stable id).";
/** Same refusal cause again, worded for the per-node content override. */
const NOT_CONTENT_OVERRIDABLE_NOTICE = "This note's content choice can't be saved (no stable id).";

/**
 * What a failed pinned-set / size-override save is ANNOUNCED as. Only the subject
 * lives here — the sentence is `settingsWriteFailureNotice.ts`'s, and the WHEN is
 * the pipeline's, so this class states no failure policy of its own.
 */
const PIN_WRITE_SUBJECT: NonSettingsWriteSubject = "pinned-set";
const NODE_SIZE_WRITE_SUBJECT: NonSettingsWriteSubject = "node-size-override";
const NODE_CONTENT_WRITE_SUBJECT: NonSettingsWriteSubject = "node-content-override";

export class ControlsActions implements ControlsActionsPort {
	constructor(
		private readonly persistenceServices: PersistenceServices,
		private readonly vault: VaultPort,
		private readonly settingsWrites: SettingsWritePipeline,
		/** The view layer's ONE user-message surface, shared with the write pipeline. */
		private readonly notices: UserNoticePort,
		/** Which note the graph is built around — the MAIN a local pin is scoped to. */
		private readonly activeMain: ActiveMainProvider,
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
	 * Locally pin TARGET under the active MAIN — the pinned set's per-main sibling, so
	 * it rides the SAME guarded seam and the SAME `pinned-set` failure subject as the
	 * global pin. `localPinDoc` needs a persistable id for BOTH docs; a refusal (either
	 * doc, or no main to scope under) wrote nothing and left the node exactly as drawn,
	 * so it reports `store-unchanged` like a refused global pin.
	 *
	 * The MAIN is captured at CLICK time, before the guarded slot queues: the slot can
	 * run behind earlier writes on the shared serial chain, and the pin must scope to
	 * the main the user was LOOKING at, not whichever note the graph has re-centred on
	 * since. (The slot's fresh-read rule is about merging GLOBALS, not about which doc
	 * a gesture named.)
	 */
	localPinNode(path: string): Promise<void> {
		const mainPath = this.activeMain.activeMainPath();
		return this.settingsWrites.runGuarded(PIN_WRITE_SUBJECT, async () => {
			const mainFile = this.mainFileAt(mainPath);
			const targetFile = this.vault.getFileByPath(path);
			if (mainFile === null || targetFile === null) {
				return "store-unchanged";
			}
			const outcome = await this.persistenceServices.localPinDoc(mainFile, targetFile);
			if (outcome.kind === "not-persistable") {
				this.notices.show(NOT_LOCALLY_PINNABLE_NOTICE);
				return "store-unchanged";
			}
			return "store-changed";
		});
	}

	/**
	 * Locally unpin TARGET from the active MAIN. Like {@link unpinNode} the removal
	 * always lands (`localUnpinDoc` reads the main's existing id without minting and
	 * reports no verdict), so it reports `store-changed` whenever a main is active. With
	 * no main to scope under there is nothing keyed to remove, so it reports
	 * `store-unchanged`. Like {@link localPinNode}, the MAIN is captured at CLICK time.
	 */
	localUnpinNode(docid: string): Promise<void> {
		const mainPath = this.activeMain.activeMainPath();
		return this.settingsWrites.runGuarded(PIN_WRITE_SUBJECT, async () => {
			const mainFile = this.mainFileAt(mainPath);
			if (mainFile === null) {
				return "store-unchanged";
			}
			await this.persistenceServices.localUnpinDoc(mainFile, docid);
			return "store-changed";
		});
	}

	/** The click-time MAIN as a resolved file, or `null` when no main was set or its path is gone. */
	private mainFileAt(mainPath: string | null): VaultFilePort | null {
		return mainPath === null ? null : this.vault.getFileByPath(mainPath);
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
	 * The gear menu's Content choice (Title only / Outline / Image): the doc's
	 * global content override, the same pin-shaped write intent naming ONE field
	 * (docid ensured lazily, the same eligibility seam can refuse it), guarded and
	 * fanned out by the pipeline. UNLIKE a resize, nothing moved on screen
	 * optimistically — the menu simply closed — so a refusal reports `store-unchanged`
	 * (no repaint needed), exactly like a refused pin.
	 */
	setNodeContentOverride(path: string, content: NodeContentOverride): Promise<void> {
		return this.settingsWrites.runGuarded(NODE_CONTENT_WRITE_SUBJECT, async () => {
			const file = this.vault.getFileByPath(path);
			if (file === null) {
				return "store-unchanged";
			}
			return this.persistOutcome(
				await this.persistenceServices.saveNodeOverrideField(file, { field: "content", value: content }),
				{ message: NOT_CONTENT_OVERRIDABLE_NOTICE, refusedOutcome: "store-unchanged" },
			);
		});
	}

	/**
	 * "Inherit": clearing never mints an id and never refuses
	 * (`clearNodeOverrideField` — an id-less doc owns no override), so like
	 * {@link unpinNode} it always lands and always repaints.
	 */
	clearNodeContentOverride(path: string): Promise<void> {
		return this.settingsWrites.runGuarded(NODE_CONTENT_WRITE_SUBJECT, async () => {
			const file = this.vault.getFileByPath(path);
			if (file === null) {
				return "store-unchanged";
			}
			await this.persistenceServices.clearNodeOverrideField(file, "content");
			return "store-changed";
		});
	}

	/**
	 * Turns a persistence verdict into a rebuild decision, telling the user when the
	 * write was refused. `refusedOutcome` belongs to the CALLER because only the caller
	 * knows whether its gesture already moved the screen — see {@link GuardedWriteOutcome};
	 * a refusal wrote nothing by definition, so `store-changed` is excluded at the type.
	 */
	private persistOutcome(
		identity: PersistableIdentity,
		refusal: { readonly message: string; readonly refusedOutcome: Exclude<GuardedWriteOutcome, "store-changed"> },
	): GuardedWriteOutcome {
		if (identity.kind === "not-persistable") {
			this.notices.show(refusal.message);
			return refusal.refusedOutcome;
		}
		return "store-changed";
	}
}
