/**
 * Serialization seam for the settings tab's INTERACTION handlers.
 *
 * WHY it exists: every control's handler is an independent async function, so two
 * clicks on the same control inside one save round-trip used to run concurrently
 * and whichever FINISHED last won `data.json` — not the one clicked last. The
 * checkbox on screen shows the last click, so the store and the visible control
 * could disagree until the tab was re-displayed.
 *
 * What must be inside a task, and why the queue takes a THUNK: the handlers that
 * race read their snapshot of the globals AFTER an await (`settlePendingWrites()`),
 * so a queue wrapping only the persist call would still let both handlers resume
 * off the same pre-write snapshot. The task therefore covers the whole
 * settle → snapshot → plan → persist → refresh sequence, and the queue is entered
 * BEFORE the snapshot read.
 *
 * NOT re-entrant: a task that enqueues another task and awaits it deadlocks, since
 * the inner task waits on the tail its own caller occupies. Writes reached from
 * INSIDE a task (the debounced thunks a task's `settlePendingWrites()` drains) must
 * call the unqueued write path — they are already ordered by the drain that runs them.
 */
export class SettingsWriteQueue {
	/** The last enqueued task, pre-caught so one rejection cannot wedge the chain. */
	private tail: Promise<void> = Promise.resolve();

	/**
	 * Runs `write` after every write enqueued before it, and resolves with ITS
	 * outcome — a rejection reaches this caller while later writes still run
	 * (same contract as `PluginDataStore.persist` and `DebouncedSettingsWrites.drain`).
	 */
	enqueue(write: () => Promise<void>): Promise<void> {
		// `tail` is stored pre-caught, so this `then` runs `write` after a failed
		// predecessor just as it does after a successful one.
		const running = this.tail.then(write);
		this.tail = running.catch(() => undefined);
		return running;
	}
}
