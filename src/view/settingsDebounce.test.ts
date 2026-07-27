import { describe, expect, it } from "vitest";
import type { DebounceScheduler } from "./settingsDebounce";
import { DebouncedSettingsWrites } from "./settingsDebounce";

const DELAY_MS = 400;

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
}

function setup(): Harness {
	const scheduler = new FakeDebounceScheduler();
	const writes: string[] = [];
	return {
		scheduler,
		debounced: new DebouncedSettingsWrites(DELAY_MS, scheduler),
		writes,
		write:
			(value) =>
			async (): Promise<void> => {
				writes.push(value);
			},
	};
}

describe("DebouncedSettingsWrites coalescing", () => {
	it("WHEN keystrokes land inside the window THEN nothing has been written yet", () => {
		const h = setup();
		for (const value of ["1", "16", "160"]) {
			h.debounced.schedule("Maximum node size (px)", h.write(value));
		}
		expect(h.writes).toEqual([]);
	});

	it("WHEN the window elapses after a burst THEN only the LAST keystroke of that field is written", async () => {
		const h = setup();
		for (const value of ["1", "16", "160"]) {
			h.debounced.schedule("Maximum node size (px)", h.write(value));
		}
		h.scheduler.elapse();
		await h.debounced.flush();
		expect(h.writes).toEqual(["160"]);
	});

	it("WHEN two fields are edited inside one window THEN both are written, in edit order", async () => {
		const h = setup();
		h.debounced.schedule("Minimum node size (px)", h.write("min"));
		h.debounced.schedule("Node cap", h.write("cap"));
		h.scheduler.elapse();
		await h.debounced.flush();
		expect(h.writes).toEqual(["min", "cap"]);
	});
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
