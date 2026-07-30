import type { ViewSettings } from "../engine";
import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import type { SettingsResetConfirmation, SettingsResetScope } from "./settingsResetPlan";
import { planSettingsReset, planSettingsResetConfirmation } from "./settingsResetPlan";
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
 * 3. **One fan-out rule.** Everything here is global state in `data.json`, which
 *    every open view renders from, so every landed write refreshes EVERY open
 *    view through {@link ViewsRefreshPort} — there is no narrower reach to pick.
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
		};
	}

	/**
	 * THE write body, and THE failure policy (rule 5) — every settings write reaches
	 * disk through here, so this `try` is the only one the pipeline needs and the only
	 * one any call site should have.
	 *
	 * Persists every command in order, then fans out ONCE — N rebuilds per scope would
	 * only flash. The fan-out runs whether or not the commands landed: views must repaint
	 * from what the STORE holds, and a partly-landed reset makes that different from what
	 * they were showing.
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
		try {
			for (const command of commands) {
				await this.persist(command);
			}
		} catch (error) {
			// The message names the setting; the console keeps the cause (which is
			// Obsidian's, and not something the notice could honestly paraphrase).
			console.error(`vicinity-graph: settings write failed notice=[${failureNotice}]`, error);
			this.notices.show(failureNotice);
		}
		this.viewsRefresh.refreshAllViews();
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
		}
	}
}
