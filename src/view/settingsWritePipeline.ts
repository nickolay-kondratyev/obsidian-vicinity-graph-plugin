import type { ViewSettings } from "../engine";
import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import type { SettingsResetConfirmation, SettingsResetScope } from "./settingsResetPlan";
import { planSettingsReset, planSettingsResetConfirmation } from "./settingsResetPlan";
import type { NonSettingsWriteSubject } from "./settingsWriteFailureNotice";
import { SettingsWriteFailureNotice } from "./settingsWriteFailureNotice";
import type { SettingsCommand, SettingsInteraction, SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";
import type { UserNoticePort, ViewsRefreshPort } from "./viewPorts";

/**
 * THE settings write pipeline — the one path every settings edit takes, from both
 * surfaces (the settings tab and the in-graph controls panel).
 *
 * Four rules live here, once:
 * 1. **Serialised.** Every write runs on ONE {@link SerialPromiseChain}, so the
 *    store ends on the value the user acted on LAST, not the write that happened
 *    to finish last.
 * 2. **Planned from a FRESH read.** The merge base is read from
 *    {@link PluginDataStore} INSIDE the serialised slot, never captured before
 *    it. A snapshot taken at enqueue time can predate a queued write that has not
 *    run yet, and every command rewrites a whole slice — so a stale base silently
 *    reverts a sibling field. This is why the pipeline takes an INTERACTION and
 *    plans it itself instead of accepting a ready-made {@link SettingsCommand}.
 * 3. **One fan-out rule, applied in one place ({@link guarded}).** Everything here is
 *    global state in `data.json`, which every open view renders from, so a write that
 *    CHANGED the store refreshes EVERY open view through {@link ViewsRefreshPort} —
 *    there is no narrower reach to pick — and a body that changed nothing refreshes
 *    none. "Changed the store" is not "reached disk": see {@link GuardedWriteOutcome}.
 * 4. **Idle is observable.** {@link drain} is what lets a caller re-read the
 *    globals (to rebuild controls) only once nothing is still queued.
 * 5. **A failed persist is the USER's news, exactly once, HERE.** Every call site
 *    `void`s its write promise (a control handler has nowhere to await it), so a
 *    rejection that escaped would be an unhandled rejection AND an invisible loss:
 *    the control still shows the value, the session still USES it (in-memory state
 *    moved before the disk write — see {@link write}), and only `data.json` is
 *    missing it, so nothing on screen betrays that the setting will be gone at the
 *    next restart. So a failed write is caught at the INNERMOST write, turned into one
 *    {@link UserNoticePort} message naming what failed, and never re-thrown — which is
 *    also what keeps a burst intact, because the debounce drain awaits its thunks in
 *    turn and a throw would abandon the rest of the window. Consequence, stated
 *    plainly: a resolved write promise means "attempted and reported", not "stored".
 *
 *    The policy covers `data.json` writes this pipeline does not itself plan, too —
 *    {@link runGuarded} lends the same catch to the pinned set, so there is ONE `try`
 *    for the file rather than one per subsystem.
 *
 *    "Exactly once" is PER FAILED WRITE, and deliberately not deduped across writes:
 *    an unwritable `data.json` notices every edit, and a reset with a pending typed
 *    edit notices the field and then the scope. Both are the honest count — two
 *    settings really did fail to save. WHY-NOT dedupe: a suppressed second notice is
 *    a setting the user is never told about, which is the exact failure mode this
 *    rule exists to remove. Do not "fix" the repetition by swallowing it.
 */

/**
 * The write API for code that is ALREADY inside a serialised slot (see
 * {@link SettingsWritePipeline.runSerialised}). Handed IN to such a task so the
 * right thing is the easy thing — the task never has to reach for the pipeline.
 *
 * HAZARD, stated plainly rather than pretended away: the pipeline's own
 * {@link SettingsWritePipeline.apply} / {@link SettingsWritePipeline.restoreDefaults} /
 * {@link SettingsWritePipeline.drain} stay reachable through any closure a slot
 * captures, and calling one from INSIDE a slot waits on the tail that slot itself is
 * holding — a deadlock, not an ordering bug. Code inside a slot MUST write through
 * the writer it was handed. (`SizingRowWrite` hit exactly this and was reshaped to
 * return an interaction instead of persisting.)
 */
export interface SettingsWriter {
	/** Plan `interaction` against the globals as they are NOW, persist it, fan out. */
	apply(interaction: SettingsInteraction): Promise<void>;
}

/**
 * The pipeline slice a caller needs to run its OWN work inside the serialised
 * slot alongside its writes (DIP — `DebouncedSettingsWrites` drains through this).
 */
export interface SerialSettingsWrites {
	runSerialised(task: (writer: SettingsWriter) => Promise<void>): Promise<void>;
}

/**
 * What a guarded body reports back — the fan-out gate (rule 3). It asks about the
 * STORE, not about the disk, because that is what every open view renders from:
 * `PluginDataStore.persist()` moves its in-memory state before the disk write, so a
 * body whose save REJECTED still changed the store and still owes every view a repaint.
 * (The one persist that refuses BEFORE memory moves — a session protecting an unread
 * `data.json` — also rejects here; its repaint redraws the unchanged store, which is
 * exactly what snaps an optimistic control back.)
 *
 * `store-unchanged` is for a body that decided not to write at all AND whose gesture
 * left the screen exactly as the store already describes it (a pin refused for want of
 * a stable id — the node simply stays unpinned): a rebuild could only redraw the screen
 * it is already showing, at the cost of one graph build plus layout in EVERY open view.
 *
 * `store-unchanged-screen-ahead` is the OTHER refusal, and the distinction is the whole
 * reason there are three values: the body wrote nothing, but the gesture asking for the
 * write had ALREADY moved the screen ahead of the store (a drag-resize's box lives in
 * React Flow's local node state until a rebuild replaces it). Only a repaint takes that
 * back — without one the graph keeps showing a size nothing ever accepted, which is the
 * exact silent-divergence this pipeline exists to prevent.
 */
export type GuardedWriteOutcome = "store-changed" | "store-unchanged" | "store-unchanged-screen-ahead";

export class SettingsWritePipeline implements SerialSettingsWrites {
	private readonly chain = new SerialPromiseChain();
	private readonly writer: SettingsWriter;

	constructor(
		private readonly store: PluginDataStore,
		private readonly viewsRefresh: ViewsRefreshPort,
		private readonly notices: UserNoticePort,
	) {
		this.writer = {
			apply: (interaction) =>
				this.write(SettingsWriteFailureNotice.forInteraction(interaction), [
					planSettingsWrite(interaction, this.context()),
				]),
		};
	}

	/** One control's edit: serialised, planned fresh, persisted, fanned out. */
	apply(interaction: SettingsInteraction): Promise<void> {
		return this.chain.run(() => this.writer.apply(interaction));
	}

	/**
	 * Restore one scope's defaults. Same seam as {@link apply} — the ONLY difference
	 * is that the commands come from {@link planSettingsReset} (spec defaults)
	 * instead of a control's value, and that the whole scope fans out ONCE.
	 */
	restoreDefaults(scope: SettingsResetScope): Promise<void> {
		return this.chain.run(() =>
			this.write(SettingsWriteFailureNotice.forReset(scope), planSettingsReset(scope, this.context())),
		);
	}

	/**
	 * Runs `task` in its own serialised slot, handing it the already-serialised
	 * {@link SettingsWriter}. For callers whose write is only part of what must be
	 * atomic with respect to other writes.
	 */
	runSerialised(task: (writer: SettingsWriter) => Promise<void>): Promise<void> {
		return this.chain.run(() => task(this.writer));
	}

	/**
	 * A serialised `data.json` write that is NOT a settings command — today the pinned
	 * set and the per-node size overrides, both of which `ControlsActions` writes through
	 * `PersistenceServices`. Same chain (two fast pin clicks must land in click order, and
	 * neither a pin nor a released resize may interleave with a settings write mid-save)
	 * and, crucially, the SAME failure policy (rule 5): the task's rejection is caught
	 * HERE, named through the same copy seam, and never re-thrown at the handler that
	 * `void`s this promise.
	 *
	 * WHY this exists at all, rather than callers catching around their own body: a
	 * second `try` would be a second policy, free to drift on wording, on logging and on
	 * whether it re-throws. These writes need the policy MORE than settings do — the pin
	 * (or the resized box) is already in memory when the save fails, so the node goes on
	 * rendering as pinned/resized until a restart silently drops it.
	 *
	 * The fan-out is the pipeline's here too, on the SAME rule {@link write} follows,
	 * and the task's {@link GuardedWriteOutcome} is the only thing it asks: a body that
	 * changed the store gets every view repainted — INCLUDING one whose save rejected,
	 * which is precisely when the screen is the stale copy — and a body that wrote
	 * nothing gets no rebuild UNLESS it reports that its gesture already moved the
	 * screen ahead of the store.
	 *
	 * Keep the guarded body to the write and its outcome: the catch cannot tell a
	 * rejected `saveData` from a bug thrown anywhere else under it, so anything else a
	 * caller grows in here would be reported to the user as a `data.json` save failure.
	 */
	runGuarded(subject: NonSettingsWriteSubject, task: () => Promise<GuardedWriteOutcome>): Promise<void> {
		return this.chain.run(() => this.guarded(SettingsWriteFailureNotice.forNonSettingsWrite(subject), task));
	}

	/**
	 * What a reset scope must confirm before it runs, judged against the globals as
	 * they are NOW — same fresh read as the write itself, so the modal cannot list
	 * patterns a concurrent write has already changed.
	 */
	planResetConfirmation(scope: SettingsResetScope): SettingsResetConfirmation | null {
		return planSettingsResetConfirmation(scope, this.context());
	}

	/**
	 * The view globals as they are stored NOW, for a CONTROL that must judge one field
	 * against its siblings before it writes (`SizingRowWrite`). The same fresh read
	 * {@link context} plans a write from, exposed for the same reason
	 * {@link planResetConfirmation} is: a decision the user sees must be taken against
	 * the state the write will be taken against, not against a rendered snapshot.
	 *
	 * READ ONLY, and not a substitute for the pipeline's own merge: a caller may look,
	 * but the slice it writes is still merged inside the serialised slot.
	 */
	storedGlobalView(): ViewSettings {
		return this.store.globalView();
	}

	/** Resolves once no write is queued or running — the safe point to re-read the globals. */
	drain(): Promise<void> {
		return this.chain.drain();
	}

	/** Globals read FRESH per write so successive edits compose instead of clobbering. */
	private context(): SettingsWriteContext {
		return {
			globalDepths: this.store.globalDepths(),
			globalView: this.store.globalView(),
			nodeExclusion: this.store.nodeExclusion(),
			frontmatterLinks: this.store.frontmatterLinks(),
		};
	}

	/**
	 * THE write body, and THE failure policy (rule 5) — every settings write reaches
	 * disk through here, so this `try` is the only one the pipeline needs and the only
	 * one any call site should have.
	 *
	 * Persists every command in order, then fans out ONCE (in {@link guarded}) — N rebuilds
	 * per scope would only flash. A settings write ALWAYS reports `store-changed`, so the
	 * fan-out runs whether or not the commands landed: views must repaint from what the
	 * STORE holds, and a partly-landed reset makes that different from what they were
	 * showing.
	 *
	 * Stated exactly, because it is easy to assume the opposite: this is NOT a snap-back.
	 * `PluginDataStore.persist()` moves in-memory state BEFORE the disk write, so after a
	 * rejected persist the store still holds the value that never reached disk — the
	 * repaint shows that value, and an optimistic control releases its override ONTO it.
	 * The notice is therefore the only signal the user gets. Whether the in-memory value
	 * should roll back instead is an open owner decision, ticket
	 * `nid_biwdtykvazsk3ejcqqli8o9j7_e`.
	 *
	 * `failureNotice` is built by the caller because only the caller knows WHAT was
	 * being written — one interaction's row, or one reset scope.
	 */
	private async write(failureNotice: string, commands: readonly SettingsCommand[]): Promise<void> {
		await this.guarded(failureNotice, async () => {
			for (const command of commands) {
				await this.persist(command);
			}
			return "store-changed";
		});
	}

	/**
	 * THE catch AND THE fan-out — the single place a `data.json` write turns into
	 * user-visible news, and the single place rule 3 is applied. Both the settings
	 * {@link write} body and {@link runGuarded}'s foreign body pass through it, so "one
	 * failure policy" is one `try`, not two that agree today, and neither half can drift
	 * on when views repaint.
	 */
	private async guarded(failureNotice: string, body: () => Promise<GuardedWriteOutcome>): Promise<void> {
		// A THROWN body counts as `store-changed`, which is why the initial value is not
		// `store-unchanged`: `PluginDataStore.persist()` moved its in-memory state before the
		// save rejected, so the store is exactly what the views must be repainted from.
		let outcome: GuardedWriteOutcome = "store-changed";
		try {
			outcome = await body();
		} catch (error) {
			// The message names what was being saved; the console keeps the cause (which is
			// Obsidian's, and not something the notice could honestly paraphrase).
			console.error(`vicinity-graph: data.json write failed notice=[${failureNotice}]`, error);
			this.notices.show(failureNotice);
		}
		// Everything BUT the one outcome that promises the screen already matches the
		// store repaints — so a new reason to repaint is added by naming it, never by
		// growing a second fan-out.
		if (outcome !== "store-unchanged") {
			this.viewsRefresh.refreshAllViews();
		}
	}

	/** The single persistence executor — every settings command writes `data.json`. */
	private async persist(command: SettingsCommand): Promise<void> {
		switch (command.kind) {
			case "global-depths":
				await this.store.saveGlobalDepths(command.depths);
				return;
			case "global-view":
				await this.store.saveGlobalView(command.view);
				return;
			case "node-exclusion":
				await this.store.saveNodeExclusion(command.nodeExclusion);
				return;
			case "frontmatter-links":
				await this.store.saveFrontmatterLinks(command.frontmatterLinks);
				return;
		}
	}
}
