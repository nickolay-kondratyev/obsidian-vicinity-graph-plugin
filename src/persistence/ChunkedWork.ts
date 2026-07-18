/**
 * Main-thread-friendly batch processing: async alone does NOT yield the event
 * loop, so bulk work (sweep warm-up, orphan deletion) runs in batches with an
 * explicit yield between them (step doc constraint).
 */
export class ChunkedWork {
	/**
	 * Runs `work` over every item, yielding via `yieldBetweenBatches` after
	 * each full batch (never after the last, partial or not — no trailing idle
	 * hop). `yieldBetweenBatches` is injectable so tests can count yields.
	 */
	static async forEachChunked<T>(
		items: readonly T[],
		batchSize: number,
		work: (item: T) => void | Promise<void>,
		yieldBetweenBatches: () => Promise<void> = ChunkedWork.sleepZero,
	): Promise<void> {
		for (let index = 0; index < items.length; index++) {
			const item = items[index] as T;
			await work(item);
			const batchBoundary = (index + 1) % batchSize === 0 && index + 1 < items.length;
			if (batchBoundary) {
				await yieldBetweenBatches();
			}
		}
	}

	/** `await sleep(0)` — a real macrotask hop, releasing the main thread. */
	static sleepZero(): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, 0));
	}
}
