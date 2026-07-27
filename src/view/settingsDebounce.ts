/**
 * Debounce seam for the settings tab's TYPED fields (numbers, text, textarea).
 *
 * WHY it exists: every keystroke in those fields used to persist `data.json` and
 * rebuild every open graph — a full vault traversal plus an elk+d3 layout pass —
 * so typing `160` cost three rebuilds. Sliders are deliberately NOT routed here
 * (they commit discrete values and their drag feel was reviewed as-is).
 *
 * Two properties this must never lose:
 * - **No dropped edits.** The last keystroke of a burst is what the user meant, so
 *   the tab flushes on blur and on `hide()`; a debounce that swallows it would be
 *   worse than no debounce.
 * - **Edits compose.** Callers pass a THUNK, never a precomputed command, so the
 *   globals are read fresh at flush time — the same invariant
 *   `VicinityGraphSettingTab.writeContext()` protects. Two fields edited inside one
 *   window must merge, not clobber each other.
 */

/**
 * The timer the debouncer runs on. An interface (not a bare `setTimeout`) so tests
 * drive the settle window directly instead of faking globals.
 */
export interface DebounceScheduler {
	schedule(callback: () => void, delayMs: number): number;
	cancel(handle: number): void;
}

/** Production scheduler: Obsidian's renderer window. */
export const WINDOW_DEBOUNCE_SCHEDULER: DebounceScheduler = {
	schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
	cancel: (handle) => window.clearTimeout(handle),
};

/** A pending settings write. Deferred on purpose — see the module doc. */
export type SettingsWriteThunk = () => Promise<void>;

/**
 * Coalesces typed settings edits into one write per field per settle window.
 *
 * Latest-wins PER FIELD, one shared window: a burst across several fields settles
 * together and then drains in edit order, each write awaited before the next so no
 * write reads globals the previous one has not applied yet.
 */
export class DebouncedSettingsWrites {
	/** Field key → its latest pending write. Insertion-ordered = edit-ordered drain. */
	private readonly pending = new Map<string, SettingsWriteThunk>();
	private handle: number | null = null;
	private draining: Promise<void> = Promise.resolve();

	constructor(
		private readonly delayMs: number,
		private readonly scheduler: DebounceScheduler = WINDOW_DEBOUNCE_SCHEDULER,
	) {}

	/** Replaces `field`'s pending write and restarts the settle window. */
	schedule(field: string, write: SettingsWriteThunk): void {
		this.pending.set(field, write);
		this.restartWindow();
	}

	/**
	 * Forgets `field`'s pending write. Used when a keystroke turns a field's value
	 * into a non-value (cleared field) or a rejected one — the earlier, valid
	 * keystrokes of the same burst must not persist behind the user's back.
	 */
	drop(field: string): void {
		this.pending.delete(field);
	}

	/** Runs every pending write NOW (blur / tab close). Resolves when they are persisted. */
	flush(): Promise<void> {
		this.cancelWindow();
		return this.drain();
	}

	private restartWindow(): void {
		this.cancelWindow();
		this.handle = this.scheduler.schedule(() => {
			this.handle = null;
			void this.drain();
		}, this.delayMs);
	}

	private cancelWindow(): void {
		if (this.handle !== null) {
			this.scheduler.cancel(this.handle);
			this.handle = null;
		}
	}

	private drain(): Promise<void> {
		const writes = [...this.pending.values()];
		this.pending.clear();
		const runAll = async (): Promise<void> => {
			for (const write of writes) {
				await write();
			}
		};
		// Chained so a flush that overlaps an in-flight drain still runs AFTER it.
		// The rejection handler mirrors `PluginDataStore.persist`: one failed write
		// must not wedge every later one, and the failure still reaches ITS caller
		// through the returned promise.
		const drained = this.draining.then(runAll, runAll);
		this.draining = drained.catch(() => undefined);
		return drained;
	}
}
