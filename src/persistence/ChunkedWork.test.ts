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

describe("ChunkedWork.forEachChunkedUntil", () => {
	it("WHEN work signals stop THEN the remaining items are never visited", async () => {
		const visited: number[] = [];
		await ChunkedWork.forEachChunkedUntil([1, 2, 3, 4, 5], 2, (item) => {
			visited.push(item);
			return item === 2;
		});
		expect(visited).toEqual([1, 2]);
	});

	it("WHEN work never signals stop THEN every item is visited in order", async () => {
		const visited: number[] = [];
		await ChunkedWork.forEachChunkedUntil([1, 2, 3], 2, (item) => {
			visited.push(item);
			return false;
		});
		expect(visited).toEqual([1, 2, 3]);
	});

	it("WHEN work stops on a batch boundary THEN there is no trailing yield", async () => {
		const { yieldFn, count } = countingYield();
		await ChunkedWork.forEachChunkedUntil([1, 2, 3, 4, 5], 2, (item) => item === 2, yieldFn);
		expect(count()).toBe(0);
	});
});
