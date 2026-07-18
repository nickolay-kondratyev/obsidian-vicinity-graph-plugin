import { describe, expect, it } from "vitest";
import { asFolderPath } from "../engine";
import {
	extraImageCountText,
	hiddenOverlayText,
	linkCountBadgeText,
	orphanBreakdownTitle,
	plusNText,
	VAULT_ROOT_LABEL,
} from "./badgeText";

describe("plusNText", () => {
	it("WHEN formatting a count THEN it renders as +N", () => {
		expect(plusNText(3)).toBe("+3");
	});
});

describe("hiddenOverlayText", () => {
	it("WHEN formatting the overlay total THEN it renders as +N hidden", () => {
		expect(hiddenOverlayText(5)).toBe("+5 hidden");
	});
});

describe("extraImageCountText", () => {
	it("WHEN a node has several images THEN the badge counts those beyond the first", () => {
		expect(extraImageCountText(3)).toBe("+2");
	});

	it("WHEN a node has a single image THEN there is no badge", () => {
		expect(extraImageCountText(1)).toBeNull();
	});
});

describe("linkCountBadgeText", () => {
	it("WHEN an edge collapses several links THEN the badge shows the multiplicity", () => {
		expect(linkCountBadgeText(2)).toBe("×2");
	});

	it("WHEN an edge represents a single link THEN there is no badge", () => {
		expect(linkCountBadgeText(1)).toBeNull();
	});
});

describe("orphanBreakdownTitle", () => {
	it("WHEN formatting the breakdown THEN each folder gets its own line", () => {
		const title = orphanBreakdownTitle([
			{ folder: asFolderPath("gone"), hiddenCount: 3 },
			{ folder: asFolderPath("lost"), hiddenCount: 2 },
		]);
		expect(title).toBe("gone — 3 hidden\nlost — 2 hidden");
	});

	it("WHEN the vault root has hidden nodes THEN it is labelled instead of showing an empty path", () => {
		expect(orphanBreakdownTitle([{ folder: asFolderPath(""), hiddenCount: 1 }])).toBe(
			`${VAULT_ROOT_LABEL} — 1 hidden`,
		);
	});
});
