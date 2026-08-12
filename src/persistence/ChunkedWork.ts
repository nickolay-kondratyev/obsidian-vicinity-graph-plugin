/**
 * Main-thread-friendly batch processing: async alone does NOT yield the event
 * loop, so bulk work (sweep warm-up, orphan deletion) runs in batches with an
 * explicit yield between them (step doc constraint).
 */
export class ChunkedWork {
	/**
	 * Runs `work` over items, yielding via `yieldBetweenBatches` after each full
	 * batch (never after the last, partial or not — no trailing idle hop).
	 * `work` returns `true` to STOP: the remaining items are never visited and
	 * no trailing yield happens (a scan that can finish early — the docid
	 * warm-up). `yieldBetweenBatches` is injectable so tests can count yields.
	 */
	static async forEachChunkedUntil<T>(
		items: readonly T[],
		batchSize: number,
		work: (item: T) => boolean | Promise<boolean>,
		yieldBetweenBatches: () => Promise<void> = ChunkedWork.sleepZero,
	): Promise<void> {
		for (let index = 0; index < items.length; index++) {
			const item = items[index] as T;
			if (await work(item)) {
				return;
			}
			const batchBoundary = (index + 1) % batchSize === 0 && index + 1 < items.length;
			if (batchBoundary) {
				await yieldBetweenBatches();
			}
		}
	}

	/**
	 * `await sleep(0)` — a real macrotask hop, releasing the main thread. Declared
	 * `this: void` because it is passed unbound as the default `yieldBetweenBatches`
	 * (it touches no instance state), which keeps that reference off the unbound-method lint.
	 */
	static sleepZero(this: void): Promise<void> {
		return new Promise((resolve) => window.setTimeout(resolve, 0));
	}
}
