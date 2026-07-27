import { describe, expect, it } from "vitest";
import { SettingsWriteQueue } from "./settingsWriteQueue";

/**
 * A write whose completion the TEST decides. Without it these tests cannot fail:
 * two handlers with identically shaped await chains resolve FIFO anyway, so an
 * unserialized queue would look correct. The gate makes the FIRST write finish
 * last, which is exactly the interleaving the queue exists to prevent.
 */
interface GatedWrite {
	readonly run: () => Promise<void>;
	open(): void;
}

interface Harness {
	readonly queue: SettingsWriteQueue;
	/** Values in the order they actually reached the store. */
	readonly persisted: string[];
	write(value: string): () => Promise<void>;
	gatedWrite(value: string): GatedWrite;
}

function setup(): Harness {
	const queue = new SettingsWriteQueue();
	const persisted: string[] = [];
	const write =
		(value: string) =>
		async (): Promise<void> => {
			persisted.push(value);
		};
	return {
		queue,
		persisted,
		write,
		gatedWrite: (value) => {
			let open = (): void => undefined;
			const gate = new Promise<void>((resolve) => {
				open = resolve;
			});
			return {
				run: async () => {
					await gate;
					await write(value)();
				},
				open: () => open(),
			};
		},
	};
}

describe("SettingsWriteQueue ordering", () => {
	it("WHEN a second write is enqueued while the first is still in flight THEN the first has not been overtaken", async () => {
		const h = setup();
		const slowFirst = h.gatedWrite("first");
		void h.queue.enqueue(slowFirst.run);
		const second = h.queue.enqueue(h.write("second"));
		// The gate is still shut, so an unserialized queue would already have run
		// the second write here.
		expect(h.persisted).toEqual([]);
		slowFirst.open();
		await second;
	});

	it("WHEN the EARLIER write finishes slower THEN the LAST enqueued value is persisted last", async () => {
		const h = setup();
		const slowFirst = h.gatedWrite("first");
		const first = h.queue.enqueue(slowFirst.run);
		const second = h.queue.enqueue(h.write("second"));
		slowFirst.open();
		await Promise.all([first, second]);
		expect(h.persisted).toEqual(["first", "second"]);
	});
});

describe("SettingsWriteQueue failures", () => {
	it("WHEN a write rejects THEN the failure reaches ITS caller", async () => {
		const h = setup();
		await expect(h.queue.enqueue(() => Promise.reject(new Error("disk full")))).rejects.toThrow("disk full");
	});

	it("WHEN a write rejects THEN a later write still runs", async () => {
		const h = setup();
		void h.queue.enqueue(() => Promise.reject(new Error("disk full"))).catch(() => undefined);
		await h.queue.enqueue(h.write("second"));
		expect(h.persisted).toEqual(["second"]);
	});
});
