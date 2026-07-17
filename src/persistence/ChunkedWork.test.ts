import { describe, expect, it } from "vitest";
import { ChunkedWork } from "./ChunkedWork";

function countingYield(): { yieldFn: () => Promise<void>; count: () => number } {
	let yields = 0;
	return {
		yieldFn: async () => {
			yields += 1;
		},
		count: () => yields,
	};
}

describe("ChunkedWork.forEachChunked", () => {
	it("WHEN items are processed THEN every item is visited in order", async () => {
		const visited: number[] = [];
		await ChunkedWork.forEachChunked([1, 2, 3, 4, 5], 2, (item) => {
			visited.push(item);
		});
		expect(visited).toEqual([1, 2, 3, 4, 5]);
	});

	it("WHEN items exceed the batch size THEN the main thread is yielded between batches", async () => {
		const { yieldFn, count } = countingYield();
		// 5 items in batches of 2 → boundaries after items 2 and 4 (never after the last).
		await ChunkedWork.forEachChunked([1, 2, 3, 4, 5], 2, () => undefined, yieldFn);
		expect(count()).toBe(2);
	});

	it("WHEN items fit in one batch THEN there is no yield at all", async () => {
		const { yieldFn, count } = countingYield();
		await ChunkedWork.forEachChunked([1, 2], 2, () => undefined, yieldFn);
		expect(count()).toBe(0);
	});

	it("WHEN there are no items THEN work completes without yielding", async () => {
		const { yieldFn, count } = countingYield();
		await ChunkedWork.forEachChunked([], 3, () => undefined, yieldFn);
		expect(count()).toBe(0);
	});
});
