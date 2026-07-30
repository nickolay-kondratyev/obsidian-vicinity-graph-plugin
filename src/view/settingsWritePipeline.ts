import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import type { SettingsResetConfirmation, SettingsResetScope } from "./settingsResetPlan";
import { planSettingsReset, planSettingsResetConfirmation } from "./settingsResetPlan";
import type { SettingsCommand, SettingsInteraction, SettingsWriteContext } from "./settingsWritePlan";
import { planSettingsWrite } from "./settingsWritePlan";
import type { ViewsRefreshPort } from "./viewPorts";

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
	) {
		this.writer = { apply: (interaction) => this.write([planSettingsWrite(interaction, this.context())]) };
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
		return this.chain.run(() => this.write(planSettingsReset(scope, this.context())));
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

	/** Persists every command in order, then fans out ONCE — N rebuilds per scope would only flash. */
	private async write(commands: readonly SettingsCommand[]): Promise<void> {
		for (const command of commands) {
			await this.persist(command);
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
