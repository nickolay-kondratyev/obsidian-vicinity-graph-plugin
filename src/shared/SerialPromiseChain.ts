/**
 * Runs async tasks ONE AT A TIME, in the order they were handed over.
 *
 * WHY it exists: three places used to hand-roll the same "pre-caught tail"
 * idiom (the `data.json` writer, the settings-tab debounce drain, and the
 * settings-tab interaction queue). All three had to independently get the same
 * subtlety right — the rejection handler must land on the STORED tail and never
 * on the promise handed back, or a caller stops seeing its own task's failure.
 * One implementation, one place to get it right.
 *
 * Two guarantees:
 * - **Enqueue order is run order.** A task that finishes slowly cannot be
 *   overtaken by one handed over later.
 * - **A rejection is isolated but not swallowed.** One failed task never wedges
 *   the chain, and the failure still reaches ITS OWN caller.
 */
export class SerialPromiseChain {
	/** The last enqueued task, stored PRE-CAUGHT so one rejection cannot wedge the chain. */
	private tail: Promise<void> = Promise.resolve();

	/**
	 * Runs `task` after every task handed over before it, and resolves with ITS
	 * outcome — so a rejection reaches this caller while later tasks still run.
	 */
	run(task: () => Promise<void>): Promise<void> {
		// `tail` is pre-caught, so this `then` runs `task` after a failed
		// predecessor just as it does after a successful one.
		const running = this.tail.then(task);
		this.tail = running.catch(() => undefined);
		return running;
	}

	/**
	 * Resolves — never rejects — once the chain is IDLE: every task handed over so
	 * far has settled, INCLUDING tasks a running task enqueued itself. That last
	 * part is the point: it is what lets a caller re-read state a queued task may
	 * still be about to change (the settings tab's restore-defaults → redisplay).
	 *
	 * Loops rather than awaiting the tail ONCE because the tail moves while it is
	 * being awaited. A caller that enqueues from a task forever would never see
	 * this resolve — that is a livelock in the caller, not something to paper over
	 * with a bounded wait.
	 */
	async drain(): Promise<void> {
		let awaited: Promise<void> | null = null;
		while (awaited !== this.tail) {
			awaited = this.tail;
			await awaited;
		}
	}
}
