import { describe, expect, it } from "vitest";
import { SerialPromiseChain } from "../shared/SerialPromiseChain";
import type { DebounceScheduler } from "./settingsDebounce";
import { DebouncedSettingsWrites } from "./settingsDebounce";
import type { SerialSettingsWrites, SettingsWriter } from "./settingsWritePipeline";

const DELAY_MS = 400;

/**
 * Stands in for `SettingsWritePipeline`: a REAL {@link SerialPromiseChain} (the
 * ordering these tests care about is the chain's) plus a writer these thunks never
 * use — they record instead of persisting, so what reaches the store is the
 * pipeline's own test's business, not this one's. That side is pinned end to end by
 * "DebouncedSettingsWrites over the real pipeline" in `settingsWritePipeline.test.ts`.
 */
const UNUSED_WRITER: SettingsWriter = {
	apply: () => Promise.reject(new Error("these thunks record instead of writing")),
};

function serialWritesOverOneChain(): SerialSettingsWrites {
	const chain = new SerialPromiseChain();
	return { runSerialised: (task) => chain.run(() => task(UNUSED_WRITER)) };
}

/** Deterministic stand-in for the renderer's timer: the test decides when the window elapses. */
class FakeDebounceScheduler implements DebounceScheduler {
	private readonly callbacks = new Map<number, () => void>();
	private nextHandle = 1;

	schedule(callback: () => void, delayMs: number): number {
		expect(delayMs).toBe(DELAY_MS);
		const handle = this.nextHandle++;
		this.callbacks.set(handle, callback);
		return handle;
	}

	cancel(handle: number): void {
		this.callbacks.delete(handle);
	}

	/** Fires every timer that is still armed (at most one — the debouncer restarts a single window). */
	elapse(): void {
		const armed = [...this.callbacks.values()];
		this.callbacks.clear();
		for (const callback of armed) {
			callback();
		}
	}
}

interface Harness {
	readonly scheduler: FakeDebounceScheduler;
	readonly debounced: DebouncedSettingsWrites;
	readonly writes: string[];
	write(value: string): () => Promise<void>;
	/**
	 * Resolves once `count` writes have run. The ONLY way to await the TIMER path:
	 * awaiting `flush()` instead would drain the same pending map, so a debouncer
	 * whose window never fires would still look green. Tests using this carry a
	 * short timeout so a dead timer fails fast instead of hanging.
	 */
	written(count: number): Promise<void>;
}

function setup(): Harness {
	const scheduler = new FakeDebounceScheduler();
	const writes: string[] = [];
	const awaited: { count: number; resolve: () => void }[] = [];
	const settle = (): void => {
		for (const waiter of awaited) {
			if (writes.length >= waiter.count) {
				waiter.resolve();
			}
		}
	};
	return {
		scheduler,
		debounced: new DebouncedSettingsWrites(DELAY_MS, serialWritesOverOneChain(), scheduler),
		writes,
		write:
			(value) =>
			async (): Promise<void> => {
				writes.push(value);
				settle();
			},
		written: (count) =>
			new Promise<void>((resolve) => {
				awaited.push({ count, resolve });
				settle();
			}),
	};
}

/** A dead timer must fail these in a second, not sit on vitest's default 5s. */
const TIMER_TEST_TIMEOUT_MS = 1_000;

describe("DebouncedSettingsWrites coalescing", () => {
	it("WHEN keystrokes land inside the window THEN nothing has been written yet", () => {
		const h = setup();
		for (const value of ["1", "16", "160"]) {
			h.debounced.schedule("Maximum node size (px)", h.write(value));
		}
		expect(h.writes).toEqual([]);
	});

	it(
		"WHEN the window elapses after a burst THEN only the LAST keystroke of that field is written",
		async () => {
			const h = setup();
			for (const value of ["1", "16", "160"]) {
				h.debounced.schedule("Maximum node size (px)", h.write(value));
			}
			h.scheduler.elapse();
			// NO flush(): the settle window alone must produce the write.
			await h.written(1);
			expect(h.writes).toEqual(["160"]);
		},
		TIMER_TEST_TIMEOUT_MS,
	);

	it(
		"WHEN two fields are edited inside one window THEN both are written, in edit order",
		async () => {
			const h = setup();
			h.debounced.schedule("Minimum node size (px)", h.write("min"));
			h.debounced.schedule("Node cap", h.write("cap"));
			h.scheduler.elapse();
			await h.written(2);
			expect(h.writes).toEqual(["min", "cap"]);
		},
		TIMER_TEST_TIMEOUT_MS,
	);
});

describe("DebouncedSettingsWrites flush (no edit may be lost)", () => {
	it("WHEN flushed before the window elapses THEN the pending write still lands", async () => {
		const h = setup();
		h.debounced.schedule("Node cap", h.write("120"));
		await h.debounced.flush();
		expect(h.writes).toEqual(["120"]);
	});

	it("WHEN the window elapses after a flush THEN the flushed write is NOT repeated", async () => {
		const h = setup();
		h.debounced.schedule("Node cap", h.write("120"));
		await h.debounced.flush();
		h.scheduler.elapse();
		expect(h.writes).toEqual(["120"]);
	});

	it("WHEN there is nothing pending THEN flushing writes nothing", async () => {
		const h = setup();
		await h.debounced.flush();
		expect(h.writes).toEqual([]);
	});

	it("WHEN a write rejects THEN a later flush still runs the next write", async () => {
		const h = setup();
		h.debounced.schedule("Node cap", () => Promise.reject(new Error("disk full")));
		await expect(h.debounced.flush()).rejects.toThrow("disk full");
		h.debounced.schedule("Node cap", h.write("120"));
		await h.debounced.flush();
		expect(h.writes).toEqual(["120"]);
	});
});

describe("DebouncedSettingsWrites drop", () => {
	it("WHEN a field is dropped THEN its pending write never lands", async () => {
		const h = setup();
		h.debounced.schedule("Node cap", h.write("120"));
		h.debounced.drop("Node cap");
		await h.debounced.flush();
		expect(h.writes).toEqual([]);
	});

	it("WHEN one field is dropped THEN the other field's pending write is untouched", async () => {
		const h = setup();
		h.debounced.schedule("Node cap", h.write("cap"));
		h.debounced.schedule("Depth decay k", h.write("k"));
		h.debounced.drop("Node cap");
		await h.debounced.flush();
		expect(h.writes).toEqual(["k"]);
	});
});
