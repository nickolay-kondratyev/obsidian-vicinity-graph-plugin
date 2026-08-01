import { describe, expect, it } from "vitest";
import {
	DRAWER_MAX_CONTAINER_FRACTION,
	DRAWER_MIN_SIZE_PX,
	DrawerResizeMath,
	DrawerSizeMemory,
} from "./drawerResize";

describe("DrawerResizeMath.sizeFromPointer", () => {
	const CONTAINER = { right: 1000, bottom: 800 };

	it("WHEN dragging on the height axis THEN size is the distance from the pointer to the container bottom", () => {
		expect(DrawerResizeMath.sizeFromPointer("height", { clientX: 0, clientY: 500 }, CONTAINER)).toBe(300);
	});

	it("WHEN dragging on the width axis THEN size is the distance from the pointer to the container right edge", () => {
		expect(DrawerResizeMath.sizeFromPointer("width", { clientX: 700, clientY: 0 }, CONTAINER)).toBe(300);
	});
});

describe("DrawerResizeMath.clampSize", () => {
	it("WHEN the requested size is within bounds THEN it passes through unchanged", () => {
		expect(DrawerResizeMath.clampSize("height", 300, 800)).toBe(300);
	});

	it("WHEN the requested height is below the axis minimum THEN it clamps up to the minimum", () => {
		expect(DrawerResizeMath.clampSize("height", 10, 800)).toBe(DRAWER_MIN_SIZE_PX.height);
	});

	it("WHEN the requested width is below the axis minimum THEN it clamps up to the minimum", () => {
		expect(DrawerResizeMath.clampSize("width", 10, 800)).toBe(DRAWER_MIN_SIZE_PX.width);
	});

	it("WHEN the requested size exceeds the container fraction THEN it clamps down to that fraction", () => {
		expect(DrawerResizeMath.clampSize("height", 5000, 800)).toBe(800 * DRAWER_MAX_CONTAINER_FRACTION);
	});

	it("WHEN the container is smaller than the axis minimum THEN the minimum still wins", () => {
		expect(DrawerResizeMath.clampSize("height", 10, 50)).toBe(DRAWER_MIN_SIZE_PX.height);
	});
});

describe("DrawerSizeMemory", () => {
	it("WHEN nothing was stored THEN the snapshot has no sizes", () => {
		expect(new DrawerSizeMemory().snapshot()).toEqual({ height: undefined, width: undefined });
	});

	it("WHEN a height is stored THEN the snapshot reports it", () => {
		const memory = new DrawerSizeMemory();
		memory.set("height", 320);
		expect(memory.snapshot().height).toBe(320);
	});

	it("WHEN an axis is stored again THEN the newer size replaces the older one", () => {
		const memory = new DrawerSizeMemory();
		memory.set("width", 300);
		memory.set("width", 420);
		expect(memory.get("width")).toBe(420);
	});

	it("WHEN cleared THEN previously stored sizes are gone", () => {
		const memory = new DrawerSizeMemory();
		memory.set("height", 320);
		memory.clear();
		expect(memory.get("height")).toBeUndefined();
	});
});
