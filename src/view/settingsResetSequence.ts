import type { SettingsResetScope } from "./settingsResetPlan";

/**
 * The ORDER a "Restore defaults" must happen in, extracted from the settings tab
 * so it is one testable object instead of an implicit sequence of awaits inside an
 * untestable obsidian class.
 *
 * WHY it exists: the tab used to rebuild its controls (`display()`) from INSIDE the
 * queued reset task. A control clicked while the reset was in flight had its write
 * queued BEHIND that rebuild, so the tab showed post-reset values while a write the
 * user had actually asked for was still landing
 * (`nid_8b97fdqznqsncc5kgya1p871w_e`). The rebuild therefore happens LAST, once the
 * write chain is idle — never from inside a queued task.
 *
 * WHY-NOT the alternatives the ticket listed: disabling every control for the
 * duration of a reset makes the tab feel broken for a write that normally takes
 * one tick, and re-seeding each control after every write is the focus-stealing
 * repaint pattern `nid_9k11zke41l6ze3p7n7suuo4v2_e` deliberately removed.
 */

/** The surfaces a reset coordinates. Implemented by the settings tab, faked in tests. */
export interface SettingsResetTarget {
	/** Persist every TYPED edit still inside its debounce window, and resolve either way. */
	flushTypedEdits(): Promise<void>;
	/** Write `scope`'s defaults through the serialised settings pipeline. */
	writeDefaults(scope: SettingsResetScope): Promise<void>;
	/** Resolve once the write pipeline is idle — including writes enqueued while the reset ran. */
	drainWrites(): Promise<void>;
	/** Re-seed every control from the store. Reads the globals SYNCHRONOUSLY, hence last. */
	redisplay(): void;
}

export class SettingsResetSequence {
	constructor(private readonly target: SettingsResetTarget) {}

	/**
	 * Resolves once the tab is showing what the store holds. Never rejects: a failed
	 * `data.json` write must still leave the tab displaying the truth, and the
	 * caller is a DOM click handler with nowhere to put a rejection.
	 */
	async run(scope: SettingsResetScope): Promise<void> {
		// Keystrokes typed BEFORE the reset: one still inside the settle window would
		// otherwise land after the defaults and silently un-reset its field. Tolerated
		// SEPARATELY from the write: that flush drains the user's own earlier edits, and
		// one of them failing must not cancel the reset they just asked for.
		await this.tolerating(() => this.target.flushTypedEdits());
		await this.tolerating(() => this.target.writeDefaults(scope));
		await this.settled();
		this.target.redisplay();
	}

	/**
	 * Everything that must have landed before the tab may read the globals. Every step
	 * is tolerated on its OWN so that no failure can skip a later one: a failed write —
	 * the defaults write above, or a debounced edit inside the flush below — must not
	 * skip the drain, or the redisplay rebuilds controls ahead of a write the user
	 * asked for mid-reset, which is exactly `nid_8b97fdqznqsncc5kgya1p871w_e` again.
	 */
	private async settled(): Promise<void> {
		// Keystrokes typed WHILE the reset ran — same reasoning as the pre-reset
		// flush, plus the redisplay reads the globals synchronously.
		await this.tolerating(() => this.target.flushTypedEdits());
		// And any CONTROL used while the reset ran: its write is queued behind the
		// reset, so the rebuild must wait for the whole chain, not just for the reset.
		await this.tolerating(() => this.target.drainWrites());
	}

	/** Runs one step, logging and swallowing its failure — the tab is redisplayed either way. */
	private async tolerating(step: () => Promise<void>): Promise<void> {
		try {
			await step();
		} catch (error) {
			console.error("vicinity-graph: failed to restore settings defaults", error);
		}
	}
}
