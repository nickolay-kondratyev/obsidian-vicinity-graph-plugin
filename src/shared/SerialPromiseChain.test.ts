import { describe, expect, it } from "vitest";
import { SerialPromiseChain } from "./SerialPromiseChain";

/**
 * A task whose completion the TEST decides. Without it these tests cannot fail:
 * two tasks with identically shaped await chains resolve FIFO anyway, so an
 * unserialized chain would look correct. The gate makes the FIRST task finish
 * last, which is exactly the interleaving the chain exists to prevent.
 *
 * These cases are inherited from `settingsWriteQueue.test.ts` (the class this
 * chain replaced): ordering, rejection isolation, and the subtle one — the
 * rejection must still reach ITS OWN caller.
 */
interface GatedTask {
	readonly run: () => Promise<void>;
	open(): void;
}

interface Harness {
	readonly chain: SerialPromiseChain;
	/** Values in the order their tasks actually ran. */
	readonly ran: string[];
	task(value: string): () => Promise<void>;
	gatedTask(value: string): GatedTask;
}

function setup(): Harness {
	const chain = new SerialPromiseChain();
	const ran: string[] = [];
	const task =
		(value: string) =>
		async (): Promise<void> => {
			ran.push(value);
		};
	return {
		chain,
		ran,
		task,
		gatedTask: (value) => {
			let open = (): void => undefined;
			const gate = new Promise<void>((resolve) => {
				open = resolve;
			});
			return {
				run: async () => {
					await gate;
					await task(value)();
				},
				open: () => open(),
			};
		},
	};
}

describe("SerialPromiseChain ordering", () => {
	it("WHEN a second task is enqueued while the first is still in flight THEN the first has not been overtaken", async () => {
		const h = setup();
		const slowFirst = h.gatedTask("first");
		void h.chain.run(slowFirst.run);
		const second = h.chain.run(h.task("second"));
		// The gate is still shut, so an unserialized chain would already have run
		// the second task here.
		expect(h.ran).toEqual([]);
		slowFirst.open();
		await second;
	});

	it("WHEN the EARLIER task finishes slower THEN the LAST enqueued task runs last", async () => {
		const h = setup();
		const slowFirst = h.gatedTask("first");
		const first = h.chain.run(slowFirst.run);
		const second = h.chain.run(h.task("second"));
		slowFirst.open();
		await Promise.all([first, second]);
		expect(h.ran).toEqual(["first", "second"]);
	});
});

describe("SerialPromiseChain failures", () => {
	it("WHEN a task rejects THEN the failure reaches ITS caller", async () => {
		const h = setup();
		await expect(h.chain.run(() => Promise.reject(new Error("disk full")))).rejects.toThrow("disk full");
	});

	it("WHEN a task rejects THEN a later task still runs", async () => {
		const h = setup();
		void h.chain.run(() => Promise.reject(new Error("disk full"))).catch(() => undefined);
		await h.chain.run(h.task("second"));
		expect(h.ran).toEqual(["second"]);
	});
});

describe("SerialPromiseChain drain", () => {
	it("WHEN nothing was ever enqueued THEN draining resolves", async () => {
		await expect(setup().chain.drain()).resolves.toBeUndefined();
	});

	it("WHEN a task is enqueued WHILE an earlier one runs THEN draining waits for the later task too", async () => {
		// This is the reset-vs-click ordering the settings tab depends on: the
		// redisplay may only read the store once the chain is genuinely idle.
		const h = setup();
		const slowFirst = h.gatedTask("first");
		void h.chain.run(async () => {
			await slowFirst.run();
			void h.chain.run(h.task("enqueued-during-first"));
		});
		slowFirst.open();
		await h.chain.drain();
		expect(h.ran).toEqual(["first", "enqueued-during-first"]);
	});

	it("WHEN a task rejected THEN draining still resolves", async () => {
		const h = setup();
		void h.chain.run(() => Promise.reject(new Error("disk full"))).catch(() => undefined);
		await expect(h.chain.drain()).resolves.toBeUndefined();
	});
});
